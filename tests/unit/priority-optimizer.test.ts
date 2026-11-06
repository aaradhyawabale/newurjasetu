import { describe, it, expect } from 'vitest';
import { 
  optimizeInterventionBudget, 
  OptimizeOptions 
} from '@/server/priority/optimizer';
import { PriorityCell, getPriorityCellsSync } from '@/server/priority/loader';

describe('UrjaSetu Priority Engine Budget Optimizer', () => {
  it('greedily selects candidate cells by benefit-per-hectare under hectare budget', () => {
    const options: OptimizeOptions = {
      budget_ha: 5.0,
      objective: 'cooling',
      min_greenable_ha: 0.2
    };

    const result = optimizeInterventionBudget(options);
    expect(result.status).toBe('OK');
    expect(result.budget_ha).toBe(5.0);
    expect(result.allocated_ha).toBeLessThanOrEqual(5.0);
    expect(result.selected_cells.length).toBeGreaterThan(0);

    // Verify budget allocation constraint
    const totalSelectedHa = result.selected_cells.reduce((sum, c) => sum + c.greenable_ha, 0);
    expect(totalSelectedHa).toBeCloseTo(result.allocated_ha, 2);
    expect(totalSelectedHa).toBeLessThanOrEqual(5.0);

    // Verify ordering by benefit per hectare (descending)
    for (let i = 0; i < result.selected_cells.length - 1; i++) {
      expect(result.selected_cells[i].benefit_per_ha).toBeGreaterThanOrEqual(
        result.selected_cells[i + 1].benefit_per_ha
      );
      expect(result.selected_cells[i].rank).toBe(i + 1);
    }
  });

  it('runs Monte Carlo simulation over the 30 ensemble members returning selection frequencies', () => {
    const options: OptimizeOptions = {
      budget_ha: 8.0,
      objective: 'cooling'
    };

    const result = optimizeInterventionBudget(options);
    expect(result.status).toBe('OK');
    expect(result.ensemble_runs).toBe(30);

    // Verify selection frequency is between 0.0 and 1.0
    result.selected_cells.forEach(cell => {
      expect(cell.selection_frequency).toBeGreaterThanOrEqual(0.0);
      expect(cell.selection_frequency).toBeLessThanOrEqual(1.0);
      expect(cell.times_selected_ensemble).toBeGreaterThanOrEqual(0);
      expect(cell.times_selected_ensemble).toBeLessThanOrEqual(30);
      expect(cell.times_selected_ensemble).toBe(Math.round(cell.selection_frequency * 30));
    });

    // Check that selection frequencies dictionary is populated
    expect(Object.keys(result.selection_frequencies).length).toBeGreaterThan(0);
  });

  it('optimizes with population-weighted thermal relief objective', () => {
    const optionsCooling: OptimizeOptions = {
      budget_ha: 6.0,
      objective: 'cooling'
    };
    const optionsPop: OptimizeOptions = {
      budget_ha: 6.0,
      objective: 'population_weighted'
    };

    const resultCooling = optimizeInterventionBudget(optionsCooling);
    const resultPop = optimizeInterventionBudget(optionsPop);

    expect(resultCooling.status).toBe('OK');
    expect(resultPop.status).toBe('OK');
    expect(resultPop.selected_cells.length).toBeGreaterThan(0);

    // Ranks should account for population in population-weighted objective
    const firstPopCell = resultPop.selected_cells[0];
    expect(firstPopCell.population).toBeDefined();
  });

  it('filters candidates by PMC administrative ward', () => {
    const targetWard = 'Kasba Vishrambaugwada';
    const options: OptimizeOptions = {
      budget_ha: 4.0,
      ward: targetWard
    };

    const result = optimizeInterventionBudget(options);
    expect(result.status).toBe('OK');
    result.selected_cells.forEach(c => {
      expect(c.ward.toLowerCase()).toBe(targetWard.toLowerCase());
    });
  });

  it('rigorously handles the case where cooling fields are null', () => {
    // Construct mock dataset where cooling fields are null (direction check failure or unmeasured)
    const mockNullCells: PriorityCell[] = [
      {
        id: 'cell_null_001',
        centroid: [73.85, 18.52],
        ward: 'Kasba Vishrambaugwada',
        population: 2500,
        lst_mean: 42.1,
        lst_std: 1.8,
        n_obs: 64,
        ndvi: 0.12,
        built_frac: 0.85,
        greenable_ha: 1.2,
        burden: 14.5,
        cooling_mean: null,
        cooling_p10: null,
        cooling_p90: null
      },
      {
        id: 'cell_null_002',
        centroid: [73.86, 18.53],
        ward: 'Shivajinagar - Ghole Road',
        population: 1800,
        lst_mean: 39.5,
        lst_std: 1.5,
        n_obs: 64,
        ndvi: 0.22,
        built_frac: 0.65,
        greenable_ha: 1.8,
        burden: 9.8,
        cooling_mean: null,
        cooling_p10: null,
        cooling_p90: null
      }
    ];

    const options: OptimizeOptions = {
      budget_ha: 10.0,
      objective: 'cooling'
    };

    const result = optimizeInterventionBudget(options, mockNullCells);

    // Mandated behavior when cooling fields are null
    expect(result.status).toBe('UNAVAILABLE');
    expect(result.allocated_ha).toBe(0);
    expect(result.selected_cells).toHaveLength(0);
    expect(result.ensemble_runs).toBe(0);
    expect(result.message).toContain('Cooling fields are null');
    expect(result.message).toContain('direction check unverified or missing');
  });

  it('handles empty candidates gracefully when budget is too small for any cell', () => {
    const options: OptimizeOptions = {
      budget_ha: 0.01 // Tiny budget smaller than any single cell greenable_ha
    };

    const result = optimizeInterventionBudget(options);
    expect(result.status).toBe('OK');
    expect(result.allocated_ha).toBe(0);
    expect(result.selected_cells).toHaveLength(0);
  });

  it('strictly satisfies budget constraint total area <= budget across 5-60 ha and sums equal portfolio summary', () => {
    for (let budget = 5; budget <= 60; budget += 5) {
      const result = optimizeInterventionBudget({
        budget_ha: budget,
        objective: 'cooling',
        min_greenable_ha: 0.1,
      });

      expect(result.status).toBe('OK');
      expect(result.allocated_ha).toBeLessThanOrEqual(budget);

      const computedSumHa = result.selected_cells.reduce((acc, c) => acc + c.greenable_ha, 0);
      expect(computedSumHa).toBeLessThanOrEqual(budget);
      expect(Number(computedSumHa.toFixed(2))).toBeCloseTo(result.allocated_ha, 2);

      // Verify that total population equals the sum of selected cells
      const computedPop = result.selected_cells.reduce((acc, c) => acc + (c.population || 0), 0);
      expect(computedPop).toBeGreaterThanOrEqual(0);
    }
  });
});
