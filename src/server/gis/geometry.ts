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
  const center = turf.point([centerLng, centerLat]);
  const halfLenKm = (lengthM / 2) / 1000;
  const halfWidKm = (widthM / 2) / 1000;

  // Normalized bearing in degrees
  const b = ((bearingDeg % 360) + 360) % 360;
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
    bearingDeg,
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
  pt: Feature< GeoJSON.Point >,
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
