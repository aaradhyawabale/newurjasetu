import { describe, it, expect } from "vitest";
import {
  createFootprintPolygon,
  computeAreaM2,
  computeDistanceMeters,
  getBoundingBoxAround,
  doesFootprintIntersect,
} from "@/server/gis/geometry";
import * as turf from "@turf/turf";

describe("GIS Geometry Utilities", () => {
  it("creates an oriented rectangular footprint with correct dimensions", () => {
    // 100m length x 50m width = ~5000 m2
    const poly = createFootprintPolygon(28.6139, 77.2090, 100, 50, 45);
    expect(poly.geometry.type).toBe("Polygon");
    expect(poly.geometry.coordinates[0].length).toBe(5); // 4 corners + closed loop

    const calculatedArea = computeAreaM2(poly);
    // Should be within 2% of 5000 m2 geodesic area
    expect(calculatedArea).toBeGreaterThan(4850);
    expect(calculatedArea).toBeLessThan(5150);
  });

  it("computes geodesic distance accurately", () => {
    // Distance between two points 1 degree of latitude apart (~111 km = ~111,000 m)
    const dist = computeDistanceMeters([77.2090, 28.6139], [77.2090, 29.6139]);
    expect(dist).toBeGreaterThan(110000);
    expect(dist).toBeLessThan(112000);
  });

  it("calculates accurate bounding box around point", () => {
    const bbox = getBoundingBoxAround(28.6139, 77.2090, 1000); // 1000m radius
    expect(bbox.north).toBeGreaterThan(28.6139);
    expect(bbox.south).toBeLessThan(28.6139);
    expect(bbox.east).toBeGreaterThan(77.2090);
    expect(bbox.west).toBeLessThan(77.2090);
  });

  it("detects intersection between footprint and overlapping feature", () => {
    const footprint = createFootprintPolygon(28.6139, 77.2090, 100, 50, 0);

    // Point right in center
    const insidePoint = turf.point([77.2090, 28.6139]).geometry;
    expect(doesFootprintIntersect(footprint, insidePoint)).toBe(true);

    // Point far away
    const outsidePoint = turf.point([77.3000, 28.7000]).geometry;
    expect(doesFootprintIntersect(footprint, outsidePoint)).toBe(false);
  });
});
