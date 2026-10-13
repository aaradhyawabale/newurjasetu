import type { Geometry } from "geojson";

export type ProviderErrorCode =
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "MALFORMED_RESPONSE"
  | "UPSTREAM_ERROR"
  | "INVALID_QUERY"
  | "COVERAGE_LIMITATION"
  | "UNAVAILABLE";

export class ProviderError extends Error {
  public readonly provider: string;
  public readonly code: ProviderErrorCode;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(
    provider: string,
    code: ProviderErrorCode,
    message: string,
    options?: { statusCode?: number; retryable?: boolean }
  ) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.code = code;
    this.statusCode = options?.statusCode;
    this.retryable =
      options?.retryable ??
      (code === "RATE_LIMITED" || code === "TIMEOUT" || code === "UPSTREAM_ERROR");
  }
}

export type StandardizedFeatureCategory =
  | "building"
  | "road"
  | "waterway"
  | "railway"
  | "landuse"
  | "amenity"
  | "power"
  | "transit"
  | "natural"
  | "restricted"
  | "bridge"
  | "other";

export type CacheStatusType = "miss" | "fresh_hit" | "stale_fallback";

export interface DataQualityIndicator {
  completeness: "verified" | "partial" | "sparse" | "unknown";
  isStale: boolean;
  cacheStatus: CacheStatusType;
  missingAttributes?: string[];
  notes?: string;
}

export interface StandardizedGeoFeature {
  id: string;
  sourceId: string;
  sourceName: string;
  category: StandardizedFeatureCategory;
  subCategory?: string;
  label: string;
  geometry: Geometry;
  attributes: Record<string, string | number | boolean>;
  rawTags?: Record<string, string>;
  distanceM?: number;
  retrievedAt: string;
  datasetTimestamp?: string;
  quality: DataQualityIndicator;
  license: string;
}

export interface OsmFeatureGeometry {
  lat: number;
  lon: number;
}

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
  geometry?: OsmFeatureGeometry[];
}

export interface OverpassQueryResult {
  elements: OsmElement[];
  normalizedFeatures?: StandardizedGeoFeature[];
  retrievedAt: string;
  datasetTimestamp?: string;
  source: string;
  queryId: string;
  license?: string;
  cacheStatus?: CacheStatusType;
  isStale?: boolean;
  quality?: DataQualityIndicator;
}

export interface ElevationResult {
  centerElevationM: number;
  slopePercent: number;
  aspectDeg?: number;
  samplePointsCount: number;
  retrievedAt: string;
  datasetTimestamp?: string;
  source: string;
  license?: string;
  cacheStatus?: CacheStatusType;
  isStale?: boolean;
  quality?: DataQualityIndicator;
}

export interface ClimateResult {
  maxDailyRainfallMm: number;
  annualTotalRainfallMm: number;
  validDaysCount?: number;
  retrievedAt: string;
  datasetTimestamp?: string;
  source: string;
  license?: string;
  cacheStatus?: CacheStatusType;
  isStale?: boolean;
  quality?: DataQualityIndicator;
}

export interface SolarResult {
  annualAverageGhiKwhM2Day: number; // Global Horizontal Irradiance in kWh/m2/day
  clearSkyGhiKwhM2Day?: number;
  annualMeanTempC?: number;
  retrievedAt: string;
  datasetTimestamp?: string;
  source: string;
  license?: string;
  cacheStatus?: CacheStatusType;
  isStale?: boolean;
  quality?: DataQualityIndicator;
}

export interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
  placeId: string;
  type?: string;
  source?: string;
  license?: string;
  retrievedAt?: string;
}
