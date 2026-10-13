import { GeocodeResult } from "./types";
import {
  generateCacheKey,
  getCachedEntry,
  setCachedResponse,
  withInFlightDedup,
} from "./cache";
import { OSM_LICENSE } from "./overpass";

const USER_AGENT =
  process.env.GEO_USER_AGENT ||
  "UrjaSetu-GIS-Planner/1.0 (academic-urban-planning-tool; contact@urjasetu.local)";
const NOMINATIM_BASE =
  process.env.NOMINATIM_API_URL || "https://nominatim.openstreetmap.org";

// Throttle queue: Nominatim usage policy requires max 1 request per second
let lastRequestTime = 0;

async function throttleNominatim(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    const delay = 1100 - elapsed;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  lastRequestTime = Date.now();
}

export class NominatimProvider {
  /**
   * Forward geocoding with 1 req/sec throttling, 10s timeout, in-flight dedup, and DB cache
   */
  async geocode(query: string): Promise<GeocodeResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const cacheKey = generateCacheKey("nominatim_geocode", { q: cleanQuery.toLowerCase() });
    const freshCached = await getCachedEntry<GeocodeResult[]>(cacheKey, { allowStale: false });
    if (freshCached) return freshCached.data;

    return withInFlightDedup(cacheKey, async () => {
      await throttleNominatim();

      const url = new URL(`${NOMINATIM_BASE}/search`);
      url.searchParams.set("q", cleanQuery);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "5");
      url.searchParams.set("addressdetails", "1");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch(url.toString(), {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Nominatim returned HTTP ${res.status}`);
        }

        const raw = await res.json();
        if (!Array.isArray(raw)) {
          throw new Error("Nominatim returned non-array response");
        }

        const retrievedAt = new Date().toISOString();
        const results: GeocodeResult[] = raw
          .filter(
            (item: any) =>
              item &&
              Number.isFinite(parseFloat(item.lat)) &&
              Number.isFinite(parseFloat(item.lon))
          )
          .map((item: any) => ({
            displayName: String(item.display_name || cleanQuery),
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            placeId: String(item.place_id),
            type: item.type || item.category,
            source: "OpenStreetMap Nominatim",
            license: OSM_LICENSE,
            retrievedAt,
          }));

        await setCachedResponse(cacheKey, results, 72); // Cache geocodes for 72 hours
        return results;
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.warn("[Nominatim Geocode Error]", err.message);
        const staleEntry = await getCachedEntry<GeocodeResult[]>(cacheKey, {
          allowStale: true,
          maxStaleHours: 168,
        });
        if (staleEntry) return staleEntry.data;
        return [];
      }
    });
  }

  /**
   * Reverse geocoding (coordinates to human-readable label)
   */
  async reverse(lat: number, lng: number): Promise<string> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return "0.0000, 0.0000";
    }
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLng = Math.round(lng * 10000) / 10000;
    const cacheKey = generateCacheKey("nominatim_reverse", { lat: roundedLat, lng: roundedLng });

    const freshCached = await getCachedEntry<{ label: string }>(cacheKey, { allowStale: false });
    if (freshCached) return freshCached.data.label;

    return withInFlightDedup(cacheKey, async () => {
      await throttleNominatim();

      const url = new URL(`${NOMINATIM_BASE}/reverse`);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("zoom", "16");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch(url.toString(), {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Nominatim reverse returned HTTP ${res.status}`);
        }

        const item = await res.json();
        const label = item?.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        await setCachedResponse(cacheKey, { label }, 72);
        return label;
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.warn("[Nominatim Reverse Error]", err.message);
        const staleEntry = await getCachedEntry<{ label: string }>(cacheKey, {
          allowStale: true,
          maxStaleHours: 168,
        });
        if (staleEntry) return staleEntry.data.label;
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    });
  }
}
