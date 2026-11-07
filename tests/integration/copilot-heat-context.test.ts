import { describe, it, expect } from 'vitest';
import { generateLocalCopilotResponse } from '@/server/ai/advisor';

describe('Copilot Heat & Vegetation Intelligence Integration', () => {
  it('answers urban heat and LST questions with verified satellite observations', () => {
    const response = generateLocalCopilotResponse('What does the LST layer tell us about Pune?');

    expect(response.engineSource).toBe('local_gis_engine');
    expect(response.reply).toContain('Satellite Urban Heat & Vegetation Intelligence');
    expect(response.reply).toContain('Landsat 9 TIRS-2');
    expect(response.reply).toContain('100m native thermal');
    expect(response.reply).toContain('Sentinel-2B MSI');
    expect(response.reply).toContain('area-weighted');
    expect(response.reply).toContain('LST vs. Air Temperature');
    expect(response.reply).toContain('radiometric skin');
    expect(response.reply).toContain('NDVI Definition');
  });

  it('includes site-specific thermal and vegetation observations when placement exists', () => {
    const context = {
      studyArea: 'Pune Urban Study Area (PMC)',
      infrastructureType: 'Hospital',
      placement: {
        lat: 18.5204,
        lng: 73.8567,
        lengthM: 80,
        widthM: 50,
        areaM2: 4000,
      },
    };

    const response = generateLocalCopilotResponse(
      'How does the local heat and vegetation environment affect this hospital placement?',
      context
    );

    expect(response.reply).toContain('Site-Specific Observations');
    expect(response.reply).toContain('Land Surface Temperature (LST)');
    expect(response.reply).toContain('Vegetation Index (NDVI 30m)');
    expect(response.reply).toContain('Cool Roofs');
    expect(response.reply).toContain('SRI ≥ 82');
  });

  it('provides cooling and microclimate mitigation strategies for urban planning questions', () => {
    const response = generateLocalCopilotResponse(
      'What additional datasets and cooling interventions are needed for heat mitigation?'
    );

    expect(response.reply).toContain('High-Albedo "Cool Roofs"');
    expect(response.reply).toContain('Strategic Shade Greening');
    expect(response.reply).toContain('Photovoltaic & EV Microclimate Protection');
    expect(response.reply).toContain('Additional Required Evidence');
    expect(response.reply).toContain('micrometeorological AWS sensor stations');
  });
});
