import fs from 'fs';
import path from 'path';
import { 
  PriorityCell, 
  PriorityModelCard, 
  EnsembleStats 
} from './types';

export * from './types';

/**
 * Feature flag identifier for Priority Engine Mode
 */
export const FEATURE_FLAG_PRIORITY_MODE = 'NEXT_PUBLIC_PRIORITY_MODE';

/**
 * Check whether Priority Mode feature flag is enabled
 */
export function isPriorityModeEnabled(): boolean {
  const envVal = process.env.NEXT_PUBLIC_PRIORITY_MODE;
  if (!envVal) return false;
  const normalized = envVal.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

/**
 * Path configuration for Priority Engine data artifacts
 */
export const PRIORITY_DATA_DIR = path.join(process.cwd(), 'public', 'data', 'priority');
export const CELLS_FILE = path.join(PRIORITY_DATA_DIR, 'cells.json');
export const ENSEMBLE_FILE = path.join(PRIORITY_DATA_DIR, 'ensemble_effects.bin');
export const MODEL_CARD_FILE = path.join(PRIORITY_DATA_DIR, 'model_card.json');

/**
 * Number of Monte Carlo / physical ensemble members per 250m cell
 */
export const ENSEMBLE_MEMBERS_PER_CELL = 30;

// In-memory typed caches for high-throughput zero-copy reads
let cachedCells: PriorityCell[] | null = null;
let cachedModelCard: PriorityModelCard | null = null;
let cachedEnsembleBuffer: Float32Array | null = null;

/**
 * Reset server-side memory caches (useful during tests or hot-reloading)
 */
export function clearPriorityCache(): void {
  cachedCells = null;
  cachedModelCard = null;
  cachedEnsembleBuffer = null;
}

/**
 * Check whether all required Priority Engine artifact files exist on disk
 */
export function isPriorityDataAvailable(): boolean {
  try {
    return (
      fs.existsSync(CELLS_FILE) &&
      fs.existsSync(ENSEMBLE_FILE) &&
      fs.existsSync(MODEL_CARD_FILE)
    );
  } catch {
    return false;
  }
}

/**
 * Synchronously load and parse 250m priority cells from cells.json
 */
export function getPriorityCellsSync(): PriorityCell[] {
  if (cachedCells) {
    return cachedCells;
  }

  if (!fs.existsSync(CELLS_FILE)) {
    throw new Error(
      `Priority cells artifact not found at ${CELLS_FILE}. Ensure public/data/priority/cells.json exists.`
    );
  }

  const raw = fs.readFileSync(CELLS_FILE, 'utf-8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid cells.json format: expected an array of PriorityCell objects.`);
  }

  // Strictly enforce typed schema and preserve null for unknown metrics
  cachedCells = parsed.map((item: any, idx: number): PriorityCell => {
    if (!item.id || !Array.isArray(item.centroid) || item.centroid.length !== 2) {
      throw new Error(`Invalid PriorityCell at index ${idx}: missing valid id or centroid.`);
    }

    return {
      id: String(item.id),
      centroid: [Number(item.centroid[0]), Number(item.centroid[1])],
      ward: String(item.ward || 'Unknown Ward'),
      population: item.population !== null && item.population !== undefined ? Number(item.population) : null,
      lst_mean: item.lst_mean !== null && item.lst_mean !== undefined ? Number(item.lst_mean) : null,
      lst_std: item.lst_std !== null && item.lst_std !== undefined ? Number(item.lst_std) : null,
      n_obs: typeof item.n_obs === 'number' ? item.n_obs : 0,
      ndvi: item.ndvi !== null && item.ndvi !== undefined ? Number(item.ndvi) : null,
      built_frac: item.built_frac !== null && item.built_frac !== undefined ? Number(item.built_frac) : null,
      greenable_ha: item.greenable_ha !== null && item.greenable_ha !== undefined ? Number(item.greenable_ha) : null,
      burden: item.burden !== null && item.burden !== undefined ? Number(item.burden) : null,
      cooling_mean: item.cooling_mean !== null && item.cooling_mean !== undefined ? Number(item.cooling_mean) : null,
      cooling_p10: item.cooling_p10 !== null && item.cooling_p10 !== undefined ? Number(item.cooling_p10) : null,
      cooling_p90: item.cooling_p90 !== null && item.cooling_p90 !== undefined ? Number(item.cooling_p90) : null,
    };
  });

  return cachedCells;
}

/**
 * Asynchronously load 250m priority cells from cells.json
 */
export async function loadPriorityCells(): Promise<PriorityCell[]> {
  return getPriorityCellsSync();
}

/**
 * Synchronously load priority model card from model_card.json
 */
export function getPriorityModelCardSync(): PriorityModelCard {
  if (cachedModelCard) {
    return cachedModelCard;
  }

  if (!fs.existsSync(MODEL_CARD_FILE)) {
    throw new Error(
      `Priority model card not found at ${MODEL_CARD_FILE}. Ensure public/data/priority/model_card.json exists.`
    );
  }

  const raw = fs.readFileSync(MODEL_CARD_FILE, 'utf-8');
  cachedModelCard = JSON.parse(raw) as PriorityModelCard;
  return cachedModelCard;
}

/**
 * Asynchronously load priority model card from model_card.json
 */
export async function loadPriorityModelCard(): Promise<PriorityModelCard> {
  return getPriorityModelCardSync();
}

/**
 * Synchronously load binary Float32 ensemble cooling predictions
 * File format: IEEE 754 32-bit floats, length = num_cells * 30
 */
export function getEnsembleEffectsSync(): Float32Array {
  if (cachedEnsembleBuffer) {
    return cachedEnsembleBuffer;
  }

  if (!fs.existsSync(ENSEMBLE_FILE)) {
    throw new Error(
      `Priority ensemble binary not found at ${ENSEMBLE_FILE}. Ensure public/data/priority/ensemble_effects.bin exists.`
    );
  }

  const fileBuffer = fs.readFileSync(ENSEMBLE_FILE);

  // Validate byte length is divisible by 4 (Float32) and by 30 (members)
  if (fileBuffer.byteLength % (ENSEMBLE_MEMBERS_PER_CELL * 4) !== 0) {
    console.warn(
      `[PriorityLoader] Warning: ensemble_effects.bin length (${fileBuffer.byteLength} bytes) is not an exact multiple of 30 Float32s (120 bytes).`
    );
  }

  // Create Float32Array from Node Buffer
  cachedEnsembleBuffer = new Float32Array(
    fileBuffer.buffer,
    fileBuffer.byteOffset,
    Math.floor(fileBuffer.byteLength / 4)
  );

  return cachedEnsembleBuffer;
}

/**
 * Asynchronously load binary Float32 ensemble cooling predictions
 */
export async function loadEnsembleEffects(): Promise<Float32Array> {
  return getEnsembleEffectsSync();
}

/**
 * Retrieve the 30-member predicted cooling ensemble array for a specific cell index
 * 
 * @param cellIndex 0-indexed position corresponding to cell in cells.json
 * @returns Float32Array of length 30, or null if out of range or unsimulated
 */
export function getCellEnsemble(cellIndex: number): Float32Array | null {
  if (cellIndex < 0) return null;

  const buffer = getEnsembleEffectsSync();
  const startIndex = cellIndex * ENSEMBLE_MEMBERS_PER_CELL;
  const endIndex = startIndex + ENSEMBLE_MEMBERS_PER_CELL;

  if (endIndex > buffer.length) {
    return null;
  }

  // Extract subarray view (zero-copy)
  const cellSlice = buffer.subarray(startIndex, endIndex);

  // If the cell contains all NaNs, it indicates unmeasured/unsimulated cell
  let validCount = 0;
  for (let i = 0; i < cellSlice.length; i++) {
    if (!Number.isNaN(cellSlice[i])) {
      validCount++;
    }
  }

  if (validCount === 0) {
    return null;
  }

  return cellSlice;
}

/**
 * Calculate distribution statistics for a cell's 30-member ensemble
 */
export function getCellEnsembleStats(cellIndexOrId: number | string): EnsembleStats | null {
  const cells = getPriorityCellsSync();
  const cellIndex = typeof cellIndexOrId === 'string'
    ? cells.findIndex(c => c.id === cellIndexOrId)
    : cellIndexOrId;

  if (cellIndex < 0 || cellIndex >= cells.length) {
    return null;
  }

  const cell = cells[cellIndex];
  const ensemble = getCellEnsemble(cellIndex);

  if (!ensemble) {
    return {
      cellIndex,
      cellId: cell.id,
      memberCount: 0,
      mean: null,
      p10: null,
      p90: null,
      min: null,
      max: null,
      spread: null,
      values: []
    };
  }

  const values: number[] = [];
  let sum = 0;

  for (let i = 0; i < ensemble.length; i++) {
    const val = ensemble[i];
    if (!Number.isNaN(val)) {
      values.push(val);
      sum += val;
    }
  }

  if (values.length === 0) {
    return {
      cellIndex,
      cellId: cell.id,
      memberCount: 0,
      mean: null,
      p10: null,
      p90: null,
      min: null,
      max: null,
      spread: null,
      values: []
    };
  }

  values.sort((a, b) => a - b);
  const mean = Number((sum / values.length).toFixed(2));
  const min = values[0];
  const max = values[values.length - 1];

  // 10th and 90th percentile estimation
  const p10Index = Math.min(values.length - 1, Math.max(0, Math.floor(values.length * 0.1)));
  const p90Index = Math.min(values.length - 1, Math.max(0, Math.floor(values.length * 0.9)));
  const p10 = values[p10Index];
  const p90 = values[p90Index];
  const spread = Number((p90 - p10).toFixed(2));

  return {
    cellIndex,
    cellId: cell.id,
    memberCount: values.length,
    mean,
    p10,
    p90,
    min,
    max,
    spread,
    values
  };
}

/**
 * Query a priority cell by its unique ID
 */
export function getPriorityCellById(id: string): PriorityCell | null {
  const cells = getPriorityCellsSync();
  return cells.find(c => c.id === id) || null;
}

/**
 * Query priority cells by PMC administrative ward
 */
export function getPriorityCellsByWard(ward: string): PriorityCell[] {
  const cells = getPriorityCellsSync();
  const normalized = ward.trim().toLowerCase();
  return cells.filter(c => c.ward.trim().toLowerCase() === normalized);
}

// Convenient export aliases
export const getModelCardSync = getPriorityModelCardSync;
export const getPriorityCellByIdSync = getPriorityCellById;
