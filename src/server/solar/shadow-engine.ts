import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon, Position } from "geojson";
import { StandardizedGeoFeature } from "../providers/types";
import { createFootprintPolygon, calculateDistanceMeters } from "../gis/geometry";
import { calculateSolarPosition } from "./solar-position";
import {
  HeightProvenance,
  BuildingObstructionFeature,
  HypotheticalBuilding,
  SolarPlacementInput,
  SimulationTimeInput,
  ShadingScenarioConfig,
  ShadingMetrics,
  ProvenanceSummary,
  SolarShadingResult,
} from "./types";

const DEFAULT_FLOOR_HEIGHT_M = 3.2; // Standard architectural ceiling + slab height (URDPFI / NBC India)
const MAX_SHADOW_LENGTH_M = 800.0; // Cutoff for near-horizon grazing incidence

/**
 * Determines building height and records its epistemic provenance.
 * Never silently assigns precise heights without documenting provenance.
 */
export function resolveBuildingHeight(
  feature: StandardizedGeoFeature,
  options?: {
    userOverrideHeightM?: number;
    defaultUnknownHeightM?: number;
  }
): {
  heightM: number;
  provenance: HeightProvenance;
  levels?: number;
  notes: string;
} {
  // 1. User manual override (what-if hypothetical scenario)
  if (typeof options?.userOverrideHeightM === "number" && options.userOverrideHeightM > 0) {
    return {
      heightM: options.userOverrideHeightM,
      provenance: "hypothetical_user",
      notes: `User-specified alternative height of ${options.userOverrideHeightM}m applied for what-if scenario testing.`,
    };
  }

  // 2. Direct measured height tag from OSM
  const rawHeight = feature.attributes.heightM ?? feature.rawTags?.height;
  if (rawHeight !== undefined) {
    const h = typeof rawHeight === "number" ? rawHeight : parseFloat(String(rawHeight));
    if (Number.isFinite(h) && h > 0) {
      return {
        heightM: Math.round(h * 10) / 10,
        provenance: "measured",
        notes: `Direct height tag from OpenStreetMap (${h}m).`,
      };
    }
  }

  // 3. Inferred height from building:levels
  const rawLevels = feature.attributes.levels ?? feature.rawTags?.["building:levels"];
  if (rawLevels !== undefined) {
    const lv = typeof rawLevels === "number" ? rawLevels : parseInt(String(rawLevels), 10);
    if (Number.isFinite(lv) && lv > 0) {
      const computedHeight = Math.round(lv * DEFAULT_FLOOR_HEIGHT_M * 10) / 10;
      return {
        heightM: computedHeight,
        provenance: "inferred_from_levels",
        levels: lv,
        notes: `Height inferred from ${lv} recorded storeys (${lv} × ${DEFAULT_FLOOR_HEIGHT_M}m/storey = ${computedHeight}m). Not a direct laser measurement.`,
      };
    }
  }

  // 4. Configurable default assumption (when user explicitly requests proxy testing)
  if (typeof options?.defaultUnknownHeightM === "number" && options.defaultUnknownHeightM > 0) {
    return {
      heightM: options.defaultUnknownHeightM,
      provenance: "default_assumption",
      notes: `Building lacks height and storey tags in OSM. Evaluated using an explicit planning proxy of ${options.defaultUnknownHeightM}m.`,
    };
  }

  // 5. Completely unavailable
  return {
    heightM: 0,
    provenance: "unavailable",
    notes: "No height or storey data available in OpenStreetMap. Excluded from 3D shadow projection to avoid fabricated geometry.",
  };
}

/**
 * Projects a 2D ground shadow polygon from a building footprint and solar position.
 * Uses trigonometric ray casting along the anti-solar azimuth vector.
 */
export function projectGroundShadow(
  footprint: Feature<Polygon | MultiPolygon>,
  heightM: number,
  solarElevationDeg: number,
  solarAzimuthDeg: number
): Feature<Polygon> | null {
  if (heightM <= 0 || solarElevationDeg <= 0) {
    return null; // Sun below horizon or zero building height produces no cast shadow
  }

  // Direction shadow is cast: opposite of solar azimuth
  const shadowAzimuthDeg = (solarAzimuthDeg + 180.0) % 360.0;

  // Shadow length on horizontal ground: L = H / tan(elevation)
  const elevationRad = solarElevationDeg * (Math.PI / 180.0);
  const tanElev = Math.tan(elevationRad);
  if (tanElev <= 1e-4) {
    return null;
  }
  const rawShadowLengthM = heightM / tanElev;
  const shadowLengthM = Math.min(rawShadowLengthM, MAX_SHADOW_LENGTH_M);

  // Extract base coordinates
  const coords: Position[] = [];
  if (footprint.geometry.type === "Polygon") {
    coords.push(...footprint.geometry.coordinates[0]);
  } else if (footprint.geometry.type === "MultiPolygon") {
    for (const poly of footprint.geometry.coordinates) {
      coords.push(...poly[0]);
    }
  }

  if (coords.length < 3) {
    return null;
  }

  // Project each vertex along the shadow vector
  const projectedRoofCoords: Position[] = [];
  for (const pt of coords) {
    const dest = turf.destination(turf.point([pt[0], pt[1]]), shadowLengthM / 1000.0, shadowAzimuthDeg, {
      units: "kilometers",
    });
    projectedRoofCoords.push(dest.geometry.coordinates);
  }

  // Form the full shadow envelope: convex hull of base points and projected roof points
  const allPoints = [...coords, ...projectedRoofCoords].map((c) => turf.point(c));
  const hull = turf.convex(turf.featureCollection(allPoints));

  if (!hull || hull.geometry.type !== "Polygon") {
    return null;
  }

  return hull as Feature<Polygon>;
}

/**
 * Calculates the geometric intersection area (m²) between a solar installation
 * footprint and one or more cast shadow polygons.
 */
export function calculateShadedAreaM2(
  solarPolygon: Feature<Polygon>,
  shadowPolygons: Feature<Polygon>[]
): {
  shadedAreaM2: number;
  unshadedAreaM2: number;
  shadedPercentage: number;
  unshadedPercentage: number;
  overlapGeom: Feature<Polygon | MultiPolygon> | null;
} {
  const totalAreaM2 = Math.round(turf.area(solarPolygon));
  if (totalAreaM2 <= 0 || shadowPolygons.length === 0) {
    return {
      shadedAreaM2: 0,
      unshadedAreaM2: totalAreaM2,
      shadedPercentage: 0,
      unshadedPercentage: 100,
      overlapGeom: null,
    };
  }

  // Filter shadows that physically intersect the solar bounding box
  const intersectingShadows: Feature<Polygon>[] = [];
  for (const shadow of shadowPolygons) {
    try {
      if (turf.booleanIntersects(solarPolygon, shadow)) {
        intersectingShadows.push(shadow);
      }
    } catch {
      // Ignore invalid geometry checks
    }
  }

  if (intersectingShadows.length === 0) {
    return {
      shadedAreaM2: 0,
      unshadedAreaM2: totalAreaM2,
      shadedPercentage: 0,
      unshadedPercentage: 100,
      overlapGeom: null,
    };
  }

  // Compute union of all intersecting shadows to prevent double-counting overlaps
  let combinedShadow: Feature<Polygon | MultiPolygon> = intersectingShadows[0];
  for (let i = 1; i < intersectingShadows.length; i++) {
    try {
      const u = turf.union(turf.featureCollection([combinedShadow, intersectingShadows[i]]));
      if (u) {
        combinedShadow = u as Feature<Polygon | MultiPolygon>;
      }
    } catch {
      // If union encounters topology errors, continue with individual intersection fallback
    }
  }

  // Intersect combined shadow with the solar installation footprint
  try {
    const intersection = turf.intersect(turf.featureCollection([solarPolygon, combinedShadow]));
    if (!intersection) {
      return {
        shadedAreaM2: 0,
        unshadedAreaM2: totalAreaM2,
        shadedPercentage: 0,
        unshadedPercentage: 100,
        overlapGeom: null,
      };
    }

    const rawShadedAreaM2 = turf.area(intersection);
    const shadedAreaM2 = Math.min(Math.round(rawShadedAreaM2), totalAreaM2);
    const unshadedAreaM2 = Math.max(0, totalAreaM2 - shadedAreaM2);
    const shadedPercentage = Math.round((shadedAreaM2 / totalAreaM2) * 1000) / 10;
    const unshadedPercentage = Math.round((100 - shadedPercentage) * 10) / 10;

    return {
      shadedAreaM2,
      unshadedAreaM2,
      shadedPercentage,
      unshadedPercentage,
      overlapGeom: intersection as Feature<Polygon | MultiPolygon>,
    };
  } catch {
    return {
      shadedAreaM2: 0,
      unshadedAreaM2: totalAreaM2,
      shadedPercentage: 0,
      unshadedPercentage: 100,
      overlapGeom: null,
    };
  }
}

/**
 * Runs the complete "Shadow-of-the-Future" future-aware solar shading simulation.
 * Compares the existing baseline built environment against user-defined hypothetical scenarios.
 */
export function simulateSolarShading(
  solarPlacement: SolarPlacementInput,
  simulationTime: SimulationTimeInput,
  surroundingFeatures: StandardizedGeoFeature[],
  scenarioConfig: ShadingScenarioConfig
): SolarShadingResult {
  const simDate = new Date(simulationTime.isoDate);
  const tzOffset = simulationTime.timezoneOffsetMinutes ?? 0;

  // 1. Calculate Astronomical Solar Position
  const solarPos = calculateSolarPosition(solarPlacement.lat, solarPlacement.lng, simDate, tzOffset);

  // 2. Generate Proposed Solar Installation Footprint
  const solarFootprint = createFootprintPolygon(
    solarPlacement.lat,
    solarPlacement.lng,
    solarPlacement.lengthM,
    solarPlacement.widthM,
    solarPlacement.bearingDeg
  );
  const totalSolarAreaM2 = Math.round(turf.area(solarFootprint));

  // 3. Filter existing surrounding buildings from geographic evidence
  const buildingFeatures = surroundingFeatures.filter(
    (f) =>
      f.category === "building" &&
      (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
  );

  // Provenance counters
  let measuredCount = 0;
  let inferredCount = 0;
  let defaultAssumedCount = 0;
  let unavailableCount = 0;

  const baselineObstructions: BuildingObstructionFeature[] = [];
  const baselineShadows: Feature<Polygon>[] = [];

  const scenarioObstructions: BuildingObstructionFeature[] = [];
  const scenarioShadows: Feature<Polygon>[] = [];

  // 4. Process existing mapped buildings
  for (const b of buildingFeatures) {
    const footprint = {
      type: "Feature" as const,
      properties: b.attributes,
      geometry: b.geometry as Polygon | MultiPolygon,
    };

    const centroid = turf.centroid(footprint);
    const bLng = centroid.geometry.coordinates[0];
    const bLat = centroid.geometry.coordinates[1];
    const distM = calculateDistanceMeters(solarPlacement.lat, solarPlacement.lng, bLat, bLng);

    // Baseline height resolution
    const baselineHeightRes = resolveBuildingHeight(b, {
      defaultUnknownHeightM: scenarioConfig.defaultUnknownBuildingHeightM,
    });

    if (baselineHeightRes.provenance === "measured") measuredCount++;
    else if (baselineHeightRes.provenance === "inferred_from_levels") inferredCount++;
    else if (baselineHeightRes.provenance === "default_assumption") defaultAssumedCount++;
    else unavailableCount++;

    // Cast baseline shadow
    let bShadow: Feature<Polygon> | null = null;
    let bIntersects = false;
    let bOverlapM2 = 0;

    if (solarPos.isDaylight && baselineHeightRes.heightM > 0) {
      bShadow = projectGroundShadow(footprint, baselineHeightRes.heightM, solarPos.elevationDeg, solarPos.azimuthDeg);
      if (bShadow) {
        baselineShadows.push(bShadow);
        try {
          if (turf.booleanIntersects(solarFootprint, bShadow)) {
            const overlap = turf.intersect(turf.featureCollection([solarFootprint, bShadow]));
            if (overlap) {
              bIntersects = true;
              bOverlapM2 = Math.round(turf.area(overlap));
            }
          }
        } catch {
          // ignore geometry overlap error
        }
      }
    }

    baselineObstructions.push({
      id: b.id,
      name: b.label || `Building ${b.id.substring(0, 8)}`,
      source: "osm_overpass",
      category: b.subCategory || "building",
      footprint,
      heightM: baselineHeightRes.heightM,
      heightProvenance: baselineHeightRes.provenance,
      levels: baselineHeightRes.levels,
      distanceToSolarM: Math.round(distM),
      shadowPolygon: bShadow || undefined,
      castsShadowOnSolar: bIntersects,
      overlapAreaM2: bOverlapM2,
      obstructionNotes: baselineHeightRes.notes,
    });

    // Scenario height resolution (may have hypothetical height variant override)
    const scenarioOverride = scenarioConfig.modifiedExistingBuildingHeights?.[b.id];
    const scenarioHeightRes = resolveBuildingHeight(b, {
      userOverrideHeightM: scenarioOverride,
      defaultUnknownHeightM: scenarioConfig.defaultUnknownBuildingHeightM,
    });

    let sShadow: Feature<Polygon> | null = null;
    let sIntersects = false;
    let sOverlapM2 = 0;

    if (scenarioConfig.includeExistingBuildings && solarPos.isDaylight && scenarioHeightRes.heightM > 0) {
      sShadow = projectGroundShadow(footprint, scenarioHeightRes.heightM, solarPos.elevationDeg, solarPos.azimuthDeg);
      if (sShadow) {
        scenarioShadows.push(sShadow);
        try {
          if (turf.booleanIntersects(solarFootprint, sShadow)) {
            const overlap = turf.intersect(turf.featureCollection([solarFootprint, sShadow]));
            if (overlap) {
              sIntersects = true;
              sOverlapM2 = Math.round(turf.area(overlap));
            }
          }
        } catch {
          // ignore geometry overlap error
        }
      }
    }

    scenarioObstructions.push({
      id: b.id,
      name: b.label || `Building ${b.id.substring(0, 8)}`,
      source: "osm_overpass",
      category: b.subCategory || "building",
      footprint,
      heightM: scenarioHeightRes.heightM,
      heightProvenance: scenarioHeightRes.provenance,
      levels: scenarioHeightRes.levels,
      distanceToSolarM: Math.round(distM),
      shadowPolygon: sShadow || undefined,
      castsShadowOnSolar: sIntersects,
      overlapAreaM2: sOverlapM2,
      obstructionNotes: scenarioHeightRes.notes,
    });
  }

  // 5. Process user-proposed hypothetical buildings (future scenarios)
  const hypotheticalCount = scenarioConfig.hypotheticalBuildings.length;
  for (const hb of scenarioConfig.hypotheticalBuildings) {
    const hbFootprint = createFootprintPolygon(hb.lat, hb.lng, hb.lengthM, hb.widthM, hb.bearingDeg || 0);
    const distM = calculateDistanceMeters(solarPlacement.lat, solarPlacement.lng, hb.lat, hb.lng);

    let hShadow: Feature<Polygon> | null = null;
    let hIntersects = false;
    let hOverlapM2 = 0;

    if (solarPos.isDaylight && hb.heightM > 0) {
      hShadow = projectGroundShadow(hbFootprint, hb.heightM, solarPos.elevationDeg, solarPos.azimuthDeg);
      if (hShadow) {
        scenarioShadows.push(hShadow);
        try {
          if (turf.booleanIntersects(solarFootprint, hShadow)) {
            const overlap = turf.intersect(turf.featureCollection([solarFootprint, hShadow]));
            if (overlap) {
              hIntersects = true;
              hOverlapM2 = Math.round(turf.area(overlap));
            }
          }
        } catch {
          // ignore geometry overlap error
        }
      }
    }

    scenarioObstructions.push({
      id: hb.id,
      name: hb.name || `Hypothetical Tower (${hb.heightM}m)`,
      source: "user_hypothetical",
      category: "hypothetical_proposal",
      footprint: hbFootprint,
      heightM: hb.heightM,
      heightProvenance: "hypothetical_user",
      distanceToSolarM: Math.round(distM),
      shadowPolygon: hShadow || undefined,
      castsShadowOnSolar: hIntersects,
      overlapAreaM2: hOverlapM2,
      obstructionNotes: hb.notes || "Hypothetical proposed structure defined for what-if future shading analysis.",
    });
  }

  // 6. Calculate baseline and scenario shading metrics
  const baselineCalc = calculateShadedAreaM2(solarFootprint, baselineShadows);
  const scenarioCalc = calculateShadedAreaM2(solarFootprint, scenarioShadows);

  const baselineMetrics: ShadingMetrics = {
    totalSolarAreaM2,
    shadedAreaM2: baselineCalc.shadedAreaM2,
    shadedPercentage: baselineCalc.shadedPercentage,
    unshadedAreaM2: baselineCalc.unshadedAreaM2,
    unshadedPercentage: baselineCalc.unshadedPercentage,
    obstructingBuildingsCount: baselineObstructions.filter((o) => o.castsShadowOnSolar).length,
    totalCastShadowsAreaM2: Math.round(
      baselineShadows.reduce((acc, s) => acc + turf.area(s), 0)
    ),
  };

  const scenarioMetrics: ShadingMetrics = {
    totalSolarAreaM2,
    shadedAreaM2: scenarioCalc.shadedAreaM2,
    shadedPercentage: scenarioCalc.shadedPercentage,
    unshadedAreaM2: scenarioCalc.unshadedAreaM2,
    unshadedPercentage: scenarioCalc.unshadedPercentage,
    obstructingBuildingsCount: scenarioObstructions.filter((o) => o.castsShadowOnSolar).length,
    totalCastShadowsAreaM2: Math.round(
      scenarioShadows.reduce((acc, s) => acc + turf.area(s), 0)
    ),
  };

  // 7. Calculate Delta
  const deltaShadedAreaM2 = scenarioMetrics.shadedAreaM2 - baselineMetrics.shadedAreaM2;
  const deltaShadedPercentage =
    Math.round((scenarioMetrics.shadedPercentage - baselineMetrics.shadedPercentage) * 10) / 10;

  let exposureImpact: "no_change" | "increased_shading" | "decreased_shading" = "no_change";
  let summaryText = "Sunlight exposure remains unchanged between existing baseline and scenario.";

  if (deltaShadedAreaM2 > 0) {
    exposureImpact = "increased_shading";
    summaryText = `Future scenario increases solar array shading by +${deltaShadedAreaM2} m² (+${deltaShadedPercentage}%), reducing unshaded exposure to ${scenarioMetrics.unshadedPercentage}%.`;
  } else if (deltaShadedAreaM2 < 0) {
    exposureImpact = "decreased_shading";
    summaryText = `Future scenario decreases shading by ${Math.abs(deltaShadedAreaM2)} m² (${Math.abs(deltaShadedPercentage)}%), increasing unshaded exposure to ${scenarioMetrics.unshadedPercentage}%.`;
  }

  // Format local time display
  const localDate = new Date(simDate.getTime() + tzOffset * 60000);
  const localTimeDisplay = `${localDate.toISOString().substring(0, 10)} ${localDate.toISOString().substring(11, 16)} (UTC${tzOffset >= 0 ? "+" : ""}${Math.floor(tzOffset / 60)}:${String(Math.abs(tzOffset % 60)).padStart(2, "0")})`;

  const provenanceSummary: ProvenanceSummary = {
    totalSurroundingBuildings: buildingFeatures.length,
    measuredCount,
    inferredCount,
    defaultAssumedCount,
    unavailableCount,
    hypotheticalCount,
  };

  const limitations = [
    "Instantaneous geometric snapshot: Evaluates direct beam obstruction at the simulated hour, not annual cumulative kilowatt-hour generation loss.",
    "Planar ground approximation: Terrain between building base and solar array is evaluated as locally flat without micro-relief 3D mesh.",
    "Hypothetical distinction: User-proposed structures are strictly hypothetical what-if simulations and do NOT represent approved or confirmed municipal master plans.",
    "Beam radiation only: Diffuse sky irradiance and ground reflection (albedo) are not modeled in geometric ray-casting.",
    "Height data uncertainty: Buildings without explicit tags rely on storey inferences or conservative default exclusions as documented.",
  ];

  return {
    simulationTime: {
      isoDate: simulationTime.isoDate,
      localTimeDisplay,
      timezoneOffsetMinutes: tzOffset,
    },
    solarPosition: solarPos,
    solarInstallationFootprint: solarFootprint,
    baseline: baselineMetrics,
    scenario: scenarioMetrics,
    delta: {
      deltaShadedAreaM2,
      deltaShadedPercentage,
      exposureImpact,
      summaryText,
    },
    obstructingBuildings: scenarioObstructions.filter((o) => o.castsShadowOnSolar),
    allShadowPolygons: scenarioShadows,
    shadedFootprintOverlap: scenarioCalc.overlapGeom,
    provenanceSummary,
    limitations,
  };
}
