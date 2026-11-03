/**
 * UrjaSetu Phase 6.2 - Spatial Validation & Boundary Integrity Module
 * 
 * Enforces rigorous spatial validation, geometry semantics, and boundary classifications:
 * 1. Distinguishes Candidate Boundary from Statutory Municipal Boundary.
 * 2. Enforces WGS84 GeoJSON coordinate integrity [lng, lat].
 * 3. Validates topological correctness (self-intersections, ring closure).
 * 4. Prohibits synthetic buffering and fake area calculation from Point features.
 */

import * as turf from '@turf/turf';
import type { Feature, Geometry, Point, Polygon, MultiPolygon, LineString, FeatureCollection } from 'geojson';
import fs from 'fs';
import path from 'path';

export type SpatialBoundaryClassification =
  | 'STATUTORY_MUNICIPAL_BOUNDARY' // Official gazetted boundary from Maharashtra UDD (Not available in repository)
  | 'CANDIDATE_PLANNING_BOUNDARY'  // Non-authoritative candidate derived from Prabhag wards
  | 'OPERATIONAL_STUDY_AREA'       // Envelope defining candidate discovery scope
  | 'RASTER_COVERAGE_EXTENT'       // Orthogonal bounding grid of satellite rasters (1012x871 at 30m)
  | 'GEOGRAPHIC_PLAUSIBILITY_BOX'; // Coordinate range [18.40-18.65 N, 73.70-74.05 E] for sanity checks

export interface SpatialValidationResult {
  valid: boolean;
  geometryType?: string;
  reasons: string[];
  isPointGeometry: boolean;
  hasFabricatedArea: boolean;
  containedInCandidateBoundary?: boolean;
  containedInPlausibilityBox: boolean;
}

// Bounding box for Pune geographic plausibility filtering (NOT a municipal boundary)
export const PUNE_GEOGRAPHIC_PLAUSIBILITY_BOUNDS = {
  minLat: 18.40,
  maxLat: 18.65,
  minLng: 73.70,
  maxLng: 74.05
};

// Cached candidate boundary geometry
let cachedCandidateBoundary: Feature<Polygon | MultiPolygon> | null = null;

/**
 * Loads the candidate municipal boundary from disk (lazy-loaded)
 */
export function getCandidateMunicipalBoundary(): Feature<Polygon | MultiPolygon> | null {
  if (cachedCandidateBoundary) {
    return cachedCandidateBoundary;
  }

  const boundaryPath = path.join(process.cwd(), 'src', 'data', 'boundaries', 'pmc_candidate_boundary.geojson');
  if (!fs.existsSync(boundaryPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(boundaryPath, 'utf-8');
    const parsed = JSON.parse(raw) as FeatureCollection;
    if (parsed.features && parsed.features.length > 0) {
      cachedCandidateBoundary = parsed.features[0] as Feature<Polygon | MultiPolygon>;
      return cachedCandidateBoundary;
    }
  } catch {
    // If parse fails, return null
  }

  return null;
}

/**
 * Checks if coordinates fall within Pune geographic plausibility bounds.
 * NOTE: This is a geographic sanity check, NOT a municipal boundary verification.
 */
export function isWithinGeographicPlausibilityBox(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= PUNE_GEOGRAPHIC_PLAUSIBILITY_BOUNDS.minLat &&
    lat <= PUNE_GEOGRAPHIC_PLAUSIBILITY_BOUNDS.maxLat &&
    lng >= PUNE_GEOGRAPHIC_PLAUSIBILITY_BOUNDS.minLng &&
    lng <= PUNE_GEOGRAPHIC_PLAUSIBILITY_BOUNDS.maxLng
  );
}

/**
 * Checks if a point lies inside the PMC candidate boundary polygon using exact point-in-polygon math.
 * Distinguishes true polygon containment from rectangular bounding box checks.
 */
export function isPointInsideCandidateBoundary(lat: number, lng: number): boolean {
  if (!isWithinGeographicPlausibilityBox(lat, lng)) {
    return false;
  }

  const boundary = getCandidateMunicipalBoundary();
  if (!boundary || !boundary.geometry) {
    // Fall back to plausibility check if boundary file unavailable
    return false;
  }

  try {
    const pt = turf.point([lng, lat]);
    return turf.booleanPointInPolygon(pt, boundary);
  } catch {
    return false;
  }
}

/**
 * Validates spatial integrity of an intervention feature or infrastructure record.
 * Ensures:
 * 1. Geometry is structurally valid GeoJSON.
 * 2. Coordinates follow [longitude, latitude] standard within WGS84 bounds.
 * 3. Point features are NOT assigned arbitrary areas or treated as polygons.
 * 4. Polygons do not have self-intersecting kinks.
 */
export function validateSpatialFeature(feature: {
  geometry?: Geometry | null;
  coordinates?: [number, number] | { lat: number; lng: number };
  properties?: Record<string, any>;
}): SpatialValidationResult {
  const reasons: string[] = [];
  let isPoint = false;
  let hasFabricatedArea = false;
  let lat = 0;
  let lng = 0;
  let geometryType = 'Unknown';

  if (!feature) {
    return {
      valid: false,
      reasons: ['Feature is null or undefined'],
      isPointGeometry: false,
      hasFabricatedArea: false,
      containedInPlausibilityBox: false
    };
  }

  // Extract coordinates and geometry type
  if (feature.geometry) {
    geometryType = feature.geometry.type;
    if (feature.geometry.type === 'Point') {
      isPoint = true;
      const coords = (feature.geometry as Point).coordinates;
      if (!Array.isArray(coords) || coords.length < 2) {
        reasons.push('Point coordinates array must have at least [lng, lat]');
      } else {
        lng = coords[0];
        lat = coords[1];
      }
    } else if (feature.geometry.type === 'Polygon') {
      const poly = feature.geometry as Polygon;
      if (!poly.coordinates || poly.coordinates.length === 0 || poly.coordinates[0].length < 4) {
        reasons.push('Polygon must have a closed outer ring with at least 4 coordinates');
      } else {
        // Check for self-intersections
        try {
          const kinks = turf.kinks(turf.feature(poly));
          if (kinks.features.length > 0) {
            reasons.push(`Polygon contains ${kinks.features.length} self-intersecting kink(s)`);
          }
        } catch {
          reasons.push('Failed to evaluate polygon topology');
        }
        // Approximate centroid for bounds check
        const first = poly.coordinates[0][0];
        lng = first[0];
        lat = first[1];
      }
    } else if (feature.geometry.type === 'LineString') {
      const line = feature.geometry as LineString;
      if (!line.coordinates || line.coordinates.length < 2) {
        reasons.push('LineString must have at least 2 coordinate points');
      } else {
        lng = line.coordinates[0][0];
        lat = line.coordinates[0][1];
      }
    }
  } else if (feature.coordinates) {
    isPoint = true;
    geometryType = 'Point';
    if (Array.isArray(feature.coordinates)) {
      lng = feature.coordinates[0];
      lat = feature.coordinates[1];
    } else if (typeof feature.coordinates === 'object') {
      lat = feature.coordinates.lat;
      lng = feature.coordinates.lng;
    }
  } else {
    reasons.push('Feature has neither geometry nor coordinates');
  }

  // Coordinate validity
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    reasons.push('Coordinates must be finite numbers');
  } else {
    if (lat < -90 || lat > 90) reasons.push(`Latitude (${lat}) outside [-90, 90]`);
    if (lng < -180 || lng > 180) reasons.push(`Longitude (${lng}) outside [-180, 180]`);
  }

  // Geometry semantics: verify point features do not report fabricated rooftop/garden areas
  if (isPoint && feature.properties) {
    const props = feature.properties;
    if (props.areaSqm !== undefined && props.areaSqm !== null && props.areaSqmProvenance === undefined) {
      // Area present without provenance on a Point geometry is flagged
      hasFabricatedArea = true;
      reasons.push('Point geometry possesses an area calculation without explicit provenance citation');
    }
  }

  const inPlausibility = isWithinGeographicPlausibilityBox(lat, lng);
  if (!inPlausibility) {
    reasons.push(`Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}) fall outside Pune geographic plausibility bounds`);
  }

  const inCandidate = isPointInsideCandidateBoundary(lat, lng);

  return {
    valid: reasons.length === 0,
    geometryType,
    reasons,
    isPointGeometry: isPoint,
    hasFabricatedArea,
    containedInCandidateBoundary: inCandidate,
    containedInPlausibilityBox: inPlausibility
  };
}
