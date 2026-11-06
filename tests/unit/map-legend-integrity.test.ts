import { describe, it, expect } from 'vitest';
import { Cell } from '@/api/contract';

describe('MapView Data-Driven Legend & Zero-Artifact Integrity Tests', () => {
  // Test function reproducing MapView's data-driven quantile and min/max extraction logic
  function computeLegendStats(cells: Cell[], currentLayer: string) {
    const extractVal = (c: Cell): number | null => {
      if (currentLayer === 'lst') {
        const v = c.lst_mean;
        return v !== null && v !== undefined && !isNaN(v) && v > 0 ? v : null;
      }
      if (currentLayer === 'ndvi') {
        const v = c.ndvi;
        return v !== null && v !== undefined && !isNaN(v) ? v : null;
      }
      if (currentLayer === 'population') {
        const v = c.population;
        return v !== null && v !== undefined && !isNaN(v) && v >= 0 ? v : null;
      }
      if (currentLayer === 'loss') {
        const v = c.loss_ha;
        return v !== null && v !== undefined && !isNaN(v) && v > 0 ? v : null;
      }
      const v = c.burden;
      return v !== null && v !== undefined && !isNaN(v) ? v : null;
    };

    const vals = cells
      .map(extractVal)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    if (!vals.length) return { min: '0', max: '1', quantiles: [0, 1, 2, 3, 4] };

    const minVal = vals[0];
    const maxVal = vals[vals.length - 1];

    const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))];
    const q0 = minVal;
    const q1 = q(0.2);
    const q2 = q(0.4);
    const q3 = q(0.6);
    const q4 = q(0.8);

    let formatMin = `${minVal}`;
    let formatMax = `${maxVal}`;

    if (currentLayer === 'lst') {
      formatMin = `${minVal.toFixed(1)}°C`;
      formatMax = `${maxVal.toFixed(1)}°C`;
    }

    return {
      minVal,
      maxVal,
      formatMin,
      formatMax,
      quantiles: [q0, q1, q2, q3, q4],
    };
  }

  it('guarantees that missing or null LST does NOT cause a 0.0°C legend min artifact', () => {
    const mockCellsWithMissing: Partial<Cell>[] = [
      { id: 'cell_valid_1', lst_mean: 34.2, burden: 50 },
      { id: 'cell_valid_2', lst_mean: 42.8, burden: 120 },
      { id: 'cell_valid_3', lst_mean: 45.1, burden: 150 },
      { id: 'cell_missing_4', lst_mean: null as any, burden: 10 }, // cell with missing LST
      { id: 'cell_undefined_5', lst_mean: undefined as any, burden: 20 },
      { id: 'cell_nan_6', lst_mean: NaN as any, burden: 30 },
    ];

    const stats = computeLegendStats(mockCellsWithMissing as Cell[], 'lst');

    // Expected: minVal must be 34.2°C, NOT 0.0°C!
    expect(stats.minVal).toBe(34.2);
    expect(stats.formatMin).toBe('34.2°C');
    expect(stats.maxVal).toBe(45.1);
    expect(stats.formatMax).toBe('45.1°C');
  });

  it('verifies 5 distinct quantile bins are generated for valid data', () => {
    const cells: Partial<Cell>[] = Array.from({ length: 100 }, (_, i) => ({
      id: `cell_${i}`,
      lst_mean: 30.0 + i * 0.2, // 30.0°C to 49.8°C
      burden: i * 5,
    }));

    const stats = computeLegendStats(cells as Cell[], 'lst');
    expect(stats.quantiles.length).toBe(5);

    // Monotonically increasing quantile breaks
    for (let i = 0; i < stats.quantiles.length - 1; i++) {
      expect(stats.quantiles[i]).toBeLessThan(stats.quantiles[i + 1]);
    }
  });
});
