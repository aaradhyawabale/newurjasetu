import { describe, it, expect } from "vitest";
import {
  createFootprintPolygon,
  computeAreaM2,
  computeDistanceMeters,
  computeGeometryDistanceMeters,
  computeFootprintDistanceToGeometryMeters,
  getBoundingBoxAround,
  doesFootprintIntersect,
  validateCoordinates,
  validatePolygonGeometry,
} from "@/server/gis/geometry";
import * as turf from "@turf/turf";

describe("GIS Geometry & Validation Utilities", () => {
  it("validates valid and invalid WGS84 coordinates including boundary conditions", () => {
    expect(validateCoordinates(28.6139, 77.2090).valid).toBe(true);
    expect(validateCoordinates(0, 0).valid).toBe(true);
    expect(validateCoordinates(-84.9, 180).valid).toBe(true);

    // Invalid latitude / longitude / NaN / polar
    expect(validateCoordinates(95, 77.2).valid).toBe(false);
    expect(validateCoordinates(-91, 77.2).valid).toBe(false);
    expect(validateCoordinates(28.6, 185).valid).toBe(false);
    expect(validateCoordinates(28.6, -181).valid).toBe(false);
    expect(validateCoordinates(NaN, 77.2).valid).toBe(false);
    expect(validateCoordinates(88.5, 77.2).valid).toBe(false); // Exceeds 85° Web Mercator / DEM limit
  });

  it("rejects invalid dimensions or coordinates when creating footprint polygon", () => {
    expect(() => createFootprintPolygon(95, 77.2, 100, 50)).toThrow(/Invalid footprint coordinates/);
    expect(() => createFootprintPolygon(28.6, 77.2, 0, 50)).toThrow(/positive finite/);
    expect(() => createFootprintPolygon(28.6, 77.2, -20, 50)).toThrow(/positive finite/);
    expect(() => createFootprintPolygon(28.6, 77.2, 50000, 50)).toThrow(/maximum supported/);
  });

  it("validates polygon geometry and detects self-intersecting bow-tie polygons", () => {
    const validPoly = createFootprintPolygon(28.6139, 77.2090, 100, 50, 30);
    const validCheck = validatePolygonGeometry(validPoly);
    expect(validCheck.valid).toBe(true);
    expect(validCheck.areaM2).toBeGreaterThan(4850);

    // Self-intersecting bow-tie polygon
    const bowTie = turf.polygon([
      [
        [77.208, 28.613],
        [77.210, 28.615],
        [77.210, 28.613],
        [77.208, 28.615],
        [77.208, 28.613],
      ],
    ]);
    const bowTieCheck = validatePolygonGeometry(bowTie);
    expect(bowTieCheck.valid).toBe(false);
    expect(bowTieCheck.reason).toContain("self-intersecting");
  });

  it("creates an oriented rectangular footprint with correct dimensions", () => {
    const poly = createFootprintPolygon(28.6139, 77.2090, 100, 50, 45);
    expect(poly.geometry.type).toBe("Polygon");
    expect(poly.geometry.coordinates[0].length).toBe(5);

    const calculatedArea = computeAreaM2(poly);
    expect(calculatedArea).toBeGreaterThan(4850);
    expect(calculatedArea).toBeLessThan(5150);
  });

  it("computes geodesic distance accurately", () => {
    const dist = computeDistanceMeters([77.2090, 28.6139], [77.2090, 29.6139]);
    expect(dist).toBeGreaterThan(110000);
    expect(dist).toBeLessThan(112000);
  });

  it("computes true point-to-line and point-to-polygon boundary distance rather than centroid distance", () => {
    const longRoad = turf.lineString([
      [77.2080, 28.6139],
      [77.2090, 28.6139],
      [77.2500, 28.6139],
    ]).geometry;

    const lineDist = computeGeometryDistanceMeters([77.2090, 28.6139], longRoad);
    expect(lineDist).toBeLessThan(2);

    const footprint = createFootprintPolygon(28.6139, 77.2090, 200, 200, 0).geometry;
    expect(computeGeometryDistanceMeters([77.2090, 28.6139], footprint)).toBe(0);
  });

  it("computes shortest distance from footprint boundary to nearby feature", () => {
    // 100m x 100m footprint centered at (28.6139, 77.2090) -> extends ~50m North/South/East/West
    const footprint = createFootprintPolygon(28.6139, 77.2090, 100, 100, 0);
    const point100mNorth = turf.destination(turf.point([77.2090, 28.6139]), 0.1, 0, {
      units: "kilometers",
    }).geometry;

    // Center is 100m away, so footprint northern edge is ~50m away
    const edgeDist = computeFootprintDistanceToGeometryMeters(footprint, point100mNorth);
    expect(edgeDist).toBeGreaterThan(40);
    expect(edgeDist).toBeLessThan(65);
  });

  it("calculates accurate bounding box around point", () => {
    const bbox = getBoundingBoxAround(28.6139, 77.2090, 1000);
    expect(bbox.north).toBeGreaterThan(28.6139);
    expect(bbox.south).toBeLessThan(28.6139);
    expect(bbox.east).toBeGreaterThan(77.2090);
    expect(bbox.west).toBeLessThan(77.2090);
  });

  it("detects intersection between footprint and overlapping feature", () => {
    const footprint = createFootprintPolygon(28.6139, 77.2090, 100, 50, 0);

    const insidePoint = turf.point([77.2090, 28.6139]).geometry;
    expect(doesFootprintIntersect(footprint, insidePoint)).toBe(true);

    const outsidePoint = turf.point([77.3000, 28.7000]).geometry;
    expect(doesFootprintIntersect(footprint, outsidePoint)).toBe(false);
  });
});
