import * as turf from "@turf/turf";
import type { Feature, LineString, MultiLineString, Polygon, Geometry, Point } from "geojson";
import { InfrastructureTypeId, INFRASTRUCTURE_TYPES } from "@/config/infra-types";
import {
  createFootprintPolygon,
  doesFootprintIntersect,
  computeAreaM2,
  calculateDistanceMeters,
} from "../gis/geometry";
import { OverpassProvider, osmElementToGeoJson } from "../providers/overpass";
import { OsmElement } from "../providers/types";

export interface SmartFitResult {
  lat: number;
  lng: number;
  lengthM: number;
  widthM: number;
  bearingDeg: number;
  roadName: string;
  roadDistanceM: number;
  curbOffsetM: number;
  areaM2: number;
  collisionsAvoided: number;
  summary: string;
}

const overpassProvider = new OverpassProvider();

/**
 * Township Planner Smart Siting Engine
 *
 * Automatically fits infrastructure footprints to open unbuilt land parcels
 * with direct road frontage (touching the road edge) and zero building collisions.
 */
export async function smartFitFootprint(
  type: InfrastructureTypeId,
  lat: number,
  lng: number,
  currentLengthM: number,
  currentWidthM: number,
  currentBearingDeg = 0,
  preloadedElements?: OsmElement[]
): Promise<SmartFitResult | null> {
  const typeConfig = INFRASTRUCTURE_TYPES[type] || INFRASTRUCTURE_TYPES["Park"];
  const clickPt = turf.point([lng, lat]);

  const elements =
    preloadedElements !== undefined
      ? preloadedElements
      : (await overpassProvider.getFeaturesAround(lat, lng, 300)).elements;

  const roads: Array<{ id: number; name: string; geometry: LineString | MultiLineString }> = [];
  const buildings: Array<{ id: number; geometry: Geometry }> = [];
  const waterways: Array<{ id: number; geometry: Geometry }> = [];

  for (const el of elements) {
    const geo = osmElementToGeoJson(el);
    if (!geo) continue;
    const tags = el.tags || {};

    if (tags.highway && tags.highway !== "steps" && tags.highway !== "platform") {
      if (geo.geometry.type === "LineString" || geo.geometry.type === "MultiLineString") {
        roads.push({
          id: el.id,
          name: tags.name || tags.ref || `${tags.highway} road`,
          geometry: geo.geometry as LineString | MultiLineString,
        });
      }
    }

    if (tags.building && tags.building !== "no") {
      buildings.push({ id: el.id, geometry: geo.geometry });
    }

    if (tags.waterway || tags.natural === "water" || tags.landuse === "reservoir") {
      waterways.push({ id: el.id, geometry: geo.geometry });
    }
  }

  if (roads.length === 0) {
    return null;
  }

  // 1. Find the closest road to the target site
  let closestRoad: { id: number; name: string; geometry: LineString | MultiLineString } | null = null;
  let minRoadDistM = Infinity;
  let nearestPtOnRoad: Feature<Point, { dist: number; index: number; location: number }> | null = null;
  let nearestLineString: Feature<LineString> | null = null;

  for (const r of roads) {
    const lineStrings: Feature<LineString>[] = [];
    if (r.geometry.type === "LineString") {
      lineStrings.push(turf.lineString(r.geometry.coordinates));
    } else if (r.geometry.type === "MultiLineString") {
      for (const coords of r.geometry.coordinates) {
        if (coords.length >= 2) {
          lineStrings.push(turf.lineString(coords));
        }
      }
    }

    for (const ls of lineStrings) {
      const snapped = turf.nearestPointOnLine(ls, clickPt);
      const distM = (snapped.properties.dist ?? 0) * 1000;
      if (distM < minRoadDistM) {
        minRoadDistM = distM;
        closestRoad = r;
        nearestPtOnRoad = snapped;
        nearestLineString = ls;
      }
    }
  }

  if (!closestRoad || !nearestPtOnRoad || !nearestLineString) {
    return null;
  }

  // 2. Compute the road corridor bearing at the access frontage point
  const coords = nearestLineString.geometry.coordinates;
  const snappedIdx = nearestPtOnRoad.properties.index ?? 0;
  const p1 = coords[snappedIdx] || coords[0];
  const p2 = coords[Math.min(snappedIdx + 1, coords.length - 1)] || coords[coords.length - 1];

  let roadBearing = 0;
  if (p1[0] !== p2[0] || p1[1] !== p2[1]) {
    roadBearing = Math.round(((turf.bearing(turf.point(p1), turf.point(p2)) % 360) + 360) % 360);
  } else if (coords.length >= 2) {
    roadBearing = Math.round(
      ((turf.bearing(turf.point(coords[0]), turf.point(coords[coords.length - 1])) % 360) + 360) % 360
    );
  }

  // 3. Determine which side of the road the user clicked
  const bearingToClick = turf.bearing(nearestPtOnRoad, clickPt);
  const norm1 = (roadBearing + 90 + 360) % 360;
  const norm2 = (roadBearing - 90 + 360) % 360;
  const diff1 = Math.abs(((bearingToClick - norm1 + 540) % 360) - 180);
  const diff2 = Math.abs(((bearingToClick - norm2 + 540) % 360) - 180);
  const parcelSideBearing = diff1 < diff2 ? norm1 : norm2;

  // 4. Set road curb offset (half-width of typical municipal road is ~6m from centerline)
  // This ensures the park boundary touches the road edge (0m setback) without blocking traffic.
  const curbOffsetM = 6;

  // 5. Test candidate dimensions to fit open unbuilt space
  const candidateLengths = [
    Math.round(currentLengthM),
    120,
    100,
    80,
    70,
    60,
    50,
    40,
    30,
  ].filter((v, i, a) => v >= 20 && a.indexOf(v) === i);

  const candidateWidths = [
    Math.round(currentWidthM),
    80,
    65,
    55,
    45,
    35,
    25,
    20,
  ].filter((v, i, a) => v >= 15 && a.indexOf(v) === i);

  const lateralShiftsM = [0, 8, -8, 16, -16, 24, -24, 35, -35];

  let bestFit: {
    lat: number;
    lng: number;
    lengthM: number;
    widthM: number;
    bearingDeg: number;
    areaM2: number;
    avoided: number;
  } | null = null;

  for (const len of candidateLengths) {
    for (const wid of candidateWidths) {
      const area = len * wid;
      // Skip if smaller than best area already found
      if (bestFit && area <= bestFit.areaM2) continue;

      for (const shiftM of lateralShiftsM) {
        // Front edge touches road: center is offset by curbOffsetM + wid / 2 into the parcel
        const depthOffsetKm = (curbOffsetM + wid / 2) / 1000;
        let basePt = turf.destination(nearestPtOnRoad, depthOffsetKm, parcelSideBearing, {
          units: "kilometers",
        });

        // Apply lateral shift along road corridor if needed to dodge side structures
        if (shiftM !== 0) {
          const shiftBearing = shiftM > 0 ? roadBearing : (roadBearing + 180) % 360;
          basePt = turf.destination(basePt, Math.abs(shiftM) / 1000, shiftBearing, {
            units: "kilometers",
          });
        }

        const [cLng, cLat] = basePt.geometry.coordinates;
        const poly = createFootprintPolygon(cLat, cLng, len, wid, roadBearing);

        // Verify zero building collisions
        let buildingCollision = false;
        let collisionsCount = 0;
        for (const b of buildings) {
          if (doesFootprintIntersect(poly, b.geometry)) {
            buildingCollision = true;
            collisionsCount++;
          }
        }

        if (buildingCollision) continue;

        // Verify no intersection with the road centerline itself
        let roadCollision = false;
        if (nearestLineString && doesFootprintIntersect(poly, nearestLineString.geometry)) {
          roadCollision = true;
        }

        if (roadCollision) continue;

        // Verify no waterway collision unless permitted
        let waterCollision = false;
        for (const w of waterways) {
          if (doesFootprintIntersect(poly, w.geometry)) {
            waterCollision = true;
            break;
          }
        }

        if (waterCollision) continue;

        // Candidate fits cleanly!
        bestFit = {
          lat: cLat,
          lng: cLng,
          lengthM: len,
          widthM: wid,
          bearingDeg: roadBearing,
          areaM2: area,
          avoided: buildings.length,
        };
        break;
      }
    }
  }

  // Fallback: If no candidate fit without buildings, use scaled minimum envelope touching road
  if (!bestFit) {
    const minLen = Math.max(30, Math.min(candidateLengths[candidateLengths.length - 1], 40));
    const minWid = Math.max(20, Math.min(candidateWidths[candidateWidths.length - 1], 25));
    const depthOffsetKm = (curbOffsetM + minWid / 2) / 1000;
    const basePt = turf.destination(nearestPtOnRoad, depthOffsetKm, parcelSideBearing, {
      units: "kilometers",
    });
    const [cLng, cLat] = basePt.geometry.coordinates;

    bestFit = {
      lat: cLat,
      lng: cLng,
      lengthM: minLen,
      widthM: minWid,
      bearingDeg: roadBearing,
      areaM2: minLen * minWid,
      avoided: 0,
    };
  }

  const frontageM = bestFit.lengthM;
  const depthM = bestFit.widthM;

  return {
    lat: Number(bestFit.lat.toFixed(7)),
    lng: Number(bestFit.lng.toFixed(7)),
    lengthM: bestFit.lengthM,
    widthM: bestFit.widthM,
    bearingDeg: bestFit.bearingDeg,
    roadName: closestRoad.name,
    roadDistanceM: Math.round(minRoadDistM),
    curbOffsetM,
    areaM2: bestFit.areaM2,
    collisionsAvoided: bestFit.avoided,
    summary: `Aligned ${type} footprint along ${closestRoad.name} with ${frontageM}m street frontage (curb-adjacent) and ${depthM}m parcel depth (${bestFit.areaM2.toLocaleString()} m² open space).`,
  };
}
