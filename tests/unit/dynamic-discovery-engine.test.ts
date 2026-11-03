import { describe, it, expect } from 'vitest';
import {
  runDynamicSpatialDiscovery,
  getDynamicCandidates,
  getDynamicCandidateById,
  getLatestAnalysisRun,
  generateInterventionCandidates,
  generateSampleCandidates,
  getCandidateById,
  listRegisteredDatasets,
  getDatasetAvailabilitySummary
} from '@/server/intervention-engine';

describe('Phase 6 Dynamic Spatial Discovery Engine Unit Tests', () => {
  it('executes dynamic discovery and emits reproducible AnalysisRun audit', () => {
    const result = runDynamicSpatialDiscovery({
      studyAreaId: 'pune-pmc',
      minThermalStressLST: 40.0,
      maxCandidatesPerCategory: 15
    });

    expect(result).toBeDefined();
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.analysisRun).toBeDefined();

    const run = result.analysisRun;
    expect(run.analysisId).toMatch(/^RUN-DISCOVERY-/);
    expect(run.studyAreaId).toBe('pune-pmc');
    expect(run.featuresEvaluated).toBeGreaterThan(50);
    expect(run.candidatesDiscovered).toBe(result.candidates.length);
    expect(run.candidatesRejected).toBeGreaterThan(0);
    expect(run.rejectionReasonsSummary).toBeDefined();
    expect(run.provenanceSummary).toContain('DATASET_DERIVED');
  });

  it('guarantees all discovered candidates are strictly DATASET_DERIVED with source feature provenance', () => {
    const candidates = getDynamicCandidates();
    expect(candidates.length).toBeGreaterThan(0);

    candidates.forEach(c => {
      // Must have strict DATASET_DERIVED or MANUALLY_CURATED provenance (never SAMPLE_LOCATION)
      expect(['DATASET_DERIVED', 'MANUALLY_CURATED']).toContain(c.provenanceType);
      expect(c.provenanceType).not.toBe('SAMPLE_LOCATION');
      expect(c.sourceFeatureId).toBeDefined();
      expect(typeof c.sourceFeatureId).toBe('string');
      expect(c.sourceDatasetName).toBeDefined();
      expect(c.analysisRunId).toBeDefined();

      // Coordinates must be in Central/Greater Pune
      expect(c.coordinates.lat).toBeGreaterThan(18.35);
      expect(c.coordinates.lat).toBeLessThan(18.65);
      expect(c.coordinates.lng).toBeGreaterThan(73.7);
      expect(c.coordinates.lng).toBeLessThan(74.05);

      // Must have valid raster queried values
      expect(c.thermalContext.surfaceTemperatureCelsius).toBeGreaterThan(20);
      expect(c.thermalContext.rawThermalDN).toBeGreaterThan(0);
      expect(c.vegetationContext.sclClassId).toBeDefined();
    });
  });

  it('segregates curated demonstration samples from dynamic discoveries', () => {
    const dynamicOnly = generateInterventionCandidates({ includeSamples: false });
    const withSamples = generateInterventionCandidates({ includeSamples: true });
    const samplesOnly = generateSampleCandidates();

    // Dynamic candidates must NOT contain SAMPLE_LOCATION
    dynamicOnly.forEach(c => {
      expect(c.provenanceType).not.toBe('SAMPLE_LOCATION');
      expect(c.id).not.toContain('cand-green-karve-road');
      expect(c.id).not.toContain('cand-roof-balgandharva');
    });

    // Samples must all be SAMPLE_LOCATION
    expect(samplesOnly.length).toBe(12);
    samplesOnly.forEach(c => {
      expect(c.provenanceType).toBe('SAMPLE_LOCATION');
    });

    // Combined must equal dynamicOnly + samples
    expect(withSamples.length).toBe(dynamicOnly.length + samplesOnly.length);
  });

  it('resolves both dynamic candidates and curated landmarks through getCandidateById', () => {
    const dynamicCandidate = getDynamicCandidates()[0];
    expect(dynamicCandidate).toBeDefined();

    const fetchedDynamic = getCandidateById(dynamicCandidate.id);
    expect(fetchedDynamic).toBeDefined();
    expect(fetchedDynamic?.id).toBe(dynamicCandidate.id);
    expect(['DATASET_DERIVED', 'MANUALLY_CURATED']).toContain(fetchedDynamic?.provenanceType);

    // Fetch historical curated sample
    const sample = getCandidateById('cand-roof-balgandharva');
    expect(sample).toBeDefined();
    expect(sample?.provenanceType).toBe('SAMPLE_LOCATION');
    expect(sample?.name).toContain('Balgandharva');
  });

  it('audits central dataset registry completeness and verification status', () => {
    const datasets = listRegisteredDatasets();
    expect(datasets.length).toBeGreaterThanOrEqual(10);

    const summary = getDatasetAvailabilitySummary();
    expect(summary.totalRegistered).toBe(datasets.length);
    expect(summary.availableCount).toBeGreaterThanOrEqual(8);
    expect(summary.officialVerifiedCount).toBeGreaterThanOrEqual(4);
    expect(summary.missingDatasetsRoadmap.length).toBeGreaterThanOrEqual(3);

    // Verify presence of required datasets
    const pmcGardens = datasets.find(d => d.id === 'ds-pmc-official-gardens');
    expect(pmcGardens).toBeDefined();
    expect(pmcGardens?.verificationStatus).toBe('VERIFIED_OFFICIAL');

    const landsatLST = datasets.find(d => d.id === 'ds-landsat-9-tirs2');
    expect(landsatLST).toBeDefined();
    expect(landsatLST?.crs).toContain('32643');

    const sentinelNDVI = datasets.find(d => d.id === 'ds-sentinel-2b-msi');
    expect(sentinelNDVI).toBeDefined();
    expect(sentinelNDVI?.crs).toContain('32643');
  });
});
