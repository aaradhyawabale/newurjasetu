import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as postOptimize } from '@/app/api/optimize/route';
import { GET as getZone } from '@/app/api/zone/[id]/route';
import { GET as getModelCard } from '@/app/api/model-card/route';

describe('Priority Engine API Endpoints with Zod Validation', () => {
  describe('POST /api/optimize', () => {
    it('optimizes allocation within budget and returns selected cells and ensemble frequencies', async () => {
      const payload = {
        budget_ha: 6.0,
        objective: 'cooling',
        min_greenable_ha: 0.1
      };

      const req = new NextRequest('http://localhost:3000/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const res = await postOptimize(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('OK');
      expect(json.data.budget_ha).toBe(6.0);
      expect(json.data.allocated_ha).toBeLessThanOrEqual(6.0);
      expect(json.data.selected_cells.length).toBeGreaterThan(0);
      expect(json.data.ensemble_runs).toBe(30);

      // Verify each cell has selection frequency and provenance
      const first = json.data.selected_cells[0];
      expect(first.selection_frequency).toBeGreaterThanOrEqual(0.0);
      expect(first.selection_frequency).toBeLessThanOrEqual(1.0);
      expect(first.rank).toBe(1);
    });

    it('rejects invalid request payloads with 400 and structured Zod error details', async () => {
      // 1. Missing budget_ha
      const reqEmpty = new NextRequest('http://localhost:3000/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const resEmpty = await postOptimize(reqEmpty);
      expect(resEmpty.status).toBe(400);
      const jsonEmpty = await resEmpty.json();
      expect(jsonEmpty.error).toContain('Validation failed');
      expect(jsonEmpty.details.budget_ha).toBeDefined();

      // 2. Negative budget_ha
      const reqNeg = new NextRequest('http://localhost:3000/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_ha: -5.0 })
      });
      const resNeg = await postOptimize(reqNeg);
      expect(resNeg.status).toBe(400);

      // 3. Invalid objective enum
      const reqObj = new NextRequest('http://localhost:3000/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_ha: 10.0, objective: 'invalid_objective' })
      });
      const resObj = await postOptimize(reqObj);
      expect(resObj.status).toBe(400);
    });
  });

  describe('GET /api/zone/[id]', () => {
    it('retrieves valid 250m priority zone by ID with 30-member ensemble statistics', async () => {
      const validZoneId = 'cell_250m_0001';
      const req = new NextRequest(`http://localhost:3000/api/zone/${validZoneId}`);
      const res = await getZone(req, { params: { id: validZoneId } });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('OK');
      expect(json.zone.id).toBe(validZoneId);
      expect(json.zone.centroid).toHaveLength(2);
      expect(json.zone.ward).toBeDefined();

      // Verify ensemble statistics
      expect(json.ensemble).toBeDefined();
      if (json.zone.cooling_mean !== null) {
        expect(json.ensemble.memberCount).toBe(30);
        expect(json.ensemble.mean).toBeDefined();
        expect(json.ensemble.p10).toBeLessThanOrEqual(json.ensemble.p90);
      }

      // Verify provenance tags
      expect(json.provenance.lst_mean).toBe('Measured');
      expect(json.provenance.cooling_mean).toBe('Modelled');
    });

    it('returns 404 for non-existent zone ID', async () => {
      const fakeZoneId = 'non_existent_zone_9999';
      const req = new NextRequest(`http://localhost:3000/api/zone/${fakeZoneId}`);
      const res = await getZone(req, { params: { id: fakeZoneId } });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('not found');
      expect(json.id).toBe(fakeZoneId);
    });
  });

  describe('GET /api/model-card', () => {
    it('returns model card with metrics, authentic sources, and scientific limitations', async () => {
      const req = new NextRequest('http://localhost:3000/api/model-card');
      const res = await getModelCard(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('OK');
      expect(json.model_card).toBeDefined();
      expect(json.model_card.model_name).toContain('Priority Engine');
      expect(json.model_card.metrics.ensemble_members).toBe(30);
      expect(json.model_card.sources.length).toBeGreaterThanOrEqual(4);
      expect(json.model_card.limitations.some((l: string) => l.includes('not air temperature'))).toBe(true);
    });

    it('supports ?format=summary query parameter', async () => {
      const req = new NextRequest('http://localhost:3000/api/model-card?format=summary');
      const res = await getModelCard(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('OK');
      expect(json.model_name).toBeDefined();
      expect(json.metrics).toBeDefined();
      expect(json.limitations).toBeDefined();
      expect(json.model_card).toBeUndefined(); // summary format excludes raw root
    });

    it('rejects invalid query format parameter with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/model-card?format=unsupported_format');
      const res = await getModelCard(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid query parameters');
    });
  });
});
