/**
 * UrjaSetu Satellite Heat & Vegetation Engine Types
 * Phase 3 Architecture
 * 
 * Strict separation of:
 * - VERIFIED_INPUT: Authoritative satellite metadata, calibrated bands, verified sensor specifications
 * - DETERMINISTIC_RESULT: Mathematically exact raster calculations (scaling equations, area-weighted overlap aggregation)
 * - AI_INTERPRETATION: LLM-derived insights, urban context commentary, planning recommendations
 * - UNVERIFIED_ASSUMPTION: Hypotheses, unverified building materials, non-statutory estimates
 */

export type ProvenanceCategory = 
  | 'VERIFIED_INPUT'
  | 'DETERMINISTIC_RESULT'
  | 'AI_INTERPRETATION'
  | 'UNVERIFIED_ASSUMPTION';

export interface ProvenanceField<T> {
  value: T;
  provenance: ProvenanceCategory;
  source: string;
  notes?: string;
}

export interface DiagnosticsMetadata {
  title: string;
  studyArea: string;
  boundaryDisclaimer: string;
  generatedAt: string;
  processingDurationSeconds: number;
  crs: string;
  affineTransform: [number, number, number, number, number, number];
  targetGridResolutionMeters: number;
  rasterDimensions: {
    width: number;
    height: number;
    totalPixels: number;
  };
  candidateBoundaryPixels: number;
  candidateBoundaryAreaKm2: number;
}

export interface Landsat9Diagnostics {
  sceneId: string;
  acquisitionTimestamp: string;
  collection: string;
  nativeThermalResolutionMeters: number;
  deliveredResolutionMeters: number;
  calibrationFormula: string;
  rawDigitalNumbers: {
    dnZeroFillCount: number;
    dn1To292AnomalyCount: number;
    dnNominalValidCount: number;
    minDN: number;
    maxDN: number;
  };
  calibratedLSTCelsius: {
    unit: string;
    min: number;
    max: number;
    mean: number;
    median: number;
    std: number;
    p10: number;
    p90: number;
  };
  surfaceTemperatureQA: {
    unit: string;
    description: string;
    meanUncertaintyK: number;
    medianUncertaintyK: number;
    minUncertaintyK: number;
    maxUncertaintyK: number;
  };
  qaPixelBreakdown: {
    totalValid: number;
    clearPixels: number;
    clearPercentage: number;
    cloudPixels: number;
    cloudPercentage: number;
    cloudShadowPixels: number;
    cirrusPixels: number;
    waterPixels: number;
  };
  qaRadsatTerrainOcclusion: {
    flaggedPixels: number;
    note: string;
  };
}

export interface Sentinel2BDiagnostics {
  sceneId: string;
  acquisitionTimestamp: string;
  temporalBaselineNote: string;
  calibrationFormula: string;
  reflectanceDiagnostics: {
    b04NegativeReflectancePixels: number;
    b08NegativeReflectancePixels: number;
    note: string;
  };
  sclCategoricalDistribution: Record<string, number>;
  ndvi30mDistribution: {
    unit: string;
    note: string;
    validPixelCount: number;
    validPercentage: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    std: number;
  };
  coverageFractions30m: {
    meanSourceCoverageFraction: number;
    meanValidityWithinSourceCoverage: number;
    meanValidFootprintFraction: number;
  };
}

export interface HeatDiagnosticsReport {
  metadata: DiagnosticsMetadata;
  landsat9: Landsat9Diagnostics;
  sentinel2b: Sentinel2BDiagnostics;
}

export interface HeatPointQueryResult {
  coordinates: {
    lng: number;
    lat: number;
    utmX: number;
    utmY: number;
  };
  gridCell: {
    col: number;
    row: number;
    isInsideGrid: boolean;
  };
  lst: {
    celsius: number | null;
    kelvin: number | null;
    rawDn: number;
    stQaUncertaintyKelvin: number | null;
    classification: 'NOMINAL_VALID' | 'DIAGNOSTIC_ANOMALY' | 'FILL_NODATA' | 'CLOUD_MASKED';
    nativeResolutionNotice: string;
  };
  ndvi: {
    aggregated30m: number | null;
    sourceCoverageFraction: number;
    validityWithinCoverage: number;
    validFootprintFraction: number;
    sclClassId: number;
    sclClassName: string;
    isTerrestrialVegetation: boolean;
  };
  provenance: {
    lst: ProvenanceCategory;
    ndvi: ProvenanceCategory;
    scl: ProvenanceCategory;
  };
}
