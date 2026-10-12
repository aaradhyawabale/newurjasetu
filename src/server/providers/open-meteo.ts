import { ElevationResult, ClimateResult } from "./types";
import { generateCacheKey, getCachedResponse, setCachedResponse } from "./cache";

const ELEVATION_BASE =
  process.env.OPEN_METEO_ELEVATION_URL || "https://api.open-meteo.com/v1/elevation";
const ARCHIVE_BASE =
  process.env.OPEN_METEO_ARCHIVE_URL || "https://archive-api.open-meteo.com/v1/archive";

export class OpenMeteoProvider {
  /**
   * Computes elevation at the center and samples a 3x3 grid (~60m spacing)
   * to compute accurate ground slope percentage and aspect using Horn's finite differences.
   */
  async getElevationAndSlope(lat: number, lng: number): Promise<ElevationResult> {
    const cacheKey = generateCacheKey("open_meteo_elevation", { lat, lng });
    const cached = await getCachedResponse<ElevationResult>(cacheKey);
    if (cached) return cached;

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
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo Elevation API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const elevations: number[] = data.elevation || [];

    if (elevations.length < 9) {
      throw new Error("Insufficient elevation sample points returned by Open-Meteo");
    }

    const [nw, n, ne, w, c, e, sw, s, se] = elevations;
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
      samplePointsCount: elevations.length,
      retrievedAt: new Date().toISOString(),
      source: "Open-Meteo Elevation API (Copernicus DEM 90m / 30m)",
    };

    await setCachedResponse(cacheKey, result, 72);
    return result;
  }

  /**
   * Fetches historical precipitation indicators for drainage assessment
   */
  async getClimateIndicators(lat: number, lng: number): Promise<ClimateResult> {
    const cacheKey = generateCacheKey("open_meteo_climate", { lat, lng });
    const cached = await getCachedResponse<ClimateResult>(cacheKey);
    if (cached) return cached;

    // Query past 1-year archive window (ending 7 days ago to ensure ERA5-Land archive completeness)
    const end = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = end.toISOString().split("T")[0];
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    const startDate = start.toISOString().split("T")[0];

    const url = `${ARCHIVE_BASE}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(
      4
    )}&start_date=${startDate}&end_date=${endDate}&daily=precipitation_sum&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo Archive returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const dailyPrecip: number[] = data.daily?.precipitation_sum || [];

    let maxDaily = 0;
    let totalAnnual = 0;
    let validDays = 0;

    for (const val of dailyPrecip) {
      if (typeof val === "number" && !isNaN(val)) {
        totalAnnual += val;
        if (val > maxDaily) maxDaily = val;
        validDays++;
      }
    }

    if (validDays === 0) {
      throw new Error("Open-Meteo Archive returned no valid precipitation records");
    }

    const result: ClimateResult = {
      maxDailyRainfallMm: Math.round(maxDaily * 10) / 10,
      annualTotalRainfallMm: Math.round(totalAnnual),
      retrievedAt: new Date().toISOString(),
      source: "Open-Meteo Climate Archive (ERA5-Land)",
    };

    await setCachedResponse(cacheKey, result, 72);
    return result;
  }
}
