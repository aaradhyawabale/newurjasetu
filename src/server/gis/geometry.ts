import * as turf from "@turf/turf";
import type { Feature, Polygon, Geometry, LineString, MultiLineString } from "geojson";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Validates WGS84 latitude and longitude coordinates.
 * Rejects NaN/Infinity, out-of-range coordinates, and extreme polar latitudes (> 85°)
 * where Web Mercator and 3x3 DEM grid approximations become degenerate.
 */
export function validateCoordinates(lat: number, lng: number): {
  valid: boolean;
  reason?: string;
} {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valid: false, reason: "Coordinates must be finite numbers." };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, reason: `Latitude (${lat}) must be between -90° and 90°.` };
  }
  if (lng < -180 || lng > 180) {
    return { valid: false, reason: `Longitude (${lng}) must be between -180° and 180°.` };
  }
  if (Math.abs(lat) > 85) {
    return {
      valid: false,
      reason: `Latitude (${lat}°) exceeds operational Web Mercator / DEM bounds (-85° to 85°).`,
    };
  }
  return { valid: true };
}

/**
 * Validates that a GeoJSON Polygon has a closed outer ring, finite vertices,
 * positive geodesic area, and no self-intersecting kinks.
 */
export function validatePolygonGeometry(polygon: Feature<Polygon> | Polygon): {
  valid: boolean;
  areaM2: number;
  reason?: string;
} {
  try {
    const geom = "geometry" in polygon ? polygon.geometry : polygon;
    if (!geom || geom.type !== "Polygon" || !Array.isArray(geom.coordinates) || geom.coordinates.length === 0) {
      return { valid: false, areaM2: 0, reason: "Geometry is not a valid GeoJSON Polygon." };
    }

    const ring = geom.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 4) {
      return { valid: false, areaM2: 0, reason: "Polygon outer ring must have at least 4 coordinates." };
    }

    for (const pt of ring) {
      if (!Array.isArray(pt) || pt.length < 2 || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
        return { valid: false, areaM2: 0, reason: "Polygon contains non-finite vertex coordinates." };
      }
      if (pt[1] < -90 || pt[1] > 90 || pt[0] < -180 || pt[0] > 180) {
        return { valid: false, areaM2: 0, reason: "Polygon vertex out of WGS84 coordinate bounds." };
      }
    }

    const first = ring[0];
    const last = ring[ring.length - 1];
    if (Math.abs(first[0] - last[0]) > 1e-9 || Math.abs(first[1] - last[1]) > 1e-9) {
      return { valid: false, areaM2: 0, reason: "Polygon linear ring is not closed." };
    }

    const kinks = turf.kinks(geom);
    if (kinks.features.length > 0) {
      return {
        valid: false,
        areaM2: 0,
        reason: `Polygon is self-intersecting (${kinks.features.length} kink(s) detected).`,
      };
    }

    const areaM2 = Math.round(turf.area(geom));
    if (!Number.isFinite(areaM2) || areaM2 <= 0) {
      return { valid: false, areaM2: 0, reason: "Polygon has zero or invalid geodesic surface area." };
    }

    return { valid: true, areaM2 };
  } catch (err: any) {
    return { valid: false, areaM2: 0, reason: err?.message || "Invalid polygon geometry." };
  }
}

/**
 * Creates a GeoJSON Polygon representing an oriented rectangle footprint
 * centered at (lat, lng), with length along bearing and width perpendicular.
 */
export function createFootprintPolygon(
  centerLat: number,
  centerLng: number,
  lengthM: number,
  widthM: number,
  bearingDeg = 0
): Feature<Polygon> {
  const coordCheck = validateCoordinates(centerLat, centerLng);
  if (!coordCheck.valid) {
    throw new Error(`Invalid footprint coordinates: ${coordCheck.reason}`);
  }
  if (!Number.isFinite(lengthM) || !Number.isFinite(widthM) || lengthM <= 0 || widthM <= 0) {
    throw new Error("Footprint lengthM and widthM must be positive finite numbers.");
  }
  if (lengthM > 20000 || widthM > 20000) {
    throw new Error("Footprint dimensions exceed maximum supported site extent (20,000m).");
  }
  const safeBearing = Number.isFinite(bearingDeg) ? bearingDeg : 0;

  const center = turf.point([centerLng, centerLat]);
  const halfLenKm = (lengthM / 2) / 1000;
  const halfWidKm = (widthM / 2) / 1000;

  // Normalized bearing in degrees
  const b = ((safeBearing % 360) + 360) % 360;
  const bPerp = (b + 90) % 360;

  // Corner 1: +halfLen, -halfWid
  const pFront = turf.destination(center, halfLenKm, b, { units: "kilometers" });
  const pBack = turf.destination(center, halfLenKm, (b + 180) % 360, { units: "kilometers" });

  const c1 = turf.destination(pFront, halfWidKm, (bPerp + 180) % 360, { units: "kilometers" });
  const c2 = turf.destination(pFront, halfWidKm, bPerp, { units: "kilometers" });
  const c3 = turf.destination(pBack, halfWidKm, bPerp, { units: "kilometers" });
  const c4 = turf.destination(pBack, halfWidKm, (bPerp + 180) % 360, { units: "kilometers" });

  const coords = [
    c1.geometry.coordinates,
    c2.geometry.coordinates,
    c3.geometry.coordinates,
    c4.geometry.coordinates,
    c1.geometry.coordinates,
  ];

  return turf.polygon([coords], {
    lengthM,
    widthM,
    bearingDeg: safeBearing,
    areaM2: lengthM * widthM,
    centerLat,
    centerLng,
  });
}

/**
 * Computes exact geodesic surface area in square meters.
 */
export function computeAreaM2(polygon: Feature<Polygon> | Polygon): number {
  return Math.round(turf.area(polygon));
}

/**
 * Computes geodesic distance in meters between two coordinates [lng, lat].
 */
export function computeDistanceMeters(p1: [number, number], p2: [number, number]): number {
  const from = turf.point(p1);
  const to = turf.point(p2);
  return turf.distance(from, to, { units: "meters" });
}

/**
 * Computes geodesic distance in meters between two (lat, lng) pairs.
 */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  return computeDistanceMeters([lng1, lat1], [lng2, lat2]);
}

function distanceToLineOrMultiLine(
  pt: Feature<GeoJSON.Point>,
  geom: LineString | MultiLineString
): number {
  if (geom.type === "LineString") {
    return turf.pointToLineDistance(pt, geom, { units: "meters" });
  }
  let minD = Infinity;
  for (const coords of geom.coordinates) {
    if (coords.length >= 2) {
      const d = turf.pointToLineDistance(pt, turf.lineString(coords), { units: "meters" });
      if (d < minD) minD = d;
    }
  }
  return minD;
}

/**
 * Computes exact geodesic distance in meters from a point [lng, lat]
 * to any GeoJSON Geometry (Point, LineString, Polygon, etc.)
 * avoiding centroid approximation errors on long linear corridors.
 */
export function computeGeometryDistanceMeters(
  pointCoords: [number, number],
  geometry: Geometry
): number {
  try {
    const pt = turf.point(pointCoords);

    if (geometry.type === "Point") {
      return turf.distance(pt, turf.point(geometry.coordinates), { units: "meters" });
    }

    if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
      return distanceToLineOrMultiLine(pt, geometry);
    }

    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      if (turf.booleanPointInPolygon(pt, geometry as any)) {
        return 0;
      }
      const boundary = turf.polygonToLine(geometry as any);
      if (boundary.type === "FeatureCollection") {
        let minDist = Infinity;
        for (const f of boundary.features) {
          const d = distanceToLineOrMultiLine(pt, f.geometry as LineString | MultiLineString);
          if (d < minDist) minDist = d;
        }
        return minDist;
      }
      return distanceToLineOrMultiLine(
        pt,
        (boundary as Feature<LineString | MultiLineString>).geometry
      );
    }

    const c = turf.centroid(geometry as any);
    return turf.distance(pt, c, { units: "meters" });
  } catch {
    return 9999;
  }
}

/**
 * Computes the shortest geodesic distance in meters from the boundary/interior of a
 * footprint polygon to a target Geometry (0 if they intersect).
 */
export function computeFootprintDistanceToGeometryMeters(
  footprint: Feature<Polygon>,
  geometry: Geometry
): number {
  try {
    if (doesFootprintIntersect(footprint, geometry)) {
      return 0;
    }
    const ring = footprint.geometry.coordinates[0];
    let minD = Infinity;
    // Check distance from each footprint corner + center to target geometry
    for (let i = 0; i < ring.length - 1; i++) {
      const cornerDist = computeGeometryDistanceMeters([ring[i][0], ring[i][1]], geometry);
      if (cornerDist < minD) minD = cornerDist;
    }
    // Also check if target geometry vertices are close to footprint edges
    if (geometry.type === "Point") {
      const d = computeGeometryDistanceMeters(
        [geometry.coordinates[0], geometry.coordinates[1]],
        footprint.geometry
      );
      if (d < minD) minD = d;
    } else if (geometry.type === "LineString") {
      for (const coord of geometry.coordinates) {
        const d = computeGeometryDistanceMeters([coord[0], coord[1]], footprint.geometry);
        if (d < minD) minD = d;
      }
    }
    return minD;
  } catch {
    return 9999;
  }
}

/**
 * Computes a bounding box in WGS84 for a given center and radius in meters.
 */
export function getBoundingBoxAround(lat: number, lng: number, radiusM: number): BoundingBox {
  const center = turf.point([lng, lat]);
  const radiusKm = radiusM / 1000;

  const north = turf.destination(center, radiusKm, 0, { units: "kilometers" }).geometry.coordinates[1];
  const south = turf.destination(center, radiusKm, 180, { units: "kilometers" }).geometry.coordinates[1];
  const east = turf.destination(center, radiusKm, 90, { units: "kilometers" }).geometry.coordinates[0];
  const west = turf.destination(center, radiusKm, 270, { units: "kilometers" }).geometry.coordinates[0];

  return {
    south: Math.min(south, north),
    west: Math.min(west, east),
    north: Math.max(south, north),
    east: Math.max(west, east),
  };
}

/**
 * Checks if a footprint polygon intersects with any OSM feature (Polygon or LineString or Point inside)
 */
export function doesFootprintIntersect(
  footprint: Feature<Polygon>,
  featureGeometry: Geometry
): boolean {
  try {
    if (featureGeometry.type === "Point") {
      return turf.booleanPointInPolygon(turf.point(featureGeometry.coordinates), footprint);
    }
    if (featureGeometry.type === "Polygon" || featureGeometry.type === "MultiPolygon") {
      return turf.booleanIntersects(footprint, featureGeometry as any);
    }
    if (featureGeometry.type === "LineString" || featureGeometry.type === "MultiLineString") {
      return turf.booleanIntersects(footprint, featureGeometry as any);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Checks whether a given [lat, lng] point lies inside a GeoJSON Polygon or MultiPolygon.
 * Strictly respects GeoJSON coordinate ordering [longitude, latitude] for Turf operations.
 */
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: Feature<Polygon | GeoJSON.MultiPolygon> | Polygon | GeoJSON.MultiPolygon
): boolean {
  const coordCheck = validateCoordinates(lat, lng);
  if (!coordCheck.valid) return false;
  try {
    const pt = turf.point([lng, lat]);
    return turf.booleanPointInPolygon(pt, polygon as any);
  } catch {
    return false;
  }
}

/**
 * Calculates a preliminary access road alignment connecting a footprint perimeter
 * to the nearest point on a road network geometry.
 */
export function calculateAccessRoadAlignment(
  footprint: Feature<Polygon>,
  roadGeometry: Geometry
): {
  alignment: Feature<LineString>;
  lengthM: number;
  fromCoord: [number, number];
  toCoord: [number, number];
} | null {
  try {
    const center = turf.centroid(footprint);
    let targetPoint: [number, number] | null = null;

    if (roadGeometry.type === "Point") {
      targetPoint = [roadGeometry.coordinates[0], roadGeometry.coordinates[1]];
    } else if (roadGeometry.type === "LineString") {
      const nearest = turf.nearestPointOnLine(turf.lineString(roadGeometry.coordinates), center);
      targetPoint = [nearest.geometry.coordinates[0], nearest.geometry.coordinates[1]];
    } else if (roadGeometry.type === "MultiLineString") {
      let minDist = Infinity;
      for (const coords of roadGeometry.coordinates) {
        if (coords.length >= 2) {
          const nearest = turf.nearestPointOnLine(turf.lineString(coords), center);
          const d = turf.distance(center, nearest, { units: "meters" });
          if (d < minDist) {
            minDist = d;
            targetPoint = [nearest.geometry.coordinates[0], nearest.geometry.coordinates[1]];
          }
        }
      }
    }

    if (!targetPoint) return null;

    // Find the closest point on the footprint perimeter ring to the road target point
    const ring = footprint.geometry.coordinates[0];
    const targetPtFeature = turf.point(targetPoint);
    let bestRingPoint: [number, number] = [ring[0][0], ring[0][1]];
    let minD = Infinity;

    for (let i = 0; i < ring.length - 1; i++) {
      const seg = turf.lineString([ring[i], ring[i + 1]]);
      const np = turf.nearestPointOnLine(seg, targetPtFeature);
      const d = turf.distance(targetPtFeature, np, { units: "meters" });
      if (d < minD) {
        minD = d;
        bestRingPoint = [np.geometry.coordinates[0], np.geometry.coordinates[1]];
      }
    }

    const lengthM = Math.round(
      turf.distance(turf.point(bestRingPoint), targetPtFeature, { units: "meters" })
    );
    const alignment = turf.lineString([bestRingPoint, targetPoint], {
      lengthM,
      type: "proposed_access_road",
    });

    return {
      alignment,
      lengthM,
      fromCoord: bestRingPoint,
      toCoord: targetPoint,
    };
  } catch {
    return null;
  }
}
