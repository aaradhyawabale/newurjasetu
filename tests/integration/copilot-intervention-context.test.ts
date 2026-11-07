import { describe, it, expect } from 'vitest';
import { generateLocalCopilotResponse } from '@/server/ai/advisor';

describe('Copilot — Urban Intervention Context & Fallback (Phase 5)', () => {
  it('handles general urban intervention queries with 5 categories and evidence standards', async () => {
    const res = await generateLocalCopilotResponse(
      'What urban intervention planning categories are available for Pune?',
      {
        placement: { lat: 18.5204, lng: 73.8567, lengthM: 20, widthM: 10, areaM2: 200 },
        studyArea: 'Pune'
      }
    );

    expect(res.reply).toContain('Evidence-Based Urban Intervention Planning');
    expect(res.reply).toContain('URBAN_GREENING_CORRIDOR');
    expect(res.reply).toContain('COOL_ROOF_FEASIBILITY');
    expect(res.reply).toContain('SOLAR_CANOPY_EV_COLOCATION');
    expect(res.reply).toContain('GREEN_SPACE_ENHANCEMENT');
    expect(res.reply).toContain('INTEGRATED_FACILITY_UPGRADE');
    expect(res.reply).toContain('Zero Fabricated Benefits');
    expect(res.engineSource).toBe('local_gis_engine');
  });

  it('provides detailed site-specific candidate profiles and constraints when a candidate is queried', async () => {
    const res = await generateLocalCopilotResponse(
      'Tell me about the cool roof feasibility at Sassoon Hospital and what surveys are required',
      {
        placement: { lat: 18.5255, lng: 73.8715, lengthM: 30, widthM: 20, areaM2: 600 },
        studyArea: 'Pune'
      }
    );

    expect(res.reply).toContain('Sassoon General Hospital');
    expect(res.reply).toContain('COOL_ROOF_FEASIBILITY');
    expect(res.reply).toContain('Landsat 9 LST');
    expect(res.reply).toContain('CRITICAL_BLOCKER');
    expect(res.reply).toContain('Indoor Top-Floor Thermal Comfort Assessment');
    expect(res.reply).toContain('ASTM C1153');
  });

  it('provides detailed site constraints and solar canopy co-location details for Mandai parking', async () => {
    const res = await generateLocalCopilotResponse(
      'What are the constraints for solar canopy and EV charging co-location at Mandai parking?',
      {
        placement: { lat: 18.5120, lng: 73.8570, lengthM: 40, widthM: 25, areaM2: 1000 },
        studyArea: 'Pune'
      }
    );

    expect(res.reply).toContain('Mandai');
    expect(res.reply).toContain('SOLAR_CANOPY_EV_COLOCATION');
    expect(res.reply).toContain('Wind-Load Rating');
    expect(res.reply).toContain('Distribution Transformer Headroom');
    expect(res.reply).toContain('MSEDCL');
  });
});
