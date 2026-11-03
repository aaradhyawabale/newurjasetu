import { describe, it, expect } from 'vitest';
import { evaluateHeatInfrastructureContext } from '@/server/analysis-engine/heat-integration';
import { getHeatDiagnostics, queryHeatPoint } from '@/server/heat-engine/loader';
import { generateLocalCopilotResponse } from '@/server/ai/gemini-advisor';

describe('Phase 4.1 Scientific Governance & Validation Audit', () => {
  it('does not calculate actual PV efficiency loss directly from satellite LST', () => {
    const result = evaluateHeatInfrastructureContext('Solar Farm', 18.5204, 73.8567);

    expect(result.available).toBe(true);
    const engText = result.disciplineInsights.engineeringConsiderations.join(' ');
    
    // Confirms module temperature coefficient is preserved as a verified technical parameter
    expect(engText).toContain('temperature coefficient');
    expect(engText).toContain('IEC 61215');
    
    // Confirms explicit disclosure that actual derating cannot be derived directly from LST
    expect(engText).toContain('cannot be calculated from satellite LST alone');

    // Confirms presence in structured evidence ledger
    const pvRef = result.disciplineInsights.evidenceLedger.find(e => e.sourceOrStandard?.includes('IEC 61215'));
    expect(pvRef).toBeDefined();
    expect(pvRef?.category).toBe('VERIFIED_TECHNICAL_REFERENCE');

    const pvLimit = result.disciplineInsights.evidenceLedger.find(e => e.category === 'UNVERIFIED_REQUIRES_ADDITIONAL_DATA');
    expect(pvLimit).toBeDefined();
  });

  it('distinguishes EV charging ground LST from battery core operating conditions', () => {
    const result = evaluateHeatInfrastructureContext('EV Charging Station', 18.5204, 73.8567);
    const engText = result.disciplineInsights.engineeringConsiderations.join(' ');

    expect(engText).toContain('does NOT establish vehicle battery core temperature');
    expect(engText).toContain('EPRI Report 3002016335');

    const evEvidence = result.disciplineInsights.evidenceLedger.find(e => e.sourceOrStandard?.includes('EPRI'));
    expect(evEvidence).toBeDefined();
    expect(evEvidence?.category).toBe('VERIFIED_TECHNICAL_REFERENCE');
  });

  it('evaluates urban park greening without arbitrary binary priority thresholds', () => {
    const result = evaluateHeatInfrastructureContext('Park', 18.5204, 73.8567);
    
    // Headline does not claim arbitrary threshold priority
    expect(result.disciplineInsights.headline).not.toContain('High Priority Urban Greening Opportunity');
    expect(result.disciplineInsights.headline).toContain('Urban Greening');

    // Compares continuous observations to baseline mean
    const planText = result.disciplineInsights.planningRecommendations.join(' ');
    expect(planText).toContain('NDVI');
    expect(planText).toContain('Azadirachta indica');
  });

  it('cites statutory BEE ECBC 2017 Table 4.1 for cool roofs and distinguishes advisory SRI 82', () => {
    const result = evaluateHeatInfrastructureContext('Building', 18.5204, 73.8567);
    const engText = result.disciplineInsights.engineeringConsiderations.join(' ');

    expect(engText).toContain('BEE');
    expect(engText).toContain('ECBC 2017 Table 4.1');
    expect(engText).toContain('SRI ≥ 78');
    expect(engText).toContain('SRI ≥ 82');
    expect(engText).toContain('advisory');

    const ecbcRef = result.disciplineInsights.evidenceLedger.find(e => e.sourceOrStandard?.includes('ECBC 2017'));
    expect(ecbcRef).toBeDefined();
    expect(ecbcRef?.category).toBe('VERIFIED_TECHNICAL_REFERENCE');
  });

  it('reconciles satellite data quality statistics with distinct, explicit denominators', () => {
    const diag = getHeatDiagnostics();
    const boundaryCells = diag.metadata.candidateBoundaryPixels; // 577,304

    // 1. Landsat 9 Clear-Sky Ratio
    const clearPixels = diag.landsat9.qaPixelBreakdown.clearPixels; // 577,208
    const clearRatio = clearPixels / boundaryCells;
    expect(clearRatio).toBeCloseTo(0.9998, 3);
    expect(diag.landsat9.qaPixelBreakdown.clearPercentage).toBeCloseTo(99.98, 2);

    // 2. Sentinel-2B 30m Macro-Cell Valid Observation Rate
    const valid30mCells = diag.sentinel2b.ndvi30mDistribution.validPixelCount; // 518,651
    const validRatio = valid30mCells / boundaryCells;
    expect(validRatio).toBeCloseTo(0.8984, 3);
    expect(diag.sentinel2b.ndvi30mDistribution.validPercentage).toBeCloseTo(89.84, 2);

    // 3. Sentinel-2B Mean Sub-Pixel Valid Footprint Fraction
    const meanSubPixelFrac = diag.sentinel2b.coverageFractions30m.meanValidFootprintFraction;
    expect(meanSubPixelFrac).toBeCloseTo(0.702, 3);

    // Verify mathematical separation between cell-level validity rate (89.84%) and sub-pixel area fraction (70.20%)
    expect(validRatio).toBeGreaterThan(meanSubPixelFrac);
  });

  it('generates grounded Local Copilot responses reflecting statutory ECBC and PV physics', () => {
    const response = generateLocalCopilotResponse('What are the cool roof and solar standards for Pune?');
    
    expect(response.reply).toContain('High-Albedo "Cool Roofs"');
    expect(response.reply).toContain('ECBC 2017');
    expect(response.reply).toContain('SRI ≥ 78');
    expect(response.reply).toContain('IEC 61215');
    expect(response.reply).toContain('cannot be calculated directly from LST alone');
  });
});
