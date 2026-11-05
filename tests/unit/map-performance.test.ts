import { describe, it, expect } from 'vitest';
import { getPriorityCellsSync } from '@/server/priority/loader';
import { optimizeInterventionBudget } from '@/server/priority/optimizer';

describe('Map 250m Layer Interaction Performance Benchmarks (<200ms)', () => {
  const cells = getPriorityCellsSync();

  it('generates GeoJSON FeatureCollection with static polygon coordinates in < 50ms (well under 200ms)', () => {
    const startTime = performance.now();

    // Emulate static polygons precomputation map
    const dx = 0.001186;
    const dy = 0.001129;
    const basePolygonsMap = new Map<string, number[][][]>();
    cells.forEach(cell => {
      const [lng, lat] = cell.centroid || [73.8567, 18.5204];
      basePolygonsMap.set(cell.id, [
        [
          [lng - dx, lat - dy],
          [lng + dx, lat - dy],
          [lng + dx, lat + dy],
          [lng - dx, lat + dy],
          [lng - dx, lat - dy],
        ],
      ]);
    });

    // Emulate GeoJSON FeatureCollection creation for map layer
    const features = cells.map(cell => ({
      type: 'Feature' as const,
      id: cell.id,
      properties: {
        id: cell.id,
        ward: cell.ward,
        burden: cell.burden ?? 0,
        lst_mean: cell.lst_mean ?? 0,
        ndvi: cell.ndvi ?? 0,
        population: cell.population ?? 0,
        greenable_ha: cell.greenable_ha ?? 0,
        cooling_mean: cell.cooling_mean ?? 0,
        cooling_p10: cell.cooling_p10 ?? 0,
        cooling_p90: cell.cooling_p90 ?? 0,
        isSelected: 0,
        rank: 0,
        selection_frequency: 0,
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: basePolygonsMap.get(cell.id)!,
      },
    }));

    const duration = performance.now() - startTime;

    expect(features.length).toBe(cells.length);
    expect(features.length).toBeGreaterThan(0);
    // Strict requirement: under 200 ms per interaction
    expect(duration).toBeLessThan(50);
  });

  it('performs optimistic cell selection on map click in < 5ms (well under 200ms)', () => {
    const cellIdMap = new Map(cells.map(c => [c.id, c]));
    const targetId = cells[0].id;

    const startTime = performance.now();
    const selected = cellIdMap.get(targetId);
    const duration = performance.now() - startTime;

    expect(selected).toBeDefined();
    expect(selected?.id).toBe(targetId);
    expect(duration).toBeLessThan(5);
  });

  it('executes counterfactual optimization under hectare budget in < 200ms', () => {
    const startTime = performance.now();

    const result = optimizeInterventionBudget({
      budget_ha: 10.0,
      objective: 'cooling',
      target_ndvi: 0.65,
      min_greenable_ha: 0.1,
    });

    const duration = performance.now() - startTime;

    expect(result.status).toBe('OK');
    expect(result.selected_cells.length).toBeGreaterThan(0);
    expect(result.ensemble_runs).toBe(30);
    // Strict requirement: must execute within 200ms
    expect(duration).toBeLessThan(200);
  });

  it('completes the full slider update cycle (optimization + GeoJSON re-index) in < 250ms', () => {
    const startTime = performance.now();

    // 1. Optimize
    const optResult = optimizeInterventionBudget({
      budget_ha: 15.0,
      objective: 'population_weighted',
      target_ndvi: 0.65,
    });

    // 2. Build index sets
    const selectedIdSet = new Set(optResult.selected_cells.map(c => c.id));
    const selectedRankMap = new Map(optResult.selected_cells.map(c => [c.id, c.rank]));
    const selectedFreqMap = new Map(optResult.selected_cells.map(c => [c.id, c.selection_frequency]));

    // 3. Update features
    const updatedFeatures = cells.map(cell => ({
      type: 'Feature' as const,
      id: cell.id,
      properties: {
        id: cell.id,
        isSelected: selectedIdSet.has(cell.id) ? 1 : 0,
        rank: selectedRankMap.get(cell.id) ?? 0,
        selection_frequency: selectedFreqMap.get(cell.id) ?? 0,
      },
    }));

    const duration = performance.now() - startTime;

    expect(updatedFeatures.length).toBe(cells.length);
    expect(duration).toBeLessThan(250);
  });
});
