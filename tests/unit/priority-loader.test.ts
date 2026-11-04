import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isPriorityModeEnabled,
  isPriorityDataAvailable,
  getPriorityCellsSync,
  loadPriorityCells,
  getPriorityModelCardSync,
  loadPriorityModelCard,
  getEnsembleEffectsSync,
  loadEnsembleEffects,
  getCellEnsemble,
  getCellEnsembleStats,
  getPriorityCellById,
  getPriorityCellsByWard,
  clearPriorityCache,
  ENSEMBLE_MEMBERS_PER_CELL
} from '@/server/priority/loader';

describe('UrjaSetu Priority Engine Typed Loader', () => {
  beforeEach(() => {
    clearPriorityCache();
  });

  afterEach(() => {
    clearPriorityCache();
  });

  it('evaluates feature flag NEXT_PUBLIC_PRIORITY_MODE correctly', () => {
    const original = process.env.NEXT_PUBLIC_PRIORITY_MODE;
    try {
      process.env.NEXT_PUBLIC_PRIORITY_MODE = 'true';
      expect(isPriorityModeEnabled()).toBe(true);

      process.env.NEXT_PUBLIC_PRIORITY_MODE = '1';
      expect(isPriorityModeEnabled()).toBe(true);

      process.env.NEXT_PUBLIC_PRIORITY_MODE = 'false';
      expect(isPriorityModeEnabled()).toBe(false);

      delete process.env.NEXT_PUBLIC_PRIORITY_MODE;
      expect(isPriorityModeEnabled()).toBe(false);
    } finally {
      process.env.NEXT_PUBLIC_PRIORITY_MODE = original;
    }
  });

  it('detects generated priority artifacts on disk', () => {
    expect(isPriorityDataAvailable()).toBe(true);
  });

  it('loads valid 250m cells synchronously and asynchronously with full schema adherence', async () => {
    const syncCells = getPriorityCellsSync();
    expect(Array.isArray(syncCells)).toBe(true);
    expect(syncCells.length).toBeGreaterThan(0);

    const asyncCells = await loadPriorityCells();
    expect(asyncCells).toHaveLength(syncCells.length);

    // Verify first cell schema
    const first = syncCells[0];
    expect(first.id).toMatch(/^cell_250m_\d+$/);
    expect(first.centroid).toHaveLength(2);
    expect(typeof first.centroid[0]).toBe('number'); // lng
    expect(typeof first.centroid[1]).toBe('number'); // lat
    expect(typeof first.ward).toBe('string');
    expect(first.ward.length).toBeGreaterThan(0);
    expect(first.n_obs).toBeGreaterThan(0);

    // Verify coordinates are within Pune bounding area
    expect(first.centroid[0]).toBeGreaterThan(73.7);
    expect(first.centroid[0]).toBeLessThan(74.1);
    expect(first.centroid[1]).toBeGreaterThan(18.3);
    expect(first.centroid[1]).toBeLessThan(18.7);
  });

  it('preserves null values without fabricating or substituting synthetic zeros', () => {
    const cells = getPriorityCellsSync();
    
    // Find our intentional null test cell
    const nullCell = cells.find(c => c.population === null);
    expect(nullCell).toBeDefined();
    
    if (nullCell) {
      expect(nullCell.population).toBeNull();
      expect(nullCell.lst_mean).toBeNull();
      expect(nullCell.lst_std).toBeNull();
      expect(nullCell.ndvi).toBeNull();
      expect(nullCell.built_frac).toBeNull();
      expect(nullCell.greenable_ha).toBeNull();
      expect(nullCell.burden).toBeNull();
      expect(nullCell.cooling_mean).toBeNull();
      expect(nullCell.cooling_p10).toBeNull();
      expect(nullCell.cooling_p90).toBeNull();
    }
  });

  it('loads model card with metrics, dates, authentic sources, and scientific limitations', async () => {
    const card = getPriorityModelCardSync();
    expect(card).toBeDefined();
    expect(card.model_name).toContain('Priority Engine');
    expect(card.spatial_resolution.cell_size_meters).toBe(250);
    expect(card.spatial_resolution.cell_area_hectares).toBe(6.25);

    // Metrics validation
    expect(card.metrics.ensemble_members).toBe(30);
    expect(card.metrics.rmse_celsius).toBeGreaterThan(0);
    expect(card.metrics.r2_score).toBeGreaterThan(0.5);

    // Dates validation
    expect(card.dates.landsat9_overpass).toBeDefined();
    expect(card.dates.sentinel2b_overpass).toBeDefined();

    // Sources validation
    expect(card.sources.length).toBeGreaterThanOrEqual(4);
    const sourceNames = card.sources.map(s => s.name);
    expect(sourceNames.some(s => s.includes('Landsat 9'))).toBe(true);
    expect(sourceNames.some(s => s.includes('Sentinel-2'))).toBe(true);
    expect(sourceNames.some(s => s.includes('PMC'))).toBe(true);

    // Limitations validation (Scientific rules)
    expect(card.limitations.some(l => l.includes('not air temperature'))).toBe(true);
    expect(card.limitations.some(l => l.includes('not canopy cover'))).toBe(true);
    expect(card.limitations.some(l => l.includes('No arbitrary weighted'))).toBe(true);

    const asyncCard = await loadPriorityModelCard();
    expect(asyncCard.version).toBe(card.version);
  });

  it('loads binary ensemble buffer and extracts 30-member distributions per cell', async () => {
    const cells = getPriorityCellsSync();
    const buffer = getEnsembleEffectsSync();
    expect(buffer).toBeInstanceOf(Float32Array);
    expect(buffer.length).toBe(cells.length * ENSEMBLE_MEMBERS_PER_CELL);

    const asyncBuffer = await loadEnsembleEffects();
    expect(asyncBuffer.length).toBe(buffer.length);

    // Extract ensemble for first valid cell
    const cell0Ensemble = getCellEnsemble(0);
    expect(cell0Ensemble).not.toBeNull();
    expect(cell0Ensemble).toHaveLength(ENSEMBLE_MEMBERS_PER_CELL);

    // Verify cell ensemble statistics
    const stats0 = getCellEnsembleStats(0);
    expect(stats0).not.toBeNull();
    expect(stats0?.memberCount).toBe(30);
    expect(stats0?.mean).toBeGreaterThan(0);
    expect(stats0?.p10).toBeLessThanOrEqual(stats0?.p90!);
    expect(stats0?.spread).toBeCloseTo((stats0?.p90! - stats0?.p10!), 1);

    // Out-of-bounds cell index returns null
    expect(getCellEnsemble(-1)).toBeNull();
    expect(getCellEnsemble(cells.length + 100)).toBeNull();
    expect(getCellEnsembleStats(-1)).toBeNull();
  });

  it('queries cells by ID and by PMC administrative ward', () => {
    const cells = getPriorityCellsSync();
    const target = cells[0];

    const queried = getPriorityCellById(target.id);
    expect(queried).not.toBeNull();
    expect(queried?.id).toBe(target.id);

    const missing = getPriorityCellById('non-existent-cell-id');
    expect(missing).toBeNull();

    const wardCells = getPriorityCellsByWard(target.ward);
    expect(wardCells.length).toBeGreaterThan(0);
    wardCells.forEach(c => {
      expect(c.ward.toLowerCase()).toBe(target.ward.toLowerCase());
    });
  });
});
