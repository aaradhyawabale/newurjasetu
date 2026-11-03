import { describe, it, expect } from 'vitest';
import { 
  isHeatDataAvailable, 
  getHeatDiagnostics, 
  getProvenanceManifest, 
  wgs84ToUtm43N, 
  queryHeatPoint 
} from '@/server/heat-engine/loader';
import { generateHeatContext } from '@/server/heat-engine/ai-adapter';

describe('UrjaSetu Satellite Heat & Vegetation Engine', () => {
  it('detects generated heat raster artifacts and manifests', () => {
    expect(isHeatDataAvailable()).toBe(true);
  });

  it('loads valid heat diagnostics report with scientific integrity', () => {
    const diag = getHeatDiagnostics();
    expect(diag).toBeDefined();
    expect(diag.metadata.crs).toBe('EPSG:32643');
    expect(diag.metadata.studyArea).toContain('PMC Candidate');
    expect(diag.metadata.boundaryDisclaimer).toContain('non-authoritative');
    
    // Landsat 9 verification
    expect(diag.landsat9.sceneId).toBe('LC09_L2SP_147047_20230422_02_T1');
    expect(diag.landsat9.nativeThermalResolutionMeters).toBe(100.0);
    expect(diag.landsat9.deliveredResolutionMeters).toBe(30.0);
    expect(diag.landsat9.calibratedLSTCelsius.mean).toBeGreaterThan(30.0);
    expect(diag.landsat9.calibratedLSTCelsius.mean).toBeLessThan(55.0);
    expect(diag.landsat9.rawDigitalNumbers.dn1To292AnomalyCount).toBe(0);
    expect(diag.landsat9.surfaceTemperatureQA.unit).toContain('Kelvin');

    // Sentinel-2B verification
    expect(diag.sentinel2b.sceneId).toContain('S2B_MSIL2A_20230424');
    expect(diag.sentinel2b.reflectanceDiagnostics.b04NegativeReflectancePixels).toBeGreaterThan(0);
    expect(diag.sentinel2b.reflectanceDiagnostics.note).toContain('without synthetic zero-clipping');
    expect(diag.sentinel2b.ndvi30mDistribution.unit).toContain('Unitless');
    expect(diag.sentinel2b.coverageFractions30m.meanSourceCoverageFraction).toBe(1.0);
  });

  it('verifies provenance manifest contains all 8 required raster products', () => {
    const manifest = getProvenanceManifest();
    expect(manifest.products).toHaveLength(8);

    const filenames = manifest.products.map((p: any) => p.filename);
    expect(filenames).toContain('pune_lst_raw_dn_30m.tif');
    expect(filenames).toContain('pune_lst_30m.tif');
    expect(filenames).toContain('pune_lst_statistical_mask_30m.tif');
    expect(filenames).toContain('pune_st_qa_30m.tif');
    expect(filenames).toContain('pune_ndvi_10m.tif');
    expect(filenames).toContain('pune_ndvi_30m.tif');
    expect(filenames).toContain('pune_ndvi_valid_fraction_30m.tif');
    expect(filenames).toContain('pune_scl_30m.tif');

    // All must be deterministic
    manifest.products.forEach((p: any) => {
      expect(p.provenance).toBe('DETERMINISTIC_RESULT');
    });
  });

  it('converts WGS84 to UTM Zone 43N correctly for Pune coordinates', () => {
    const puneLng = 73.8567;
    const puneLat = 18.5204;
    const { utmX, utmY } = wgs84ToUtm43N(puneLng, puneLat);

    // Pune UTM 43N coordinates are approximately X ~ 379,200m, Y ~ 2,048,000m
    expect(utmX).toBeGreaterThan(375000);
    expect(utmX).toBeLessThan(385000);
    expect(utmY).toBeGreaterThan(2040000);
    expect(utmY).toBeLessThan(2055000);
  });

  it('queries heat and vegetation metrics at a given point inside Pune candidate boundary', () => {
    const result = queryHeatPoint(73.8567, 18.5204);
    expect(result.gridCell.isInsideGrid).toBe(true);
    expect(result.lst.celsius).toBeGreaterThan(20.0);
    expect(result.lst.classification).toBe('NOMINAL_VALID');
    expect(result.lst.nativeResolutionNotice).toContain('100m native');
    expect(result.provenance.lst).toBe('DETERMINISTIC_RESULT');
    expect(result.provenance.ndvi).toBe('DETERMINISTIC_RESULT');
  });

  it('generates structured AI heat context with explicit provenance separation', () => {
    const diag = getHeatDiagnostics();
    const context = generateHeatContext(diag);

    expect(context.urbanHeatIslandContext.lstDistribution.provenance).toBe('DETERMINISTIC_RESULT');
    expect(context.urbanHeatIslandContext.thermalAnomalyStatus.provenance).toBe('DETERMINISTIC_RESULT');
    expect(context.recommendations[0].provenance).toBe('AI_INTERPRETATION');
    expect(context.disclaimers).toHaveLength(3);
    expect(context.disclaimers[0]).toContain('non-authoritative');
  });
});
