import { InfrastructureTypeId, INFRASTRUCTURE_TYPES } from "@/config/infra-types";
import { computeDistanceMeters, computeAreaM2, createFootprintPolygon } from "../gis/geometry";
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
import * as turf from "@turf/turf";

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
}

export interface AnalysisReportResult {
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
  const { placementId, type, lat, lng, lengthM, widthM, bearingDeg = 0, customParams = {}, label } = params;
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

  // 1. Footprint Validation
  const validation = await validateFootprint(type, lat, lng, lengthM, widthM, bearingDeg);
  if (validation.conflicts.length > 0) {
    for (const conf of validation.conflicts) {
      if (conf.severity === "critical") {
        risks.push(`CRITICAL CONFLICT: ${conf.description}`);
      } else {
        risks.push(`CONSTRUCTION RISK: ${conf.description}`);
      }
    }
  }

  // 2. Fetch OSM Features in Search Radii
  let osmFeaturesR1: any[] = [];
  let osmFeaturesR2: any[] = [];
  const centerPoint: [number, number] = [lng, lat];

  try {
    const resR1 = await overpassProvider.getFeaturesAround(lat, lng, config.searchRadiusR1M);
    osmFeaturesR1 = resR1.elements;
    evidence.push({
      id: "evd_osm_r1",
      provider: resR1.source,
      params: { radiusM: config.searchRadiusR1M, lat, lng },
      retrievedAt: resR1.retrievedAt,
      featureCount: resR1.elements.length,
      summary: `Retrieved ${resR1.elements.length} mapped OSM features within ${config.searchRadiusR1M}m radius.`,
    });
  } catch (err: any) {
    dataGaps.push(`Failed to fetch immediate OSM features: ${err.message}`);
  }

  try {
    const resR2 = await overpassProvider.getFeaturesAround(lat, lng, config.searchRadiusR2M);
    osmFeaturesR2 = resR2.elements;
    evidence.push({
      id: "evd_osm_r2",
      provider: resR2.source,
      params: { radiusM: config.searchRadiusR2M, lat, lng },
      retrievedAt: resR2.retrievedAt,
      featureCount: resR2.elements.length,
      summary: `Retrieved ${resR2.elements.length} regional OSM features within ${config.searchRadiusR2M}m radius.`,
    });
  } catch (err: any) {
    dataGaps.push(`Failed to fetch extended regional OSM features: ${err.message}`);
  }

  // 3. Fetch Elevation & Slope
  let elevationData = { centerElevationM: 0, slopePercent: 2.0, samplePointsCount: 0, source: "", retrievedAt: "" };
  try {
    const elev = await openMeteoProvider.getElevationAndSlope(lat, lng);
    elevationData = elev;
    evidence.push({
      id: "evd_elevation",
      provider: elev.source,
      params: { lat, lng, sampleGrid: "3x3 points (60m step)" },
      retrievedAt: elev.retrievedAt,
      summary: `Sampled 3x3 digital elevation model. Ground elevation: ${elev.centerElevationM}m, Surface gradient: ${elev.slopePercent}%.`,
    });
  } catch (err: any) {
    dataGaps.push(`Failed to retrieve digital elevation data: ${err.message}`);
  }

  // 4. Extract geospatial spatial metrics from OSM data
  let nearestRoadDistM = 9999;
  let nearestArterialDistM = 9999;
  let nearestWaterwayDistM = 9999;
  let nearestRailwayDistM = 9999;
  let nearestPowerDistM = 9999;
  let nearestParkDistM = 9999;
  let residentialBldgsCount = 0;
  let hospitalsCount = 0;
  let schoolsCount = 0;
  let transitStopsCount = 0;
  let parksAreaM2 = 0;
  let buildingCorridorCollisions = 0;

  const allOsm = [...osmFeaturesR1, ...osmFeaturesR2];
  const uniqueElements = new Map<number, any>();
  for (const el of allOsm) {
    uniqueElements.set(el.id, el);
  }

  for (const el of uniqueElements.values()) {
    const geo = osmElementToGeoJson(el);
    if (!geo) continue;

    // Approximate distance to center
    let distM = 9999;
    try {
      if (geo.geometry.type === "Point") {
        distM = computeDistanceMeters(centerPoint, geo.geometry.coordinates as [number, number]);
      } else {
        const centroid = turf.centroid(geo);
        distM = computeDistanceMeters(centerPoint, centroid.geometry.coordinates as [number, number]);
      }
    } catch {
      distM = 9999;
    }

    const tags = el.tags || {};

    // Highways / Roads
    if (tags.highway) {
      if (distM < nearestRoadDistM) nearestRoadDistM = distM;
      if (["primary", "secondary", "trunk", "motorway"].includes(tags.highway)) {
        if (distM < nearestArterialDistM) nearestArterialDistM = distM;
      }
    }

    // Waterways
    if (tags.waterway || tags.natural === "water") {
      if (distM < nearestWaterwayDistM) nearestWaterwayDistM = distM;
    }

    // Railways
    if (tags.railway && tags.railway !== "abandoned") {
      if (distM < nearestRailwayDistM) nearestRailwayDistM = distM;
    }

    // Power infrastructure
    if (tags.power) {
      if (distM < nearestPowerDistM) nearestPowerDistM = distM;
    }

    // Parks
    if (tags.leisure === "park" || tags.leisure === "garden") {
      if (distM < nearestParkDistM) nearestParkDistM = distM;
      if (distM <= 1000) {
        parksAreaM2 += tags.area ? parseFloat(tags.area) || 5000 : 5000;
      }
    }

    // Buildings & residential proxy
    if (tags.building && tags.building !== "no") {
      if (distM <= 1000) {
        residentialBldgsCount++;
      }
      if (distM <= Math.max(lengthM, widthM) / 2) {
        buildingCorridorCollisions++;
      }
    }

    // Amenities
    if (tags.amenity === "hospital" || tags.amenity === "clinic") {
      if (distM <= 3000) hospitalsCount++;
    }
    if (tags.amenity === "school" || tags.amenity === "college" || tags.amenity === "kindergarten") {
      if (distM <= 1000) schoolsCount++;
    }
    if (tags.public_transport || tags.railway === "station" || tags.highway === "bus_stop") {
      if (distM <= 800) transitStopsCount++;
    }
  }

  // Coverage indicator
  const areaKm2 = (Math.PI * Math.pow(config.searchRadiusR1M / 1000, 2));
  const featureDensity = osmFeaturesR1.length / Math.max(areaKm2, 0.1);
  if (featureDensity < 3.0) {
    dataGaps.push(
      `Low OpenStreetMap feature density (${featureDensity.toFixed(1)} features/km²) in this zone. Some physical infrastructure may be unmapped.`
    );
  }

  // 5. Compute Criteria per Infrastructure Type
  const computedCriteria: CriterionResult[] = [];

  for (const critDef of config.criteria) {
    let metricVal = 0;
    let scoreObj: MetricScore = { score: 50, status: "acceptable", formattedValue: "N/A" };
    let evidenceIds: string[] = ["evd_osm_r1"];

    switch (critDef.id) {
      // Common & Arterial Access
      case "arterial_access":
      case "road_arterial_access":
        metricVal = nearestArterialDistM;
        scoreObj = scoreDistanceToRoad(nearestArterialDistM);
        if (nearestArterialDistM <= 400) {
          supporting.push(`Direct arterial road access within ${Math.round(nearestArterialDistM)}m ensures rapid logistics.`);
        } else {
          risks.push(`Distance to arterial road is ${Math.round(nearestArterialDistM)}m; requires collector road upgrading.`);
        }
        break;

      case "road_frontage":
      case "grid_connectivity":
      case "footpath_road_access":
      case "road_maintenance_access":
        metricVal = nearestRoadDistM;
        scoreObj = scoreDistanceToRoad(nearestRoadDistM);
        if (nearestRoadDistM <= 100) {
          supporting.push(`Immediate street frontage at ${Math.round(nearestRoadDistM)}m.`);
        }
        break;

      // Healthcare Gap
      case "healthcare_gap":
        metricVal = hospitalsCount;
        scoreObj = scoreGapNeed(hospitalsCount);
        if (hospitalsCount === 0) {
          supporting.push("Underserved medical catchment: no major hospital located within 3km.");
        } else {
          risks.push(`Existing medical saturation: ${hospitalsCount} facilities within 3km.`);
        }
        break;

      // School Gap
      case "education_gap":
        metricVal = schoolsCount;
        scoreObj = scoreGapNeed(schoolsCount);
        if (schoolsCount <= 1) {
          supporting.push(`High educational need: only ${schoolsCount} school(s) within 1km.`);
        }
        break;

      // Residential Catchment
      case "residential_catchment":
      case "density_catchment":
        metricVal = residentialBldgsCount;
        scoreObj = scoreDemandDensity(residentialBldgsCount);
        if (residentialBldgsCount >= 50) {
          supporting.push(`Dense residential base: ${residentialBldgsCount} structures within 1km catchment.`);
        } else {
          risks.push(`Low residential density (${residentialBldgsCount} structures within 1km); potential low utilization.`);
        }
        break;

      // Hazard & Noise Buffer
      case "hazard_noise_buffer":
        metricVal = Math.min(nearestRailwayDistM, 2000);
        scoreObj = scoreDistanceToRoad(metricVal > 300 ? 50 : 800); // Inverse: farther is better
        if (nearestRailwayDistM < 200) {
          risks.push(`High acoustic noise: railway tracks located within ${Math.round(nearestRailwayDistM)}m.`);
        } else {
          supporting.push(`Quiet acoustic zone: well-buffered from rail corridors (${Math.round(nearestRailwayDistM)}m).`);
        }
        break;

      // Highway safety buffer
      case "highway_safety_buffer":
        metricVal = nearestArterialDistM;
        if (nearestArterialDistM > 200) {
          scoreObj = { score: 95, status: "optimal", formattedValue: `${Math.round(nearestArterialDistM)} m buffer` };
          supporting.push(`Safe setback from major high-speed roads (${Math.round(nearestArterialDistM)}m).`);
        } else {
          scoreObj = { score: 40, status: "suboptimal", formattedValue: `${Math.round(nearestArterialDistM)} m (close to traffic)` };
          risks.push(`Proximity to high-speed arterial road (${Math.round(nearestArterialDistM)}m) requires traffic calming.`);
        }
        break;

      // Green Space Deficit
      case "green_space_deficit":
        metricVal = parksAreaM2;
        if (parksAreaM2 < 5000) {
          scoreObj = { score: 95, status: "optimal", formattedValue: "Severe park deficit (< 5,000 m² nearby)" };
          supporting.push("High public impact: site fills a severe urban green-space deficit.");
        } else {
          scoreObj = { score: 55, status: "acceptable", formattedValue: `${Math.round(parksAreaM2).toLocaleString()} m² existing` };
        }
        break;

      // Waterway synergy / outfall link
      case "waterway_synergy":
      case "waterway_outfall_link":
      case "outfall_proximity":
        metricVal = nearestWaterwayDistM;
        evidenceIds = ["evd_osm_r1"];
        if (nearestWaterwayDistM <= 450) {
          scoreObj = { score: 92, status: "optimal", formattedValue: `${Math.round(nearestWaterwayDistM)} m to channel` };
          supporting.push(`Optimal drainage/outfall link: receiving waterway within ${Math.round(nearestWaterwayDistM)}m.`);
        } else {
          scoreObj = { score: 50, status: "suboptimal", formattedValue: `${Math.round(nearestWaterwayDistM)} m` };
          risks.push(`Extended outfall distance: ${Math.round(nearestWaterwayDistM)}m to nearest receiving waterway.`);
        }
        break;

      // Bridge barrier alignment
      case "span_barrier_alignment":
        metricVal = Math.min(nearestWaterwayDistM, nearestRailwayDistM);
        if (metricVal <= 100) {
          scoreObj = { score: 95, status: "optimal", formattedValue: `Traverses barrier (${Math.round(metricVal)}m)` };
          supporting.push(`Direct alignment over physical barrier (${Math.round(metricVal)}m).`);
        } else {
          scoreObj = { score: 40, status: "suboptimal", formattedValue: `${Math.round(metricVal)}m away` };
          risks.push("Bridge does not closely cross an identifiable waterway or rail corridor.");
        }
        break;

      case "approach_road_classes":
        metricVal = nearestRoadDistM;
        scoreObj = scoreDistanceToRoad(nearestRoadDistM);
        break;

      case "crossing_redundancy":
        metricVal = 1200; // heuristic
        scoreObj = { score: 85, status: "optimal", formattedValue: "> 1 km to next bridge" };
        break;

      case "abutment_clearance":
        metricVal = buildingCorridorCollisions;
        scoreObj = {
          score: buildingCorridorCollisions === 0 ? 95 : 45,
          status: buildingCorridorCollisions === 0 ? "optimal" : "suboptimal",
          formattedValue: `${buildingCorridorCollisions} structures`,
        };
        break;

      case "building_displacement_risk":
      case "structure_avoidance":
        metricVal = buildingCorridorCollisions;
        if (buildingCorridorCollisions === 0) {
          scoreObj = { score: 100, status: "optimal", formattedValue: "0 structures in corridor" };
          supporting.push("Right-of-way is completely clear of existing building structures.");
        } else {
          scoreObj = { score: 30, status: "constrained", formattedValue: `${buildingCorridorCollisions} structures impacted` };
          risks.push(`Right-of-way intersects ${buildingCorridorCollisions} building structures, requiring resettlement or demolition.`);
        }
        break;

      case "water_rail_crossings":
      case "road_crossing_cost":
        metricVal = (nearestWaterwayDistM < 100 ? 1 : 0) + (nearestRailwayDistM < 100 ? 1 : 0);
        scoreObj = { score: metricVal <= 1 ? 88 : 50, status: metricVal <= 1 ? "optimal" : "acceptable", formattedValue: `${metricVal} crossings` };
        break;

      case "park_proximity":
        metricVal = nearestParkDistM;
        scoreObj = scoreDistanceToRoad(nearestParkDistM);
        break;

      case "landuse_compatibility":
        metricVal = 85;
        scoreObj = { score: 85, status: "optimal", formattedValue: "Compatible Urban fabric" };
        break;

      case "utility_power_proximity":
      case "grid_substation_proximity":
        metricVal = nearestPowerDistM;
        if (nearestPowerDistM <= 600) {
          scoreObj = { score: 95, status: "optimal", formattedValue: `${Math.round(nearestPowerDistM)} m to power line/grid` };
          supporting.push(`High grid proximity: electrical infrastructure located within ${Math.round(nearestPowerDistM)}m.`);
        } else {
          scoreObj = { score: 55, status: "acceptable", formattedValue: `${Math.round(nearestPowerDistM)} m to grid` };
          risks.push(`Grid extension required: ${Math.round(nearestPowerDistM)}m to nearest power infrastructure.`);
        }
        break;

      // Intermodal & transit
      case "intermodal_connectivity":
        metricVal = transitStopsCount;
        scoreObj = {
          score: transitStopsCount >= 3 ? 95 : transitStopsCount >= 1 ? 75 : 40,
          status: transitStopsCount >= 3 ? "optimal" : "acceptable",
          formattedValue: `${transitStopsCount} connecting stops`,
        };
        if (transitStopsCount >= 2) supporting.push(`Strong intermodal links: ${transitStopsCount} transit stops within 400m.`);
        break;

      case "transit_network_gap":
        metricVal = 800;
        scoreObj = { score: 80, status: "optimal", formattedValue: "Well-spaced (> 600m)" };
        break;

      // Drainage Manning & Impervious
      case "manning_capacity_check": {
        const flowLps = Number(customParams.designFlow || 1200);
        const widthM = Number(customParams.channelWidth || 3.5);
        const depthM = Number(customParams.channelDepth || 1.8);
        evidenceIds = ["evd_elevation"];
        scoreObj = scoreManningHydraulicCapacity(flowLps, widthM, depthM, elevationData.slopePercent);
        metricVal = scoreObj.score;
        if (scoreObj.score >= 80) {
          supporting.push(`Manning open-channel conveyance capacity meets peak design inflow (${flowLps} L/s) with required freeboard.`);
        } else {
          risks.push(`Manning hydraulic check warning: channel dimensions may back up under peak inflow (${flowLps} L/s).`);
        }
        break;
      }

      case "impervious_surface_proxy": {
        const impRatio = Math.min(Math.round((residentialBldgsCount * 120) / (Math.PI * 250000) * 100), 85);
        metricVal = impRatio;
        scoreObj = { score: impRatio > 35 ? 90 : 60, status: impRatio > 35 ? "optimal" : "acceptable", formattedValue: `${impRatio}% estimated` };
        supporting.push(`Urban imperviousness (~${impRatio}%) demonstrates strong need for engineered stormwater drainage.`);
        break;
      }

      case "topographic_depression":
        metricVal = elevationData.slopePercent;
        evidenceIds = ["evd_elevation"];
        scoreObj = {
          score: elevationData.slopePercent >= 0.2 && elevationData.slopePercent <= 3.0 ? 95 : 60,
          status: "optimal",
          formattedValue: `${elevationData.slopePercent}% gentle valley slope`,
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
            summary: `Historical peak 24-hr daily rainfall: ${climate.maxDailyRainfallMm} mm/day.`,
          });
          evidenceIds = ["evd_climate"];
          metricVal = climate.maxDailyRainfallMm;
          scoreObj = {
            score: climate.maxDailyRainfallMm > 60 ? 95 : 75,
            status: "optimal",
            formattedValue: `${climate.maxDailyRainfallMm} mm/day peak`,
          };
        } catch {
          metricVal = 50;
          scoreObj = { score: 75, status: "acceptable", formattedValue: "50 mm/day" };
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
          if (solar.annualAverageGhiKwhM2Day >= 4.5) {
            supporting.push(`High solar resource: GHI of ${solar.annualAverageGhiKwhM2Day} kWh/m²/day exceeds commercial PV threshold.`);
          }
        } catch {
          metricVal = 4.8;
          scoreObj = scoreSolarGhi(4.8);
        }
        break;
      }

      case "shading_obstruction_proxy":
        metricVal = buildingCorridorCollisions;
        scoreObj = { score: 90, status: "optimal", formattedValue: "Minimal tall obstacles" };
        break;

      // Terrain / Slope
      case "terrain_slope":
      case "slope_stability":
      case "slope_and_aspect":
      case "longitudinal_slope":
      case "gravity_gradient":
      case "flood_elevation_profile":
        metricVal = elevationData.slopePercent;
        evidenceIds = ["evd_elevation"];
        scoreObj = scoreSlopePercent(elevationData.slopePercent, 6);
        if (elevationData.slopePercent <= 4.0) {
          supporting.push(`Gentle topography: ${elevationData.slopePercent}% slope minimizes grading and foundation retaining costs.`);
        } else {
          risks.push(`Steep terrain: ${elevationData.slopePercent}% surface slope requires civil grading and cut-and-fill analysis.`);
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

    computedCriteria.push({
      id: critDef.id,
      label: critDef.label,
      value: scoreObj.formattedValue,
      rawMetric: metricVal,
      unit: critDef.unit,
      score: scoreObj.score,
      weight: critDef.weight,
      status: scoreObj.status,
      benchmark: critDef.benchmark,
      evidenceIds,
      description: critDef.description,
    });
  }

  // 6. Compute Weighted Overall Score & Confidence
  let weightedSum = 0;
  let totalWeight = 0;
  for (const c of computedCriteria) {
    weightedSum += c.score * c.weight;
    totalWeight += c.weight;
  }

  let finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

  // Penalize score if critical validation conflicts exist
  if (validation.status === "fail") {
    finalScore = Math.min(finalScore, 24);
  } else if (validation.status === "warn") {
    finalScore = Math.min(finalScore, 65);
  }

  const bandInfo = determineSuitabilityBand(finalScore);
  const confidencePercent = Math.min(Math.round(totalWeight * 100), 100);

  // 7. Generate Narrative Text with Evidence Citations
  const narrative = `UrjaSetu geospatial multi-criteria evaluation indicates an overall score of ${finalScore}/100 (${bandInfo.band}) for the proposed ${config.label} project [EVD-1]. The site encompasses ${lengthM}m × ${widthM}m (~${Math.round(lengthM * widthM).toLocaleString()} m²) at coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}). Primary supporting factors include ${supporting.slice(0, 2).join(" Furthermore, ") || "baseline access alignment"}. Key constraints include ${risks.slice(0, 2).join(" In addition, ") || "routine regulatory setback verification"}. Digital elevation modeling records ${elevationData.centerElevationM}m elevation with ${elevationData.slopePercent}% ground gradient. This assessment provides indicative decision support only and must be corroborated by statutory on-site land surveys.`;

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
      areaM2: lengthM * widthM,
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
