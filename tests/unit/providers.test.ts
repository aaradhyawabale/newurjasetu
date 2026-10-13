import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateCacheKey,
  withInFlightDedup,
  getInFlightCount,
  getCachedEntry,
} from "@/server/providers/cache";
import {
  OverpassProvider,
  normalizeOsmElements,
} from "@/server/providers/overpass";
import { OpenMeteoProvider } from "@/server/providers/open-meteo";
import { NasaPowerProvider } from "@/server/providers/nasa-power";
import { NominatimProvider } from "@/server/providers/nominatim";

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    providerCache: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      upsert: (...args: any[]) => mockUpsert(...args),
      delete: (...args: any[]) => mockDelete(...args),
    },
  },
}));

describe("Geographic Data Layer: Providers, Normalization, Caching & Error Handling", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});
    mockDelete.mockResolvedValue({});
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Standardized Data Contract & Attribute Quality (STEP 2)", () => {
    it("normalizes OSM elements into StandardizedGeoFeature with provenance, license, and quality metadata", () => {
      const retrievedAt = "2026-10-13T08:00:00.000Z";
      const rawElements: any[] = [
        {
          type: "way",
          id: 5501,
          tags: {
            building: "apartments",
            name: "Shanti Niketan Tower",
            "building:levels": "8",
          },
          geometry: [
            { lat: 28.613, lon: 77.208 },
            { lat: 28.6135, lon: 77.2085 },
            { lat: 28.613, lon: 77.2085 },
            { lat: 28.613, lon: 77.208 },
          ],
        },
        {
          type: "way",
          id: 5502,
          tags: {
            building: "yes", // Missing height and building:levels!
          },
          geometry: [
            { lat: 28.614, lon: 77.209 },
            { lat: 28.6145, lon: 77.2095 },
            { lat: 28.614, lon: 77.2095 },
            { lat: 28.614, lon: 77.209 },
          ],
        },
        {
          type: "node",
          id: 5503,
          lat: 28.615,
          lon: 77.21,
          tags: {
            power: "substation",
            voltage: "33000",
            name: "33kV Grid Substation",
          },
        },
      ];

      const standardized = normalizeOsmElements(rawElements, { retrievedAt });
      expect(standardized).toHaveLength(3);

      // 1. Building with levels tag -> verified quality
      const bldgComplete = standardized[0];
      expect(bldgComplete.id).toBe("osm:way:5501");
      expect(bldgComplete.sourceId).toBe("way/5501");
      expect(bldgComplete.sourceName).toContain("OpenStreetMap");
      expect(bldgComplete.category).toBe("building");
      expect(bldgComplete.subCategory).toBe("apartments");
      expect(bldgComplete.geometry.type).toBe("Polygon");
      expect(bldgComplete.quality.completeness).toBe("verified");
      expect(bldgComplete.quality.missingAttributes).toBeUndefined();
      expect(bldgComplete.license).toContain("ODbL");

      // 2. Building without height or building:levels -> partial quality & missingAttributes flagged
      const bldgPartial = standardized[1];
      expect(bldgPartial.id).toBe("osm:way:5502");
      expect(bldgPartial.category).toBe("building");
      expect(bldgPartial.quality.completeness).toBe("partial");
      expect(bldgPartial.quality.missingAttributes).toContain("building:levels");
      expect(bldgPartial.quality.missingAttributes).toContain("height");

      // 3. Power substation node -> verified quality
      const subStation = standardized[2];
      expect(subStation.category).toBe("power");
      expect(subStation.subCategory).toBe("substation");
      expect(subStation.quality.completeness).toBe("verified");
    });
  });

  describe("Canonical Cache Keys & In-Flight Request Deduplication (STEP 3)", () => {
    it("generates identical SHA-256 cache keys regardless of object property order", () => {
      const k1 = generateCacheKey("overpass", {
        lat: 28.6139,
        lng: 77.209,
        radiusM: 2500,
        nested: { b: 2, a: 1 },
      });
      const k2 = generateCacheKey("overpass", {
        radiusM: 2500,
        lng: 77.209,
        lat: 28.6139,
        nested: { a: 1, b: 2 },
      });
      expect(k1).toBe(k2);
    });

    it("deduplicates concurrent in-flight requests to the same cache key", async () => {
      let callCount = 0;
      const slowFetcher = () =>
        new Promise<string>((resolve) => {
          callCount++;
          setTimeout(() => resolve("shared_result"), 30);
        });

      const p1 = withInFlightDedup("dedup_test_key", slowFetcher);
      const p2 = withInFlightDedup("dedup_test_key", slowFetcher);
      expect(getInFlightCount()).toBe(1);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe("shared_result");
      expect(r2).toBe("shared_result");
      expect(callCount).toBe(1);
      expect(getInFlightCount()).toBe(0);
    });

    it("distinguishes fresh vs stale cached entries in getCachedEntry", async () => {
      const expiredRecord = {
        key: "k_stale",
        response: JSON.stringify({ centerElevationM: 250 }),
        fetchedAt: new Date(Date.now() - 48 * 3600 * 1000),
        expiresAt: new Date(Date.now() - 2 * 3600 * 1000), // Expired 2h ago
      };
      mockFindUnique.mockResolvedValue(expiredRecord);

      // Default (allowStale: false) returns null
      const freshOnly = await getCachedEntry("k_stale");
      expect(freshOnly).toBeNull();

      // With allowStale: true returns stale entry flagged with isStale: true
      const staleFallback = await getCachedEntry("k_stale", { allowStale: true });
      expect(staleFallback).not.toBeNull();
      expect(staleFallback?.isStale).toBe(true);
      expect(staleFallback?.data).toEqual({ centerElevationM: 250 });
    });
  });

  describe("Provider Reliability, Timeouts, Rate Limits, Malformed Data & Stale Fallback (STEP 3 & STEP 6)", () => {
    it("clamps Overpass search radius to [50m, 5000m] and rejects out-of-range coordinates", async () => {
      const ovp = new OverpassProvider();
      await expect(ovp.getFeaturesAround(95, 77.2, 1000)).rejects.toMatchObject({
        code: "INVALID_QUERY",
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          version: 0.6,
          osm3s: { timestamp_osm_base: "2026-10-13T00:00:00Z" },
          elements: [],
        }),
      });
      global.fetch = fetchMock as any;

      const res = await ovp.getFeaturesAround(28.6139, 77.209, 25000); // > 5000m
      expect(res.elements).toEqual([]);
      expect(res.normalizedFeatures).toEqual([]);
      // Verify Overpass query used clamped 5000m radius
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const bodyStr = decodeURIComponent(fetchMock.mock.calls[0][1].body);
      expect(bodyStr).toContain("around:5000");
    });

    it("handles Overpass HTTP 429 rate limits and falls back to stale cache when available", async () => {
      const ovp = new OverpassProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      }) as any;

      // 1. Without stale cache -> throws RATE_LIMITED ProviderError
      await expect(ovp.getFeaturesAround(28.6139, 77.209, 1000)).rejects.toMatchObject({
        code: "RATE_LIMITED",
        statusCode: 429,
      });

      // 2. With stale cache available -> returns stale data marked with isStale: true and cacheStatus: 'stale_fallback'
      mockFindUnique
        .mockResolvedValueOnce(null) // First check (fresh cache) -> miss
        .mockResolvedValueOnce({
          // Second check (allowStale: true) -> hit
          key: "stale_ovp",
          response: JSON.stringify({
            elements: [
              {
                type: "node",
                id: 701,
                lat: 28.614,
                lon: 77.209,
                tags: { amenity: "school", name: "Cached School" },
              },
            ],
            retrievedAt: "2026-10-10T00:00:00.000Z",
            source: "OpenStreetMap Overpass API",
            queryId: "ovp_cached",
          }),
          fetchedAt: new Date(Date.now() - 48 * 3600 * 1000),
          expiresAt: new Date(Date.now() - 12 * 3600 * 1000),
        });

      const fallbackRes = await ovp.getFeaturesAround(28.6139, 77.209, 1000);
      expect(fallbackRes.isStale).toBe(true);
      expect(fallbackRes.cacheStatus).toBe("stale_fallback");
      expect(fallbackRes.normalizedFeatures).toHaveLength(1);
      expect(fallbackRes.normalizedFeatures![0].quality.isStale).toBe(true);
    });

    it("rejects malformed Overpass JSON missing elements array", async () => {
      const ovp = new OverpassProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ remark: "runtime error: Query timed out" }), // No elements array!
      }) as any;

      await expect(ovp.getFeaturesAround(28.6139, 77.209, 1000)).rejects.toMatchObject({
        code: "MALFORMED_RESPONSE",
      });
    });

    it("handles Open-Meteo timeouts (AbortError) and malformed DEM responses (< 9 points)", async () => {
      const om = new OpenMeteoProvider();

      // 1. Simulate AbortError timeout
      const abortErr = new Error("The operation was aborted");
      abortErr.name = "AbortError";
      global.fetch = vi.fn().mockRejectedValue(abortErr) as any;

      await expect(om.getElevationAndSlope(28.6139, 77.209)).rejects.toMatchObject({
        code: "TIMEOUT",
      });

      // 2. Simulate malformed DEM response with fewer than 9 elevation points
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ elevation: [215, 216, 214] }), // Only 3 points instead of 9
      }) as any;

      await expect(om.getElevationAndSlope(28.6139, 77.209)).rejects.toMatchObject({
        code: "MALFORMED_RESPONSE",
      });
    });

    it("rejects NASA POWER -999 missing-value sentinels and polar coverage limitations", async () => {
      const nasa = new NasaPowerProvider();

      // 1. Polar latitude (> 85 deg) rejected with COVERAGE_LIMITATION
      await expect(nasa.getSolarResource(88.0, 77.209)).rejects.toMatchObject({
        code: "COVERAGE_LIMITATION",
      });

      // 2. NASA POWER returning -999 sentinel value for ALLSKY_SFC_SW_DWN
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          properties: {
            parameter: {
              ALLSKY_SFC_SW_DWN: { ANN: -999 },
            },
          },
        }),
      }) as any;

      await expect(nasa.getSolarResource(28.6139, 77.209)).rejects.toMatchObject({
        code: "MALFORMED_RESPONSE",
      });

      // 3. Valid NASA POWER response with clear-sky GHI and ambient temperature
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          header: { start: "2001", end: "2020" },
          properties: {
            parameter: {
              ALLSKY_SFC_SW_DWN: { ANN: 5.42 },
              CLRSKY_SFC_SW_DWN: { ANN: 6.81 },
              T2M: { ANN: 25.4 },
            },
          },
        }),
      }) as any;

      const validSolar = await nasa.getSolarResource(28.6139, 77.209);
      expect(validSolar.annualAverageGhiKwhM2Day).toBe(5.42);
      expect(validSolar.clearSkyGhiKwhM2Day).toBe(6.81);
      expect(validSolar.annualMeanTempC).toBe(25.4);
      expect(validSolar.cacheStatus).toBe("miss");
    });

    it("handles Nominatim empty queries and valid forward geocoding", async () => {
      const nom = new NominatimProvider();

      // 1. Empty query returns empty array without calling fetch
      const emptyRes = await nom.geocode("   ");
      expect(emptyRes).toEqual([]);

      // 2. Valid Nominatim geocode response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            place_id: 998877,
            display_name: "Connaught Place, New Delhi, India",
            lat: "28.6315",
            lon: "77.2167",
            type: "administrative",
          },
        ],
      }) as any;

      const results = await nom.geocode("Connaught Place");
      expect(results).toHaveLength(1);
      expect(results[0].lat).toBeCloseTo(28.6315, 4);
      expect(results[0].lng).toBeCloseTo(77.2167, 4);
      expect(results[0].source).toContain("Nominatim");
      expect(results[0].license).toContain("ODbL");
    });
  });
});
