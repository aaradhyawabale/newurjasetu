import { describe, it, expect } from 'vitest';
import { 
  ENGINEERING_STANDARDS_REGISTRY, 
  getEngineeringStandard, 
  getStandardsByStatus 
} from '@/server/intervention-engine/standards-registry';

describe('Phase 6.2 Engineering Standards Applicability Tests', () => {
  it('correctly registers mandatory Indian statutory building codes', () => {
    const ecbc = getEngineeringStandard('BEE_ECBC_2017');
    expect(ecbc).toBeDefined();
    expect(ecbc?.applicabilityStatus).toBe('STATUTORY_REQUIREMENT');
    expect(ecbc?.jurisdiction).toBe('NATIONAL_INDIA');
    expect(ecbc?.statutoryBasis).toContain('Energy Conservation Act 2001');
    expect(ecbc?.applicabilityConditions).toContain('connected electrical load >= 100 kW');

    const windCode = getEngineeringStandard('IS_875_PART_3');
    expect(windCode).toBeDefined();
    expect(windCode?.applicabilityStatus).toBe('STATUTORY_REQUIREMENT');
    expect(windCode?.statutoryBasis).toContain('National Building Code of India');

    const cea = getEngineeringStandard('CEA_SAFETY_REG_2010');
    expect(cea).toBeDefined();
    expect(cea?.applicabilityStatus).toBe('STATUTORY_REQUIREMENT');
  });

  it('correctly classifies foreign standards as technical references or recommended practices', () => {
    const astmAdhesion = getEngineeringStandard('ASTM_D4541');
    expect(astmAdhesion).toBeDefined();
    expect(astmAdhesion?.applicabilityStatus).toBe('TECHNICAL_REFERENCE');
    expect(astmAdhesion?.countryOfOrigin).toBe('United States');
    // Foreign testing standards must not be labeled as Indian statutory requirements
    expect(astmAdhesion?.applicabilityStatus).not.toBe('STATUTORY_REQUIREMENT');

    const greenSeal = getEngineeringStandard('GREEN_SEAL_GS_11');
    expect(greenSeal).toBeDefined();
    expect(greenSeal?.applicabilityStatus).toBe('RECOMMENDED_PRACTICE');
    expect(greenSeal?.jurisdiction).toBe('INTERNATIONAL');
    expect(greenSeal?.applicabilityStatus).not.toBe('STATUTORY_REQUIREMENT');

    const asceUtility = getEngineeringStandard('ASCE_38_02');
    expect(asceUtility).toBeDefined();
    expect(asceUtility?.applicabilityStatus).toBe('TECHNICAL_REFERENCE');
    expect(asceUtility?.applicabilityStatus).not.toBe('STATUTORY_REQUIREMENT');
  });

  it('distinguishes contractual specifications from universal statutory regulations', () => {
    const cpwd = getEngineeringStandard('CPWD_SPEC_2019');
    expect(cpwd).toBeDefined();
    expect(cpwd?.applicabilityStatus).toBe('CONTRACTUAL_REQUIREMENT');

    const ircTwoLane = getEngineeringStandard('IRC_SP_73_2018');
    expect(ircTwoLane).toBeDefined();
    expect(ircTwoLane?.applicabilityStatus).toBe('CONTRACTUAL_REQUIREMENT');
  });

  it('filters registry standards by applicability status', () => {
    const statutory = getStandardsByStatus('STATUTORY_REQUIREMENT');
    expect(statutory.length).toBeGreaterThanOrEqual(3);
    const statutoryIds = statutory.map(s => s.identifier);
    expect(statutoryIds).toContain('BEE ECBC 2017 Table 4.1');
    expect(statutoryIds).toContain('IS 875 (Part 3): 2015');

    const technicalRefs = getStandardsByStatus('TECHNICAL_REFERENCE');
    expect(technicalRefs.length).toBeGreaterThanOrEqual(3);
    const techIds = technicalRefs.map(s => s.identifier);
    expect(techIds).toContain('ASTM D4541-22');
    expect(techIds).toContain('ASCE 38-02 / ASCE 38-22');
  });
});
