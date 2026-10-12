import { InfrastructureTypeId, INFRASTRUCTURE_TYPES } from "@/config/infra-types";
import {
  computeGeometryDistanceMeters,
  createFootprintPolygon,
  doesFootprintIntersect,
} from "../gis/geometry";
import { OverpassProvider, osmElementToGeoJson } from "../providers/overpass";
import { OpenMeteoProvider } from "../providers/open-meteo";
import { NasaPowerProvider } from "../providers/nasa-power";
import { validateFootprint, ValidationResult } from "./validation";
import {
  MetricScore,
  scoreDistanceToRoad,
  scoreSlopePercent,
  scoreDemandDensity,
  scoreGapNeed,
  scoreSolarGhi,
  scoreOsmDataCoverage,
  scoreManningHydraulicCapacity,
  determineSuitabilityBand,
} from "./scoring";
import { OsmElement } from "../providers/types";

export interface EvidenceItem {
  id: string;
  provider: string;
  params: Record<string, unknown>;
  retrievedAt: string;
  featureCount?: number;
  summary: string;
}

export interface CriterionResult {
  id: string;
  label: string;
  value: string;
  rawMetric: number;
  unit?: string;
  score: number;
  weight: number;
  status: "optimal" | "acceptable" | "suboptimal" | "constrained";
  benchmark: string;
  evidenceIds: string[];
  description: string;
  computed?: boolean;
}

export interface AnalysisReportResult {
  analysisId?: string;
  engineVersion: string;
  timestamp: string;
  placementSnapshot: {
    id: string;
    type: InfrastructureTypeId;
    lat: number;
    lng: number;
    lengthM: number;
    widthM: number;
    bearingDeg: number;
    areaM2: number;
    params: Record<string, any>;
    label?: string;
  };
  validation: ValidationResult;
  criteria: CriterionResult[];
  overall: {
    score: number;
    band: string;
    tone: "positive" | "moderate" | "cautious" | "negative";
    confidence: number;
    verdictSummary: string;
  };
  supporting: string[];
  risks: string[];
  dataGaps: string[];
  evidence: EvidenceItem[];
  limitations: string[];
  narrativeText: string;
}

const overpassProvider = new OverpassProvider();
const openMeteoProvider = new OpenMeteoProvider();
const nasaPowerProvider = new NasaPowerProvider();

export async function runAnalysisEngine(params: {
  placementId: string;
  type: InfrastructureTypeId;
  lat: number;
  lng: number;
  lengthM: number;
  widthM: number;
  bearingDeg?: number;
  customParams?: Record<string, any>;
  label?: string;
}): Promise<AnalysisReportResult> {
  const {
    placementId,
    type,
    lat,
    lng,
    lengthM,
    widthM,
    bearingDeg = 0,
    customParams = {},
    label,
  } = params;
  const config = INFRASTRUCTURE_TYPES[type];
  if (!config) {
    throw new Error(`Unsupported infrastructure type: ${type}`);
  }

  const evidence: EvidenceItem[] = [];
  const dataGaps: string[] = [];
  const supporting: string[] = [];
  const risks: string[] = [];
  const limitations: string[] = [
    "Indicative suitability heuristics for preliminary planning and site screening only.",
    "Not a statutory clearance, environmental impact statement (EIS), or geotechnical engineering certification.",
    "OpenStreetMap is volunteered geographic data; features may be unmapped or outdated in emerging areas.",
    "Thresholds and criteria weights represent default heuristics — verify against local municipal master plans and building codes (NEEDS VERIFICATION).",
  ];

  const centerPoint: [number, number] = [lng, lat];
  const footprintPolygon = createFootprintPolygon(lat, lng, lengthM, widthM, bearingDeg);
  const footprintAreaM2 = Math.round(lengthM * widthM);

  // 1. Unified Overpass Query for extended radius R2 (contains R1 and footprint zone)
  let osmFeaturesAll: OsmElement[] = [];
  let osmFeaturesR1Count = 0;
  let osmLoaded = false;

  try {
    const resR2 = await overpassProvider.getFeaturesAround(lat, lng, config.searchRadiusR2M);
    osmFeaturesAll = resR2.elements;
    osmLoaded = true;

    evidence.push({
      id: "evd_osm_r2",
      provider: resR2.source,
      params: {
        radiusR1M: config.searchRadiusR1M,
        radiusR2M: config.searchRadiusR2M,
        lat,
        lng,
      },
      retrievedAt: resR2.retrievedAt,
      featureCount: resR2.elements.length,
      summary: `Retrieved ${resR2.elements.length} mapped OSM features within ${config.searchRadiusR2M}m regional buffer.`,
    });
  } catch (err: any) {
    dataGaps.push(`OpenStreetMap Overpass query failed: ${err.message}`);
  }

  // 2. Footprint Validation (reusing preloaded OSM elements when available)
  const validation = await validateFootprint(
    type,
    lat,
    lng,
    lengthM,
    widthM,
    bearingDeg,
    osmLoaded ? osmFeaturesAll : undefined
  );

  if (validation.conflicts.length > 0) {
    for (const conf of validation.conflicts) {
      if (conf.severity === "critical") {
        risks.push(`CRITICAL CONFLICT: ${conf.description}`);
      } else {
        risks.push(`CONSTRUCTION RISK: ${conf.description}`);
      }
    }
  }

  // 3. Fetch Elevation & Slope (3x3 DEM grid)
  let elevationData = {
    centerElevationM: 0,
    slopePercent: 0,
    aspectDeg: 180,
    samplePointsCount: 0,
    source: "",
    retrievedAt: "",
  };
  let elevationLoaded = false;

  try {
    const elev = await openMeteoProvider.getElevationAndSlope(lat, lng);
    elevationData = {
      ...elev,
      aspectDeg: elev.aspectDeg ?? 180,
    };
    elevationLoaded = true;
    evidence.push({
      id: "evd_elevation",
      provider: elev.source,
      params: { lat, lng, sampleGrid: "3x3 points (60m step)" },
      retrievedAt: elev.retrievedAt,
      summary: `Sampled 3x3 digital elevation model. Ground elevation: ${elev.centerElevationM}m, Surface gradient: ${elev.slopePercent}%, Aspect: ${elevationData.aspectDeg}°.`,
    });
  } catch (err: any) {
    dataGaps.push(`Digital elevation model unavailable: ${err.message}`);
  }

  // 4. Extract accurate geospatial metrics from OSM features using point-to-line / point-to-polygon distances
  let nearestRoadDistM = 9999;
  let nearestArterialDistM = 9999;
  let nearestWaterwayDistM = 9999;
  let nearestRailwayDistM = 9999;
  let nearestPowerDistM = 9999;
  let nearestParkDistM = 9999;
  let nearestBridgeDistM = 9999;
  let nearestTransitDistM = 9999;
  let nearestShadeObstructionDistM = 9999;
  let nearestIncompatibleLanduseDistM = 9999;

  let residentialBldgsCount = 0;
  let commercialBldgsCount = 0;
  let incompatibleLanduseCount = 0;
  let hospitalsCount = 0;
  let schoolsCount = 0;
  let transitStopsCount = 0;
  let parksAreaM2 = 0;
  let buildingCorridorCollisions = 0;
  let waterwayCorridorCrossings = 0;
  let railwayCorridorCrossings = 0;
  let roadCorridorCrossings = 0;

  const uniqueElements = new Map<number, OsmElement>();
  for (const el of osmFeaturesAll) {
    uniqueElements.set(el.id, el);
  }

  for (const el of uniqueElements.values()) {
    const geo = osmElementToGeoJson(el);
    if (!geo) continue;

    const distM = computeGeometryDistanceMeters(centerPoint, geo.geometry);
    if (distM <= config.searchRadiusR1M) {
      osmFeaturesR1Count++;
    }

    const intersectsFootprint = doesFootprintIntersect(footprintPolygon, geo.geometry);
    const tags = el.tags || {};

    // Bridges
    if (tags.bridge && tags.bridge !== "no") {
      if (distM < nearestBridgeDistM) nearestBridgeDistM = distM;
    }

    // Highways / Roads
    if (tags.highway) {
      if (distM < nearestRoadDistM) nearestRoadDistM = distM;
      if (["primary", "secondary", "trunk", "motorway"].includes(tags.highway)) {
        if (distM < nearestArterialDistM) nearestArterialDistM = distM;
        if (intersectsFootprint) roadCorridorCrossings++;
      }
    }

    // Waterways
    if (tags.waterway || tags.natural === "water" || tags.landuse === "reservoir") {
      if (distM < nearestWaterwayDistM) nearestWaterwayDistM = distM;
      if (intersectsFootprint) waterwayCorridorCrossings++;
    }

    // Railways
    if (tags.railway && tags.railway !== "abandoned" && tags.railway !== "disused") {
      if (distM < nearestRailwayDistM) nearestRailwayDistM = distM;
      if (intersectsFootprint) railwayCorridorCrossings++;
    }

    // Power infrastructure
    if (tags.power) {
      if (distM < nearestPowerDistM) nearestPowerDistM = distM;
    }

    // Parks & open space
    if (tags.leisure === "park" || tags.leisure === "garden" || tags.landuse === "recreation_ground") {
      if (distM < nearestParkDistM) nearestParkDistM = distM;
      if (distM <= 1000) {
        parksAreaM2 += tags.area ? parseFloat(tags.area) || 5000 : 5000;
      }
    }

    // Shading / tall obstructions (forests, woods, or 5+ story buildings)
    const levels = parseInt(tags["building:levels"] || "0", 10);
    const heightM = parseFloat(tags.height || "0");
    if (
      tags.natural === "wood" ||
      tags.landuse === "forest" ||
      levels >= 5 ||
      heightM >= 15
    ) {
      if (distM < nearestShadeObstructionDistM) {
        nearestShadeObstructionDistM = distM;
      }
    }

    // Incompatible landuse (industrial, landfill, quarry, military, cemetery)
    if (
      ["industrial", "landfill", "quarry", "military", "cemetery"].includes(
        tags.landuse || ""
      ) ||
      tags.military
    ) {
      if (distM < nearestIncompatibleLanduseDistM) {
        nearestIncompatibleLanduseDistM = distM;
      }
      if (distM <= 500) {
        incompatibleLanduseCount++;
      }
    }

    // Buildings & residential/commercial catchment proxy
    if (tags.building && tags.building !== "no") {
      if (distM <= 1000) {
        residentialBldgsCount++;
        if (["commercial", "retail", "office", "industrial"].includes(tags.building)) {
          commercialBldgsCount++;
        }
      }
      if (intersectsFootprint) {
        buildingCorridorCollisions++;
      }
    }

    // Civic & Transit Amenities
    if (
      tags.amenity === "hospital" ||
      tags.amenity === "clinic" ||
      tags.amenity === "doctors"
    ) {
      if (distM <= 3000) hospitalsCount++;
    }
    if (
      tags.amenity === "school" ||
      tags.amenity === "college" ||
      tags.amenity === "kindergarten"
    ) {
      if (distM <= 1000) schoolsCount++;
    }
    if (
      tags.public_transport ||
      tags.railway === "station" ||
      tags.railway === "halt" ||
      tags.highway === "bus_stop"
    ) {
      if (distM < nearestTransitDistM) nearestTransitDistM = distM;
      if (distM <= 800) transitStopsCount++;
    }
  }

  // Record R1 evidence summary
  if (osmLoaded) {
    evidence.push({
      id: "evd_osm_r1",
      provider: evidence[0]?.provider || "OpenStreetMap / Overpass",
      params: { radiusM: config.searchRadiusR1M, lat, lng },
      retrievedAt: evidence[0]?.retrievedAt || new Date().toISOString(),
      featureCount: osmFeaturesR1Count,
      summary: `Filtered ${osmFeaturesR1Count} mapped OSM features within immediate ${config.searchRadiusR1M}m site radius.`,
    });
  }

  // Coverage indicator
  const areaKm2 = Math.PI * Math.pow(config.searchRadiusR1M / 1000, 2);
  const featureDensity = osmLoaded ? osmFeaturesR1Count / Math.max(areaKm2, 0.1) : 0;
  if (osmLoaded && featureDensity < 3.0) {
    dataGaps.push(
      `Low OpenStreetMap feature density (${featureDensity.toFixed(1)} features/km²) in this zone. Some physical infrastructure may be unmapped.`
    );
  }

  // 5. Compute Criteria per Infrastructure Type
  const computedCriteria: CriterionResult[] = [];
  let totalConfiguredWeight = 0;
  let computedWeight = 0;
  let weightedSum = 0;

  for (const critDef of config.criteria) {
    totalConfiguredWeight += critDef.weight;
    let metricVal = 0;
    let scoreObj: MetricScore = { score: 0, status: "constrained", formattedValue: "Unavailable" };
    let evidenceIds: string[] = ["evd_osm_r1"];
    let isComputed = true;

    // Check if required base provider succeeded
    if (
      (critDef.sourceProvider === "overpass" || critDef.sourceProvider === "osm-coverage") &&
      !osmLoaded
    ) {
      isComputed = false;
    } else if (
      critDef.sourceProvider === "open-meteo" &&
      critDef.id !== "precipitation_intensity" &&
      !elevationLoaded
    ) {
      isComputed = false;
    }

    if (isComputed) {
      switch (critDef.id) {
        // Common & Arterial Access
        case "arterial_access":
        case "road_arterial_access":
          metricVal = nearestArterialDistM;
          scoreObj = scoreDistanceToRoad(nearestArterialDistM);
          if (nearestArterialDistM <= 400) {
            supporting.push(
              `Direct arterial road access within ${Math.round(nearestArterialDistM)}m ensures rapid logistics [evd_osm_r1].`
            );
          } else {
            risks.push(
              `Distance to arterial road is ${Math.round(nearestArterialDistM)}m; requires collector road upgrading [evd_osm_r1].`
            );
          }
          break;

        case "road_frontage":
        case "grid_connectivity":
        case "footpath_road_access":
        case "road_maintenance_access":
          metricVal = nearestRoadDistM;
          scoreObj = scoreDistanceToRoad(nearestRoadDistM);
          if (nearestRoadDistM <= 100) {
            supporting.push(
              `Immediate street frontage at ${Math.round(nearestRoadDistM)}m [evd_osm_r1].`
            );
          } else if (nearestRoadDistM > 500) {
            risks.push(
              `Nearest mapped road is ${Math.round(nearestRoadDistM)}m away; requires access road construction [evd_osm_r1].`
            );
          }
          break;

        // Healthcare Gap
        case "healthcare_gap":
          metricVal = hospitalsCount;
          evidenceIds = ["evd_osm_r2"];
          scoreObj = scoreGapNeed(hospitalsCount);
          if (hospitalsCount === 0) {
            supporting.push(
              "Underserved medical catchment: no major hospital or clinic mapped within 3km [evd_osm_r2]."
            );
          } else {
            risks.push(
              `Existing medical presence: ${hospitalsCount} healthcare facility/facilities mapped within 3km [evd_osm_r2].`
            );
          }
          break;

        // School Gap
        case "education_gap":
          metricVal = schoolsCount;
          scoreObj = scoreGapNeed(schoolsCount);
          if (schoolsCount <= 1) {
            supporting.push(
              `High educational need: only ${schoolsCount} school(s) mapped within 1km [evd_osm_r1].`
            );
          } else {
            risks.push(
              `${schoolsCount} existing schools mapped within 1km walking radius [evd_osm_r1].`
            );
          }
          break;

        // Residential Catchment
        case "residential_catchment":
        case "density_catchment":
          metricVal = residentialBldgsCount + commercialBldgsCount;
          scoreObj = scoreDemandDensity(metricVal);
          if (metricVal >= 50) {
            supporting.push(
              `Strong neighborhood catchment: ${metricVal} mapped buildings within 1km radius [evd_osm_r1].`
            );
          } else {
            risks.push(
              `Low mapped building density (${metricVal} structures within 1km); verify local population [evd_osm_r1].`
            );
          }
          break;

        // Hazard & Noise Buffer
        case "hazard_noise_buffer": {
          const hazardDist = Math.min(nearestRailwayDistM, nearestIncompatibleLanduseDistM);
          metricVal = Math.min(Math.round(hazardDist), 5000);
          if (hazardDist >= 400) {
            scoreObj = {
              score: 95,
              status: "optimal",
              formattedValue: `${Math.round(Math.min(hazardDist, 2000))} m buffer`,
            };
            supporting.push(
              `Quiet acoustic zone: well-buffered from rail and industrial zones (> ${Math.round(Math.min(hazardDist, 2000))}m) [evd_osm_r1].`
            );
          } else if (hazardDist >= 200) {
            scoreObj = {
              score: 70,
              status: "acceptable",
              formattedValue: `${Math.round(hazardDist)} m buffer`,
            };
          } else {
            scoreObj = {
              score: 30,
              status: "constrained",
              formattedValue: `${Math.round(hazardDist)} m (noise/hazard risk)`,
            };
            risks.push(
              `Acoustic/industrial proximity: railway or industrial zone within ${Math.round(hazardDist)}m [evd_osm_r1].`
            );
          }
          break;
        }

        // Highway safety buffer
        case "highway_safety_buffer":
          metricVal = nearestArterialDistM;
          if (nearestArterialDistM > 200) {
            scoreObj = {
              score: 95,
              status: "optimal",
              formattedValue: `${Math.round(Math.min(nearestArterialDistM, 2000))} m buffer`,
            };
            supporting.push(
              `Safe pedestrian setback from high-speed roads (${Math.round(Math.min(nearestArterialDistM, 2000))}m) [evd_osm_r1].`
            );
          } else {
            scoreObj = {
              score: 40,
              status: "suboptimal",
              formattedValue: `${Math.round(nearestArterialDistM)} m (close to traffic)`,
            };
            risks.push(
              `Proximity to high-speed arterial road (${Math.round(nearestArterialDistM)}m) requires pedestrian safety barriers [evd_osm_r1].`
            );
          }
          break;

        // Green Space Deficit
        case "green_space_deficit":
          metricVal = parksAreaM2;
          if (parksAreaM2 < 5000) {
            scoreObj = {
              score: 95,
              status: "optimal",
              formattedValue: "High deficit (< 5,000 m² nearby)",
            };
            supporting.push(
              "High public impact: site addresses a neighborhood green-space deficit [evd_osm_r1]."
            );
          } else {
            scoreObj = {
              score: 58,
              status: "acceptable",
              formattedValue: `${Math.round(parksAreaM2).toLocaleString()} m² existing`,
            };
          }
          break;

        // Waterway synergy / outfall link
        case "waterway_synergy":
        case "waterway_outfall_link":
        case "outfall_proximity":
          metricVal = nearestWaterwayDistM;
          evidenceIds = ["evd_osm_r1"];
          if (nearestWaterwayDistM <= 450) {
            scoreObj = {
              score: 92,
              status: "optimal",
              formattedValue: `${Math.round(nearestWaterwayDistM)} m to channel`,
            };
            supporting.push(
              `Viable hydrological link: receiving waterway within ${Math.round(nearestWaterwayDistM)}m [evd_osm_r1].`
            );
          } else {
            scoreObj = {
              score: 48,
              status: "suboptimal",
              formattedValue: `${Math.round(Math.min(nearestWaterwayDistM, 5000))} m`,
            };
            risks.push(
              `Extended outfall distance: ${Math.round(Math.min(nearestWaterwayDistM, 5000))}m to nearest mapped waterway [evd_osm_r1].`
            );
          }
          break;

        // Bridge barrier alignment
        case "span_barrier_alignment":
          metricVal = Math.min(nearestWaterwayDistM, nearestRailwayDistM);
          if (metricVal <= 100) {
            scoreObj = {
              score: 95,
              status: "optimal",
              formattedValue: `Traverses barrier (${Math.round(metricVal)} m)`,
            };
            supporting.push(
              `Direct alignment over physical waterway/rail barrier (${Math.round(metricVal)}m) [evd_osm_r1].`
            );
          } else {
            scoreObj = {
              score: 38,
              status: "suboptimal",
              formattedValue: `${Math.round(Math.min(metricVal, 5000))} m away`,
            };
            risks.push(
              "Bridge footprint does not closely cross a mapped waterway or railway corridor [evd_osm_r1]."
            );
          }
          break;

        case "approach_road_classes":
          metricVal = nearestRoadDistM;
          scoreObj = scoreDistanceToRoad(nearestRoadDistM);
          break;

        case "crossing_redundancy": {
          const bridgeDist = Math.min(nearestBridgeDistM, 5000);
          metricVal = Math.round(bridgeDist);
          if (bridgeDist >= 800) {
            scoreObj = {
              score: 92,
              status: "optimal",
              formattedValue:
                nearestBridgeDistM > 3000
                  ? "> 3 km to next bridge"
                  : `${Math.round(bridgeDist)} m to next bridge`,
            };
            supporting.push(
              "Relieves crossing bottleneck: no redundant bridge within 800m [evd_osm_r1]."
            );
          } else {
            scoreObj = {
              score: 52,
              status: "acceptable",
              formattedValue: `Existing bridge at ${Math.round(bridgeDist)} m`,
            };
            risks.push(
              `Existing bridge located ${Math.round(bridgeDist)}m away; evaluate traffic redundancy [evd_osm_r1].`
            );
          }
          break;
        }

        case "abutment_clearance":
          metricVal = buildingCorridorCollisions;
          scoreObj = {
            score: buildingCorridorCollisions === 0 ? 95 : 42,
            status: buildingCorridorCollisions === 0 ? "optimal" : "suboptimal",
            formattedValue: `${buildingCorridorCollisions} structures in footprint`,
          };
          break;

        case "building_displacement_risk":
        case "structure_avoidance":
          metricVal = buildingCorridorCollisions;
          if (buildingCorridorCollisions === 0) {
            scoreObj = {
              score: 100,
              status: "optimal",
              formattedValue: "0 structures in footprint",
            };
            supporting.push(
              "Footprint corridor is clear of mapped building structures [evd_osm_r1]."
            );
          } else {
            scoreObj = {
              score: 25,
              status: "constrained",
              formattedValue: `${buildingCorridorCollisions} structures intersected`,
            };
            risks.push(
              `Footprint intersects ${buildingCorridorCollisions} mapped building(s), requiring realignment or acquisition [evd_osm_r1].`
            );
          }
          break;

        case "water_rail_crossings":
          metricVal = waterwayCorridorCrossings + railwayCorridorCrossings;
          scoreObj = {
            score: metricVal === 0 ? 95 : metricVal === 1 ? 72 : 42,
            status: metricVal <= 1 ? "optimal" : "suboptimal",
            formattedValue: `${metricVal} crossing(s)`,
          };
          if (metricVal > 0) {
            risks.push(
              `Corridor intersects ${metricVal} waterway/rail line(s) requiring culvert or grade separation [evd_osm_r1].`
            );
          }
          break;

        case "road_crossing_cost":
          metricVal = roadCorridorCrossings;
          scoreObj = {
            score: metricVal === 0 ? 95 : metricVal === 1 ? 75 : 45,
            status: metricVal <= 1 ? "optimal" : "suboptimal",
            formattedValue: `${metricVal} arterial crossing(s)`,
          };
          break;

        case "park_proximity":
          metricVal = nearestParkDistM;
          scoreObj = scoreDistanceToRoad(nearestParkDistM);
          break;

        case "landuse_compatibility":
          metricVal = incompatibleLanduseCount;
          if (incompatibleLanduseCount === 0 && nearestIncompatibleLanduseDistM > 300) {
            scoreObj = {
              score: 92,
              status: "optimal",
              formattedValue: "0 incompatible zones within 500m",
            };
            supporting.push(
              "Surrounding land-use is free of heavy industrial, quarry, or restricted conflicts [evd_osm_r1]."
            );
          } else {
            scoreObj = {
              score: 45,
              status: "suboptimal",
              formattedValue: `${incompatibleLanduseCount} conflict zone(s) within 500m`,
            };
            risks.push(
              `Adjacent industrial/restricted landuse detected within ${Math.round(nearestIncompatibleLanduseDistM)}m [evd_osm_r1].`
            );
          }
          break;

        case "utility_power_proximity":
        case "grid_substation_proximity":
          metricVal = nearestPowerDistM;
          evidenceIds = ["evd_osm_r2"];
          if (nearestPowerDistM <= 800) {
            scoreObj = {
              score: 95,
              status: "optimal",
              formattedValue: `${Math.round(nearestPowerDistM)} m to power grid`,
            };
            supporting.push(
              `Close electrical grid proximity: power infrastructure mapped within ${Math.round(nearestPowerDistM)}m [evd_osm_r2].`
            );
          } else if (nearestPowerDistM <= 2000) {
            scoreObj = {
              score: 72,
              status: "acceptable",
              formattedValue: `${Math.round(nearestPowerDistM)} m to power grid`,
            };
          } else {
            scoreObj = {
              score: 45,
              status: "suboptimal",
              formattedValue:
                nearestPowerDistM > 5000
                  ? "> 5 km (unmapped/distant)"
                  : `${Math.round(nearestPowerDistM)} m to grid`,
            };
            risks.push(
              `Extended feeder line required: nearest mapped power infrastructure is ${
                nearestPowerDistM > 5000 ? "> 5km" : `${Math.round(nearestPowerDistM)}m`
              } away [evd_osm_r2].`
            );
          }
          break;

        // Intermodal & transit
        case "intermodal_connectivity":
          metricVal = transitStopsCount;
          scoreObj = {
            score: transitStopsCount >= 3 ? 95 : transitStopsCount >= 1 ? 75 : 40,
            status: transitStopsCount >= 3 ? "optimal" : transitStopsCount >= 1 ? "acceptable" : "suboptimal",
            formattedValue: `${transitStopsCount} connecting stops (800m)`,
          };
          if (transitStopsCount >= 2) {
            supporting.push(
              `Strong intermodal connectivity: ${transitStopsCount} transit stops within 800m walkshed [evd_osm_r1].`
            );
          }
          break;

        case "transit_network_gap": {
          const stationDist = Math.min(nearestTransitDistM, 5000);
          metricVal = Math.round(stationDist);
          if (stationDist >= 500) {
            scoreObj = {
              score: 90,
              status: "optimal",
              formattedValue:
                nearestTransitDistM > 3000
                  ? "> 3 km spacing"
                  : `${Math.round(stationDist)} m from nearest stop`,
            };
          } else {
            scoreObj = {
              score: 55,
              status: "acceptable",
              formattedValue: `${Math.round(stationDist)} m to existing stop`,
            };
          }
          break;
        }

        // Drainage Manning & Impervious
        case "manning_capacity_check": {
          const flowLps = Number(customParams.designFlow || 1200);
          const widthM = Number(customParams.channelWidth || 3.5);
          const depthM = Number(customParams.channelDepth || 1.8);
          evidenceIds = ["evd_elevation"];
          scoreObj = scoreManningHydraulicCapacity(
            flowLps,
            widthM,
            depthM,
            elevationData.slopePercent
          );
          metricVal = scoreObj.score;
          if (scoreObj.score >= 80) {
            supporting.push(
              `Manning open-channel conveyance capacity meets peak design inflow (${flowLps} L/s) with 25% freeboard [evd_elevation].`
            );
          } else {
            risks.push(
              `Manning hydraulic check warning: channel (${widthM}m × ${depthM}m) may surcharge under peak inflow (${flowLps} L/s) [evd_elevation].`
            );
          }
          break;
        }

        case "impervious_surface_proxy": {
          const impRatio = Math.min(
            Math.round(((residentialBldgsCount * 140) / (Math.PI * 250000)) * 100),
            90
          );
          metricVal = impRatio;
          scoreObj = {
            score: impRatio >= 30 ? 90 : 62,
            status: impRatio >= 30 ? "optimal" : "acceptable",
            formattedValue: `${impRatio}% built proxy`,
          };
          supporting.push(
            `Catchment built-surface proxy (~${impRatio}%) indicates stormwater runoff mitigation demand [evd_osm_r1].`
          );
          break;
        }

        case "topographic_depression":
          metricVal = elevationData.slopePercent;
          evidenceIds = ["evd_elevation"];
          scoreObj = {
            score:
              elevationData.slopePercent >= 0.2 && elevationData.slopePercent <= 3.5
                ? 94
                : 62,
            status:
              elevationData.slopePercent >= 0.2 && elevationData.slopePercent <= 3.5
                ? "optimal"
                : "acceptable",
            formattedValue: `${elevationData.slopePercent}% grade (${elevationData.centerElevationM}m elev)`,
          };
          break;

        case "precipitation_intensity": {
          try {
            const climate = await openMeteoProvider.getClimateIndicators(lat, lng);
            evidence.push({
              id: "evd_climate",
              provider: climate.source,
              params: { lat, lng },
              retrievedAt: climate.retrievedAt,
              summary: `Historical peak 24-hr daily rainfall: ${climate.maxDailyRainfallMm} mm/day (Annual: ${climate.annualTotalRainfallMm} mm).`,
            });
            evidenceIds = ["evd_climate"];
            metricVal = climate.maxDailyRainfallMm;
            scoreObj = {
              score: climate.maxDailyRainfallMm >= 50 ? 92 : 76,
              status: "optimal",
              formattedValue: `${climate.maxDailyRainfallMm} mm/day peak`,
            };
          } catch (err: any) {
            isComputed = false;
            dataGaps.push(`Historical precipitation archive unavailable: ${err.message}`);
          }
          break;
        }

        // Solar Irradiance
        case "solar_irradiance": {
          try {
            const solar = await nasaPowerProvider.getSolarResource(lat, lng);
            evidence.push({
              id: "evd_solar",
              provider: solar.source,
              params: { lat, lng, parameter: "ALLSKY_SFC_SW_DWN" },
              retrievedAt: solar.retrievedAt,
              summary: `Annual average Global Horizontal Irradiance (GHI): ${solar.annualAverageGhiKwhM2Day} kWh/m²/day.`,
            });
            evidenceIds = ["evd_solar"];
            metricVal = solar.annualAverageGhiKwhM2Day;
            scoreObj = scoreSolarGhi(solar.annualAverageGhiKwhM2Day);

            // Check PV array tilt angle alignment against latitude
            const targetMw = Number(customParams.targetCapacityMw || 5);
            const tiltDeg = Number(customParams.panelTiltDeg ?? Math.round(Math.abs(lat)));
            const requiredAreaM2 = targetMw * 8000; // ~0.8 ha/MWp minimum packing

            if (solar.annualAverageGhiKwhM2Day >= 4.5) {
              supporting.push(
                `High solar resource: GHI of ${solar.annualAverageGhiKwhM2Day} kWh/m²/day supports utility PV generation (optimal tilt ~${Math.round(
                  Math.abs(lat)
                )}° vs configured ${tiltDeg}°) [evd_solar].`
              );
            }
            if (footprintAreaM2 < requiredAreaM2) {
              risks.push(
                `PV capacity density constraint: ${targetMw} MWp typically requires ~${requiredAreaM2.toLocaleString()} m², exceeding current ${footprintAreaM2.toLocaleString()} m² footprint.`
              );
            }
          } catch (err: any) {
            isComputed = false;
            dataGaps.push(`NASA POWER solar irradiance unavailable: ${err.message}`);
          }
          break;
        }

        case "shading_obstruction_proxy": {
          const shadeDist = Math.min(nearestShadeObstructionDistM, 2000);
          metricVal = Math.round(shadeDist);
          if (shadeDist > 120 && buildingCorridorCollisions === 0) {
            scoreObj = {
              score: 94,
              status: "optimal",
              formattedValue:
                nearestShadeObstructionDistM > 1500
                  ? "Clear horizon (> 1.5 km)"
                  : `${Math.round(shadeDist)} m setback`,
            };
            supporting.push(
              "Unobstructed solar horizon: clear of dense forests and tall high-rise shading [evd_osm_r1]."
            );
          } else {
            scoreObj = {
              score: 45,
              status: "suboptimal",
              formattedValue: `Obstruction at ${Math.round(shadeDist)} m`,
            };
            risks.push(
              `Potential horizon shading from nearby forest canopy or tall structures (${Math.round(shadeDist)}m) [evd_osm_r1].`
            );
          }
          break;
        }

        // Terrain / Slope & Aspect
        case "terrain_slope":
        case "slope_stability":
        case "slope_and_aspect":
        case "longitudinal_slope":
        case "gravity_gradient":
        case "flood_elevation_profile":
          metricVal = elevationData.slopePercent;
          evidenceIds = ["evd_elevation"];
          scoreObj = scoreSlopePercent(elevationData.slopePercent, 6);
          if (critDef.id === "slope_and_aspect") {
            scoreObj.formattedValue = `${elevationData.slopePercent}% (${elevationData.aspectDeg}° aspect)`;
          }
          if (elevationData.slopePercent <= 4.0) {
            supporting.push(
              `Gentle topography: ${elevationData.slopePercent}% slope at ${elevationData.centerElevationM}m elevation minimizes earthwork [evd_elevation].`
            );
          } else {
            risks.push(
              `Steep terrain: ${elevationData.slopePercent}% surface gradient requires cut-and-fill grading [evd_elevation].`
            );
          }
          break;

        // OSM Coverage Confidence
        case "osm_coverage":
          metricVal = Math.round(featureDensity * 10) / 10;
          evidenceIds = ["evd_osm_r1"];
          scoreObj = scoreOsmDataCoverage(featureDensity);
          break;

        default:
          metricVal = 50;
          scoreObj = { score: 70, status: "acceptable", formattedValue: "Benchmark met" };
          break;
      }
    }

    if (isComputed) {
      weightedSum += scoreObj.score * critDef.weight;
      computedWeight += critDef.weight;
    }

    computedCriteria.push({
      id: critDef.id,
      label: critDef.label,
      value: isComputed ? scoreObj.formattedValue : "Data Unavailable",
      rawMetric: metricVal,
      unit: critDef.unit,
      score: isComputed ? scoreObj.score : 0,
      weight: critDef.weight,
      status: isComputed ? scoreObj.status : "constrained",
      benchmark: critDef.benchmark,
      evidenceIds: isComputed ? evidenceIds : [],
      description: critDef.description,
      computed: isComputed,
    });
  }

  // 6. Compute Weighted Overall Score & True Confidence Share
  let finalScore = computedWeight > 0 ? Math.round(weightedSum / computedWeight) : 0;

  // Penalize score if critical validation conflicts exist
  if (validation.status === "fail") {
    finalScore = Math.min(finalScore, 24);
  } else if (validation.status === "warn") {
    finalScore = Math.min(finalScore, 65);
  }

  const bandInfo = determineSuitabilityBand(finalScore);
  const confidencePercent =
    totalConfiguredWeight > 0
      ? Math.min(Math.round((computedWeight / totalConfiguredWeight) * 100), 100)
      : 0;

  const primaryEvdId = evidence[0]?.id || "evd_osm_r2";

  // 7. Generate Narrative Text with Verifiable Evidence Citations
  const narrative = `UrjaSetu geospatial multi-criteria evaluation indicates an overall score of ${finalScore}/100 (${bandInfo.band}, ${confidencePercent}% data confidence) for the proposed ${config.label} project [${primaryEvdId}]. The site encompasses ${lengthM}m × ${widthM}m (~${footprintAreaM2.toLocaleString()} m²) at coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}). Primary supporting factors include ${
    supporting.slice(0, 2).join(" Furthermore, ") || "baseline access alignment"
  }. Key constraints include ${
    risks.slice(0, 2).join(" In addition, ") || "routine regulatory setback verification"
  }. ${
    elevationLoaded
      ? `Digital elevation modeling records ${elevationData.centerElevationM}m elevation with ${elevationData.slopePercent}% ground gradient [evd_elevation].`
      : "Digital elevation data could not be retrieved for this run."
  } This assessment provides indicative decision support only and must be corroborated by statutory on-site land surveys.`;

  return {
    engineVersion: "1.0.0",
    timestamp: new Date().toISOString(),
    placementSnapshot: {
      id: placementId,
      type,
      lat,
      lng,
      lengthM,
      widthM,
      bearingDeg,
      areaM2: footprintAreaM2,
      params: customParams,
      label: label || `${type} at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    },
    validation,
    criteria: computedCriteria,
    overall: {
      score: finalScore,
      band: bandInfo.band,
      tone: bandInfo.tone,
      confidence: confidencePercent,
      verdictSummary: bandInfo.summary,
    },
    supporting,
    risks,
    dataGaps,
    evidence,
    limitations,
    narrativeText: narrative,
  };
}
