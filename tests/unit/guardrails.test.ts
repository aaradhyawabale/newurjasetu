import { describe, it, expect } from 'vitest';
import {
  validateWording,
  validateNumericGrounding,
  enforceModelledLabels,
} from '@/server/ai/guardrails';

describe('AI Guardrails & Scientific Governance Tests', () => {
  describe('Wording Guardrails (validateWording)', () => {
    it('passes on compliant scientific phrasing', () => {
      const text =
        'The surface temperature of the cell is 42.1°C, associated with high building density and low vegetation index. This models surface temperature, not air temperature.';
      const res = validateWording(text);
      expect(res.valid).toBe(true);
      expect(res.violations).toEqual([]);
    });

    it('flags unnegated "air temperature" usage', () => {
      const text = 'This urban park will reduce the air temperature across Pune by 3°C.';
      const res = validateWording(text);
      expect(res.valid).toBe(false);
      expect(res.violations.some((v) => v.includes("air temperature"))).toBe(true);
    });

    it('permits "air temperature" when explicitly negated or contrasted with LST', () => {
      const text =
        'Satellite radiometry records radiometric surface temperature, not ambient 2m air temperature.';
      const res = validateWording(text);
      expect(res.valid).toBe(true);
    });

    it('flags banned word "canopy" (must use vegetation index or shade cover)', () => {
      const text = 'The tree canopy in Hadapsar ward has decreased by 12%.';
      const res = validateWording(text);
      expect(res.valid).toBe(false);
      expect(res.violations.some((v) => v.includes("canopy"))).toBe(true);
    });

    it('flags causal phrasing "caused by" (must use "associated with")', () => {
      const text = 'The severe urban heat island was caused by rapid impervious surface expansion.';
      const res = validateWording(text);
      expect(res.valid).toBe(false);
      expect(res.violations.some((v) => v.includes("caused by"))).toBe(true);
    });

    it('flags carbon and kWh energy savings claims', () => {
      const text1 = 'Greening this zone will save 450 kWh in air conditioning load.';
      const res1 = validateWording(text1);
      expect(res1.valid).toBe(false);
      expect(res1.violations.some((v) => v.includes("carbon or kWh"))).toBe(true);

      const text2 = 'The project generates 120 carbon credits per year.';
      const res2 = validateWording(text2);
      expect(res2.valid).toBe(false);
    });

    it('flags authority adoption and exclusivity claims', () => {
      const res1 = validateWording('This model was adopted by PMC as statutory regulation.');
      expect(res1.valid).toBe(false);

      const res2 = validateWording('UrjaSetu is the first in India heat analytics tool.');
      expect(res2.valid).toBe(false);
    });
  });

  describe('Numeric Grounding (validateNumericGrounding)', () => {
    const verifiedSources = [
      'Optimization Tool Output: budget_ha: 25.0, allocated_ha: 24.7, cooling_mean: -13.3, people_benefiting: 14489, zones: 11',
      'Model Metadata: cv_rmse: 0.91, r2: 0.533, ensemble_seeds: 30',
    ];

    it('passes when all quoted numbers are present in tool output or metadata', () => {
      const answer =
        'Allocating 25 ha achieves 24.7 ha of greening across 11 priority zones, benefiting 14,489 residents with an estimated surface cooling of -13.3°C (CV RMSE ±0.91°C across 30 seeds).';
      const res = validateNumericGrounding(answer, verifiedSources);
      expect(res.grounded).toBe(true);
      expect(res.ungroundedNumbers).toEqual([]);
    });

    it('detects ungrounded hallucinated numbers', () => {
      const answer =
        'Allocating 25 ha will cool Pune by -28.9°C and save 98,765 people with 88 zones.';
      const res = validateNumericGrounding(answer, verifiedSources);
      expect(res.grounded).toBe(false);
      expect(res.ungroundedNumbers).toContain('28.9');
      expect(res.ungroundedNumbers).toContain('98765');
      expect(res.ungroundedNumbers).toContain('88');
    });
  });

  describe('Label Enforcement (enforceModelledLabels)', () => {
    it('appends [Modelled] tag to cooling mentions', () => {
      const text = 'The intervention provides estimated cooling of -13.3°C for the priority cluster.';
      const labeled = enforceModelledLabels(text);
      expect(labeled).toContain('cooling of -13.3°C [Modelled]');
    });
  });
});
