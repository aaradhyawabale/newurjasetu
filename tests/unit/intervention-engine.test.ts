import { describe, it, expect } from 'vitest';
import { 
  listCategoryMetadata, 
  getCategoryMetadata,
  generateInterventionCandidates,
  getCandidateById,
  listCandidatesByCategory,
  evaluateCandidate,
  compareCandidates,
  generatePlanningDossier
} from '@/server/intervention-engine';

describe('Phase 5 Intervention Planning Engine Unit Tests', () => {
  it('registers all 5 mandatory intervention categories with full metadata', () => {
    const categories = listCategoryMetadata();
    expect(categories).toHaveLength(5);

    const ids = categories.map(c => c.id);
    expect(ids).toContain('URBAN_GREENING_CORRIDOR');
    expect(ids).toContain('COOL_ROOF_FEASIBILITY');
    expect(ids).toContain('SOLAR_CANOPY_EV_COLOCATION');
    expect(ids).toContain('GREEN_SPACE_ENHANCEMENT');
    expect(ids).toContain('INTEGRATED_FACILITY_UPGRADE');

    // Verify governing standards exist for each category
    categories.forEach(cat => {
      expect(cat.governingStandards.length).toBeGreaterThan(0);
      expect(cat.mandatorySurveyChecklist.length).toBeGreaterThan(0);
      expect(cat.scientificDisclaimers.length).toBeGreaterThan(0);
    });

    const coolRoof = getCategoryMetadata('COOL_ROOF_FEASIBILITY');
    expect(coolRoof.governingStandards.some(s => s.standardName.includes('ECBC 2017'))).toBe(true);
  });

  it('generates real candidates with queried satellite observations and evidence ledgers', () => {
    const candidates = generateInterventionCandidates();
    expect(candidates.length).toBeGreaterThanOrEqual(10);

    candidates.forEach(c => {
      expect(c.id).toBeDefined();
      expect(c.coordinates.lat).toBeGreaterThan(18.0);
      expect(c.coordinates.lng).toBeGreaterThan(73.0);
      
      // Thermal context
      expect(c.thermalContext.baselineStudyAreaMeanLSTCelsius).toBe(46.3);
      if (c.thermalContext.surfaceTemperatureCelsius !== null) {
        expect(c.thermalContext.surfaceTemperatureCelsius).toBeGreaterThan(20);
        expect(c.thermalContext.surfaceTemperatureCelsius).toBeLessThan(70);
      }

      // Vegetation context
      expect(c.vegetationContext.baselineTerrestrialMeanNdvi).toBe(0.514);
      if (c.vegetationContext.ndvi30m !== null) {
        expect(c.vegetationContext.ndvi30m).toBeGreaterThanOrEqual(-1.0);
        expect(c.vegetationContext.ndvi30m).toBeLessThanOrEqual(1.0);
      }

      // Evidence ledger must contain satellite observations and standards
      expect(c.evidenceLedger.length).toBeGreaterThanOrEqual(5);
      expect(c.evidenceLedger.some(e => e.category === 'SATELLITE_OBSERVATION')).toBe(true);
      expect(c.evidenceLedger.some(e => e.category === 'DETERMINISTIC_CALCULATION')).toBe(true);
      expect(c.evidenceLedger.some(e => e.category === 'VERIFIED_TECHNICAL_REFERENCE')).toBe(true);
      expect(c.evidenceLedger.some(e => e.category === 'UNVERIFIED_REQUIRES_ADDITIONAL_DATA')).toBe(true);

      // Constraints and missing surveys
      expect(c.constraints.length).toBeGreaterThan(0);
      expect(c.missingSurveyChecklist.length).toBeGreaterThan(0);
    });
  });

  it('correctly filters candidates by category and id', () => {
    const greening = listCandidatesByCategory('URBAN_GREENING_CORRIDOR');
    expect(greening.length).toBeGreaterThan(0);
    greening.forEach(c => expect(c.categoryId).toBe('URBAN_GREENING_CORRIDOR'));

    const candidate = getCandidateById('cand-roof-pmc-hq');
    expect(candidate).toBeDefined();
    expect(candidate?.name).toContain('Pune Municipal Corporation');
    expect(candidate?.categoryId).toBe('COOL_ROOF_FEASIBILITY');
  });

  it('evaluates candidate dimensions without fabricating scores or cooling degrees', () => {
    const candidate = getCandidateById('cand-solar-mandai-parking');
    expect(candidate).toBeDefined();

    const evaluation = evaluateCandidate(candidate!);
    expect(evaluation.candidateId).toBe(candidate!.id);
    expect(evaluation.thermalDimension.lstCelsius).toBeDefined();
    expect(evaluation.governanceAndConstraints.criticalBlockerCount).toBeGreaterThan(0);
    expect(evaluation.infrastructureReadiness.roadAccessTier).toBe('IMMEDIATE_FRONTAGE');
  });

  it('compares 2 to 4 candidates side-by-side with matrix and trade-offs', () => {
    const comparison = compareCandidates(['cand-roof-pmc-hq', 'cand-solar-mandai-parking']);
    expect(comparison.candidateIds).toEqual(['cand-roof-pmc-hq', 'cand-solar-mandai-parking']);
    expect(comparison.comparisonMatrix.length).toBeGreaterThan(5);
    expect(comparison.tradeOffAnalysis.length).toBe(3);
    expect(comparison.planningNotice).toBeDefined();

    // Verify bounds validation
    expect(() => compareCandidates(['cand-roof-pmc-hq'])).toThrow('at least 2 candidates');
    expect(() => compareCandidates([
      'cand-green-karve-road',
      'cand-green-laxmi-road',
      'cand-green-fc-road',
      'cand-roof-pmc-hq',
      'cand-roof-sassoon-hospital'
    ])).toThrow('maximum of 4 candidates');
  });

  it('generates a detailed municipal planning dossier with all required sections', () => {
    const dossier = generatePlanningDossier('cand-integ-shivajinagar-hub');
    expect(dossier.dossierId).toContain('DOSSIER-PUNE-CAND-INTEG-SHIVAJINAGAR-HUB');
    expect(dossier.executiveSummary).toContain('Shivajinagar');
    expect(dossier.spatialEvidenceSummary.landsat9ThermalSummary).toBeDefined();
    expect(dossier.spatialEvidenceSummary.sentinel2VegetationSummary).toBeDefined();
    expect(dossier.regulatoryAndStandardAlignment.length).toBeGreaterThan(0);
    expect(dossier.preImplementationSurveyPlan.length).toBeGreaterThan(0);
    expect(dossier.nonAuthoritativeDisclaimer).toContain('DISCLAIMER');
  });
});
