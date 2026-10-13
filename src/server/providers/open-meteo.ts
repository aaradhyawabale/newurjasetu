import { ElevationResult, ClimateResult, ProviderError } from "./types";
import {
  generateCacheKey,
  getCachedEntry,
  setCachedResponse,
  withInFlightDedup,
} from "./cache";

const ELEVATION_BASE =
  process.env.OPEN_METEO_ELEVATION_URL || "https://api.open-meteo.com/v1/elevation";
const ARCHIVE_BASE =
  process.env.OPEN_METEO_ARCHIVE_URL || "https://archive-api.open-meteo.com/v1/archive";

export const OPEN_METEO_LICENSE =
  "CC BY 4.0 — Copernicus DEM GLO-90/GLO-30 & ECMWF ERA5-Land via Open-Meteo";

export class OpenMeteoProvider {
  /**
   * Computes elevation at the center and samples a 3x3 grid (~60m spacing)
   * to compute accurate ground slope percentage and aspect using Horn's finite differences.
   */
  async getElevationAndSlope(lat: number, lng: number): Promise<ElevationResult> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new ProviderError(
        "Open-Meteo Elevation",
        "INVALID_QUERY",
        `Invalid coordinates (${lat}, ${lng}) for elevation query.`,
        { retryable: false }
      );
    }

    const cacheKey = generateCacheKey("open_meteo_elevation", { lat, lng });
    const freshCached = await getCachedEntry<ElevationResult>(cacheKey, { allowStale: false });
    if (freshCached) {
      return {
        ...freshCached.data,
        source: freshCached.data.source.includes("(Cached)")
          ? freshCached.data.source
          : `${freshCached.data.source} (Cached)`,
        cacheStatus: "fresh_hit",
        isStale: false,
      };
    }

    return withInFlightDedup(cacheKey, async () => {
      // Grid spacing ~60 meters in degrees (~0.00055 deg)
      const step = 0.00055;
      const lats = [
        lat + step, lat + step, lat + step, // NW, N, NE
        lat,        lat,        lat,        // W,  C, E
        lat - step, lat - step, lat - step, // SW, S, SE
      ];
      const lngs = [
        lng - step, lng,        lng + step,
        lng - step, lng,        lng + step,
        lng - step, lng,        lng + step,
      ];

      const url = `${ELEVATION_BASE}?latitude=${lats.join(",")}&longitude=${lngs.join(",")}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.status === 429) {
          throw new ProviderError(
            "Open-Meteo Elevation",
            "RATE_LIMITED",
            "Open-Meteo Elevation API rate limit exceeded (HTTP 429).",
            { statusCode: 429, retryable: true }
          );
        }

        if (!res.ok) {
          throw new ProviderError(
            "Open-Meteo Elevation",
            "UPSTREAM_ERROR",
            `Open-Meteo Elevation API returned HTTP ${res.status}`,
            { statusCode: res.status, retryable: res.status >= 500 }
          );
        }

        const data = await res.json();
        const elevations: unknown[] = Array.isArray(data?.elevation) ? data.elevation : [];

        if (elevations.length < 9) {
          throw new ProviderError(
            "Open-Meteo Elevation",
            "MALFORMED_RESPONSE",
            "Insufficient elevation sample points returned by Open-Meteo (expected 9-point grid).",
            { retryable: false }
          );
        }

        const numericElevations: number[] = [];
        for (let i = 0; i < 9; i++) {
          const val = elevations[i];
          if (typeof val !== "number" || !Number.isFinite(val) || val < -500 || val > 9000) {
            throw new ProviderError(
              "Open-Meteo Elevation",
              "MALFORMED_RESPONSE",
              `Invalid elevation value (${String(val)}) at grid index ${i}.`,
              { retryable: false }
            );
          }
          numericElevations.push(val);
        }

        const [nw, n, ne, w, c, e, sw, s, se] = numericElevations;
        const dxMeters = 60 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
        const dyMeters = 60;

        // Horn's method for surface gradient:
        const dz_dx = ((ne + 2 * e + se) - (nw + 2 * w + sw)) / (8 * dxMeters);
        const dz_dy = ((ne + 2 * n + nw) - (se + 2 * s + sw)) / (8 * dyMeters);

        const slopeRatio = Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy);
        const slopePercent = Math.round(slopeRatio * 100 * 10) / 10;

        // Aspect in degrees clockwise from North (direction of downhill facing slope)
        const aspectRad = Math.atan2(-dz_dx, -dz_dy);
        const aspectDeg = Math.round((((aspectRad * 180) / Math.PI) + 360) % 360);

        const result: ElevationResult = {
          centerElevationM: Math.round(c * 10) / 10,
          slopePercent: Math.min(Math.max(slopePercent, 0), 100),
          aspectDeg,
          samplePointsCount: numericElevations.length,
          retrievedAt: new Date().toISOString(),
          datasetTimestamp: "Copernicus DEM GLO-90/GLO-30",
          source: "Open-Meteo Elevation API (Copernicus DEM 90m / 30m)",
          license: OPEN_METEO_LICENSE,
          cacheStatus: "miss",
          isStale: false,
          quality: {
            completeness: "verified",
            isStale: false,
            cacheStatus: "miss",
          },
        };

        await setCachedResponse(cacheKey, result, 72);
        return result;
      } catch (err: any) {
        clearTimeout(timeoutId);
        const normalizedErr =
          err?.name === "AbortError"
            ? new ProviderError(
                "Open-Meteo Elevation",
                "TIMEOUT",
                "Open-Meteo Elevation API timed out after 12s.",
                { statusCode: 504, retryable: true }
              )
            : err;

        // Only fall back to stale cache on transient network / timeout / rate-limit / upstream errors
        if (!(normalizedErr instanceof ProviderError && normalizedErr.code === "MALFORMED_RESPONSE")) {
          const staleEntry = await getCachedEntry<ElevationResult>(cacheKey, {
            allowStale: true,
            maxStaleHours: 168,
          });
          if (staleEntry) {
            return {
              ...staleEntry.data,
              source: `${staleEntry.data.source} (Stale Cache Fallback)`,
              cacheStatus: "stale_fallback",
              isStale: true,
              quality: {
                completeness: "verified",
                isStale: true,
                cacheStatus: "stale_fallback",
                notes: `Served from stale cache due to Open-Meteo error: ${normalizedErr.message}`,
              },
            };
          }
        }
        throw normalizedErr;
      }
    });
  }

  /**
   * Fetches historical precipitation indicators for drainage assessment
   */
  async getClimateIndicators(lat: number, lng: number): Promise<ClimateResult> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new ProviderError(
        "Open-Meteo Archive",
        "INVALID_QUERY",
        `Invalid coordinates (${lat}, ${lng}) for climate archive query.`,
        { retryable: false }
      );
    }

    const cacheKey = generateCacheKey("open_meteo_climate", { lat, lng });
    const freshCached = await getCachedEntry<ClimateResult>(cacheKey, { allowStale: false });
    if (freshCached) {
      return {
        ...freshCached.data,
        source: freshCached.data.source.includes("(Cached)")
          ? freshCached.data.source
          : `${freshCached.data.source} (Cached)`,
        cacheStatus: "fresh_hit",
        isStale: false,
      };
    }

    return withInFlightDedup(cacheKey, async () => {
      // Query past 1-year archive window (ending 7 days ago to ensure ERA5-Land archive completeness)
      const end = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = end.toISOString().split("T")[0];
      const start = new Date(end);
      start.setFullYear(start.getFullYear() - 1);
      const startDate = start.toISOString().split("T")[0];

      const url = `${ARCHIVE_BASE}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(
        4
      )}&start_date=${startDate}&end_date=${endDate}&daily=precipitation_sum&timezone=auto`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.status === 429) {
          throw new ProviderError(
            "Open-Meteo Archive",
            "RATE_LIMITED",
            "Open-Meteo Archive rate limit exceeded (HTTP 429).",
            { statusCode: 429, retryable: true }
          );
        }

        if (!res.ok) {
          throw new ProviderError(
            "Open-Meteo Archive",
            "UPSTREAM_ERROR",
            `Open-Meteo Archive returned HTTP ${res.status}`,
            { statusCode: res.status, retryable: res.status >= 500 }
          );
        }

        const data = await res.json();
        const dailyPrecip: unknown[] = Array.isArray(data?.daily?.precipitation_sum)
          ? data.daily.precipitation_sum
          : [];

        let maxDaily = 0;
        let totalAnnual = 0;
        let validDays = 0;

        for (const val of dailyPrecip) {
          if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
            totalAnnual += val;
            if (val > maxDaily) maxDaily = val;
            validDays++;
          }
        }

        if (validDays === 0) {
          throw new ProviderError(
            "Open-Meteo Archive",
            "MALFORMED_RESPONSE",
            "Open-Meteo Archive returned no valid precipitation records",
            { retryable: false }
          );
        }

        const result: ClimateResult = {
          maxDailyRainfallMm: Math.round(maxDaily * 10) / 10,
          annualTotalRainfallMm: Math.round(totalAnnual),
          validDaysCount: validDays,
          retrievedAt: new Date().toISOString(),
          datasetTimestamp: `${startDate} to ${endDate}`,
          source: "Open-Meteo Climate Archive (ERA5-Land)",
          license: OPEN_METEO_LICENSE,
          cacheStatus: "miss",
          isStale: false,
          quality: {
            completeness: validDays >= 300 ? "verified" : "partial",
            isStale: false,
            cacheStatus: "miss",
          },
        };

        await setCachedResponse(cacheKey, result, 72);
        return result;
      } catch (err: any) {
        clearTimeout(timeoutId);
        const normalizedErr =
          err?.name === "AbortError"
            ? new ProviderError(
                "Open-Meteo Archive",
                "TIMEOUT",
                "Open-Meteo Climate Archive timed out after 12s.",
                { statusCode: 504, retryable: true }
              )
            : err;

        if (!(normalizedErr instanceof ProviderError && normalizedErr.code === "MALFORMED_RESPONSE")) {
          const staleEntry = await getCachedEntry<ClimateResult>(cacheKey, {
            allowStale: true,
            maxStaleHours: 168,
          });
          if (staleEntry) {
            return {
              ...staleEntry.data,
              source: `${staleEntry.data.source} (Stale Cache Fallback)`,
              cacheStatus: "stale_fallback",
              isStale: true,
              quality: {
                completeness: "verified",
                isStale: true,
                cacheStatus: "stale_fallback",
                notes: `Served from stale cache due to Open-Meteo Archive error: ${normalizedErr.message}`,
              },
            };
          }
        }
        throw normalizedErr;
      }
    });
  }
}
