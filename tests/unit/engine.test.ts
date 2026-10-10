import { describe, it, expect, vi } from "vitest";
import { runAnalysisEngine } from "@/server/analysis-engine/engine";
import { INFRASTRUCTURE_TYPES, InfrastructureTypeId } from "@/config/infra-types";

// Mock external network providers to run isolated, rapid unit tests with zero network latency
vi.mock("@/server/providers/overpass", () => {
  return {
    OverpassProvider: class {
      async getFeaturesAround() {
        return {
          elements: [
            {
              type: "way",
              id: 101,
              tags: { highway: "primary", name: "Ring Road" },
              geometry: [{ lat: 28.614, lon: 77.209 }, { lat: 28.615, lon: 77.210 }],
            },
            {
              type: "way",
              id: 102,
              tags: { building: "yes" },
              geometry: [{ lat: 28.6142, lon: 77.2092 }, { lat: 28.6143, lon: 77.2093 }, { lat: 28.6142, lon: 77.2093 }, { lat: 28.6142, lon: 77.2092 }],
            },
            {
              type: "node",
              id: 103,
              lat: 28.6135,
              lon: 77.2085,
              tags: { amenity: "hospital", name: "City General" },
            },
          ],
          retrievedAt: new Date().toISOString(),
          source: "OpenStreetMap (Mock Test Fixture)",
          queryId: "mock_ovp_1",
        };
      }
    },
    osmElementToGeoJson: (el: any) => {
      if (el.type === "node") {
        return { type: "Feature", geometry: { type: "Point", coordinates: [el.lon, el.lat] }, properties: el.tags };
      }
      return {
        type: "Feature",
        geometry: { type: "LineString", coordinates: el.geometry.map((g: any) => [g.lon, g.lat]) },
        properties: el.tags,
      };
    },
  };
});

vi.mock("@/server/providers/open-meteo", () => {
  return {
    OpenMeteoProvider: class {
      async getElevationAndSlope() {
        return {
          centerElevationM: 215,
          slopePercent: 2.3,
          samplePointsCount: 9,
          retrievedAt: new Date().toISOString(),
          source: "Open-Meteo DEM (Mock)",
        };
      }
      async getClimateIndicators() {
        return {
          maxDailyRainfallMm: 62.5,
          annualTotalRainfallMm: 850,
          retrievedAt: new Date().toISOString(),
          source: "Open-Meteo Climate Archive (Mock)",
        };
      }
    },
  };
});

vi.mock("@/server/providers/nasa-power", () => {
  return {
    NasaPowerProvider: class {
      async getSolarResource() {
        return {
          annualAverageGhiKwhM2Day: 5.35,
          retrievedAt: new Date().toISOString(),
          source: "NASA POWER CERES (Mock)",
        };
      }
    },
  };
});

describe("Analysis Engine Pipeline for all 10 Infrastructure Types", () => {
  const allTypes = Object.keys(INFRASTRUCTURE_TYPES) as InfrastructureTypeId[];

  for (const infraType of allTypes) {
    it(`evaluates ${infraType} producing valid report structure, criteria, and evidence`, async () => {
      const cfg = INFRASTRUCTURE_TYPES[infraType];
      const result = await runAnalysisEngine({
        placementId: `test_${infraType.toLowerCase().replace(/\s+/g, "_")}`,
        type: infraType,
        lat: 28.6139,
        lng: 77.2090,
        lengthM: cfg.defaultLengthM,
        widthM: cfg.defaultWidthM,
        bearingDeg: 15,
        customParams: {
          designFlow: 1500,
          channelWidth: 4.0,
          channelDepth: 2.0,
          targetCapacityMw: 10,
        },
      });

      expect(result).toBeDefined();
      expect(result.engineVersion).toBe("1.0.0");
      expect(result.overall.score).toBeGreaterThanOrEqual(0);
      expect(result.overall.score).toBeLessThanOrEqual(100);
      expect(result.overall.band).toBeDefined();
      expect(result.overall.confidence).toBeGreaterThan(0);
      expect(result.criteria.length).toBe(cfg.criteria.length);
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.limitations.length).toBeGreaterThan(0);
      expect(result.narrativeText).toContain("UrjaSetu");

      // Verify each criterion has valid score and weight
      for (const crit of result.criteria) {
        expect(crit.score).toBeGreaterThanOrEqual(0);
        expect(crit.score).toBeLessThanOrEqual(100);
        expect(crit.weight).toBeGreaterThan(0);
        expect(crit.benchmark).toContain("NEEDS VERIFICATION");
      }
    });
  }
});
