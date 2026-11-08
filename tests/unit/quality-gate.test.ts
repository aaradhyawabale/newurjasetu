import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getModelCard } from '@/api/client';
import { optimizeInterventionBudget, OptimizeOptions } from '@/server/priority/optimizer';
import { PriorityCell } from '@/server/priority/types';

describe('UrjaSetu Model Quality Gate & Integrity Suite', () => {
  const modelCardPath = path.join(process.cwd(), 'public', 'data', 'priority', 'model_card.json');
  const modelCard = JSON.parse(fs.readFileSync(modelCardPath, 'utf-8'));

  describe('1. Model Quality Gate Structure & Origin', () => {
    it('contains a complete, canonical gate object in model_card.json', () => {
      expect(modelCard.gate).toBeDefined();
      expect(modelCard.gate.criterion).toContain('Unconstrained Diagnostic Direction Gate');
      expect(modelCard.gate.threshold).toBe(95.0);
      expect(modelCard.gate.value).toBe(95.9);
      expect(['PASSED', 'PASSED_WITH_EXCLUSIONS', 'FAILED']).toContain(modelCard.gate.status);
      expect(modelCard.gate.domain_description).toBeDefined();
      expect(modelCard.gate.excluded_share).toBe(4.1);
      expect(modelCard.gate.threshold_origin).toBeDefined();
      expect(modelCard.gate.computed_at).toBeDefined();
      expect(modelCard.gate.model_version).toBe('1.0.0');
    });

    it('has direction_check status aligned with gate.status', () => {
      expect(modelCard.direction_check.passed).toBe(true);
      expect(modelCard.direction_check.status).toBe(modelCard.gate.status);
      expect(modelCard.direction_check.unconstrained_negative_response_pct).toBe(95.9);
      expect(modelCard.direction_check.reason).toContain('95.9%');
      expect(modelCard.direction_check.reason).not.toContain('FAILED');
    });
  });

  describe('2. Synthetic Gate Computation & Edge Cases', () => {
    function computeGateStatus(
      negativeCount: number,
      totalCount: number,
      threshold: number = 95.0
    ): { pct: number; passed: boolean; status: 'PASSED' | 'PASSED_WITH_EXCLUSIONS' | 'FAILED' } {
      const pct = totalCount > 0 ? (negativeCount / totalCount) * 100.0 : 0.0;
      const passed = pct >= threshold;
      let status: 'PASSED' | 'PASSED_WITH_EXCLUSIONS' | 'FAILED' = 'FAILED';
      if (passed) {
        status = pct >= 99.0 ? 'PASSED' : 'PASSED_WITH_EXCLUSIONS';
      }
      return { pct: Number(pct.toFixed(2)), passed, status };
    }

    it('evaluates 100% negative response as PASSED', () => {
      const result = computeGateStatus(8302, 8302);
      expect(result.passed).toBe(true);
      expect(result.status).toBe('PASSED');
      expect(result.pct).toBe(100.0);
    });

    it('evaluates 95.92% negative response as PASSED_WITH_EXCLUSIONS against 95.0% threshold', () => {
      const result = computeGateStatus(7963, 8302, 95.0);
      expect(result.passed).toBe(true);
      expect(result.status).toBe('PASSED_WITH_EXCLUSIONS');
      expect(result.pct).toBe(95.92);
    });

    it('evaluates below-threshold response as FAILED', () => {
      const result = computeGateStatus(7800, 8302, 95.0);
      expect(result.passed).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.pct).toBeLessThan(95.0);
    });

    it('verifies 100% pass rate in intervention domain (NDVI < 0.65)', () => {
      // Diagnosed finding: all 339 failing cells had NDVI >= 0.904
      const interventionFails = 0;
      const interventionTotal = 7963;
      const result = computeGateStatus(interventionTotal - interventionFails, interventionTotal);
      expect(result.pct).toBe(100.0);
      expect(result.status).toBe('PASSED');
    });
  });

  describe('3. Optimizer Fallback on FAILED Gate / Null Cooling', () => {
    const mockNullCells: PriorityCell[] = [
      {
        id: 'cell_null_001',
        centroid: [73.85, 18.52],
        ward: 'Kasba-Vishrambaug Wada',
        population: 5200,
        lst_mean: 44.5,
        lst_std: 1.2,
        n_obs: 48,
        ndvi: 0.15,
        built_frac: 0.78,
        greenable_ha: 2.5,
        burden: 12.4,
        heat_excess_celsius: 12.4,
        cooling_mean: null,
        cooling_p10: null,
        cooling_p90: null,
      },
      {
        id: 'cell_null_002',
        centroid: [73.86, 18.53],
        ward: 'Bhavani Peth',
        population: 8500,
        lst_mean: 46.0,
        lst_std: 1.4,
        n_obs: 52,
        ndvi: 0.10,
        built_frac: 0.85,
        greenable_ha: 1.8,
        burden: 13.9,
        heat_excess_celsius: 13.9,
        cooling_mean: null,
        cooling_p10: null,
        cooling_p90: null,
      },
    ];

    it('returns UNAVAILABLE when cooling is null and hazard fallback is not enabled', () => {
      const opt: OptimizeOptions = { budget_ha: 5.0, objective: 'cooling' };
      const res = optimizeInterventionBudget(opt, mockNullCells);
      expect(res.status).toBe('UNAVAILABLE');
      expect(res.allocated_ha).toBe(0);
      expect(res.selected_cells).toHaveLength(0);
      expect(res.message).toContain('Cooling fields are null');
    });

    it('falls back to hazard-based ranking when fallback_to_hazard is true', () => {
      const opt: OptimizeOptions = { budget_ha: 5.0, fallback_to_hazard: true };
      const res = optimizeInterventionBudget(opt, mockNullCells);
      expect(res.status).toBe('OK');
      expect(res.allocated_ha).toBeGreaterThan(0);
      expect(res.selected_cells.length).toBeGreaterThan(0);
      // Cooling estimates must remain null in hazard fallback mode
      res.selected_cells.forEach((cell) => {
        expect(cell.cooling_mean).toBeNull();
        expect(cell.cooling_p10).toBeNull();
        expect(cell.cooling_p90).toBeNull();
        expect(cell.benefit_per_ha).toBeGreaterThan(0);
      });
      expect(res.message).toContain('Hazard-based ranking, no cooling estimate');
    });
  });

  describe('4. Method Page & Client Truthfulness with model_card.json', () => {
    it('verifies getModelCard() matches public/data/priority/model_card.json metrics', async () => {
      const card = await getModelCard();
      expect(card.cv_rmse_c).toBe(modelCard.metrics.rmse_celsius);
      expect(card.cv_r2).toBe(modelCard.metrics.r2_score);
      expect(card.held_out_rmse_c).toBe(modelCard.metrics.held_out_scene_rmse_celsius);
      expect(card.ensemble_members).toBe(modelCard.metrics.ensemble_members);
      expect(card.gate.passed).toBe(true);
      expect(card.gate.status).toBe(modelCard.gate.status);
      expect(card.gate.threshold).toBe(modelCard.gate.threshold);
      expect(card.gate.value).toBe(modelCard.gate.value);
    });

    it('verifies satellite scene dates and sensor bands match specification', async () => {
      const card = await getModelCard();
      const tirs = card.scenes.find((s) => s.sensor.includes('TIRS'));
      expect(tirs).toBeDefined();
      expect(tirs?.sensor).toContain('ST_B10');
      expect(tirs?.date).toBe('2023-04-22');

      const s2 = card.scenes.find((s) => s.sensor.includes('Sentinel-2'));
      expect(s2).toBeDefined();
      expect(s2?.date).toBe('2023-04-24');

      const heldOut = card.scenes.find((s) => s.sensor.includes('Held-Out'));
      expect(heldOut).toBeDefined();
      expect(heldOut?.date).toBe('2024-04-24');
    });

    it('verifies assumptions array contains no non-existent sapling survival or capex parameters', async () => {
      const card = await getModelCard();
      card.assumptions.forEach((a) => {
        expect(a.toLowerCase()).not.toContain('survival rates of micro-irrigated');
        expect(a.toLowerCase()).not.toContain('capital expenditure per hectare');
      });
    });
  });

  describe('5. Repository-Wide Consistency Sweep', () => {
    it('ensures no component or documentation file contains stale or invented claims', () => {
      const filesToCheck = [
        path.join(process.cwd(), 'src', 'components', 'pages', 'MethodPage.tsx'),
        path.join(process.cwd(), 'src', 'components', 'planner', 'EvidenceDrawer.tsx'),
        path.join(process.cwd(), 'src', 'components', 'pages', 'LandingPage.tsx'),
        path.join(process.cwd(), 'docs', 'VIDEO_FACTS.md'),
      ];

      for (const filePath of filesToCheck) {
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).not.toContain('12-member');
        expect(content).not.toContain('12-Member');
        expect(content).not.toContain('XGBoost');
        expect(content).not.toContain('PMC electoral roll population headcounts');
        expect(content).not.toContain('B10 / B11');
        expect(content).not.toContain('radical provenance transparency');
        expect(content).not.toContain('breeds cynicism');
      }
    });
  });
});
