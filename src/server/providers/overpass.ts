import {
  OverpassQueryResult,
  OsmElement,
  StandardizedGeoFeature,
  StandardizedFeatureCategory,
  CacheStatusType,
  ProviderError,
} from "./types";
import {
  generateCacheKey,
  getCachedEntry,
  setCachedResponse,
  withInFlightDedup,
} from "./cache";
import * as turf from "@turf/turf";
import type { Feature, Geometry } from "geojson";

const USER_AGENT =
  process.env.GEO_USER_AGENT ||
  "UrjaSetu-GIS-Planner/1.0 (academic-urban-planning-tool; contact@urjasetu.local)";

const PRIMARY_URL =
  process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter";
const BACKUP_URL =
  process.env.OVERPASS_BACKUP_URL || "https://overpass.kumi.systems/api/interpreter";

export const MIN_OVERPASS_RADIUS_M = 50;
export const MAX_OVERPASS_RADIUS_M = 5000;
export const OSM_LICENSE = "ODbL 1.0 — © OpenStreetMap contributors";

export class OverpassProvider {
  /**
   * Fetches features within radiusM meters around (lat, lng).
   * Enforces safe query radius bounds [50m, 5000m], deduplicates concurrent requests,
   * normalizes elements into StandardizedGeoFeature[], and falls back to stale cache if mirrors fail.
   */
  async getFeaturesAround(
    lat: number,
    lng: number,
    radiusM: number,
    tagFilters?: string[]
  ): Promise<OverpassQueryResult> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new ProviderError(
        "Overpass",
        "INVALID_QUERY",
        `Invalid geographic coordinates (${lat}, ${lng}) for Overpass query.`,
        { retryable: false }
      );
    }

    if (!Number.isFinite(radiusM) || radiusM <= 0) {
      throw new ProviderError(
        "Overpass",
        "INVALID_QUERY",
        `Overpass search radius must be a positive number (received ${radiusM}).`,
        { retryable: false }
      );
    }

    const boundedRadiusM = Math.min(
      Math.max(Math.round(radiusM), MIN_OVERPASS_RADIUS_M),
      MAX_OVERPASS_RADIUS_M
    );

    const cacheKey = generateCacheKey("overpass", {
      lat,
      lng,
      radiusM: boundedRadiusM,
      tagFilters,
    });

    const freshCached = await getCachedEntry<OverpassQueryResult>(cacheKey, {
      allowStale: false,
    });
    if (freshCached) {
      const cachedData = freshCached.data;
      const sourceLabel = cachedData.source.includes("(Cached)")
        ? cachedData.source
        : `${cachedData.source} (Cached)`;
      return {
        ...cachedData,
        source: sourceLabel,
        cacheStatus: "fresh_hit",
        isStale: false,
        normalizedFeatures:
          cachedData.normalizedFeatures ||
          normalizeOsmElements(cachedData.elements, {
            sourceName: sourceLabel,
            retrievedAt: cachedData.retrievedAt,
            datasetTimestamp: cachedData.datasetTimestamp,
            cacheStatus: "fresh_hit",
            isStale: false,
          }),
      };
    }

    return withInFlightDedup(cacheKey, async () => {
      const defaultFilters = [
        `way["building"](around:${boundedRadiusM},${lat},${lng});`,
        `way["highway"](around:${boundedRadiusM},${lat},${lng});`,
        `way["waterway"](around:${boundedRadiusM},${lat},${lng});`,
        `way["natural"="water"](around:${boundedRadiusM},${lat},${lng});`,
        `way["natural"="wood"](around:${boundedRadiusM},${lat},${lng});`,
        `way["railway"](around:${boundedRadiusM},${lat},${lng});`,
        `way["landuse"](around:${boundedRadiusM},${lat},${lng});`,
        `way["military"](around:${boundedRadiusM},${lat},${lng});`,
        `way["leisure"](around:${boundedRadiusM},${lat},${lng});`,
        `node["amenity"](around:${boundedRadiusM},${lat},${lng});`,
        `way["amenity"](around:${boundedRadiusM},${lat},${lng});`,
        `node["power"](around:${boundedRadiusM},${lat},${lng});`,
        `way["power"](around:${boundedRadiusM},${lat},${lng});`,
        `node["public_transport"](around:${boundedRadiusM},${lat},${lng});`,
        `node["railway"="station"](around:${boundedRadiusM},${lat},${lng});`,
        `node["highway"="bus_stop"](around:${boundedRadiusM},${lat},${lng});`,
      ];

      const filterBlock =
        tagFilters && tagFilters.length > 0
          ? tagFilters.join("\n")
          : defaultFilters.join("\n");

      const query = `
        [out:json][timeout:25];
        (
          ${filterBlock}
        );
        out body geom;
      `;

      try {
        const result = await this.executeWithFallback(query, {
          lat,
          lng,
          radiusM: boundedRadiusM,
        });
        await setCachedResponse(cacheKey, result, 24);
        return result;
      } catch (liveErr: any) {
        // Attempt stale cache fallback if upstream Overpass mirrors are down or rate-limited
        const staleEntry = await getCachedEntry<OverpassQueryResult>(cacheKey, {
          allowStale: true,
          maxStaleHours: 168,
        });
        if (staleEntry) {
          const staleData = staleEntry.data;
          const staleSource = `${staleData.source} (Stale Cache Fallback)`;
          return {
            ...staleData,
            source: staleSource,
            cacheStatus: "stale_fallback",
            isStale: true,
            quality: {
              completeness:
                staleData.elements.length === 0
                  ? "unknown"
                  : staleData.elements.length < 15
                  ? "sparse"
                  : "verified",
              isStale: true,
              cacheStatus: "stale_fallback",
              notes: `Served from stale local cache (fetched ${staleEntry.fetchedAt}) due to live Overpass unavailability: ${liveErr.message}`,
            },
            normalizedFeatures: normalizeOsmElements(staleData.elements, {
              sourceName: staleSource,
              retrievedAt: staleData.retrievedAt,
              datasetTimestamp: staleData.datasetTimestamp,
              cacheStatus: "stale_fallback",
              isStale: true,
            }),
          };
        }
        throw liveErr;
      }
    });
  }

  private async executeWithFallback(
    query: string,
    params: { lat: number; lng: number; radiusM: number }
  ): Promise<OverpassQueryResult> {
    const urls = [PRIMARY_URL, BACKUP_URL];
    let lastError: Error | null = null;

    for (const url of urls) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
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
          throw new ProviderError(
            "Overpass",
            "RATE_LIMITED",
            "Overpass API rate limit reached (HTTP 429). Please retry shortly.",
            { statusCode: 429, retryable: true }
          );
        }

        if (response.status === 504) {
          throw new ProviderError(
            "Overpass",
            "TIMEOUT",
            "Overpass API query timed out (HTTP 504). Try a smaller search area.",
            { statusCode: 504, retryable: true }
          );
        }

        if (!response.ok) {
          throw new ProviderError(
            "Overpass",
            "UPSTREAM_ERROR",
            `Overpass server returned HTTP ${response.status}`,
            { statusCode: response.status, retryable: response.status >= 500 }
          );
        }

        const data = await response.json();
        if (!data || typeof data !== "object" || !Array.isArray(data.elements)) {
          throw new ProviderError(
            "Overpass",
            "MALFORMED_RESPONSE",
            "Overpass API returned malformed JSON without an elements array.",
            { retryable: false }
          );
        }

        const elements: OsmElement[] = data.elements.filter(
          (el: any) =>
            el &&
            typeof el.id === "number" &&
            (el.type === "node" || el.type === "way" || el.type === "relation")
        );

        const retrievedAt = new Date().toISOString();
        const datasetTimestamp =
          typeof data.osm3s?.timestamp_osm_base === "string"
            ? data.osm3s.timestamp_osm_base
            : undefined;
        const sourceName = `OpenStreetMap / Overpass (${new URL(url).hostname})`;

        const normalizedFeatures = normalizeOsmElements(elements, {
          sourceName,
          retrievedAt,
          datasetTimestamp,
          cacheStatus: "miss",
          isStale: false,
        });

        return {
          elements,
          normalizedFeatures,
          retrievedAt,
          datasetTimestamp,
          source: sourceName,
          queryId: `ovp_${Date.now()}_${Math.round(params.lat * 1000)}_${Math.round(params.lng * 1000)}`,
          license: OSM_LICENSE,
          cacheStatus: "miss",
          isStale: false,
          quality: {
            completeness:
              elements.length === 0 ? "unknown" : elements.length < 15 ? "sparse" : "verified",
            isStale: false,
            cacheStatus: "miss",
          },
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err?.name === "AbortError") {
          lastError = new ProviderError(
            "Overpass",
            "TIMEOUT",
            `Overpass request to ${url} timed out after 20s.`,
            { statusCode: 504, retryable: true }
          );
        } else {
          lastError = err;
        }
        console.warn(`[Overpass Provider] Failed against ${url}:`, lastError?.message);
      }
    }

    if (lastError instanceof ProviderError) {
      throw lastError;
    }

    throw new ProviderError(
      "Overpass",
      "UNAVAILABLE",
      `OpenStreetMap Overpass service unavailable: ${lastError?.message || "All endpoints failed"}. Please retry or check network connectivity.`
    );
  }
}

/**
 * Classifies an OSM tag dictionary into a standardized UrjaSetu feature category and subcategory.
 */
export function classifyOsmTags(tags: Record<string, string>): {
  category: StandardizedFeatureCategory;
  subCategory?: string;
  label: string;
  missingAttributes: string[];
} {
  const missingAttributes: string[] = [];

  if (tags.bridge && tags.bridge !== "no") {
    return {
      category: "bridge",
      subCategory: tags.highway || tags.railway || "bridge",
      label: tags.name || `Bridge (${tags.highway || tags.railway || "crossing"})`,
      missingAttributes,
    };
  }

  if (
    tags.military ||
    ["military", "landfill", "quarry", "cemetery"].includes(tags.landuse || "") ||
    tags.amenity === "grave_yard"
  ) {
    return {
      category: "restricted",
      subCategory: tags.landuse || tags.military || "restricted",
      label: tags.name || `Restricted Zone (${tags.landuse || tags.military || "cemetery"})`,
      missingAttributes,
    };
  }

  if (tags.building && tags.building !== "no") {
    if (!tags["building:levels"] && !tags.height) {
      missingAttributes.push("building:levels", "height");
    }
    return {
      category: "building",
      subCategory: tags.building,
      label: tags.name || tags["building:name"] || `Building (${tags.building})`,
      missingAttributes,
    };
  }

  if (tags.highway) {
    if (tags.highway === "bus_stop") {
      return {
        category: "transit",
        subCategory: "bus_stop",
        label: tags.name || "Bus Stop",
        missingAttributes,
      };
    }
    if (!tags.surface) missingAttributes.push("surface");
    if (!tags.lanes && ["primary", "secondary", "trunk", "motorway"].includes(tags.highway)) {
      missingAttributes.push("lanes");
    }
    return {
      category: "road",
      subCategory: tags.highway,
      label: tags.name || tags.ref || `Road (${tags.highway})`,
      missingAttributes,
    };
  }

  if (
    tags.waterway ||
    tags.natural === "water" ||
    tags.landuse === "reservoir" ||
    tags.water
  ) {
    return {
      category: "waterway",
      subCategory: tags.waterway || tags.water || "water",
      label: tags.name || `Waterway (${tags.waterway || tags.natural || "water"})`,
      missingAttributes,
    };
  }

  if (tags.railway) {
    if (tags.railway === "station" || tags.railway === "halt" || tags.railway === "subway_entrance") {
      return {
        category: "transit",
        subCategory: tags.railway,
        label: tags.name || `Transit Station (${tags.railway})`,
        missingAttributes,
      };
    }
    return {
      category: "railway",
      subCategory: tags.railway,
      label: tags.name || `Railway (${tags.railway})`,
      missingAttributes,
    };
  }

  if (tags.public_transport) {
    return {
      category: "transit",
      subCategory: tags.public_transport,
      label: tags.name || `Public Transport (${tags.public_transport})`,
      missingAttributes,
    };
  }

  if (tags.power) {
    if (!tags.voltage && (tags.power === "line" || tags.power === "substation")) {
      missingAttributes.push("voltage");
    }
    return {
      category: "power",
      subCategory: tags.power,
      label: tags.name || `Power Infrastructure (${tags.power})`,
      missingAttributes,
    };
  }

  if (tags.amenity) {
    return {
      category: "amenity",
      subCategory: tags.amenity,
      label: tags.name || `Amenity (${tags.amenity})`,
      missingAttributes,
    };
  }

  if (tags.leisure || tags.landuse) {
    return {
      category: "landuse",
      subCategory: tags.leisure || tags.landuse,
      label: tags.name || `Landuse (${tags.leisure || tags.landuse})`,
      missingAttributes,
    };
  }

  if (tags.natural) {
    return {
      category: "natural",
      subCategory: tags.natural,
      label: tags.name || `Natural (${tags.natural})`,
      missingAttributes,
    };
  }

  return {
    category: "other",
    label: tags.name || "Mapped Feature",
    missingAttributes,
  };
}

/**
 * Normalizes a raw OsmElement into a StandardizedGeoFeature with provenance and quality metadata.
 */
export function normalizeOsmElement(
  el: OsmElement,
  meta?: {
    sourceName?: string;
    retrievedAt?: string;
    datasetTimestamp?: string;
    cacheStatus?: CacheStatusType;
    isStale?: boolean;
  }
): StandardizedGeoFeature | null {
  const geoFeature = osmElementToGeoJson(el);
  if (!geoFeature) return null;

  const tags = el.tags || {};
  const classification = classifyOsmTags(tags);
  const attributes: Record<string, string | number | boolean> = {
    osmType: el.type,
    osmId: el.id,
  };

  if (tags.name) attributes.name = tags.name;
  if (tags.highway) attributes.highway = tags.highway;
  if (tags.building) attributes.building = tags.building;
  if (tags["building:levels"]) {
    const lv = parseInt(tags["building:levels"], 10);
    if (Number.isFinite(lv)) attributes.levels = lv;
  }
  if (tags.height) {
    const h = parseFloat(tags.height);
    if (Number.isFinite(h)) attributes.heightM = h;
  }
  if (tags.waterway) attributes.waterway = tags.waterway;
  if (tags.railway) attributes.railway = tags.railway;
  if (tags.amenity) attributes.amenity = tags.amenity;
  if (tags.landuse) attributes.landuse = tags.landuse;
  if (tags.power) attributes.power = tags.power;
  if (tags.voltage) attributes.voltage = tags.voltage;

  return {
    id: `osm:${el.type}:${el.id}`,
    sourceId: `${el.type}/${el.id}`,
    sourceName: meta?.sourceName || "OpenStreetMap / Overpass API",
    category: classification.category,
    subCategory: classification.subCategory,
    label: classification.label,
    geometry: geoFeature.geometry,
    attributes,
    rawTags: tags,
    retrievedAt: meta?.retrievedAt || new Date().toISOString(),
    datasetTimestamp: meta?.datasetTimestamp,
    quality: {
      completeness: classification.missingAttributes.length > 0 ? "partial" : "verified",
      isStale: meta?.isStale ?? false,
      cacheStatus: meta?.cacheStatus ?? "miss",
      ...(classification.missingAttributes.length > 0
        ? { missingAttributes: classification.missingAttributes }
        : {}),
    },
    license: OSM_LICENSE,
  };
}

export function normalizeOsmElements(
  elements: OsmElement[],
  meta?: {
    sourceName?: string;
    retrievedAt?: string;
    datasetTimestamp?: string;
    cacheStatus?: CacheStatusType;
    isStale?: boolean;
  }
): StandardizedGeoFeature[] {
  const out: StandardizedGeoFeature[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    const key = `${el.type}:${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const norm = normalizeOsmElement(el, meta);
    if (norm) out.push(norm);
  }
  return out;
}

/**
 * Converts an OSM element with geometry to a Turf GeoJSON Feature
 */
export function osmElementToGeoJson(
  el: OsmElement
): Feature<Geometry, Record<string, any>> | null {
  if (!el || typeof el !== "object") return null;

  if (
    el.type === "node" &&
    typeof el.lat === "number" &&
    typeof el.lon === "number" &&
    Number.isFinite(el.lat) &&
    Number.isFinite(el.lon)
  ) {
    return turf.point([el.lon, el.lat], { id: el.id, tags: el.tags || {}, osmType: "node" });
  }

  if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length > 1) {
    const coords = el.geometry
      .filter(
        (pt) =>
          pt &&
          typeof pt.lon === "number" &&
          typeof pt.lat === "number" &&
          Number.isFinite(pt.lon) &&
          Number.isFinite(pt.lat)
      )
      .map((pt) => [pt.lon, pt.lat]);

    if (coords.length < 2) return null;

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
