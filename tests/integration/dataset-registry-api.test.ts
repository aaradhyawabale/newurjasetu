import { describe, it, expect } from 'vitest';
import { GET as getDatasets } from '@/app/api/interventions/datasets/route';
import { GET as getCandidates, POST as postCandidates } from '@/app/api/interventions/candidates/route';
import { NextRequest } from 'next/server';

describe('Phase 6 Dataset Registry and Dynamic Discovery API Tests', () => {
  it('GET /api/interventions/datasets returns full registry and roadmap', async () => {
    const res = await getDatasets();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('OK');
    expect(data.totalDatasets).toBeGreaterThanOrEqual(10);
    expect(data.summary).toBeDefined();
    expect(data.summary.totalRegistered).toBeGreaterThanOrEqual(10);
    expect(data.summary.officialVerifiedCount).toBeGreaterThanOrEqual(4);
    expect(data.summary.missingDatasetsRoadmap.length).toBeGreaterThan(0);

    // Verify dataset items have required metadata fields
    const firstDataset = data.datasets[0];
    expect(firstDataset.id).toBeDefined();
    expect(firstDataset.name).toBeDefined();
    expect(firstDataset.sourceOrganization).toBeDefined();
    expect(firstDataset.crs).toBeDefined();
    expect(firstDataset.verificationStatus).toBeDefined();
    expect(firstDataset.knownLimitations).toBeDefined();
  });

  it('GET /api/interventions/candidates filters by provenanceType', async () => {
    // 1. DATASET_DERIVED query (default)
    const reqDerived = new NextRequest('http://localhost:3000/api/interventions/candidates?provenanceType=DATASET_DERIVED');
    const resDerived = await getCandidates(reqDerived);
    expect(resDerived.status).toBe(200);
    const dataDerived = await resDerived.json();
    expect(dataDerived.status).toBe('OK');
    expect(dataDerived.candidates.length).toBeGreaterThan(0);
    dataDerived.candidates.forEach((c: any) => {
      expect(c.provenanceType).toBe('DATASET_DERIVED');
    });

    // 2. SAMPLE_LOCATION query
    const reqSample = new NextRequest('http://localhost:3000/api/interventions/candidates?provenanceType=SAMPLE_LOCATION');
    const resSample = await getCandidates(reqSample);
    expect(resSample.status).toBe(200);
    const dataSample = await resSample.json();
    expect(dataSample.status).toBe('OK');
    expect(dataSample.candidates.length).toBe(12);
    dataSample.candidates.forEach((c: any) => {
      expect(c.provenanceType).toBe('SAMPLE_LOCATION');
    });

    // 3. MANUALLY_CURATED query (road corridors and transit seed)
    const reqCurated = new NextRequest('http://localhost:3000/api/interventions/candidates?provenanceType=MANUALLY_CURATED');
    const resCurated = await getCandidates(reqCurated);
    expect(resCurated.status).toBe(200);
    const dataCurated = await resCurated.json();
    expect(dataCurated.status).toBe('OK');
    expect(dataCurated.candidates.length).toBeGreaterThan(0);
    dataCurated.candidates.forEach((c: any) => {
      expect(c.provenanceType).toBe('MANUALLY_CURATED');
    });

    // 4. Combined query with includeSamples=true
    const reqAll = new NextRequest('http://localhost:3000/api/interventions/candidates?includeSamples=true');
    const resAll = await getCandidates(reqAll);
    expect(resAll.status).toBe(200);
    const dataAll = await resAll.json();
    expect(dataAll.total).toBe(
      dataDerived.candidates.length + dataSample.candidates.length + dataCurated.candidates.length
    );
  });

  it('POST /api/interventions/candidates triggers a fresh dynamic discovery run', async () => {
    const req = new NextRequest('http://localhost:3000/api/interventions/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studyAreaId: 'pune-pmc',
        minThermalStressLST: 41.0,
        maxCandidatesPerCategory: 10
      })
    });

    const res = await postCandidates(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('OK');
    expect(data.analysisRun).toBeDefined();
    expect(data.analysisRun.analysisId).toBeDefined();
    expect(data.analysisRun.candidatesDiscovered).toBe(data.candidatesCount);
    expect(data.candidates.length).toBeGreaterThan(0);
  });
});
