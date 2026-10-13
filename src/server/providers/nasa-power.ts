import { SolarResult, ProviderError } from "./types";
import {
  generateCacheKey,
  getCachedEntry,
  setCachedResponse,
  withInFlightDedup,
} from "./cache";

const NASA_POWER_BASE =
  process.env.NASA_POWER_API_URL ||
  "https://power.larc.nasa.gov/api/temporal/climatology/point";

export const NASA_POWER_LICENSE =
  "Public Domain — NASA Langley Research Center POWER Project (CERES / MERRA-2)";

export class NasaPowerProvider {
  /**
   * Fetches annual average Global Horizontal Irradiance (GHI in kWh/m2/day)
   * parameter ALLSKY_SFC_SW_DWN (and optional clear-sky GHI / ambient temperature)
   * from NASA POWER API. Explicitly rejects NASA POWER's -999 missing-value sentinel.
   */
  async getSolarResource(lat: number, lng: number): Promise<SolarResult> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new ProviderError(
        "NASA POWER",
        "INVALID_QUERY",
        `Invalid coordinates (${lat}, ${lng}) for NASA POWER solar query.`,
        { retryable: false }
      );
    }
    if (Math.abs(lat) > 85) {
      throw new ProviderError(
        "NASA POWER",
        "COVERAGE_LIMITATION",
        `Latitude ${lat}° exceeds reliable CERES / MERRA-2 solar PV agroclimatology coverage (±85°).`,
        { retryable: false }
      );
    }

    const cacheKey = generateCacheKey("nasa_power_solar", { lat, lng });
    const freshCached = await getCachedEntry<SolarResult>(cacheKey, { allowStale: false });
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
      const url = new URL(NASA_POWER_BASE);
      url.searchParams.set("parameters", "ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN,T2M");
      url.searchParams.set("community", "RE");
      url.searchParams.set("longitude", lng.toFixed(4));
      url.searchParams.set("latitude", lat.toFixed(4));
      url.searchParams.set("format", "JSON");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        const res = await fetch(url.toString(), { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.status === 429) {
          throw new ProviderError(
            "NASA POWER",
            "RATE_LIMITED",
            "NASA POWER API rate limit exceeded (HTTP 429).",
            { statusCode: 429, retryable: true }
          );
        }

        if (!res.ok) {
          throw new ProviderError(
            "NASA POWER",
            "UPSTREAM_ERROR",
            `NASA POWER API returned HTTP ${res.status}`,
            { statusCode: res.status, retryable: res.status >= 500 }
          );
        }

        const json = await res.json();
        const paramsObj = json?.properties?.parameter;
        const annualVal = paramsObj?.ALLSKY_SFC_SW_DWN?.ANN;

        // NASA POWER uses -999 or -99 for missing/unmeasured values; valid Earth GHI is (0, 15] kWh/m2/day
        if (
          typeof annualVal !== "number" ||
          !Number.isFinite(annualVal) ||
          annualVal <= 0 ||
          annualVal === -999 ||
          annualVal > 15
        ) {
          throw new ProviderError(
            "NASA POWER",
            "MALFORMED_RESPONSE",
            `NASA POWER API returned invalid or missing ALLSKY_SFC_SW_DWN value (${String(annualVal)})`,
            { retryable: false }
          );
        }

        const ghi = Math.round(annualVal * 100) / 100;
        const rawClearSky = paramsObj?.CLRSKY_SFC_SW_DWN?.ANN;
        const clearSkyGhi =
          typeof rawClearSky === "number" && rawClearSky > 0 && rawClearSky <= 15
            ? Math.round(rawClearSky * 100) / 100
            : undefined;

        const rawTemp = paramsObj?.T2M?.ANN;
        const annualMeanTempC =
          typeof rawTemp === "number" && rawTemp > -80 && rawTemp < 70
            ? Math.round(rawTemp * 10) / 10
            : undefined;

        const startYr = json?.header?.start;
        const endYr = json?.header?.end;
        const datasetTimestamp =
          startYr && endYr ? `Climatology ${startYr}-${endYr}` : "CERES / MERRA-2 Multi-Year Climatology";

        const result: SolarResult = {
          annualAverageGhiKwhM2Day: ghi,
          ...(clearSkyGhi !== undefined ? { clearSkyGhiKwhM2Day: clearSkyGhi } : {}),
          ...(annualMeanTempC !== undefined ? { annualMeanTempC } : {}),
          retrievedAt: new Date().toISOString(),
          datasetTimestamp,
          source: "NASA POWER Agroclimatology / CERES & MERRA-2",
          license: NASA_POWER_LICENSE,
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
                "NASA POWER",
                "TIMEOUT",
                "NASA POWER API timed out after 12s.",
                { statusCode: 504, retryable: true }
              )
            : err;

        if (!(normalizedErr instanceof ProviderError && normalizedErr.code === "MALFORMED_RESPONSE")) {
          const staleEntry = await getCachedEntry<SolarResult>(cacheKey, {
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
                notes: `Served from stale cache due to NASA POWER error: ${normalizedErr.message}`,
              },
            };
          }
        }
        throw normalizedErr;
      }
    });
  }
}
