import { describe, it, expect } from 'vitest';
import {
  isWithinGeographicPlausibilityBox,
  isPointInsideCandidateBoundary,
  validateSpatialFeature,
  getCandidateMunicipalBoundary
} from '@/server/gis/spatial-validation';

describe('Phase 6.2 Spatial Integrity & Boundary Tests', () => {
  it('correctly loads candidate municipal boundary and confirms non-authoritative candidate metadata', () => {
    const boundary = getCandidateMunicipalBoundary();
    expect(boundary).toBeDefined();
    expect(boundary).not.toBeNull();
    expect(boundary?.properties?.name).toContain('Pune Municipal Corporation Candidate Boundary');
    expect(boundary?.properties?.provenance?.legalAuthoritativeness).toContain('Non-authoritative candidate');
  });

  it('validates coordinates against Pune geographic plausibility bounds', () => {
    // Valid Pune coordinates (e.g. Shaniwar Wada)
    expect(isWithinGeographicPlausibilityBox(18.5196, 73.8553)).toBe(true);
    // Invalid coordinate outside bounds (Mumbai)
    expect(isWithinGeographicPlausibilityBox(19.0760, 72.8777)).toBe(false);
    // Invalid non-finite coordinate
    expect(isWithinGeographicPlausibilityBox(NaN, 73.8553)).toBe(false);
  });

  it('performs exact point-in-polygon containment against candidate boundary', () => {
    // Central Pune (Shivajinagar)
    expect(isPointInsideCandidateBoundary(18.5314, 73.8446)).toBe(true);
    // Outlying point far outside Pune municipal limits (Lonawala)
    expect(isPointInsideCandidateBoundary(18.7557, 73.4091)).toBe(false);
  });

  it('validates spatial feature geometry and detects non-finite or out-of-range coordinates', () => {
    const validPoint = {
      geometry: {
        type: 'Point' as const,
        coordinates: [73.8553, 18.5196] as [number, number]
      }
    };
    const resValid = validateSpatialFeature(validPoint);
    expect(resValid.valid).toBe(true);
    expect(resValid.isPointGeometry).toBe(true);
    expect(resValid.hasFabricatedArea).toBe(false);

    const invalidCoord = {
      geometry: {
        type: 'Point' as const,
        coordinates: [73.8553, 999] as [number, number]
      }
    };
    const resInvalid = validateSpatialFeature(invalidCoord);
    expect(resInvalid.valid).toBe(false);
    expect(resInvalid.reasons.some(r => r.includes('outside [-90, 90]'))).toBe(true);
  });

  it('prohibits fabricated rooftop/garden areas on Point geometries without provenance', () => {
    const pointWithFabricatedArea = {
      geometry: {
        type: 'Point' as const,
        coordinates: [73.8553, 18.5196] as [number, number]
      },
      properties: {
        name: 'Sample Civic Hospital',
        areaSqm: 4500 // Area on a Point without provenance!
      }
    };

    const res = validateSpatialFeature(pointWithFabricatedArea);
    expect(res.hasFabricatedArea).toBe(true);
    expect(res.reasons.some(r => r.includes('Point geometry possesses an area calculation'))).toBe(true);
  });

  it('detects self-intersecting kinks in polygon geometries', () => {
    // Bowtie polygon with self-intersecting edges
    const selfIntersectingPolygon = {
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [73.84, 18.51],
          [73.86, 18.53],
          [73.86, 18.51],
          [73.84, 18.53],
          [73.84, 18.51]
        ]]
      }
    };

    const res = validateSpatialFeature(selfIntersectingPolygon);
    expect(res.valid).toBe(false);
    expect(res.reasons.some(r => r.includes('self-intersecting kink'))).toBe(true);
  });
});
