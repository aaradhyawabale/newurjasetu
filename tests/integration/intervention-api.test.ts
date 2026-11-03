import { describe, it, expect } from 'vitest';
import { GET as getIndex } from '@/app/api/interventions/route';
import { GET as getCandidates } from '@/app/api/interventions/candidates/route';
import { GET as getCandidateDetail } from '@/app/api/interventions/candidates/[id]/route';
import { POST as postCompare } from '@/app/api/interventions/compare/route';
import { POST as postDossier } from '@/app/api/interventions/dossier/route';
import { NextRequest } from 'next/server';

describe('Phase 5 Intervention API Endpoints Integration Tests', () => {
  it('GET /api/interventions returns category stats and metadata', async () => {
    const res = await getIndex();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('OK');
    expect(data.totalCandidates).toBeGreaterThanOrEqual(10);
    expect(data.categories.length).toBe(5);
    expect(data.metadata.baselineMeanLST).toBe(46.3);
  });

  it('GET /api/interventions/candidates returns filtered candidates and GeoJSON', async () => {
    // Normal JSON query
    const req1 = new NextRequest('http://localhost:3000/api/interventions/candidates?category=COOL_ROOF_FEASIBILITY');
    const res1 = await getCandidates(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.status).toBe('OK');
    expect(data1.candidates.length).toBeGreaterThan(0);
    data1.candidates.forEach((c: any) => expect(c.categoryId).toBe('COOL_ROOF_FEASIBILITY'));

    // GeoJSON query
    const req2 = new NextRequest('http://localhost:3000/api/interventions/candidates?format=geojson');
    const res2 = await getCandidates(req2);
    expect(res2.status).toBe(200);
    const geojson = await res2.json();
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features.length).toBeGreaterThanOrEqual(10);
    expect(geojson.features[0].geometry.type).toBe('Point');
    expect(geojson.features[0].properties.surfaceTemperatureCelsius).toBeDefined();
  });

  it('GET /api/interventions/candidates/[id] returns candidate, category metadata, and evaluation', async () => {
    const req = new NextRequest('http://localhost:3000/api/interventions/candidates/cand-roof-pmc-hq');
    const res = await getCandidateDetail(req, { params: { id: 'cand-roof-pmc-hq' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('OK');
    expect(data.candidate.id).toBe('cand-roof-pmc-hq');
    expect(data.categoryMetadata.id).toBe('COOL_ROOF_FEASIBILITY');
    expect(data.evaluation.candidateId).toBe('cand-roof-pmc-hq');
    expect(data.evaluation.governanceAndConstraints.criticalBlockerCount).toBeDefined();
  });

  it('POST /api/interventions/compare validates and returns side-by-side comparison', async () => {
    const req = new NextRequest('http://localhost:3000/api/interventions/compare', {
      method: 'POST',
      body: JSON.stringify({
        candidateIds: ['cand-roof-pmc-hq', 'cand-solar-mandai-parking']
      })
    });
    const res = await postCompare(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('OK');
    expect(data.comparison.candidateIds).toEqual(['cand-roof-pmc-hq', 'cand-solar-mandai-parking']);
    expect(data.comparison.comparisonMatrix.length).toBeGreaterThan(0);

    // Test error case: 1 candidate
    const reqBad = new NextRequest('http://localhost:3000/api/interventions/compare', {
      method: 'POST',
      body: JSON.stringify({ candidateIds: ['cand-roof-pmc-hq'] })
    });
    const resBad = await postCompare(reqBad);
    expect(resBad.status).toBe(400);
  });

  it('POST /api/interventions/dossier generates formal planning dossier', async () => {
    const req = new NextRequest('http://localhost:3000/api/interventions/dossier', {
      method: 'POST',
      body: JSON.stringify({ candidateId: 'cand-green-karve-road' })
    });
    const res = await postDossier(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('OK');
    expect(data.dossier.dossierId).toContain('CAND-GREEN-KARVE-ROAD');
    expect(data.dossier.spatialEvidenceSummary).toBeDefined();
    expect(data.dossier.nonAuthoritativeDisclaimer).toContain('DISCLAIMER');
  });
});
