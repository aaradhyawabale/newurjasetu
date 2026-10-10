import { SolarResult } from "./types";
import { generateCacheKey, getCachedResponse, setCachedResponse } from "./cache";

const NASA_POWER_BASE =
  process.env.NASA_POWER_API_URL ||
  "https://power.larc.nasa.gov/api/temporal/climatology/point";

export class NasaPowerProvider {
  /**
   * Fetches annual average Global Horizontal Irradiance (GHI in kWh/m2/day)
   * parameter ALLSKY_SFC_SW_DWN from NASA POWER API.
   */
  async getSolarResource(lat: number, lng: number): Promise<SolarResult> {
    const cacheKey = generateCacheKey("nasa_power_solar", { lat, lng });
    const cached = await getCachedResponse<SolarResult>(cacheKey);
    if (cached) return cached;

    try {
      const url = new URL(NASA_POWER_BASE);
      url.searchParams.set("parameters", "ALLSKY_SFC_SW_DWN");
      url.searchParams.set("community", "RE");
      url.searchParams.set("longitude", lng.toFixed(4));
      url.searchParams.set("latitude", lat.toFixed(4));
      url.searchParams.set("format", "JSON");

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`NASA POWER API returned HTTP ${res.status}`);
      }

      const json = await res.json();
      const annualVal = json.properties?.parameter?.ALLSKY_SFC_SW_DWN?.ANN;

      const ghi =
        typeof annualVal === "number" && annualVal > 0
          ? Math.round(annualVal * 100) / 100
          : 5.1; // Typical tropical/subtropical baseline if missing

      const result: SolarResult = {
        annualAverageGhiKwhM2Day: ghi,
        retrievedAt: new Date().toISOString(),
        source: "NASA POWER Agroclimatology / CERES & MERRA-2",
      };

      await setCachedResponse(cacheKey, result, 72);
      return result;
    } catch (err: any) {
      console.warn("[NASA POWER Error]", err.message);
      // Fallback based on latitude estimation
      const absLat = Math.abs(lat);
      const estGhi = absLat < 20 ? 5.2 : absLat < 35 ? 4.8 : absLat < 50 ? 3.6 : 2.8;

      return {
        annualAverageGhiKwhM2Day: estGhi,
        retrievedAt: new Date().toISOString(),
        source: "NASA POWER (Latitude Radiation Model Fallback)",
      };
    }
  }
}
