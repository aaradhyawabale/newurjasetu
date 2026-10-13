import {
  InfrastructureTypeId,
  INFRASTRUCTURE_TYPES,
  INFRASTRUCTURE_SEPARATION_RULES,
} from "@/config/infra-types";
import {
  computeGeometryDistanceMeters,
  createFootprintPolygon,
  doesFootprintIntersect,
  validateCoordinates,
  validatePolygonGeometry,
} from "../gis/geometry";
import { OverpassProvider, osmElementToGeoJson } from "../providers/overpass";
import { OpenMeteoProvider } from "../providers/open-meteo";
import { NasaPowerProvider } from "../providers/nasa-power";
import { validateFootprint, ValidationResult, ConflictingFeature } from "./validation";
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
import { OsmElement, StandardizedGeoFeature, StandardizedFeatureCategory } from "../providers/types";

export type AnalysisErrorCode =
  | "INVALID_INPUT"
  | "UNSUPPORTED_TYPE"
  | "INVALID_COORDINATES"
  | "INVALID_GEOMETRY"
  | "INSUFFICIENT_EVIDENCE"
  | "PROVIDER_TIMEOUT"
  | "RATE_LIMIT";

export class AnalysisEngineError extends Error {
  public readonly code: AnalysisErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: AnalysisErrorCode,
    message: string,
    statusCode = 400,
    details?: unknown
  ) {
    super(message);
    this.name = "AnalysisEngineError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface EvidenceItem {
  id: string;
  provider: string;
  params: Record<string, unknown>;
  retrievedAt: string;
  datasetTimestamp?: string;
  license?: string;
  featureCount?: number;
  qualityStatus?: "verified" | "sparse" | "empty" | "stale";
  freshness?: "live" | "cached" | "stale_fallback";
  summary: string;
}

export interface DataSourceSummary {
  provider: string;
  status: "ok" | "empty" | "failed" | "stale";
  retrievedAt?: string;
  datasetTimestamp?: string;
  license?: string;
  isStale?: boolean;
  featureCount?: number;
  errorMessage?: string;
}

export interface CriterionResult {
  id: string;
  label: string;
  value: string;
  rawMetric: number | null;
  unit?: string;
  score: number | null;
  weight: number;
  status: "optimal" | "acceptable" | "suboptimal" | "constrained" | "unknown";
  benchmark: string;
  evidenceIds: string[];
  description: string;
  computed?: boolean;
  missingReason?: string;
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
  constraints?: ConflictingFeature[];
  analyzedFeatures?: StandardizedGeoFeature[];
  searchRings?: {
    centerLat: number;
    centerLng: number;
    r1M: number;
    r2M: number;
  };
  criteria: CriterionResult[];
  overall: {
    score: number;
    band: string;
    tone: "positive" | "moderate" | "cautious" | "negative";
    confidence: number;
    canCalculateOverall?: boolean;
    evidenceCompleteness?: number;
    verdictSummary: string;
  };
  supporting: string[];
  risks: string[];
  warnings?: string[];
  recommendations?: string[];
  assumptions?: string[];
  dataGaps: string[];
  dataSources?: DataSourceSummary[];
  evidence: EvidenceItem[];
  limitations: string[];
  narrativeText: string;
}

const overpassProvider = new OverpassProvider();
const openMeteoProvider = new OpenMeteoProvider();
const nasaPowerProvider = new NasaPowerProvider();

export async function runAnalysisEngine(params: {
  analysisId?: string;
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
  // =========================================================================
  // STEP 1: VALIDATE SUBMITTED ANALYSIS REQUEST & INFRASTRUCTURE TYPE
  // =========================================================================
  if (!params || typeof params !== "object") {
    throw new AnalysisEngineError("INVALID_INPUT", "Analysis request payload is missing or malformed.", 400);
  }

  const {
    analysisId,
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

  if (!placementId || typeof placementId !== "string" || placementId.trim() === "") {
    throw new AnalysisEngineError("INVALID_INPUT", "A valid placementId is required to execute analysis.", 400);
  }

  const config = INFRASTRUCTURE_TYPES[type];
  if (!config) {
    throw new AnalysisEngineError(
      "UNSUPPORTED_TYPE",
      `Unsupported infrastructure type: "${String(type)}". Supported types: ${Object.keys(INFRASTRUCTURE_TYPES).join(", ")}.`,
      400
    );
  }
  const separationRules = INFRASTRUCTURE_SEPARATION_RULES[type];

  // =========================================================================
  // STEP 2: VALIDATE COORDINATES, GEOMETRY, DIMENSIONS & INFRASTRUCTURE PARAMS
  // =========================================================================
  const coordCheck = validateCoordinates(lat, lng);
  if (!coordCheck.valid) {
    throw new AnalysisEngineError(
      "INVALID_COORDINATES",
      coordCheck.reason || "Invalid geographic coordinates.",
      400
    );
  }

  if (
    typeof lengthM !== "number" ||
    typeof widthM !== "number" ||
    !Number.isFinite(lengthM) ||
    !Number.isFinite(widthM) ||
    lengthM <= 0 ||
    widthM <= 0
  ) {
    throw new AnalysisEngineError(
      "INVALID_INPUT",
      "Footprint dimensions (lengthM and widthM) must be positive finite numbers.",
      400
    );
  }

  if (lengthM > 20000 || widthM > 20000) {
    throw new AnalysisEngineError(
      "INVALID_INPUT",
      "Footprint dimensions exceed maximum supported engineering site extent (20,000m).",
      400
    );
  }

  const safeBearing = Number.isFinite(bearingDeg) ? bearingDeg : 0;
  const footprintPolygon = createFootprintPolygon(lat, lng, lengthM, widthM, safeBearing);
  const geomCheck = validatePolygonGeometry(footprintPolygon);
  if (!geomCheck.valid) {
    throw new AnalysisEngineError(
      "INVALID_GEOMETRY",
      geomCheck.reason || "Generated footprint polygon geometry is invalid.",
      400
    );
  }

  const footprintAreaM2 = geomCheck.areaM2;
  const centerPoint: [number, number] = [lng, lat];

  // Sanitize & validate type-specific parameters against config schema
  const sanitizedParams: Record<string, any> = { ...customParams };
  const warnings: string[] = [];

  for (const paramDef of config.parameters) {
    const rawVal = customParams[paramDef.id];
    if (rawVal === undefined || rawVal === null || rawVal === "") {
      sanitizedParams[paramDef.id] = paramDef.defaultValue;
      continue;
    }

    if (paramDef.type === "number") {
      const numVal = Number(rawVal);
      if (!Number.isFinite(numVal)) {
        sanitizedParams[paramDef.id] = paramDef.defaultValue;
        warnings.push(
          `Parameter "${paramDef.label}" had non-numeric value and was reset to default (${paramDef.defaultValue}${paramDef.unit ? ` ${paramDef.unit}` : ""}).`
        );
      } else if (paramDef.min !== undefined && numVal < paramDef.min) {
        sanitizedParams[paramDef.id] = paramDef.min;
        warnings.push(
          `Parameter "${paramDef.label}" (${numVal}) was below minimum (${paramDef.min}) and clamped to ${paramDef.min}${paramDef.unit ? ` ${paramDef.unit}` : ""}.`
        );
      } else if (paramDef.max !== undefined && numVal > paramDef.max) {
        sanitizedParams[paramDef.id] = paramDef.max;
        warnings.push(
          `Parameter "${paramDef.label}" (${numVal}) exceeded maximum (${paramDef.max}) and was clamped to ${paramDef.max}${paramDef.unit ? ` ${paramDef.unit}` : ""}.`
        );
      } else {
        sanitizedParams[paramDef.id] = numVal;
      }
    } else if (paramDef.type === "select" && paramDef.options) {
      const validValues = paramDef.options.map((o) => o.value);
      if (!validValues.includes(String(rawVal))) {
        sanitizedParams[paramDef.id] = paramDef.defaultValue;
        warnings.push(
          `Parameter "${paramDef.label}" had unsupported option "${String(rawVal)}" and was reset to "${String(paramDef.defaultValue)}".`
        );
      } else {
        sanitizedParams[paramDef.id] = String(rawVal);
      }
    } else if (paramDef.type === "boolean") {
      sanitizedParams[paramDef.id] = Boolean(rawVal);
    }
  }

  const evidence: EvidenceItem[] = [];
  const dataSources: DataSourceSummary[] = [];
  const dataGaps: string[] = [];
  const supporting: string[] = [];
  const risks: string[] = [];
  const recommendations: string[] = [];
  const assumptions: string[] = [
    `Geodesic footprint modeled as ${lengthM}m × ${widthM}m (~${footprintAreaM2.toLocaleString()} m²) oriented at ${safeBearing}° clockwise from true North.`,
    `Multi-ring spatial buffers evaluated at R1 = ${config.searchRadiusR1M}m (site vicinity) and R2 = ${config.searchRadiusR2M}m (regional catchment).`,
    `Terrain slope and aspect derived from 3×3 Open-Meteo 90m DEM grid (60m spacing) using Horn's finite-difference method with latitude cosine correction.`,
    `Separation and setback thresholds follow ${separationRules.standardReference}.`,
  ];

  if (type === "Drainage" || type === "Water Canal") {
    assumptions.push(
      "Hydraulic conveyance estimated via Manning's open-channel equation assuming n = 0.015 (concrete lined) or n = 0.025 (earthen) at 75% flow depth (25% freeboard)."
    );
  }
  if (type === "Solar Farm") {
    assumptions.push(
      "Utility-scale PV land requirement assumes ~8,000 m²/MWp (0.8 ha/MWp) packing factor and optimal fixed-tilt angle approximately equal to |latitude|."
    );
  }

  const limitations: string[] = [
    "Indicative suitability heuristics for preliminary planning and site screening only.",
    "Not a statutory clearance, environmental impact statement (EIS), or geotechnical engineering certification.",
    "OpenStreetMap is volunteered geographic data; features may be unmapped or outdated in emerging areas.",
    "Thresholds and criteria weights represent default heuristics — verify against local municipal master plans and building codes (NEEDS VERIFICATION).",
  ];

  // =========================================================================
  // STEP 3 & 4: RETRIEVE GEOGRAPHIC EVIDENCE & VALIDATE DATA QUALITY/COVERAGE
  // =========================================================================
  let osmFeaturesAll: OsmElement[] = [];
  let osmFeaturesR1Count = 0;
  let osmLoaded = false;
  let osmEmpty = false;
  let anyStaleDataUsed = false;
  let overpassSourceName = "OpenStreetMap / Overpass API";
  let overpassRetrievedAt = new Date().toISOString();
  let overpassDatasetTimestamp: string | undefined;
  let overpassIsStale = false;
  let overpassErrorMsg = "Overpass query failed";

  let elevationData = {
    centerElevationM: 0,
    slopePercent: 0,
    aspectDeg: 180,
    samplePointsCount: 0,
    source: "",
    retrievedAt: "",
  };
  let elevationLoaded = false;
  let elevationErrorMsg = "Elevation query failed";

  let climateData: {
    maxDailyRainfallMm: number;
    annualTotalRainfallMm: number;
    source: string;
    retrievedAt: string;
    datasetTimestamp?: string;
    license?: string;
    isStale?: boolean;
  } | null = null;
  let climateErrorMsg = "Climate archive failed";

  let solarData: {
    annualAverageGhiKwhM2Day: number;
    clearSkyGhiKwhM2Day?: number;
    annualMeanTempC?: number;
    source: string;
    retrievedAt: string;
    datasetTimestamp?: string;
    license?: string;
    isStale?: boolean;
  } | null = null;
  let solarErrorMsg = "NASA POWER query failed";

  // Fetch core providers concurrently
  const [overpassSettled, elevationSettled, climateSettled, solarSettled] =
    await Promise.allSettled([
      overpassProvider.getFeaturesAround(lat, lng, config.searchRadiusR2M),
      openMeteoProvider.getElevationAndSlope(lat, lng),
      type === "Drainage"
        ? openMeteoProvider.getClimateIndicators(lat, lng)
        : Promise.resolve(null),
      type === "Solar Farm"
        ? nasaPowerProvider.getSolarResource(lat, lng)
        : Promise.resolve(null),
    ]);

  // Process Overpass R2 response
  if (overpassSettled.status === "fulfilled") {
    const resR2 = overpassSettled.value;
    osmFeaturesAll = resR2.elements;
    osmLoaded = true;
    osmEmpty = resR2.elements.length === 0;
    overpassSourceName = resR2.source;
    overpassRetrievedAt = resR2.retrievedAt;
    overpassDatasetTimestamp = resR2.datasetTimestamp;
    overpassIsStale = Boolean(resR2.isStale);

    if (resR2.isStale) {
      anyStaleDataUsed = true;
      const staleMsg = `OpenStreetMap Overpass data was served from a stale local cache (${resR2.retrievedAt}) because live mirrors were unreachable.`;
      warnings.push(staleMsg);
      dataGaps.push(staleMsg);
    }

    dataSources.push({
      provider: resR2.source,
      status: osmEmpty ? "empty" : resR2.isStale ? "stale" : "ok",
      retrievedAt: resR2.retrievedAt,
      datasetTimestamp: resR2.datasetTimestamp,
      license: resR2.license || "ODbL 1.0 — © OpenStreetMap contributors",
      isStale: Boolean(resR2.isStale),
      featureCount: resR2.elements.length,
    });

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
      datasetTimestamp: resR2.datasetTimestamp,
      license: resR2.license || "ODbL 1.0 — © OpenStreetMap contributors",
      featureCount: resR2.elements.length,
      qualityStatus: resR2.isStale
        ? "stale"
        : osmEmpty
        ? "empty"
        : resR2.elements.length < 15
        ? "sparse"
        : "verified",
      freshness: resR2.isStale
        ? "stale_fallback"
        : resR2.cacheStatus === "fresh_hit" || resR2.source.includes("Cache")
        ? "cached"
        : "live",
      summary: `Retrieved ${resR2.elements.length} mapped OSM features within ${config.searchRadiusR2M}m regional buffer.`,
    });

    if (osmEmpty) {
      const emptyMsg = `Zero mapped OpenStreetMap features returned within ${config.searchRadiusR2M}m radius. Proximity, service-gap, and clearance criteria cannot be substantiated from OSM alone.`;
      dataGaps.push(emptyMsg);
      warnings.push(emptyMsg);
    }
  } else {
    overpassErrorMsg = overpassSettled.reason?.message || "Overpass query failed";
    dataSources.push({
      provider: "OpenStreetMap / Overpass API",
      status: "failed",
      errorMessage: overpassErrorMsg,
    });
    dataGaps.push(`OpenStreetMap Overpass query failed: ${overpassErrorMsg}`);
  }

  // Process Open-Meteo DEM response
  if (elevationSettled.status === "fulfilled") {
    const elev = elevationSettled.value;
    elevationData = {
      ...elev,
      aspectDeg: elev.aspectDeg ?? 180,
    };
    elevationLoaded = true;

    if (elev.isStale) {
      anyStaleDataUsed = true;
      const staleMsg = `Open-Meteo Digital Elevation Model data was served from a stale cache (${elev.retrievedAt}).`;
      warnings.push(staleMsg);
    }

    dataSources.push({
      provider: elev.source,
      status: elev.isStale ? "stale" : "ok",
      retrievedAt: elev.retrievedAt,
      datasetTimestamp: elev.datasetTimestamp,
      license: elev.license,
      isStale: Boolean(elev.isStale),
      featureCount: elev.samplePointsCount,
    });

    evidence.push({
      id: "evd_elevation",
      provider: elev.source,
      params: { lat, lng, sampleGrid: "3x3 points (60m step)" },
      retrievedAt: elev.retrievedAt,
      datasetTimestamp: elev.datasetTimestamp,
      license: elev.license,
      qualityStatus: elev.isStale ? "stale" : "verified",
      freshness: elev.isStale
        ? "stale_fallback"
        : elev.cacheStatus === "fresh_hit" || elev.source.includes("Cache")
        ? "cached"
        : "live",
      summary: `Sampled 3x3 digital elevation model. Ground elevation: ${elev.centerElevationM}m, Surface gradient: ${elev.slopePercent}%, Aspect: ${elevationData.aspectDeg}°.`,
    });
  } else {
    elevationErrorMsg = elevationSettled.reason?.message || "Elevation query failed";
    dataSources.push({
      provider: "Open-Meteo Elevation API",
      status: "failed",
      errorMessage: elevationErrorMsg,
    });
    dataGaps.push(`Digital elevation model unavailable: ${elevationErrorMsg}`);
  }

  // Process Open-Meteo Climate response (if applicable)
  if (type === "Drainage") {
    if (climateSettled.status === "fulfilled" && climateSettled.value) {
      climateData = climateSettled.value;
      if (climateData.isStale) {
        anyStaleDataUsed = true;
        warnings.push(`Open-Meteo Climate Archive data was served from a stale cache (${climateData.retrievedAt}).`);
      }
      dataSources.push({
        provider: climateData.source,
        status: climateData.isStale ? "stale" : "ok",
        retrievedAt: climateData.retrievedAt,
        datasetTimestamp: climateData.datasetTimestamp,
        license: climateData.license,
        isStale: Boolean(climateData.isStale),
      });
      evidence.push({
        id: "evd_climate",
        provider: climateData.source,
        params: { lat, lng },
        retrievedAt: climateData.retrievedAt,
        datasetTimestamp: climateData.datasetTimestamp,
        license: climateData.license,
        qualityStatus: climateData.isStale ? "stale" : "verified",
        freshness: climateData.isStale
          ? "stale_fallback"
          : climateData.source.includes("Cache")
          ? "cached"
          : "live",
        summary: `Historical peak 24-hr daily rainfall: ${climateData.maxDailyRainfallMm} mm/day (Annual: ${climateData.annualTotalRainfallMm} mm).`,
      });
    } else if (climateSettled.status === "rejected") {
      climateErrorMsg = climateSettled.reason?.message || "Climate archive failed";
      dataSources.push({
        provider: "Open-Meteo Historical Climate Archive",
        status: "failed",
        errorMessage: climateErrorMsg,
      });
      dataGaps.push(`Historical precipitation archive unavailable: ${climateErrorMsg}`);
    }
  }

  // Process NASA POWER Solar response (if applicable)
  if (type === "Solar Farm") {
    if (solarSettled.status === "fulfilled" && solarSettled.value) {
      solarData = solarSettled.value;
      if (solarData.isStale) {
        anyStaleDataUsed = true;
        warnings.push(`NASA POWER solar climatology data was served from a stale cache (${solarData.retrievedAt}).`);
      }
      dataSources.push({
        provider: solarData.source,
        status: solarData.isStale ? "stale" : "ok",
        retrievedAt: solarData.retrievedAt,
        datasetTimestamp: solarData.datasetTimestamp,
        license: solarData.license,
        isStale: Boolean(solarData.isStale),
      });
      evidence.push({
        id: "evd_solar",
        provider: solarData.source,
        params: { lat, lng, parameter: "ALLSKY_SFC_SW_DWN" },
        retrievedAt: solarData.retrievedAt,
        datasetTimestamp: solarData.datasetTimestamp,
        license: solarData.license,
        qualityStatus: solarData.isStale ? "stale" : "verified",
        freshness: solarData.isStale
          ? "stale_fallback"
          : solarData.source.includes("Cache")
          ? "cached"
          : "live",
        summary: `Annual average Global Horizontal Irradiance (GHI): ${solarData.annualAverageGhiKwhM2Day} kWh/m²/day${
          solarData.annualMeanTempC !== undefined ? ` (Mean ambient temp: ${solarData.annualMeanTempC}°C)` : ""
        }.`,
      });
    } else if (solarSettled.status === "rejected") {
      solarErrorMsg = solarSettled.reason?.message || "NASA POWER query failed";
      dataSources.push({
        provider: "NASA POWER CERES Solar Resource",
        status: "failed",
        errorMessage: solarErrorMsg,
      });
      dataGaps.push(`NASA POWER solar irradiance unavailable: ${solarErrorMsg}`);
    }
  }

  // Fail fast with actionable error if ALL external evidence providers failed
  if (!osmLoaded && !elevationLoaded && !climateData && !solarData) {
    throw new AnalysisEngineError(
      "INSUFFICIENT_EVIDENCE",
      "Unable to compute suitability analysis: all upstream geospatial data providers (Overpass, Open-Meteo, NASA POWER) were unreachable or timed out. Please retry shortly.",
      503,
      { dataSources }
    );
  }

  // =========================================================================
  // STEP 5: APPLY GEOSPATIAL CONSTRAINTS & FOOTPRINT VALIDATION
  // =========================================================================
  const validation = await validateFootprint(
    type,
    lat,
    lng,
    lengthM,
    widthM,
    safeBearing,
    osmLoaded ? osmFeaturesAll : undefined,
    sanitizedParams
  );

  if (validation.messages.length > 0) {
    for (const msg of validation.messages) {
      warnings.push(msg);
    }
  }

  if (validation.conflicts.length > 0) {
    for (const conf of validation.conflicts) {
      if (conf.severity === "critical") {
        risks.push(`CRITICAL CONFLICT: ${conf.description}`);
      } else {
        risks.push(`SITE CONSTRAINT: ${conf.description}`);
      }
    }
  }

  // Extract accurate geospatial metrics from OSM features using point-to-line / point-to-polygon distances
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
  let nearbyBuildings250mCount = 0;
  let buildingsWithHeightTagsCount = 0;
  let incompatibleLanduseCount = 0;
  let hospitalsCount = 0;
  let schoolsCount = 0;
  let transitStopsCount = 0;
  let parksAreaM2 = 0;
  let buildingCorridorCollisions = 0;
  let waterwayCorridorCrossings = 0;
  let railwayCorridorCrossings = 0;
  let roadCorridorCrossings = 0;

  const analyzedFeatures: StandardizedGeoFeature[] = [];
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

    // Classify feature for Map & Analysis Consistency (STEP 5)
    let category: StandardizedFeatureCategory = "other";
    let subCategory: string | undefined;
    let featLabel = tags.name || `OSM #${el.id}`;
    const missingAttributes: string[] = [];

    if (tags.bridge && tags.bridge !== "no") {
      category = "bridge";
      subCategory = tags.highway || tags.railway || "bridge";
      featLabel = tags.name || `Bridge (${subCategory})`;
    } else if (
      tags.military ||
      ["military", "landfill", "quarry", "cemetery"].includes(tags.landuse || "") ||
      tags.amenity === "grave_yard"
    ) {
      category = "restricted";
      subCategory = tags.landuse || tags.military || "restricted";
      featLabel = tags.name || `Restricted Zone (${subCategory})`;
    } else if (tags.building && tags.building !== "no") {
      category = "building";
      subCategory = tags.building;
      featLabel = tags.name || tags["building:name"] || `Building #${el.id}`;
      if (!tags["building:levels"] && !tags.height) {
        missingAttributes.push("building:levels", "height");
      }
    } else if (tags.highway) {
      category = tags.highway === "bus_stop" ? "transit" : "road";
      subCategory = tags.highway;
      featLabel = tags.name || tags.ref || `Road (${tags.highway})`;
    } else if (tags.waterway || tags.natural === "water" || tags.landuse === "reservoir") {
      category = "waterway";
      subCategory = tags.waterway || "water";
      featLabel = tags.name || `Waterway (${subCategory})`;
    } else if (tags.railway) {
      category =
        tags.railway === "station" || tags.railway === "halt" ? "transit" : "railway";
      subCategory = tags.railway;
      featLabel = tags.name || `Railway (${tags.railway})`;
    } else if (tags.power) {
      category = "power";
      subCategory = tags.power;
      featLabel = tags.name || `Power (${tags.power})`;
    } else if (tags.public_transport) {
      category = "transit";
      subCategory = tags.public_transport;
      featLabel = tags.name || `Transit (${tags.public_transport})`;
    } else if (tags.amenity) {
      category = "amenity";
      subCategory = tags.amenity;
      featLabel = tags.name || `Amenity (${tags.amenity})`;
    } else if (tags.leisure || tags.landuse) {
      category = "landuse";
      subCategory = tags.leisure || tags.landuse;
      featLabel = tags.name || `Landuse (${subCategory})`;
    } else if (tags.natural) {
      category = "natural";
      subCategory = tags.natural;
      featLabel = tags.name || `Natural (${tags.natural})`;
    }

    analyzedFeatures.push({
      id: `osm:${el.type}:${el.id}`,
      sourceId: `${el.type}/${el.id}`,
      sourceName: overpassSourceName,
      category,
      subCategory,
      label: featLabel,
      geometry: geo.geometry,
      attributes: {
        osmId: el.id,
        osmType: el.type,
        distanceM: Math.round(distM),
        intersectsFootprint,
      },
      rawTags: tags,
      distanceM: Math.round(distM),
      retrievedAt: overpassRetrievedAt,
      datasetTimestamp: overpassDatasetTimestamp,
      quality: {
        completeness: missingAttributes.length > 0 ? "partial" : "verified",
        isStale: overpassIsStale,
        cacheStatus: overpassIsStale ? "stale_fallback" : "miss",
        ...(missingAttributes.length > 0 ? { missingAttributes } : {}),
      },
      license: "ODbL 1.0 — © OpenStreetMap contributors",
    });

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
    if (
      tags.leisure === "park" ||
      tags.leisure === "garden" ||
      tags.landuse === "recreation_ground"
    ) {
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
      if (distM <= 250) {
        nearbyBuildings250mCount++;
        if (levels > 0 || heightM > 0) {
          buildingsWithHeightTagsCount++;
        }
      }
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

  // Sort analyzed features by distance so the closest site evidence is prioritized on the map overlay
  analyzedFeatures.sort((a, b) => (a.distanceM ?? 9999) - (b.distanceM ?? 9999));
  const boundedAnalyzedFeatures = analyzedFeatures.slice(0, 200);

  // Record R1 evidence summary
  if (osmLoaded) {
    evidence.push({
      id: "evd_osm_r1",
      provider: evidence[0]?.provider || "OpenStreetMap / Overpass",
      params: { radiusM: config.searchRadiusR1M, lat, lng },
      retrievedAt: evidence[0]?.retrievedAt || new Date().toISOString(),
      datasetTimestamp: overpassDatasetTimestamp,
      license: "ODbL 1.0 — © OpenStreetMap contributors",
      featureCount: osmFeaturesR1Count,
      qualityStatus: overpassIsStale
        ? "stale"
        : osmFeaturesR1Count === 0
        ? "empty"
        : osmFeaturesR1Count < 8
        ? "sparse"
        : "verified",
      freshness: evidence[0]?.freshness || "live",
      summary: `Filtered ${osmFeaturesR1Count} mapped OSM features within immediate ${config.searchRadiusR1M}m site radius.`,
    });
  }

  // Coverage indicator
  const areaKm2 = Math.PI * Math.pow(config.searchRadiusR1M / 1000, 2);
  const featureDensity = osmLoaded ? osmFeaturesR1Count / Math.max(areaKm2, 0.1) : 0;
  if (osmLoaded && !osmEmpty && featureDensity < 3.0) {
    const lowCovMsg = `Low OpenStreetMap feature density (${featureDensity.toFixed(1)} features/km²) in this zone. Some physical infrastructure may be unmapped.`;
    dataGaps.push(lowCovMsg);
    warnings.push(lowCovMsg);
  }

  // =========================================================================
  // STEP 6: CALCULATE CRITERION-LEVEL RESULTS
  // =========================================================================
  const computedCriteria: CriterionResult[] = [];
  let totalConfiguredWeight = 0;
  let computedWeight = 0;
  let weightedSum = 0;

  for (const critDef of config.criteria) {
    totalConfiguredWeight += critDef.weight;
    let metricVal: number | null = 0;
    let scoreObj: MetricScore = { score: 0, status: "constrained", formattedValue: "Unavailable" };
    let evidenceIds: string[] = ["evd_osm_r1"];
    let isComputed = true;
    let missingReason: string | undefined;

    // Check if required base provider succeeded (STEP 4 — Missing-Data Policy)
    if (
      (critDef.sourceProvider === "overpass" || critDef.sourceProvider === "osm-coverage") &&
      !osmLoaded
    ) {
      isComputed = false;
      missingReason = `OpenStreetMap Overpass provider unavailable (${overpassErrorMsg}); ${critDef.label} could not be evaluated.`;
    } else if (critDef.sourceProvider === "overpass" && osmEmpty) {
      // Do not fabricate high "gap" or "clearance" scores when Overpass returned 0 features in the entire region
      isComputed = false;
      missingReason = `Zero mapped OpenStreetMap features returned within ${config.searchRadiusR2M}m radius; ${critDef.label} cannot be verified without assuming unmapped conditions.`;
    } else if (
      critDef.sourceProvider === "open-meteo" &&
      critDef.id !== "precipitation_intensity" &&
      !elevationLoaded
    ) {
      isComputed = false;
      missingReason = `Open-Meteo Digital Elevation Model unavailable (${elevationErrorMsg}); ${critDef.label} could not be computed.`;
    } else if (critDef.id === "precipitation_intensity" && !climateData) {
      isComputed = false;
      missingReason = `Open-Meteo ERA5-Land climate archive unavailable (${climateErrorMsg}); historical precipitation could not be verified.`;
    } else if (critDef.sourceProvider === "nasa-power" && !solarData) {
      isComputed = false;
      missingReason = `NASA POWER solar climatology unavailable (${solarErrorMsg}); solar irradiance could not be verified.`;
    }

    if (isComputed) {
      switch (critDef.id) {
        // Common & Arterial Access
        case "arterial_access":
        case "road_arterial_access":
          metricVal = nearestArterialDistM;
          scoreObj = scoreDistanceToRoad(nearestArterialDistM);
          if (nearestArterialDistM <= separationRules.maxRoadAccessDistanceM) {
            supporting.push(
              `Direct arterial road access within ${Math.round(nearestArterialDistM)}m ensures rapid logistics [evd_osm_r1].`
            );
          } else {
            risks.push(
              `Distance to arterial road is ${Math.round(nearestArterialDistM)}m (exceeds ${separationRules.maxRoadAccessDistanceM}m benchmark); requires collector road upgrading [evd_osm_r1].`
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
          } else if (nearestRoadDistM > separationRules.maxRoadAccessDistanceM) {
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
          if (hazardDist >= separationRules.minHazardBufferM) {
            scoreObj = {
              score: 95,
              status: "optimal",
              formattedValue: `${Math.round(Math.min(hazardDist, 2000))} m buffer`,
            };
            supporting.push(
              `Quiet acoustic zone: well-buffered from rail and industrial zones (> ${Math.round(Math.min(hazardDist, 2000))}m) [evd_osm_r1].`
            );
          } else if (hazardDist >= separationRules.minHazardBufferM * 0.6) {
            scoreObj = {
              score: 68,
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
              `Acoustic/industrial proximity: railway or industrial zone within ${Math.round(hazardDist)}m (below ${separationRules.minHazardBufferM}m setback) [evd_osm_r1].`
            );
          }
          break;
        }

        // Highway safety buffer
        case "highway_safety_buffer":
          metricVal = nearestArterialDistM;
          if (nearestArterialDistM > separationRules.minMotorwayBufferM) {
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
          if (bridgeDist >= separationRules.minSameTypeSpacingM) {
            scoreObj = {
              score: 92,
              status: "optimal",
              formattedValue:
                nearestBridgeDistM > 3000
                  ? "> 3 km to next bridge"
                  : `${Math.round(bridgeDist)} m to next bridge`,
            };
            supporting.push(
              `Relieves crossing bottleneck: no redundant bridge within ${separationRules.minSameTypeSpacingM}m [evd_osm_r1].`
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
          if (
            incompatibleLanduseCount === 0 &&
            nearestIncompatibleLanduseDistM > separationRules.minHazardBufferM
          ) {
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
            status:
              transitStopsCount >= 3
                ? "optimal"
                : transitStopsCount >= 1
                ? "acceptable"
                : "suboptimal",
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
          if (stationDist >= separationRules.minSameTypeSpacingM) {
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
          const flowLps = Number(sanitizedParams.designFlow ?? 1200);
          const chWidthM = Number(sanitizedParams.channelWidth ?? 3.5);
          const chDepthM = Number(sanitizedParams.channelDepth ?? 1.8);
          evidenceIds = ["evd_elevation"];
          scoreObj = scoreManningHydraulicCapacity(
            flowLps,
            chWidthM,
            chDepthM,
            elevationData.slopePercent
          );
          metricVal = scoreObj.score;
          if (scoreObj.score >= 80) {
            supporting.push(
              `Manning open-channel conveyance capacity meets peak design inflow (${flowLps} L/s) with 25% freeboard [evd_elevation].`
            );
          } else {
            risks.push(
              `Manning hydraulic check warning: channel (${chWidthM}m × ${chDepthM}m) may surcharge under peak inflow (${flowLps} L/s) [evd_elevation].`
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
          if (climateData) {
            evidenceIds = ["evd_climate"];
            metricVal = climateData.maxDailyRainfallMm;
            scoreObj = {
              score: climateData.maxDailyRainfallMm >= 50 ? 92 : 76,
              status: "optimal",
              formattedValue: `${climateData.maxDailyRainfallMm} mm/day peak`,
            };
          }
          break;
        }

        // Solar Irradiance
        case "solar_irradiance": {
          if (solarData) {
            evidenceIds = ["evd_solar"];
            metricVal = solarData.annualAverageGhiKwhM2Day;
            scoreObj = scoreSolarGhi(solarData.annualAverageGhiKwhM2Day);

            const targetMw = Number(sanitizedParams.targetCapacityMw ?? 5);
            const tiltDeg = Number(sanitizedParams.panelTiltDeg ?? Math.round(Math.abs(lat)));
            const requiredAreaM2 = targetMw * 8000;

            if (solarData.annualAverageGhiKwhM2Day >= 4.5) {
              supporting.push(
                `High solar resource: GHI of ${solarData.annualAverageGhiKwhM2Day} kWh/m²/day supports utility PV generation (optimal tilt ~${Math.round(
                  Math.abs(lat)
                )}° vs configured ${tiltDeg}°) [evd_solar].`
              );
            }
            if (Math.abs(tiltDeg - Math.abs(lat)) > 15) {
              warnings.push(
                `Configured PV tilt angle (${tiltDeg}°) deviates by >15° from local latitude (${Math.abs(lat).toFixed(1)}°), which may reduce annual energy yield.`
              );
            }
            if (footprintAreaM2 < requiredAreaM2) {
              risks.push(
                `PV capacity density constraint: ${targetMw} MWp typically requires ~${requiredAreaM2.toLocaleString()} m², exceeding current ${footprintAreaM2.toLocaleString()} m² footprint.`
              );
            }
          }
          break;
        }

        case "shading_obstruction_proxy": {
          const shadeDist = Math.min(nearestShadeObstructionDistM, 2000);
          metricVal = Math.round(shadeDist);
          if (shadeDist > 120 && buildingCorridorCollisions === 0) {
            if (nearbyBuildings250mCount > 0 && buildingsWithHeightTagsCount === 0) {
              scoreObj = {
                score: 68,
                status: "acceptable",
                formattedValue: `Heights untagged (${nearbyBuildings250mCount} bldgs ≤250m)`,
              };
              warnings.push(
                `${nearbyBuildings250mCount} nearby building footprint(s) within 250m lack OSM height/building:levels attributes; vertical shadow profile requires field verification [evd_osm_r1].`
              );
              dataGaps.push(
                `OpenStreetMap building footprints within 250m lack vertical height ('height' / 'building:levels') attributes.`
              );
            } else {
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
            }
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
          scoreObj = scoreSlopePercent(
            elevationData.slopePercent,
            separationRules.maxSlopePercent
          );
          if (critDef.id === "slope_and_aspect") {
            scoreObj.formattedValue = `${elevationData.slopePercent}% (${elevationData.aspectDeg}° aspect)`;
          }
          if (elevationData.slopePercent <= separationRules.maxSlopePercent) {
            supporting.push(
              `Gentle topography: ${elevationData.slopePercent}% slope at ${elevationData.centerElevationM}m elevation is within ${separationRules.maxSlopePercent}% limit [evd_elevation].`
            );
          } else {
            risks.push(
              `Steep terrain: ${elevationData.slopePercent}% surface gradient exceeds ${separationRules.maxSlopePercent}% recommended threshold, requiring cut-and-fill grading [evd_elevation].`
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
      value: isComputed
        ? scoreObj.formattedValue
        : osmEmpty && critDef.sourceProvider === "overpass"
        ? "Unverified (0 OSM features)"
        : "Unknown (Evidence Unavailable)",
      rawMetric: isComputed ? metricVal : null,
      unit: critDef.unit,
      score: isComputed ? scoreObj.score : null,
      weight: critDef.weight,
      status: isComputed ? scoreObj.status : "unknown",
      benchmark: critDef.benchmark,
      evidenceIds: isComputed ? evidenceIds : [],
      description: critDef.description,
      computed: isComputed,
      ...(missingReason ? { missingReason } : {}),
    });
  }

  // =========================================================================
  // STEP 7: CALCULATE FINAL SUITABILITY SCORE & EVIDENCE CONFIDENCE
  // =========================================================================
  if (computedWeight <= 0) {
    throw new AnalysisEngineError(
      "INSUFFICIENT_EVIDENCE",
      "Insufficient verified geospatial evidence to compute a reliable suitability score.",
      503,
      { dataSources }
    );
  }

  let finalScore = Math.round(weightedSum / computedWeight);

  // Penalize score if critical validation conflicts exist
  if (validation.status === "fail") {
    finalScore = Math.min(finalScore, 24);
  } else if (validation.status === "warn") {
    finalScore = Math.min(finalScore, 65);
  }

  const bandInfo = determineSuitabilityBand(finalScore);
  const evidenceCompleteness =
    totalConfiguredWeight > 0
      ? Math.min(Math.round((computedWeight / totalConfiguredWeight) * 100), 100)
      : 0;
  let confidencePercent = evidenceCompleteness;

  // Reduce confidence if OSM query returned zero features across the entire region
  if (osmEmpty) {
    confidencePercent = Math.min(confidencePercent, 35);
  }
  // Reduce confidence if stale cached fallback data was used
  if (anyStaleDataUsed) {
    confidencePercent = Math.max(20, confidencePercent - 10);
  }

  // =========================================================================
  // STEP 8: GENERATE ACTIONABLE RECOMMENDATIONS & EXPLANATION
  // =========================================================================
  if (validation.conflicts.some((c) => c.category === "building")) {
    recommendations.push(
      `Shift or rotate the ${lengthM}m × ${widthM}m footprint to eliminate overlap with existing mapped building structures.`
    );
  }
  if (validation.conflicts.some((c) => c.category === "waterway")) {
    recommendations.push(
      `Relocate ${config.label} outside active waterway/floodplain channels and maintain a riparian buffer.`
    );
  }
  if (validation.conflicts.some((c) => c.category === "separation_buffer")) {
    recommendations.push(
      `Increase setback distance or incorporate engineered acoustic/environmental buffers to satisfy ${separationRules.standardReference}.`
    );
  }
  if (validation.conflicts.some((c) => c.category === "parameter_constraint")) {
    recommendations.push(
      `Adjust footprint dimensions (${lengthM}m × ${widthM}m) or target capacity parameters so site area matches engineering density norms.`
    );
  }
  if (elevationLoaded && elevationData.slopePercent > separationRules.maxSlopePercent) {
    recommendations.push(
      `Conduct detailed topographic grading and geotechnical slope-stability design for the ${elevationData.slopePercent}% ground gradient.`
    );
  }
  if (osmLoaded && !osmEmpty && nearestRoadDistM > separationRules.maxRoadAccessDistanceM) {
    recommendations.push(
      `Plan a ${Math.round(nearestRoadDistM)}m dedicated feeder access road linking the site to the nearest classified street network.`
    );
  }
  if (osmEmpty || featureDensity < 3.0) {
    recommendations.push(
      "Perform field reconnaissance and high-resolution satellite orthophoto digitization to supplement sparse OpenStreetMap baseline coverage."
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      `Proceed to preliminary municipal zoning verification, soil investigation, and utility connection application for the ${config.label} site.`
    );
  }

  const primaryEvdId = evidence[0]?.id || "evd_osm_r2";
  const narrative = `UrjaSetu geospatial multi-criteria evaluation indicates an overall score of ${finalScore}/100 (${bandInfo.band}, ${confidencePercent}% data confidence) for the proposed ${config.label} project [${primaryEvdId}]. The site encompasses ${lengthM}m × ${widthM}m (~${footprintAreaM2.toLocaleString()} m²) at coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}). Primary supporting factors include ${
    supporting.slice(0, 2).join(" Furthermore, ") || "baseline access alignment"
  }. Key constraints include ${
    risks.slice(0, 2).join(" In addition, ") || "routine regulatory setback verification"
  }. ${
    elevationLoaded
      ? `Digital elevation modeling records ${elevationData.centerElevationM}m elevation with ${elevationData.slopePercent}% ground gradient [evd_elevation].`
      : "Digital elevation data could not be retrieved for this run."
  } Recommended next action: ${recommendations[0]} This assessment provides indicative decision support only and must be corroborated by statutory on-site land surveys.`;

  return {
    ...(analysisId ? { analysisId } : {}),
    engineVersion: "1.0.0",
    timestamp: new Date().toISOString(),
    placementSnapshot: {
      id: placementId,
      type,
      lat,
      lng,
      lengthM,
      widthM,
      bearingDeg: safeBearing,
      areaM2: footprintAreaM2,
      params: sanitizedParams,
      label: label || `${type} at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    },
    validation,
    constraints: validation.conflicts,
    criteria: computedCriteria,
    overall: {
      score: finalScore,
      band: bandInfo.band,
      tone: bandInfo.tone,
      confidence: confidencePercent,
      verdictSummary: bandInfo.summary,
      canCalculateOverall: computedWeight > 0,
      evidenceCompleteness,
    },
    supporting,
    risks,
    warnings,
    recommendations,
    assumptions,
    dataGaps,
    dataSources,
    evidence,
    limitations,
    narrativeText: narrative,
    analyzedFeatures: boundedAnalyzedFeatures,
    searchRings: {
      centerLat: lat,
      centerLng: lng,
      r1M: config.searchRadiusR1M,
      r2M: config.searchRadiusR2M,
    },
  };
}
