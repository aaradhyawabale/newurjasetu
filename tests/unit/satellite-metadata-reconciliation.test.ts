import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getProvenanceManifest, getHeatDiagnostics } from '@/server/heat-engine/loader';

describe('Phase 6.2 Satellite Metadata Reconciliation Tests', () => {
  const manifestPath = path.join(process.cwd(), 'src', 'data', 'satellite_manifest.json');

  it('loads and validates the reconciled satellite manifest', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw);

    expect(manifest.manifestId).toBe('urjasetu-satellite-reconciliation-manifest-v6-2');
    expect(manifest.version).toBe('6.2.0');
    expect(manifest.datasets.landsat9).toBeDefined();
    expect(manifest.datasets.sentinel2b).toBeDefined();
  });

  it('confirms authoritative Landsat 9 acquisition timestamp and scene ID', () => {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw);
    const ls = manifest.datasets.landsat9;

    expect(ls.sceneId).toBe('LC09_L2SP_147047_20230422_02_T1');
    expect(ls.acquisitionTimestamp).toBe('2023-04-22T05:27:39.760219Z');
    expect(ls.localSolarTime).toContain('10:57 AM IST');
    expect(ls.resolution.nativeThermalMeters).toBe(100.0);
    expect(ls.resolution.deliveredResampledMeters).toBe(30.0);
    expect(ls.calibration.scaleFactor).toBe(0.00341802);
    expect(ls.calibration.offsetCelsius).toBe(-124.15);
  });

  it('confirms authoritative Sentinel-2B acquisition timestamp and scene ID', () => {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw);
    const s2 = manifest.datasets.sentinel2b;

    expect(s2.sceneId).toBe('S2B_MSIL2A_20230424T052649_N0510_R105_T43QCA_20240831T130916');
    expect(s2.acquisitionTimestamp).toBe('2023-04-24T05:26:49.024Z');
    expect(s2.temporalBaselineNote).toContain('approximately 48 hours after Landsat 9 overpass');
  });

  it('reconciles ST_QA uncertainty distribution and refutes uniform ±0.81 K claim', () => {
    const diagnostics = getHeatDiagnostics();
    expect(diagnostics.landsat9.surfaceTemperatureQA).toBeDefined();

    const stqa = diagnostics.landsat9.surfaceTemperatureQA;
    expect(stqa.unit).toBe('Kelvin (K)');
    expect(stqa.meanUncertaintyK).toBe(2.16);
    expect(stqa.medianUncertaintyK).toBe(2.10);
    expect(stqa.minUncertaintyK).toBe(1.51);
    expect(stqa.maxUncertaintyK).toBe(62.75);

    // Assert that uncertainty is not claimed as a single uniform ±0.81 K
    expect(stqa.meanUncertaintyK).not.toBe(0.81);
  });

  it('verifies coordinate system and target grid dimensions', () => {
    const diagnostics = getHeatDiagnostics();
    expect(diagnostics.metadata.crs).toBe('EPSG:32643');
    expect(diagnostics.metadata.targetGridResolutionMeters).toBe(30.0);
    expect(diagnostics.metadata.rasterDimensions.width).toBe(1012);
    expect(diagnostics.metadata.rasterDimensions.height).toBe(871);
    expect(diagnostics.metadata.candidateBoundaryPixels).toBe(577304);
  });
});
