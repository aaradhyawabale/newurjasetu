import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAnalysisEngine, AnalysisEngineError } from "@/server/analysis-engine/engine";
import { validateFootprint } from "@/server/analysis-engine/validation";
import { INFRASTRUCTURE_TYPES, InfrastructureTypeId } from "@/config/infra-types";

const mockOverpassFn = vi.fn();
const mockElevationFn = vi.fn();
const mockClimateFn = vi.fn();
const mockSolarFn = vi.fn();

vi.mock("@/server/providers/overpass", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/providers/overpass")>();
  return {
    ...actual,
    OverpassProvider: class {
      async getFeaturesAround(...args: any[]) {
        return mockOverpassFn(...args);
      }
    },
  };
});

vi.mock("@/server/providers/open-meteo", () => {
  return {
    OpenMeteoProvider: class {
      async getElevationAndSlope(...args: any[]) {
        return mockElevationFn(...args);
      }
      async getClimateIndicators(...args: any[]) {
        return mockClimateFn(...args);
      }
    },
  };
});

vi.mock("@/server/providers/nasa-power", () => {
  return {
    NasaPowerProvider: class {
      async getSolarResource(...args: any[]) {
        return mockSolarFn(...args);
      }
    },
  };
});

describe("Analysis Engine Pipeline & Geospatial Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockOverpassFn.mockResolvedValue({
      elements: [
        {
          type: "way",
          id: 101,
          tags: { highway: "primary", name: "Ring Road" },
          geometry: [
            { lat: 28.614, lon: 77.209 },
            { lat: 28.615, lon: 77.210 },
          ],
        },
        {
          type: "way",
          id: 102,
          tags: { building: "yes" },
          geometry: [
            { lat: 28.616, lon: 77.211 },
            { lat: 28.6161, lon: 77.2111 },
            { lat: 28.616, lon: 77.2111 },
            { lat: 28.616, lon: 77.211 },
          ],
        },
        {
          type: "node",
          id: 103,
          lat: 28.62,
          lon: 77.22,
          tags: { amenity: "hospital", name: "City General" },
        },
      ],
      retrievedAt: new Date().toISOString(),
      source: "OpenStreetMap (Mock Test Fixture)",
      queryId: "mock_ovp_1",
    });

    mockElevationFn.mockResolvedValue({
      centerElevationM: 215,
      slopePercent: 2.3,
      aspectDeg: 175,
      samplePointsCount: 9,
      retrievedAt: new Date().toISOString(),
      source: "Open-Meteo DEM (Mock)",
    });

    mockClimateFn.mockResolvedValue({
      maxDailyRainfallMm: 62.5,
      annualTotalRainfallMm: 850,
      retrievedAt: new Date().toISOString(),
      source: "Open-Meteo Climate Archive (Mock)",
    });

    mockSolarFn.mockResolvedValue({
      annualAverageGhiKwhM2Day: 5.35,
      retrievedAt: new Date().toISOString(),
      source: "NASA POWER CERES (Mock)",
    });
  });

  const allTypes = Object.keys(INFRASTRUCTURE_TYPES) as InfrastructureTypeId[];

  for (const infraType of allTypes) {
    it(`evaluates ${infraType} producing complete typed report, criteria, assumptions, and recommendations`, async () => {
      const cfg = INFRASTRUCTURE_TYPES[infraType];
      const result = await runAnalysisEngine({
        analysisId: `anl_${infraType.toLowerCase().replace(/\s+/g, "_")}`,
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
          targetCapacityMw: 5,
        },
      });

      expect(result).toBeDefined();
      expect(result.analysisId).toBeDefined();
      expect(result.engineVersion).toBe("1.0.0");
      expect(result.overall.score).toBeGreaterThanOrEqual(0);
      expect(result.overall.score).toBeLessThanOrEqual(100);
      expect(result.overall.band).toBeDefined();
      expect(result.overall.confidence).toBeGreaterThan(0);
      expect(result.criteria.length).toBe(cfg.criteria.length);
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.dataSources!.length).toBeGreaterThan(0);
      expect(result.assumptions!.length).toBeGreaterThan(0);
      expect(result.recommendations!.length).toBeGreaterThan(0);
      expect(result.limitations.length).toBeGreaterThan(0);
      expect(result.narrativeText).toContain("UrjaSetu");

      for (const crit of result.criteria) {
        expect(crit.score).toBeGreaterThanOrEqual(0);
        expect(crit.score).toBeLessThanOrEqual(100);
        expect(crit.weight).toBeGreaterThan(0);
        expect(crit.benchmark).toContain("NEEDS VERIFICATION");
      }
    });
  }

  it("enforces infrastructure-specific separation rules (Hospital vs Road near industrial hazard and waterway)", async () => {
    const elementsWithWaterAndIndustry: any[] = [
      // Waterway directly crossing (28.6139, 77.2090)
      {
        type: "way",
        id: 501,
        tags: { waterway: "river", name: "Yamuna Tributary" },
        geometry: [
          { lat: 28.6135, lon: 77.209 },
          { lat: 28.6145, lon: 77.209 },
        ],
      },
      // Industrial zone ~120m North of center
      {
        type: "node",
        id: 502,
        lat: 28.6152,
        lon: 77.209,
        tags: { landuse: "industrial", name: "Chemical Plant" },
      },
    ];

    // Hospital should fail on waterway intersection AND trigger hazard setback conflict (< 250m)
    const hospValidation = await validateFootprint(
      "Hospital",
      28.6139,
      77.209,
      100,
      60,
      0,
      elementsWithWaterAndIndustry
    );
    expect(hospValidation.status).toBe("fail");
    expect(hospValidation.conflicts.some((c) => c.category === "waterway")).toBe(true);
    expect(hospValidation.conflicts.some((c) => c.category === "separation_buffer")).toBe(true);

    // Bridge is expected to intersect waterways -> should NOT fail on waterway intersection
    const bridgeValidation = await validateFootprint(
      "Bridge",
      28.6139,
      77.209,
      100,
      20,
      0,
      elementsWithWaterAndIndustry
    );
    expect(bridgeValidation.conflicts.some((c) => c.category === "waterway")).toBe(false);
    expect(bridgeValidation.status).toBe("pass");
  });

  it("handles empty geographic queries without fabricating high gap scores", async () => {
    mockOverpassFn.mockResolvedValueOnce({
      elements: [],
      retrievedAt: new Date().toISOString(),
      source: "OpenStreetMap (Empty Test)",
      queryId: "mock_empty",
    });

    const result = await runAnalysisEngine({
      placementId: "test_empty_osm",
      type: "Hospital",
      lat: 28.6139,
      lng: 77.209,
      lengthM: 120,
      widthM: 80,
    });

    // Confidence must be capped when 0 OSM features are returned
    expect(result.overall.confidence).toBeLessThanOrEqual(35);
    expect(result.warnings!.some((w) => w.includes("Zero mapped OpenStreetMap features"))).toBe(true);
    const gapCriterion = result.criteria.find((c) => c.id === "healthcare_gap");
    expect(gapCriterion?.computed).toBe(false);
    expect(gapCriterion?.status).toBe("unknown");
    expect(gapCriterion?.score).toBeNull();
    expect(gapCriterion?.rawMetric).toBeNull();
    expect(gapCriterion?.missingReason).toBeDefined();
    expect(gapCriterion?.value).toContain("Unverified");
  });

  it("degrades confidence proportionally when a secondary provider fails", async () => {
    mockElevationFn.mockRejectedValueOnce(new Error("Open-Meteo timeout"));

    const result = await runAnalysisEngine({
      placementId: "test_partial_failure",
      type: "Hospital",
      lat: 28.6139,
      lng: 77.209,
      lengthM: 120,
      widthM: 80,
    });

    // Hospital has 15% weight on terrain_slope -> confidence should be 85%
    expect(result.overall.confidence).toBe(85);
    expect(result.overall.evidenceCompleteness).toBe(85);
    expect(result.overall.canCalculateOverall).toBe(true);
    const slopeCrit = result.criteria.find((c) => c.id === "terrain_slope");
    expect(slopeCrit?.status).toBe("unknown");
    expect(slopeCrit?.score).toBeNull();
    expect(slopeCrit?.rawMetric).toBeNull();
    expect(slopeCrit?.missingReason).toContain("Open-Meteo Digital Elevation Model");
    expect(result.dataGaps.some((g) => g.includes("Digital elevation model unavailable"))).toBe(
      true
    );
    expect(
      result.dataSources!.find((d) => d.provider.includes("Open-Meteo"))?.status
    ).toBe("failed");
  });

  it("penalizes shading_obstruction_proxy and records a warning when nearby buildings lack OSM height tags", async () => {
    // Building at ~150m from (28.6139, 77.2090) WITHOUT height or building:levels tags
    mockOverpassFn.mockResolvedValueOnce({
      elements: [
        {
          type: "way",
          id: 901,
          tags: { building: "commercial" }, // No height or building:levels tag!
          geometry: [
            { lat: 28.6152, lon: 77.209 },
            { lat: 28.6153, lon: 77.2091 },
            { lat: 28.6152, lon: 77.2091 },
            { lat: 28.6152, lon: 77.209 },
          ],
        },
      ],
      retrievedAt: new Date().toISOString(),
      source: "OpenStreetMap (Missing Height Tag Test)",
      queryId: "mock_untagged_height",
    });

    const result = await runAnalysisEngine({
      placementId: "test_untagged_building_heights",
      type: "Solar Farm",
      lat: 28.6139,
      lng: 77.209,
      lengthM: 250,
      widthM: 250,
    });

    const shadeCrit = result.criteria.find((c) => c.id === "shading_obstruction_proxy");
    expect(shadeCrit?.computed).toBe(true);
    // Must not assume favorable 94 ("optimal") when nearby buildings lack height attributes
    expect(shadeCrit?.score).toBe(68);
    expect(shadeCrit?.status).toBe("acceptable");
    expect(shadeCrit?.value).toContain("Heights untagged");
    expect(result.warnings!.some((w) => w.includes("lack OSM height/building:levels attributes"))).toBe(
      true
    );
  });

  it("reduces confidence and flags data sources as stale when stale fallback cache is used", async () => {
    mockElevationFn.mockResolvedValueOnce({
      centerElevationM: 215,
      slopePercent: 2.3,
      aspectDeg: 175,
      samplePointsCount: 9,
      retrievedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      source: "Open-Meteo DEM (Stale Fallback)",
      isStale: true,
      cacheStatus: "stale_fallback",
    });

    const result = await runAnalysisEngine({
      placementId: "test_stale_fallback",
      type: "Hospital",
      lat: 28.6139,
      lng: 77.209,
      lengthM: 120,
      widthM: 80,
    });

    expect(result.overall.evidenceCompleteness).toBe(100);
    expect(result.overall.confidence).toBe(90); // 100 - 10 staleness adjustment
    const demSource = result.dataSources!.find((d) => d.provider.includes("Open-Meteo DEM"));
    expect(demSource?.status).toBe("stale");
    expect(demSource?.isStale).toBe(true);
  });

  it("includes standardized analyzedFeatures and searchRings matching backend evaluation", async () => {
    const result = await runAnalysisEngine({
      placementId: "test_map_consistency",
      type: "Hospital",
      lat: 28.6139,
      lng: 77.209,
      lengthM: 120,
      widthM: 80,
    });

    expect(result.analyzedFeatures).toBeDefined();
    expect(result.analyzedFeatures!.length).toBeGreaterThan(0);
    expect(result.analyzedFeatures![0]).toHaveProperty("sourceId");
    expect(result.analyzedFeatures![0]).toHaveProperty("category");
    expect(result.analyzedFeatures![0]).toHaveProperty("quality");
    expect(result.analyzedFeatures![0]).toHaveProperty("license");
    expect(result.searchRings).toEqual({
      centerLat: 28.6139,
      centerLng: 77.209,
      r1M: INFRASTRUCTURE_TYPES["Hospital"].searchRadiusR1M,
      r2M: INFRASTRUCTURE_TYPES["Hospital"].searchRadiusR2M,
    });
  });

  it("throws actionable INSUFFICIENT_EVIDENCE error when all providers fail", async () => {
    mockOverpassFn.mockRejectedValueOnce(new Error("Overpass 504 Gateway Timeout"));
    mockElevationFn.mockRejectedValueOnce(new Error("Open-Meteo 503 Unavailable"));

    await expect(
      runAnalysisEngine({
        placementId: "test_total_failure",
        type: "Hospital",
        lat: 28.6139,
        lng: 77.209,
        lengthM: 120,
        widthM: 80,
      })
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_EVIDENCE",
      statusCode: 503,
    });
  });

  it("rejects invalid coordinates, negative dimensions, and unsupported infrastructure types", async () => {
    await expect(
      runAnalysisEngine({
        placementId: "test_bad_type",
        type: "Hyperloop" as any,
        lat: 28.6139,
        lng: 77.209,
        lengthM: 100,
        widthM: 50,
      })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE", statusCode: 400 });

    await expect(
      runAnalysisEngine({
        placementId: "test_bad_coords",
        type: "Hospital",
        lat: 99.5,
        lng: 77.209,
        lengthM: 100,
        widthM: 50,
      })
    ).rejects.toMatchObject({ code: "INVALID_COORDINATES", statusCode: 400 });

    await expect(
      runAnalysisEngine({
        placementId: "test_bad_dims",
        type: "Hospital",
        lat: 28.6139,
        lng: 77.209,
        lengthM: -50,
        widthM: 50,
      })
    ).rejects.toMatchObject({ code: "INVALID_INPUT", statusCode: 400 });
  });

  it("clamps out-of-range infrastructure parameters and records warnings", async () => {
    const result = await runAnalysisEngine({
      placementId: "test_param_clamp",
      type: "Hospital",
      lat: 28.6139,
      lng: 77.209,
      lengthM: 120,
      widthM: 80,
      customParams: {
        bedCapacity: 5, // Below min of 20
      },
    });

    expect(result.placementSnapshot.params.bedCapacity).toBe(20);
    expect(result.warnings!.some((w) => w.includes("clamped to 20"))).toBe(true);
  });
});
