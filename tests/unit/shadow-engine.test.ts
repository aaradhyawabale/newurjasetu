import { describe, it, expect } from "vitest";
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import {
  resolveBuildingHeight,
  projectGroundShadow,
  calculateShadedAreaM2,
  simulateSolarShading,
} from "@/server/solar/shadow-engine";
import { StandardizedGeoFeature } from "@/server/providers/types";
import { createFootprintPolygon } from "@/server/gis/geometry";

describe("Shadow-of-the-Future: Geometric Shadow Engine & Scenarios", () => {
  const dummyFeature = (attrs: Record<string, any>): StandardizedGeoFeature => ({
    id: "osm-way-12345",
    sourceId: "12345",
    sourceName: "OpenStreetMap",
    category: "building",
    subCategory: "commercial",
    label: "City Commercial Center",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [77.209, 28.613],
          [77.21, 28.613],
          [77.21, 28.614],
          [77.209, 28.614],
          [77.209, 28.613],
        ],
      ],
    },
    attributes: attrs,
    retrievedAt: new Date().toISOString(),
    quality: { completeness: "verified", isStale: false, cacheStatus: "fresh_hit" },
    license: "ODbL 1.0",
  });

  describe("Building Height Resolution & Epistemic Provenance (STEP 1)", () => {
    it("classifies explicit OSM height tag as measured", () => {
      const feat = dummyFeature({ heightM: 24.5 });
      const res = resolveBuildingHeight(feat);
      expect(res.provenance).toBe("measured");
      expect(res.heightM).toBe(24.5);
      expect(res.notes).toContain("Direct height tag");
    });

    it("classifies building:levels as inferred_from_levels without pretending to be a laser measurement", () => {
      const feat = dummyFeature({ levels: 5 });
      const res = resolveBuildingHeight(feat);
      expect(res.provenance).toBe("inferred_from_levels");
      expect(res.heightM).toBe(16.0); // 5 * 3.2m
      expect(res.levels).toBe(5);
      expect(res.notes).toContain("Not a direct laser measurement");
    });

    it("respects user hypothetical override in what-if scenarios", () => {
      const feat = dummyFeature({ heightM: 10.0 });
      const res = resolveBuildingHeight(feat, { userOverrideHeightM: 45.0 });
      expect(res.provenance).toBe("hypothetical_user");
      expect(res.heightM).toBe(45.0);
    });

    it("marks missing heights as default_assumption when proxy requested", () => {
      const feat = dummyFeature({});
      const res = resolveBuildingHeight(feat, { defaultUnknownHeightM: 8.0 });
      expect(res.provenance).toBe("default_assumption");
      expect(res.heightM).toBe(8.0);
    });

    it("marks missing heights as unavailable when no proxy requested", () => {
      const feat = dummyFeature({});
      const res = resolveBuildingHeight(feat);
      expect(res.provenance).toBe("unavailable");
      expect(res.heightM).toBe(0);
    });
  });

  describe("Geometric Shadow Projection (STEP 3)", () => {
    // 30m x 30m square building at 28.6139°N, 77.2090°E
    const buildingPoly = createFootprintPolygon(28.6139, 77.209, 30, 30, 0);

    it("projects shadow in anti-solar direction with correct length at 45° elevation", () => {
      // At 45° sun elevation, tan(45°) = 1.0, so shadow length = building height (20m)
      const heightM = 20.0;
      const sunElevationDeg = 45.0;
      const sunAzimuthDeg = 180.0; // Sun due South

      const shadow = projectGroundShadow(buildingPoly, heightM, sunElevationDeg, sunAzimuthDeg);
      expect(shadow).not.toBeNull();
      expect(shadow!.geometry.type).toBe("Polygon");

      // Shadow must cast to the North (180° + 180° = 360°/0°)
      // The northernmost point of the shadow should extend north of the building
      const bbox = turf.bbox(shadow!);
      const buildingBbox = turf.bbox(buildingPoly);
      expect(bbox[3]).toBeGreaterThan(buildingBbox[3]); // North coordinate extends further north
    });

    it("projects shorter shadows at high sun elevation (60°) than low sun elevation (20°)", () => {
      const heightM = 30.0;
      const sunAzimuth = 180.0;

      const shadowHighSun = projectGroundShadow(buildingPoly, heightM, 60.0, sunAzimuth);
      const shadowLowSun = projectGroundShadow(buildingPoly, heightM, 20.0, sunAzimuth);

      expect(shadowHighSun).not.toBeNull();
      expect(shadowLowSun).not.toBeNull();

      const areaHigh = turf.area(shadowHighSun!);
      const areaLow = turf.area(shadowLowSun!);

      // Low sun creates a much longer shadow envelope
      expect(areaLow).toBeGreaterThan(areaHigh * 1.5);
    });

    it("returns null when sun is at or below the horizon (night / sunset)", () => {
      const shadowZero = projectGroundShadow(buildingPoly, 25.0, 0.0, 180.0);
      expect(shadowZero).toBeNull();

      const shadowNegative = projectGroundShadow(buildingPoly, 25.0, -15.0, 180.0);
      expect(shadowNegative).toBeNull();
    });
  });

  describe("Shading Area Intersections (STEP 3)", () => {
    it("calculates 0% shading when building shadow does not reach the solar array", () => {
      const solarArray = createFootprintPolygon(28.6139, 77.209, 100, 100, 0);
      // Small shadow 2 km away
      const distantShadow = createFootprintPolygon(28.63, 77.209, 20, 20, 0);

      const metrics = calculateShadedAreaM2(solarArray, [distantShadow]);
      expect(metrics.shadedAreaM2).toBe(0);
      expect(metrics.shadedPercentage).toBe(0);
      expect(metrics.unshadedPercentage).toBe(100);
      expect(metrics.overlapGeom).toBeNull();
    });

    it("calculates exact partial shading when shadow intersects array", () => {
      const solarArray = createFootprintPolygon(28.6139, 77.209, 100, 100, 0);
      const totalSolarArea = Math.round(turf.area(solarArray));

      // Create an overlapping shadow covering approximately half of the solar array
      const overlappingShadow = createFootprintPolygon(28.6141, 77.209, 60, 100, 0);

      const metrics = calculateShadedAreaM2(solarArray, [overlappingShadow]);
      expect(metrics.shadedAreaM2).toBeGreaterThan(1000);
      expect(metrics.shadedAreaM2).toBeLessThan(totalSolarArea);
      expect(metrics.shadedPercentage).toBeGreaterThan(10);
      expect(metrics.unshadedPercentage).toBeLessThan(90);
      expect(metrics.overlapGeom).not.toBeNull();
    });
  });

  describe("Future Scenarios Comparison (STEP 4 & STEP 5)", () => {
    it("computes baseline vs future hypothetical tower scenario and reports delta", () => {
      const solarPlacement = {
        lat: 28.6139,
        lng: 77.209,
        lengthM: 100,
        widthM: 80,
        bearingDeg: 0,
        panelTiltDeg: 22,
      };

      // Winter afternoon simulation: Dec 21, 14:30 IST (low sun casting long north-easterly shadows)
      const simTime = {
        isoDate: "2026-12-21T09:00:00.000Z", // 14:30 IST
        timezoneOffsetMinutes: 330,
      };

      // Existing baseline: No tall buildings directly south
      const existingFeatures: StandardizedGeoFeature[] = [
        dummyFeature({ heightM: 8.0 }),
      ];

      // Hypothetical future scenario: A 50m commercial high-rise tower is proposed 60m directly south of the solar array
      const hypotheticalTower = {
        id: "future-tower-1",
        name: "Proposed 50m Tech Park High-Rise",
        lat: 28.6133, // South of solar array
        lng: 77.209,
        lengthM: 50,
        widthM: 40,
        heightM: 50,
        status: "hypothetical_proposal" as const,
      };

      const result = simulateSolarShading(solarPlacement, simTime, existingFeatures, {
        includeExistingBuildings: true,
        hypotheticalBuildings: [hypotheticalTower],
      });

      expect(result.solarPosition.isDaylight).toBe(true);
      expect(result.delta).toBeDefined();

      // Hypothetical tower should increase shaded area and decrease unshaded percentage
      expect(result.delta.exposureImpact).toBe("increased_shading");
      expect(result.delta.deltaShadedAreaM2).toBeGreaterThan(0);
      expect(result.delta.deltaShadedPercentage).toBeGreaterThan(0);
      expect(result.scenario.unshadedPercentage).toBeLessThan(result.baseline.unshadedPercentage);

      // Provenance summary check
      expect(result.provenanceSummary.hypotheticalCount).toBe(1);
      expect(result.provenanceSummary.measuredCount).toBe(1);

      // Explicit limitations check
      expect(result.limitations.length).toBeGreaterThanOrEqual(4);
      expect(result.limitations.some((l) => l.includes("Instantaneous geometric snapshot"))).toBe(true);
      expect(result.limitations.some((l) => l.includes("Hypothetical distinction"))).toBe(true);
    });
  });
});
