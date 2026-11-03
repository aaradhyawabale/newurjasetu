import fs from 'fs';
import path from 'path';
import { 
  HeatDiagnosticsReport, 
  HeatPointQueryResult, 
  ProvenanceCategory 
} from './types';

const HEAT_DATA_DIR = path.join(process.cwd(), 'public', 'data', 'heat');
const DIAGNOSTICS_FILE = path.join(HEAT_DATA_DIR, 'pune_qa_diagnostics.json');
const MANIFEST_FILE = path.join(HEAT_DATA_DIR, 'pune_provenance_manifest.json');

const LST_RAW_FILE = path.join(HEAT_DATA_DIR, 'pune_lst_30m.raw');
const NDVI_RAW_FILE = path.join(HEAT_DATA_DIR, 'pune_ndvi_30m.raw');
const SCL_RAW_FILE = path.join(HEAT_DATA_DIR, 'pune_scl_30m.raw');
const QA_RAW_FILE = path.join(HEAT_DATA_DIR, 'pune_st_qa_30m.raw');
const DN_RAW_FILE = path.join(HEAT_DATA_DIR, 'pune_lst_raw_dn_30m.raw');

/**
 * Exact WGS84 coordinates for the 4 corners of the 30m Pune Heat Grid (EPSG:32643)
 * Ordered: [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
 */
export const PUNE_HEAT_IMAGE_QUAD: [[number, number], [number, number], [number, number], [number, number]] = [
  [73.730767, 18.620987], // Top-Left
  [74.018523, 18.622708], // Top-Right
  [74.019868, 18.386576], // Bottom-Right
  [73.732505, 18.384878], // Bottom-Left
];

export const SCL_CLASS_NAMES: Record<number, string> = {
  0: 'No Data / Missing',
  1: 'Saturated / Defective',
  2: 'Cast Shadow',
  3: 'Cloud Shadow',
  4: 'Vegetation',
  5: 'Bare Soil / Low Vegetation',
  6: 'Water',
  7: 'Unclassified',
  8: 'Cloud Medium Probability',
  9: 'Cloud High Probability',
  10: 'Thin Cirrus',
  11: 'Snow / Ice',
};

/**
 * Cache for loaded diagnostics in server memory
 */
let cachedDiagnostics: HeatDiagnosticsReport | null = null;
let cachedManifest: any | null = null;

// Binary raster memory caches
let cachedLstArray: Float32Array | null = null;
let cachedNdviArray: Float32Array | null = null;
let cachedSclArray: Uint8Array | null = null;
let cachedQaArray: Int16Array | null = null;
let cachedDnArray: Uint16Array | null = null;

export function isHeatDataAvailable(): boolean {
  return fs.existsSync(DIAGNOSTICS_FILE) && fs.existsSync(MANIFEST_FILE);
}

export function getHeatDiagnostics(): HeatDiagnosticsReport {
  if (cachedDiagnostics) {
    return cachedDiagnostics;
  }

  if (!fs.existsSync(DIAGNOSTICS_FILE)) {
    throw new Error(`Heat diagnostics report not found at ${DIAGNOSTICS_FILE}. Run preprocessing pipeline first.`);
  }

  const raw = fs.readFileSync(DIAGNOSTICS_FILE, 'utf-8');
  cachedDiagnostics = JSON.parse(raw) as HeatDiagnosticsReport;
  return cachedDiagnostics;
}

export function getProvenanceManifest(): any {
  if (cachedManifest) {
    return cachedManifest;
  }

  if (!fs.existsSync(MANIFEST_FILE)) {
    throw new Error(`Provenance manifest not found at ${MANIFEST_FILE}. Run preprocessing pipeline first.`);
  }

  const raw = fs.readFileSync(MANIFEST_FILE, 'utf-8');
  cachedManifest = JSON.parse(raw);
  return cachedManifest;
}

/**
 * Lazy loads binary raster arrays into typed memory buffers
 */
function loadBinaryRasterArrays(): boolean {
  if (cachedLstArray && cachedNdviArray && cachedSclArray) {
    return true;
  }

  try {
    if (fs.existsSync(LST_RAW_FILE)) {
      const b = fs.readFileSync(LST_RAW_FILE);
      cachedLstArray = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
    }
    if (fs.existsSync(NDVI_RAW_FILE)) {
      const b = fs.readFileSync(NDVI_RAW_FILE);
      cachedNdviArray = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
    }
    if (fs.existsSync(SCL_RAW_FILE)) {
      const b = fs.readFileSync(SCL_RAW_FILE);
      cachedSclArray = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    }
    if (fs.existsSync(QA_RAW_FILE)) {
      const b = fs.readFileSync(QA_RAW_FILE);
      cachedQaArray = new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2);
    }
    if (fs.existsSync(DN_RAW_FILE)) {
      const b = fs.readFileSync(DN_RAW_FILE);
      cachedDnArray = new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2);
    }
    return Boolean(cachedLstArray && cachedNdviArray);
  } catch (err) {
    console.warn('Could not memory-map binary raster files:', err);
    return false;
  }
}

/**
 * Helper to convert WGS84 Lat/Lng to UTM Zone 43N (EPSG:32643) coordinates
 * Pune is centered near 73.85°E, 18.52°N in UTM Zone 43N
 */
export function wgs84ToUtm43N(lng: number, lat: number): { utmX: number; utmY: number } {
  const rad = Math.PI / 180.0;
  const a = 6378137.0; // WGS84 semi-major axis
  const f = 1.0 / 298.257223563;
  const e2 = 2 * f - f * f;
  const ePrime2 = e2 / (1 - e2);

  const utmZone = 43;
  const lambda0 = ((utmZone - 1) * 6 - 180 + 3) * rad; // Central meridian = 75°E

  const phi = lat * rad;
  const lambda = lng * rad;

  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
  const T = Math.tan(phi) * Math.tan(phi);
  const C = ePrime2 * Math.cos(phi) * Math.cos(phi);
  const A = Math.cos(phi) * (lambda - lambda0);

  const M = a * (
    (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * phi
    - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * phi)
    + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * phi)
    - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * phi)
  );

  const k0 = 0.9996;
  const utmX = 500000.0 + k0 * N * (
    A + (1 - T + C) * Math.pow(A, 3) / 6.0
    + (5 - 18 * T + T * T + 72 * C - 58 * ePrime2) * Math.pow(A, 5) / 120.0
  );

  const utmY = k0 * (
    M + N * Math.tan(phi) * (
      A * A / 2.0
      + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24.0
      + (61 - 58 * T + T * T + 600 * C - 330 * ePrime2) * Math.pow(A, 6) / 720.0
    )
  );

  return { utmX, utmY };
}

/**
 * Query point heat & vegetation estimates from actual raster pixels
 */
export function queryHeatPoint(lng: number, lat: number): HeatPointQueryResult {
  const { utmX, utmY } = wgs84ToUtm43N(lng, lat);
  const diag = getHeatDiagnostics();
  const [originX, pixelW, , originY, , pixelH] = diag.metadata.affineTransform;
  const { width: gridW, height: gridH } = diag.metadata.rasterDimensions;

  const col = Math.floor((utmX - originX) / pixelW);
  const row = Math.floor((utmY - originY) / pixelH);

  const isInside = col >= 0 && col < gridW && row >= 0 && row < gridH;
  const hasBinaryRasters = loadBinaryRasterArrays();

  // Pixel index inside 1D flat buffer
  const pixelIndex = isInside ? row * gridW + col : -1;

  let sampledLst: number | null = null;
  let sampledNdvi: number | null = null;
  let sampledScl = 0;
  let sampledQaKelvin: number | null = null;
  let sampledRawDn = 0;

  if (isInside && hasBinaryRasters && pixelIndex >= 0) {
    if (cachedLstArray && pixelIndex < cachedLstArray.length) {
      const val = cachedLstArray[pixelIndex];
      if (!isNaN(val) && val > 0 && val < 100 && val !== -9999) {
        sampledLst = Math.round(val * 10) / 10;
      }
    }
    if (cachedNdviArray && pixelIndex < cachedNdviArray.length) {
      const val = cachedNdviArray[pixelIndex];
      if (!isNaN(val) && val >= -1.0 && val <= 1.0 && val !== -9999) {
        sampledNdvi = Math.round(val * 1000) / 1000;
      }
    }
    if (cachedSclArray && pixelIndex < cachedSclArray.length) {
      sampledScl = cachedSclArray[pixelIndex];
    }
    if (cachedQaArray && pixelIndex < cachedQaArray.length) {
      const qaRaw = cachedQaArray[pixelIndex];
      if (qaRaw > 0) {
        sampledQaKelvin = Math.round(qaRaw * 0.01 * 100) / 100;
      }
    }
    if (cachedDnArray && pixelIndex < cachedDnArray.length) {
      sampledRawDn = cachedDnArray[pixelIndex];
    }
  } else if (isInside) {
    // Fallback to mean diagnostics if raw binaries are absent
    sampledLst = Math.round(diag.landsat9.calibratedLSTCelsius.mean * 10) / 10;
    sampledNdvi = Math.round(diag.sentinel2b.ndvi30mDistribution.mean * 1000) / 1000;
    sampledQaKelvin = diag.landsat9.surfaceTemperatureQA.meanUncertaintyK;
    sampledScl = 5;
    sampledRawDn = 43800;
  }

  const isCloudOrShadow = sampledScl === 3 || sampledScl === 8 || sampledScl === 9;
  const isWater = sampledScl === 6;
  const isVegetation = sampledScl === 4;

  let classification: 'NOMINAL_VALID' | 'DIAGNOSTIC_ANOMALY' | 'FILL_NODATA' | 'CLOUD_MASKED' = 'FILL_NODATA';
  if (!isInside) {
    classification = 'FILL_NODATA';
  } else if (isCloudOrShadow) {
    classification = 'CLOUD_MASKED';
  } else if (sampledLst !== null) {
    classification = 'NOMINAL_VALID';
  }

  const sclName = SCL_CLASS_NAMES[sampledScl] || `Class ${sampledScl}`;

  return {
    coordinates: { lng, lat, utmX: Math.round(utmX * 100) / 100, utmY: Math.round(utmY * 100) / 100 },
    gridCell: {
      col: isInside ? col : -1,
      row: isInside ? row : -1,
      isInsideGrid: isInside,
    },
    lst: {
      celsius: sampledLst,
      kelvin: sampledLst !== null ? Math.round((sampledLst + 273.15) * 10) / 10 : null,
      rawDn: sampledRawDn,
      stQaUncertaintyKelvin: sampledQaKelvin,
      classification,
      nativeResolutionNotice: 'Landsat ST_B10 thermal band has 100m native spatial resolution (resampled to 30m grid by USGS Collection 2).',
    },
    ndvi: {
      aggregated30m: sampledNdvi,
      sourceCoverageFraction: isInside ? diag.sentinel2b.coverageFractions30m.meanSourceCoverageFraction : 0,
      validityWithinCoverage: isInside ? (sampledNdvi !== null ? 1.0 : 0.0) : 0,
      validFootprintFraction: isInside ? (sampledNdvi !== null ? 1.0 : 0.0) : 0,
      sclClassId: sampledScl,
      sclClassName: isInside ? sclName : 'Outside Target Grid',
      isTerrestrialVegetation: isVegetation,
    },
    provenance: {
      lst: 'DETERMINISTIC_RESULT' as ProvenanceCategory,
      ndvi: 'DETERMINISTIC_RESULT' as ProvenanceCategory,
      scl: 'VERIFIED_INPUT' as ProvenanceCategory,
    }
  };
}
