import { describe, it, expect } from 'vitest';
import { evaluateHeatInfrastructureContext } from '@/server/analysis-engine/heat-integration';

describe('Heat & Vegetation Infrastructure Integration', () => {
  it('evaluates thermal context for Pune center coordinates (73.8567, 18.5204)', () => {
    const result = evaluateHeatInfrastructureContext('Solar Farm', 18.5204, 73.8567);

    expect(result.available).toBe(true);
    expect(result.provenance).toBe('DETERMINISTIC_RESULT');
    expect(result.siteObservations.isInsideStudyArea).toBe(true);
    expect(result.siteObservations.lstCelsius).toBeGreaterThan(25.0);
    expect(result.siteObservations.lstCelsius).toBeLessThan(65.0);
    expect(result.siteObservations.ndvi30m).toBeGreaterThan(-1.0);
    expect(result.siteObservations.ndvi30m).toBeLessThan(1.0);
    expect(result.siteObservations.sclClassName).toBeDefined();

    expect(result.citywideBaselines.meanLSTCelsius).toBeGreaterThan(45.0);
    expect(result.citywideBaselines.meanLSTCelsius).toBeLessThan(48.0);
    expect(result.citywideBaselines.meanNDVI).toBeCloseTo(0.514, 2);

    expect(result.disciplineInsights.category).toContain('Solar Farm');
    expect(result.disciplineInsights.engineeringConsiderations.length).toBeGreaterThan(0);
    expect(result.disciplineInsights.scientificLimitations.some(l => l.includes('radiometric skin temperature'))).toBe(true);
  });

  it('provides PV thermal derating guidance for Solar Farm in elevated temperature zones', () => {
    const result = evaluateHeatInfrastructureContext('Solar Farm', 18.5204, 73.8567);
    const engText = result.disciplineInsights.engineeringConsiderations.join(' ');
    const planText = result.disciplineInsights.planningRecommendations.join(' ');
    expect(engText).toContain('temperature coefficient');
    expect(planText).toContain('mounting');
  });

  it('provides battery thermal management and shading guidance for EV Charging Station', () => {
    const result = evaluateHeatInfrastructureContext('EV Charging Station', 18.5204, 73.8567);
    const planText = result.disciplineInsights.planningRecommendations.join(' ');
    expect(planText).toContain('shading');
  });

  it('provides cooling corridor and canopy guidance for Park placement', () => {
    const result = evaluateHeatInfrastructureContext('Park', 18.5204, 73.8567);
    expect(result.disciplineInsights.headline).toContain('Urban Greening');
    expect(result.disciplineInsights.planningRecommendations.length).toBeGreaterThan(0);
  });

  it('handles coordinates outside study area gracefully with null observations', () => {
    const result = evaluateHeatInfrastructureContext('Building', 19.5, 75.0);
    expect(result.siteObservations.isInsideStudyArea).toBe(false);
    expect(result.siteObservations.lstCelsius).toBeNull();
    expect(result.siteObservations.ndvi30m).toBeNull();
    expect(result.citywideBaselines.thermalDeltaCelsius).toBeNull();
  });
});
