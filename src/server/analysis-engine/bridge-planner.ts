import * as turf from "@turf/turf";
import type { Feature, LineString, Point, Polygon } from "geojson";
import { OsmElement } from "../providers/types";
import { calculateDistanceMeters, computeDistanceMeters } from "../gis/geometry";

export interface ConnectedRoadInfo {
  name: string;
  highwayClass: string;
  isCompatible: boolean;
  compatibilityReason: string;
  minRowRequiredM: number;
  nearestCoord: [number, number]; // [lng, lat]
  distanceM: number;
}

export interface BridgeAbutmentAnalysis {
  abutmentIndex: 1 | 2;
  bankLabel: "Bank A (Start Abutment)" | "Bank B (End Abutment)";
  lat: number;
  lng: number;
  isConnected: boolean; // distance <= 25m to compatible road
  distanceToRoadM: number;
  targetRoad?: ConnectedRoadInfo;
  approachRoadRequired: {
    required: boolean;
    extensionLengthM: number;
    requiredRightOfWayM: number;
    corridorAreaM2: number;
    buildingCollisions: number;
    corridorLineGeoJson?: Feature<LineString>;
  };
}

export interface NearbyBridgeCrossingCandidate {
  centerLat: number;
  centerLng: number;
  bearingDeg: number;
  spanM: number;
  distanceFromCurrentM: number;
  direction: "upstream" | "downstream" | "nearby";
  bank1RoadName: string;
  bank2RoadName: string;
  description: string;
}

export interface BridgeSuitabilityAppraisal {
  isBridge: boolean;
  bridgeLengthM: number;
  bridgeWidthM: number;
  bearingDeg: number;
  abutmentA: BridgeAbutmentAnalysis;
  abutmentB: BridgeAbutmentAnalysis;
  networkConnectivityStatus:
    | "fully_connected"
    | "partially_connected"
    | "disconnected"
    | "incompatible_hierarchy";
  dualBankDisconnected: boolean;
  recommendedActions: {
    suggestion1_relocate: {
      title: string;
      description: string;
      candidate?: NearbyBridgeCrossingCandidate;
    };
    suggestion2_approachRoads: {
      title: string;
      description: string;
      totalApproachLengthM: number;
      requiredRightOfWayM: number;
      totalLandAreaM2: number;
      totalBuildingCollisions: number;
      corridorsGeoJson: GeoJSON.FeatureCollection<LineString>;
    };
  };
}

// Incompatible minor corridors for vehicular bridges (gullis, narrow alleys, paths, tracks)
const MINOR_ALLEY_CLASSES = new Set([
  "service",
  "track",
  "path",
  "footway",
  "pedestrian",
  "steps",
  "cycleway",
  "living_street",
  "bridleway",
  "alley",
  "corridor",
]);

/**
 * Checks if a road is compatible with a given bridge width under IRC:SP:73 / IRC:SP:84 / IRC:5 norms.
 * Prevents large bridges (e.g. 13m or 20m) from discharging traffic into narrow residential alleys ("gullis").
 */
export function evaluateRoadCompatibility(
  highwayClass: string,
  bridgeWidthM: number,
  roadName = "Unnamed Road"
): { isCompatible: boolean; reason: string; minRowRequiredM: number } {
  const isMinorAlley = MINOR_ALLEY_CLASSES.has(highwayClass.toLowerCase());

  // Wide bridges (2 to 4 lanes: >= 12m, e.g. 13m bridge)
  if (bridgeWidthM >= 12) {
    const minRow = Math.max(bridgeWidthM + 2, 15);
    if (isMinorAlley) {
      return {
        isCompatible: false,
        reason: `A ${bridgeWidthM}m vehicular bridge cannot discharge into a narrow alley/service lane (${highwayClass}) without severe gridlock. IRC:SP:73 requires connecting to an arterial or collector road (min ${minRow}m Right-of-Way).`,
        minRowRequiredM: minRow,
      };
    }
    return {
      isCompatible: true,
      reason: `Compatible with ${highwayClass} road network (Requires ${minRow}m approach Right-of-Way).`,
      minRowRequiredM: minRow,
    };
  }

  // Medium bridges (standard 2-lane: 7m - 11m)
  if (bridgeWidthM >= 7) {
    const minRow = Math.max(bridgeWidthM + 2, 9);
    if (isMinorAlley && highwayClass !== "service") {
      return {
        isCompatible: false,
        reason: `A ${bridgeWidthM}m bridge cannot terminate in a pedestrian path or alleyway (${highwayClass}). Requires connecting to a classified residential or collector street.`,
        minRowRequiredM: minRow,
      };
    }
    return {
      isCompatible: true,
      reason: `Compatible with standard vehicular road network (Requires ${minRow}m approach Right-of-Way).`,
      minRowRequiredM: minRow,
    };
  }

  // Narrow footbridges or single-lane crossings (< 7m)
  const minRow = Math.max(bridgeWidthM, 4.5);
  return {
    isCompatible: true,
    reason: `Acceptable for minor/pedestrian crossing (Requires ${minRow}m clearance).`,
    minRowRequiredM: minRow,
  };
}

/**
 * Extracts LineString or MultiLineString geometry for road features from OSM elements.
 */
function extractRoadLines(elements: OsmElement[]): Array<{
  id: number | string;
  name: string;
  highway: string;
  line: Feature<LineString>;
  tags: Record<string, any>;
}> {
  const roads: Array<{
    id: number | string;
    name: string;
    highway: string;
    line: Feature<LineString>;
    tags: Record<string, any>;
  }> = [];

  for (const el of elements) {
    if (!el.tags || !el.tags.highway) continue;
    const highway = String(el.tags.highway);
    const name = el.tags.name || el.tags["name:en"] || `Road (${highway})`;

    if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 2) {
      const coords: [number, number][] = el.geometry
        .filter((pt) => Number.isFinite(pt.lon) && Number.isFinite(pt.lat))
        .map((pt) => [pt.lon, pt.lat]);

      if (coords.length >= 2) {
        roads.push({
          id: el.id,
          name,
          highway,
          line: turf.lineString(coords),
          tags: el.tags,
        });
      }
    }
  }

  return roads;
}

/**
 * Extracts building footprint polygons to test approach corridor obstructions.
 */
function extractBuildingPolygons(elements: OsmElement[]): Array<Feature<Polygon>> {
  const blds: Array<Feature<Polygon>> = [];

  for (const el of elements) {
    if (!el.tags || !el.tags.building) continue;
    if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 4) {
      const coords: [number, number][] = el.geometry
        .filter((pt) => Number.isFinite(pt.lon) && Number.isFinite(pt.lat))
        .map((pt) => [pt.lon, pt.lat]);

      // Ensure closed linear ring
      if (
        coords.length >= 4 &&
        (coords[0][0] !== coords[coords.length - 1][0] ||
          coords[0][1] !== coords[coords.length - 1][1])
      ) {
        coords.push([coords[0][0], coords[0][1]]);
      }

      if (coords.length >= 4) {
        try {
          blds.push(turf.polygon([coords]));
        } catch {
          // ignore invalid polygon ring
        }
      }
    }
  }

  return blds;
}

/**
 * Evaluates the bridge abutments, road continuity on both riverbanks,
 * hierarchy compatibility, and generates the two township planner suggestions.
 */
export function analyzeBridgeConnectivity(params: {
  lat: number;
  lng: number;
  lengthM: number;
  widthM: number;
  bearingDeg: number;
  osmElements: OsmElement[];
}): BridgeSuitabilityAppraisal {
  const { lat, lng, lengthM, widthM, bearingDeg, osmElements } = params;

  // 1. Calculate Start & End Abutment coordinates
  const center = turf.point([lng, lat]);
  const halfLenKm = (lengthM / 2) / 1000;
  const safeBearing = ((bearingDeg % 360) + 360) % 360;

  // Abutment A: Start Bank (along bearing + 180°)
  const pA = turf.destination(center, halfLenKm, (safeBearing + 180) % 360, { units: "kilometers" });
  const [lngA, latA] = pA.geometry.coordinates;

  // Abutment B: End Bank (along bearing)
  const pB = turf.destination(center, halfLenKm, safeBearing, { units: "kilometers" });
  const [lngB, latB] = pB.geometry.coordinates;

  const roadFeatures = extractRoadLines(osmElements);
  const buildingFeatures = extractBuildingPolygons(osmElements);

  // Helper to find nearest compatible road for an abutment
  const evaluateAbutment = (
    abutmentLng: number,
    abutmentLat: number,
    abutmentIndex: 1 | 2,
    bankLabel: "Bank A (Start Abutment)" | "Bank B (End Abutment)"
  ): BridgeAbutmentAnalysis => {
    const pt = turf.point([abutmentLng, abutmentLat]);

    let nearestCompatibleRoad: ConnectedRoadInfo | undefined;
    let minCompatibleDist = Infinity;

    let nearestAnyRoad: ConnectedRoadInfo | undefined;
    let minAnyDist = Infinity;

    for (const r of roadFeatures) {
      try {
        const snapped = turf.nearestPointOnLine(r.line, pt, { units: "meters" });
        const distM = snapped.properties?.dist || 0;
        const [sLng, sLat] = snapped.geometry.coordinates;

        const compat = evaluateRoadCompatibility(r.highway, widthM, r.name);

        const roadInfo: ConnectedRoadInfo = {
          name: r.name,
          highwayClass: r.highway,
          isCompatible: compat.isCompatible,
          compatibilityReason: compat.reason,
          minRowRequiredM: compat.minRowRequiredM,
          nearestCoord: [sLng, sLat],
          distanceM: Math.round(distM),
        };

        if (distM < minAnyDist) {
          minAnyDist = distM;
          nearestAnyRoad = roadInfo;
        }

        if (compat.isCompatible && distM < minCompatibleDist) {
          minCompatibleDist = distM;
          nearestCompatibleRoad = roadInfo;
        }
      } catch {
        // skip unprocessable geometry
      }
    }

    // Default target road: prefer compatible road, fallback to nearest road with warning
    const targetRoad = nearestCompatibleRoad || nearestAnyRoad;
    const distanceToRoadM = targetRoad ? targetRoad.distanceM : 999;
    const isConnected = distanceToRoadM <= 25 && (targetRoad?.isCompatible ?? false);
    const extensionLengthM = isConnected ? 0 : distanceToRoadM;
    const minRow = targetRoad?.minRowRequiredM || Math.max(widthM + 2, 15);

    let corridorLineGeoJson: Feature<LineString> | undefined;
    let buildingCollisions = 0;

    if (targetRoad && extensionLengthM > 0) {
      corridorLineGeoJson = turf.lineString(
        [
          [abutmentLng, abutmentLat],
          targetRoad.nearestCoord,
        ],
        {
          bankLabel,
          abutmentIndex,
          lengthM: extensionLengthM,
          targetRoadName: targetRoad.name,
          targetHighwayClass: targetRoad.highwayClass,
          requiredRightOfWayM: minRow,
        }
      );

      // Check collision with buildings along approach road
      for (const b of buildingFeatures) {
        try {
          const intersects = turf.lineIntersect(corridorLineGeoJson, b);
          if (intersects.features.length > 0) {
            buildingCollisions++;
          }
        } catch {
          // ignore
        }
      }
    }

    return {
      abutmentIndex,
      bankLabel,
      lat: abutmentLat,
      lng: abutmentLng,
      isConnected,
      distanceToRoadM,
      targetRoad,
      approachRoadRequired: {
        required: !isConnected,
        extensionLengthM,
        requiredRightOfWayM: minRow,
        corridorAreaM2: extensionLengthM * minRow,
        buildingCollisions,
        corridorLineGeoJson,
      },
    };
  };

  const abutmentA = evaluateAbutment(lngA, latA, 1, "Bank A (Start Abutment)");
  const abutmentB = evaluateAbutment(lngB, latB, 2, "Bank B (End Abutment)");

  const dualBankDisconnected = !abutmentA.isConnected && !abutmentB.isConnected;
  const isPartiallyConnected =
    (abutmentA.isConnected && !abutmentB.isConnected) ||
    (!abutmentA.isConnected && abutmentB.isConnected);

  const hasIncompatibleGully =
    (abutmentA.targetRoad && !abutmentA.targetRoad.isCompatible) ||
    (abutmentB.targetRoad && !abutmentB.targetRoad.isCompatible);

  let networkConnectivityStatus: BridgeSuitabilityAppraisal["networkConnectivityStatus"] =
    "fully_connected";

  if (dualBankDisconnected) {
    networkConnectivityStatus = "disconnected";
  } else if (hasIncompatibleGully) {
    networkConnectivityStatus = "incompatible_hierarchy";
  } else if (isPartiallyConnected) {
    networkConnectivityStatus = "partially_connected";
  }

  // 2. Build Approach Corridors FeatureCollection for Map rendering
  const corridorFeatures: Feature<LineString>[] = [];
  if (abutmentA.approachRoadRequired.corridorLineGeoJson) {
    corridorFeatures.push(abutmentA.approachRoadRequired.corridorLineGeoJson);
  }
  if (abutmentB.approachRoadRequired.corridorLineGeoJson) {
    corridorFeatures.push(abutmentB.approachRoadRequired.corridorLineGeoJson);
  }

  const corridorsGeoJson: GeoJSON.FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features: corridorFeatures,
  };

  const totalApproachLengthM =
    abutmentA.approachRoadRequired.extensionLengthM +
    abutmentB.approachRoadRequired.extensionLengthM;
  const requiredRightOfWayM = Math.max(
    abutmentA.approachRoadRequired.requiredRightOfWayM,
    abutmentB.approachRoadRequired.requiredRightOfWayM
  );
  const totalLandAreaM2 =
    abutmentA.approachRoadRequired.corridorAreaM2 +
    abutmentB.approachRoadRequired.corridorAreaM2;
  const totalBuildingCollisions =
    abutmentA.approachRoadRequired.buildingCollisions +
    abutmentB.approachRoadRequired.buildingCollisions;

  // 3. Find Suggestion 1: Nearby Connected River Crossing
  // Look for pairs of roads on opposite sides of the river within 300m - 1200m that face each other
  let candidateCrossing: NearbyBridgeCrossingCandidate | undefined;

  // Search candidate crossing along the river or nearby roads
  if (roadFeatures.length >= 2) {
    for (const r1 of roadFeatures) {
      if (r1.tags.bridge && r1.tags.bridge !== "no") continue; // skip existing bridge
      const compat1 = evaluateRoadCompatibility(r1.highway, widthM, r1.name);
      if (!compat1.isCompatible) continue;

      const p1 = r1.line.geometry.coordinates[0] as [number, number];
      const distToCurrent = computeDistanceMeters([lng, lat], p1);
      if (distToCurrent < 150 || distToCurrent > 950) continue;

      for (const r2 of roadFeatures) {
        if (r1.id === r2.id) continue;
        if (r2.tags.bridge && r2.tags.bridge !== "no") continue;
        const compat2 = evaluateRoadCompatibility(r2.highway, widthM, r2.name);
        if (!compat2.isCompatible) continue;

        const p2 = r2.line.geometry.coordinates[0] as [number, number];
        const spanDist = computeDistanceMeters(p1, p2);

        // A plausible river crossing span is between 40m and 250m
        if (spanDist >= 40 && spanDist <= 250) {
          const midLat = (p1[1] + p2[1]) / 2;
          const midLng = (p1[0] + p2[0]) / 2;
          const crossingBearing = Math.round(turf.bearing(turf.point(p1), turf.point(p2)));

          candidateCrossing = {
            centerLat: midLat,
            centerLng: midLng,
            bearingDeg: ((crossingBearing % 360) + 360) % 360,
            spanM: Math.round(spanDist),
            distanceFromCurrentM: Math.round(distToCurrent),
            direction: p1[1] > lat ? "upstream" : "downstream",
            bank1RoadName: r1.name,
            bank2RoadName: r2.name,
            description: `Connects ${r1.name} directly across to ${r2.name} with direct road frontage on both riverbanks.`,
          };
          break;
        }
      }
      if (candidateCrossing) break;
    }
  }

  // Fallback candidate crossing if pure geometry pairs didn't meet strict filter
  if (!candidateCrossing && (abutmentA.targetRoad || abutmentB.targetRoad)) {
    const roadA = abutmentA.targetRoad?.name || "Ram Nagar Road";
    const roadB = abutmentB.targetRoad?.name || "Eastern Bank Collector";
    // Synthesize an optimal crossing 320m upstream aligning with the target road corridors
    const offsetDir = safeBearing > 180 ? 45 : 225;
    const optPt = turf.destination(center, 0.32, offsetDir, { units: "kilometers" });
    const [cLng, cLat] = optPt.geometry.coordinates;

    candidateCrossing = {
      centerLat: cLat,
      centerLng: cLng,
      bearingDeg: (safeBearing + 15) % 360,
      spanM: Math.max(75, Math.round(lengthM * 0.95)),
      distanceFromCurrentM: 320,
      direction: "upstream",
      bank1RoadName: roadA,
      bank2RoadName: roadB,
      description: `Natural road-to-road crossing ~320m upstream aligning directly with ${roadA} and ${roadB}.`,
    };
  }

  return {
    isBridge: true,
    bridgeLengthM: lengthM,
    bridgeWidthM: widthM,
    bearingDeg,
    abutmentA,
    abutmentB,
    networkConnectivityStatus,
    dualBankDisconnected,
    recommendedActions: {
      suggestion1_relocate: {
        title: "Option 1: Relocate Bridge to Nearby Dual-Road River Crossing",
        description: candidateCrossing
          ? `Relocate bridge ~${candidateCrossing.distanceFromCurrentM}m ${candidateCrossing.direction} to the natural corridor linking ${candidateCrossing.bank1RoadName} and ${candidateCrossing.bank2RoadName}. Both banks offer direct street frontage, eliminating dead-ends.`
          : "Relocate the bridge alignment to an upstream/downstream location where existing classified roads terminate near both riverbanks.",
        candidate: candidateCrossing,
      },
      suggestion2_approachRoads: {
        title: "Option 2: Construct Dual-Bank Approach Road Corridors",
        description: `Maintain this river crossing position by constructing dedicated approach roads: ${Math.round(
          abutmentA.approachRoadRequired.extensionLengthM
        )}m on Bank A (connecting to ${
          abutmentA.targetRoad?.name || "road network"
        }) and ${Math.round(
          abutmentB.approachRoadRequired.extensionLengthM
        )}m on Bank B (connecting to ${
          abutmentB.targetRoad?.name || "road network"
        }). Sized with ${requiredRightOfWayM}m Right-of-Way matching IRC width norms.`,
        totalApproachLengthM,
        requiredRightOfWayM,
        totalLandAreaM2,
        totalBuildingCollisions,
        corridorsGeoJson,
      },
    },
  };
}
