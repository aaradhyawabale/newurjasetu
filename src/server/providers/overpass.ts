import { OverpassQueryResult, OsmElement } from "./types";
import { generateCacheKey, getCachedResponse, setCachedResponse } from "./cache";
import * as turf from "@turf/turf";
import type { Feature, Geometry } from "geojson";

const USER_AGENT =
  process.env.GEO_USER_AGENT ||
  "UrjaSetu-GIS-Planner/1.0 (academic-urban-planning-tool; contact@urjasetu.local)";

const PRIMARY_URL =
  process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter";
const BACKUP_URL =
  process.env.OVERPASS_BACKUP_URL || "https://overpass.kumi.systems/api/interpreter";

export class OverpassProvider {
  /**
   * Fetches features within radiusM meters around (lat, lng).
   * Filters by standard infrastructure tags: buildings, highways, waterways, railways, landuse, amenities, natural, power.
   */
  async getFeaturesAround(
    lat: number,
    lng: number,
    radiusM: number,
    tagFilters?: string[]
  ): Promise<OverpassQueryResult> {
    const cacheKey = generateCacheKey("overpass", { lat, lng, radiusM, tagFilters });
    const cached = await getCachedResponse<OverpassQueryResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const defaultFilters = [
      `way["building"](around:${radiusM},${lat},${lng});`,
      `way["highway"](around:${radiusM},${lat},${lng});`,
      `way["waterway"](around:${radiusM},${lat},${lng});`,
      `way["natural"="water"](around:${radiusM},${lat},${lng});`,
      `way["natural"="wood"](around:${radiusM},${lat},${lng});`,
      `way["railway"](around:${radiusM},${lat},${lng});`,
      `way["landuse"](around:${radiusM},${lat},${lng});`,
      `way["military"](around:${radiusM},${lat},${lng});`,
      `way["leisure"](around:${radiusM},${lat},${lng});`,
      `node["amenity"](around:${radiusM},${lat},${lng});`,
      `way["amenity"](around:${radiusM},${lat},${lng});`,
      `node["power"](around:${radiusM},${lat},${lng});`,
      `way["power"](around:${radiusM},${lat},${lng});`,
      `node["public_transport"](around:${radiusM},${lat},${lng});`,
      `node["railway"="station"](around:${radiusM},${lat},${lng});`,
      `node["highway"="bus_stop"](around:${radiusM},${lat},${lng});`,
    ];

    const filterBlock =
      tagFilters && tagFilters.length > 0 ? tagFilters.join("\n") : defaultFilters.join("\n");

    const query = `
      [out:json][timeout:25];
      (
        ${filterBlock}
      );
      out body geom;
    `;

    const result = await this.executeWithFallback(query, { lat, lng, radiusM });
    await setCachedResponse(cacheKey, result, 24);
    return result;
  }

  private async executeWithFallback(
    query: string,
    params: { lat: number; lng: number; radiusM: number }
  ): Promise<OverpassQueryResult> {
    const urls = [PRIMARY_URL, BACKUP_URL];
    let lastError: Error | null = null;

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          throw new Error("Overpass API rate limit reached (HTTP 429). Please retry shortly.");
        }

        if (response.status === 504) {
          throw new Error("Overpass API query timed out (HTTP 504). Try a smaller search area.");
        }

        if (!response.ok) {
          throw new Error(`Overpass server returned HTTP ${response.status}`);
        }

        const data = await response.json();
        const elements: OsmElement[] = data.elements || [];

        return {
          elements,
          retrievedAt: new Date().toISOString(),
          source: `OpenStreetMap / Overpass (${new URL(url).hostname})`,
          queryId: `ovp_${Date.now()}_${Math.round(params.lat * 1000)}_${Math.round(params.lng * 1000)}`,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[Overpass Provider] Failed against ${url}:`, err.message);
      }
    }

    throw new Error(
      `OpenStreetMap Overpass service unavailable: ${lastError?.message || "All endpoints failed"}. Please retry or check network connectivity.`
    );
  }
}

/**
 * Converts an OSM element with geometry to a Turf GeoJSON Feature
 */
export function osmElementToGeoJson(
  el: OsmElement
): Feature<Geometry, Record<string, any>> | null {
  if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
    return turf.point([el.lon, el.lat], { id: el.id, tags: el.tags || {}, osmType: "node" });
  }

  if (el.type === "way" && el.geometry && el.geometry.length > 1) {
    const coords = el.geometry.map((pt) => [pt.lon, pt.lat]);
    const isClosed =
      coords.length >= 4 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1];

    const tags = el.tags || {};
    const isAreaTag = Boolean(
      tags.building ||
        tags.landuse ||
        tags.leisure ||
        tags.natural ||
        tags.amenity ||
        tags.military ||
        tags.water ||
        tags.area === "yes" ||
        tags.waterway === "riverbank" ||
        tags.power === "substation" ||
        tags.power === "plant"
    );
    const isLinearTag = Boolean(
      tags.highway ||
        tags.railway ||
        (tags.waterway && tags.waterway !== "riverbank") ||
        tags.power === "line" ||
        tags.power === "minor_line"
    );

    if (isClosed && isAreaTag && !isLinearTag) {
      return turf.polygon([coords], { id: el.id, tags, osmType: "way" });
    }

    return turf.lineString(coords, { id: el.id, tags, osmType: "way" });
  }

  return null;
}
