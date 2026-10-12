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
  retrievedAt: string;
  source: string;
  queryId: string;
}

export interface ElevationResult {
  centerElevationM: number;
  slopePercent: number;
  aspectDeg?: number;
  samplePointsCount: number;
  retrievedAt: string;
  source: string;
}

export interface ClimateResult {
  maxDailyRainfallMm: number;
  annualTotalRainfallMm: number;
  retrievedAt: string;
  source: string;
}

export interface SolarResult {
  annualAverageGhiKwhM2Day: number; // Global Horizontal Irradiance in kWh/m2/day
  retrievedAt: string;
  source: string;
}

export interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
  placeId: string;
  type?: string;
}
