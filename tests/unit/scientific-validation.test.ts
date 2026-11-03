import { describe, it, expect } from 'vitest';
import {
  validateSpatialGeometry,
  runDynamicSpatialDiscovery,
  runSensitivityAnalysis,
  getDynamicCandidates
} from '@/server/intervention-engine';

describe('Phase 6.1 Scientific & Spatial Validation Tests', () => {
  it('validates spatial geometries and rejects out-of-bounds or non-numeric coordinates', () => {
    // Valid Pune coordinate
    const validPoint = validateSpatialGeometry(18.5204, 73.8567, 'Point');
    expect(validPoint.isValid).toBe(true);

    // Out of bounds (e.g. Mumbai or Delhi)
    const outOfBounds = validateSpatialGeometry(19.0760, 72.8777, 'Point');
    expect(outOfBounds.isValid).toBe(false);
    expect(outOfBounds.reason).toBe('OUTSIDE_PUNE_REGIONAL_BOUNDS');

    // NaN coordinates
    const nanCoord = validateSpatialGeometry(NaN, 73.85, 'Point');
    expect(nanCoord.isValid).toBe(false);
    expect(nanCoord.reason).toBe('INVALID_COORDINATES_NAN_OR_TYPE');

    // Unsupported geometry type
    const unsupportedGeom = validateSpatialGeometry(18.52, 73.85, 'CircularString');
    expect(unsupportedGeom.isValid).toBe(false);
    expect(unsupportedGeom.reason).toBe('UNSUPPORTED_GEOMETRY_TYPE');
  });

  it('runs dynamic spatial discovery with configurable screening thresholds', () => {
    // High thermal stress threshold (e.g. 42°C)
    const highThresholdRun = runDynamicSpatialDiscovery({
      minThermalStressLST: 42.0,
      maxVegetationNDVI: 0.40,
      maxSubstationDistanceM: 2000,
      maxCandidatesPerCategory: 5
    });

    expect(highThresholdRun).toBeDefined();
    expect(highThresholdRun.analysisRun).toBeDefined();
    expect(highThresholdRun.analysisRun.parameters.minThermalStressLST).toBe(42.0);
    expect(highThresholdRun.analysisRun.parameters.maxVegetationNDVI).toBe(0.40);
    expect(highThresholdRun.analysisRun.parameters.engineVersion).toMatch(/^UrjaSetu v6\./);
    expect(highThresholdRun.analysisRun.rejectionReasonsSummary['SUB_THRESHOLD_THERMAL_EXPOSURE']).toBeGreaterThanOrEqual(0);
  });

  it('verifies candidate eligibility state transitions reflect technical screening', () => {
    const candidates = getDynamicCandidates();
    expect(candidates.length).toBeGreaterThan(0);

    const statuses = new Set(candidates.map(c => c.status));
    // Discovered candidates should reflect differentiated technical eligibility states
    expect(statuses.has('ELIGIBLE_FOR_REVIEW') || statuses.has('CONDITIONALLY_ELIGIBLE') || statuses.has('REQUIRES_SITE_VALIDATION')).toBe(true);

    // Curated road corridors must be REQUIRES_SITE_VALIDATION
    const roadCandidates = candidates.filter(c => c.categoryId === 'URBAN_GREENING_CORRIDOR');
    roadCandidates.forEach(rc => {
      expect(rc.status).toBe('REQUIRES_SITE_VALIDATION');
      expect(rc.provenanceType).toBe('MANUALLY_CURATED');
      expect(rc.sourceGeometryType).toBe('Point');
    });

    // EV charging canopy candidates must be CONDITIONALLY_ELIGIBLE due to unverified headroom
    const evCandidates = candidates.filter(c => c.categoryId === 'SOLAR_CANOPY_EV_COLOCATION');
    evCandidates.forEach(ec => {
      expect(ec.status).toBe('CONDITIONALLY_ELIGIBLE');
      expect(ec.provenanceType).toBe('DATASET_DERIVED');
    });
  });

  it('executes reproducible sensitivity analysis sweeping across key parameters', () => {
    const sensitivity = runSensitivityAnalysis({
      maxCandidatesPerCategory: 5
    });

    expect(sensitivity).toBeDefined();
    expect(sensitivity.analysisTimestamp).toBeTruthy();
    expect(sensitivity.baseCandidateCount).toBeGreaterThan(0);

    // LST sweeps: 36, 38, 40, 42, 44 °C
    const lstSweeps = sensitivity.parameterSweeps.lstThresholds;
    expect(lstSweeps.length).toBe(5);
    expect(lstSweeps[0].testedValue).toBe('36°C');
    expect(lstSweeps[4].testedValue).toBe('44°C');
    // Higher LST threshold should result in fewer or equal candidates (more rejections)
    expect(lstSweeps[0].candidatesDiscovered).toBeGreaterThanOrEqual(lstSweeps[4].candidatesDiscovered);

    // NDVI sweeps
    const ndviSweeps = sensitivity.parameterSweeps.ndviThresholds;
    expect(ndviSweeps.length).toBe(5);

    // Substation distance sweeps
    const subSweeps = sensitivity.parameterSweeps.substationDistanceThresholds;
    expect(subSweeps.length).toBe(4);

    // Scientific synthesis
    const syn = sensitivity.scientificSynthesis;
    expect(syn.thermalSkinVsAirClarification).toContain('Landsat 9 TIRS-2 radiometric LST');
    expect(syn.thermalSkinVsAirClarification).toContain('surface skin temperature');
    expect(syn.thermalSkinVsAirClarification).toContain('ambient air temperature');
    expect(syn.lstSensitivityObservation).toBeTruthy();
    expect(syn.ndviSensitivityObservation).toBeTruthy();
  });
});
