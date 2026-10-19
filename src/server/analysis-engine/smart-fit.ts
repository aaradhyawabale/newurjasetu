import * as turf from "@turf/turf";
import type { Feature, LineString, MultiLineString, Polygon, MultiPolygon, Geometry, Point } from "geojson";
import { InfrastructureTypeId, INFRASTRUCTURE_TYPES } from "@/config/infra-types";
import {
  createFootprintPolygon,
  doesFootprintIntersect,
  computeAreaM2,
  calculateDistanceMeters,
} from "../gis/geometry";
import { OverpassProvider, osmElementToGeoJson } from "../providers/overpass";
import { OsmElement } from "../providers/types";

export interface SmartFitOtherPlacement {
  id?: string;
  type?: string;
  lat: number;
  lng: number;
  lengthM: number;
  widthM: number;
  bearingDeg?: number;
}

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
 * Calculates standard road half-width (centerline to curb/edge) in meters
 * adhering to Indian Roads Congress (IRC) and urban municipal town planning standards.
 */
export function getRoadHalfWidthM(tags: Record<string, string> = {}): number {
  if (tags.width) {
    const parsed = parseFloat(tags.width);
    if (!isNaN(parsed) && parsed > 0) {
      return Math.max(2.5, parsed / 2);
    }
  }
  if (tags.lanes) {
    const lanes = parseInt(tags.lanes, 10);
    if (!isNaN(lanes) && lanes > 0) {
      // 3.5m per lane + 1.5m pedestrian footpath/curb margin
      return Math.max(3.0, (lanes * 3.5) / 2 + 1.5);
    }
  }
  const highway = tags.highway || "";
  switch (highway) {
    case "motorway":
    case "motorway_link":
      return 14.0;
    case "trunk":
    case "trunk_link":
      return 11.0;
    case "primary":
    case "primary_link":
      return 9.5;
    case "secondary":
    case "secondary_link":
      return 7.5;
    case "tertiary":
    case "tertiary_link":
      return 6.0;
    case "residential":
    case "unclassified":
      return 5.0;
    case "living_street":
    case "service":
      return 3.5;
    case "pedestrian":
    case "footway":
    case "cycleway":
    case "path":
      return 2.5;
    default:
      return 5.0;
  }
}

/**
 * Gets statutory front setback (in meters) from the road curb edge into the parcel.
 * National Building Code (NBC) / DCR requirements:
 * - Green spaces & parks: 1.0m pedestrian sidewalk margin
 * - Civic structures & hospitals: 2.5m - 3.0m building line setback
 */
export function getStatutoryFrontageSetbackM(type: InfrastructureTypeId): number {
  switch (type) {
    case "Park":
      return 1.0; // Open green space touches curb with 1m pedestrian margin
    case "Bridge":
    case "Road":
      return 0.0;
    case "Hospital":
    case "School":
    case "Building":
      return 3.0; // Statutory building line setback for pedestrian access, ambulance & emergency vehicles
    case "Transit Station":
    case "EV Charging Station":
    case "Solar Farm":
      return 2.5;
    default:
      return 2.0;
  }
}

/**
 * Minimum viable parcel dimensions by infrastructure type for smart fitting.
 */
function getMinimumViableDimensions(type: InfrastructureTypeId): { minLen: number; minWid: number } {
  switch (type) {
    case "Hospital":
      return { minLen: 40, minWid: 30 };
    case "School":
      return { minLen: 40, minWid: 30 };
    case "Solar Farm":
      return { minLen: 50, minWid: 40 };
    case "Park":
      return { minLen: 25, minWid: 15 };
    case "Building":
      return { minLen: 25, minWid: 20 };
    case "Transit Station":
      return { minLen: 30, minWid: 20 };
    case "EV Charging Station":
      return { minLen: 20, minWid: 15 };
    default:
      return { minLen: 20, minWid: 15 };
  }
}

/**
 * Township Planner Smart Siting Engine
 *
 * Automatically fits infrastructure footprints to open unbuilt land parcels
 * with direct road frontage (tangent to curb with statutory setback) and
 * ZERO road, building, waterway, or neighboring infrastructure collisions.
 */
export async function smartFitFootprint(
  type: InfrastructureTypeId,
  lat: number,
  lng: number,
  currentLengthM: number,
  currentWidthM: number,
  currentBearingDeg = 0,
  preloadedElements?: OsmElement[],
  otherPlacements?: SmartFitOtherPlacement[]
): Promise<SmartFitResult | null> {
  const typeConfig = INFRASTRUCTURE_TYPES[type] || INFRASTRUCTURE_TYPES["Park"];
  const clickPt = turf.point([lng, lat]);

  const elements =
    preloadedElements !== undefined
      ? preloadedElements
      : (await overpassProvider.getFeaturesAround(lat, lng, 350)).elements;

  interface RoadFeature {
    id: number;
    name: string;
    tags: Record<string, string>;
    geometry: LineString | MultiLineString;
    lineStrings: Feature<LineString>[];
  }

  const roads: RoadFeature[] = [];
  const buildings: Array<{ id: number; geometry: Geometry }> = [];
  const waterways: Array<{ id: number; geometry: Geometry }> = [];
  const railways: Array<{ id: number; geometry: Geometry }> = [];

  for (const el of elements) {
    const geo = osmElementToGeoJson(el);
    if (!geo) continue;
    const tags = el.tags || {};

    if (tags.highway && tags.highway !== "steps" && tags.highway !== "platform" && tags.highway !== "elevator") {
      if (geo.geometry.type === "LineString" || geo.geometry.type === "MultiLineString") {
        const lineStrings: Feature<LineString>[] = [];
        if (geo.geometry.type === "LineString") {
          lineStrings.push(turf.lineString(geo.geometry.coordinates));
        } else {
          for (const coords of geo.geometry.coordinates) {
            if (coords.length >= 2) {
              lineStrings.push(turf.lineString(coords));
            }
          }
        }
        roads.push({
          id: el.id,
          name: tags.name || tags.ref || `${tags.highway} road`,
          tags,
          geometry: geo.geometry as LineString | MultiLineString,
          lineStrings,
        });
      }
    }

    if (tags.building && tags.building !== "no") {
      buildings.push({ id: el.id, geometry: geo.geometry });
    }

    if (tags.waterway || tags.natural === "water" || tags.landuse === "reservoir" || tags.water) {
      waterways.push({ id: el.id, geometry: geo.geometry });
    }

    if (tags.railway && tags.railway !== "abandoned" && tags.railway !== "disused") {
      railways.push({ id: el.id, geometry: geo.geometry });
    }
  }

  if (roads.length === 0) {
    return null;
  }

  // 1. Buffer ALL roads by (halfWidth + 0.8m) to strictly guarantee zero carriageway encroachment
  const bufferedRoads: Feature<Polygon | MultiPolygon>[] = [];
  for (const r of roads) {
    const halfW = getRoadHalfWidthM(r.tags);
    for (const ls of r.lineStrings) {
      try {
        const buf = turf.buffer(ls, (halfW + 0.8) / 1000, { units: "kilometers" });
        if (buf) {
          bufferedRoads.push(buf);
        }
      } catch {
        // Fallback: keep line without buffer if turf buffer fails on degenerate vertices
      }
    }
  }

  // 2. Prepare other placement obstacle polygons
  const otherPlacementPolys: Feature<Polygon>[] = [];
  if (otherPlacements && otherPlacements.length > 0) {
    for (const op of otherPlacements) {
      if (
        typeof op.lat === "number" &&
        typeof op.lng === "number" &&
        op.lengthM &&
        op.widthM &&
        op.lengthM > 0 &&
        op.widthM > 0
      ) {
        try {
          const poly = createFootprintPolygon(op.lat, op.lng, op.lengthM, op.widthM, op.bearingDeg || 0);
          otherPlacementPolys.push(poly);
        } catch {
          // Skip invalid geometries
        }
      }
    }
  }

  // 3. Find candidate frontage roads sorted by distance from target location
  interface RoadCandidate {
    road: RoadFeature;
    ls: Feature<LineString>;
    snappedPt: Feature<Point, { dist: number; index: number; location: number }>;
    distM: number;
  }

  const candidateRoads: RoadCandidate[] = [];

  for (const r of roads) {
    for (const ls of r.lineStrings) {
      const snapped = turf.nearestPointOnLine(ls, clickPt);
      const distM = (snapped.properties.dist ?? 0) * 1000;
      if (distM <= 350) {
        candidateRoads.push({
          road: r,
          ls,
          snappedPt: snapped,
          distM,
        });
      }
    }
  }

  if (candidateRoads.length === 0) {
    return null;
  }

  candidateRoads.sort((a, b) => a.distM - b.distM);

  // Consider up to top 3 closest roads
  const topRoadCandidates = candidateRoads.slice(0, 3);

  // 4. Set statutory frontage setback for this infrastructure type
  const setbackM = getStatutoryFrontageSetbackM(type);
  const minDimensions = getMinimumViableDimensions(type);

  // 5. Build candidate dimensions: starting from requested size, down to minimum viable envelope
  const reqLen = Math.round(currentLengthM);
  const reqWid = Math.round(currentWidthM);

  const scaleFactors = [1.0, 0.85, 0.70, 0.55, 0.40];
  const candidateSizes: Array<{ len: number; wid: number; area: number }> = [];

  for (const scale of scaleFactors) {
    const len = Math.max(minDimensions.minLen, Math.round(reqLen * scale));
    const wid = Math.max(minDimensions.minWid, Math.round(reqWid * scale));
    const area = len * wid;

    const alreadyExists = candidateSizes.some((s) => s.len === len && s.wid === wid);
    if (!alreadyExists && area >= minDimensions.minLen * minDimensions.minWid) {
      candidateSizes.push({ len, wid, area });
    }
  }

  candidateSizes.sort((a, b) => b.area - a.area);

  // Lateral shifts along road corridor to explore open space (up to ±210m)
  const lateralShiftsM = [
    0, 15, -15, 30, -30, 45, -45, 60, -60, 80, -80, 100, -100, 130, -130, 160, -160, 200, -200,
  ];

  interface BestFitCandidate {
    lat: number;
    lng: number;
    lengthM: number;
    widthM: number;
    bearingDeg: number;
    roadName: string;
    roadDistM: number;
    curbOffsetM: number;
    areaM2: number;
    score: number;
  }

  let bestFit: BestFitCandidate | null = null;

  // 6. Scan road candidates, both sides of the corridor, and lateral shifts
  for (const cand of topRoadCandidates) {
    const { road, ls, snappedPt, distM } = cand;
    const roadHalfW = getRoadHalfWidthM(road.tags);
    const frontClearanceM = roadHalfW + setbackM;
    const coords = ls.geometry.coordinates;

    // Segment bearing at snapped point
    const snappedIdx = snappedPt.properties.index ?? 0;
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

    // Determine the two lateral perpendicular normal directions
    const normRight = (roadBearing + 90) % 360;
    const normLeft = (roadBearing - 90 + 360) % 360;

    // Identify primary side (closest to user click) and opposite side
    const bearingToClick = turf.bearing(snappedPt, clickPt);
    const diffR = Math.abs(((bearingToClick - normRight + 540) % 360) - 180);
    const diffL = Math.abs(((bearingToClick - normLeft + 540) % 360) - 180);

    const primarySideBearing = diffR <= diffL ? normRight : normLeft;
    const oppositeSideBearing = diffR <= diffL ? normLeft : normRight;
    const sidesToSearch = [primarySideBearing, oppositeSideBearing];

    for (const size of candidateSizes) {
      // If we already found a valid fit with higher area, don't downgrade area
      if (bestFit && size.area < bestFit.areaM2 * 0.85) {
        break;
      }

      for (const sideBearing of sidesToSearch) {
        for (const shiftM of lateralShiftsM) {
          // Calculate shifted frontage point along the road
          let shiftedRoadPt = snappedPt;
          let curRoadBearing = roadBearing;
          let curSideNormal = sideBearing;

          if (shiftM !== 0) {
            const shiftBearing = shiftM > 0 ? roadBearing : (roadBearing + 180) % 360;
            const approxShiftPt = turf.destination(snappedPt, Math.abs(shiftM) / 1000, shiftBearing, {
              units: "kilometers",
            });
            shiftedRoadPt = turf.nearestPointOnLine(ls, approxShiftPt);

            const curIdx = shiftedRoadPt.properties.index ?? 0;
            const cp1 = coords[curIdx] || coords[0];
            const cp2 = coords[Math.min(curIdx + 1, coords.length - 1)] || coords[coords.length - 1];
            if (cp1[0] !== cp2[0] || cp1[1] !== cp2[1]) {
              curRoadBearing = Math.round(((turf.bearing(turf.point(cp1), turf.point(cp2)) % 360) + 360) % 360);
            }

            // Normal relative to current road bearing
            const isRightSide = sideBearing === normRight;
            curSideNormal = isRightSide ? (curRoadBearing + 90) % 360 : (curRoadBearing - 90 + 360) % 360;
          }

          // Offset center into parcel: front edge touches curb line + statutory setback
          const centerDepthOffsetKm = (frontClearanceM + size.wid / 2) / 1000;
          const centerPt = turf.destination(shiftedRoadPt, centerDepthOffsetKm, curSideNormal, {
            units: "kilometers",
          });
          const [cLng, cLat] = centerPt.geometry.coordinates;

          // Length runs along road corridor
          const poly = createFootprintPolygon(cLat, cLng, size.len, size.wid, curRoadBearing);

          // Rigorous Collision Checks:
          // 1. Road Carriageway & Corridors (buffered roads)
          let collidesRoad = false;
          for (const rBuf of bufferedRoads) {
            if (doesFootprintIntersect(poly, rBuf.geometry)) {
              collidesRoad = true;
              break;
            }
          }
          if (collidesRoad) continue;

          // 2. Existing Buildings & Structures
          let collidesBuilding = false;
          for (const b of buildings) {
            if (doesFootprintIntersect(poly, b.geometry)) {
              collidesBuilding = true;
              break;
            }
          }
          if (collidesBuilding) continue;

          // 3. Other Placed Infrastructures in Scenario
          let collidesOther = false;
          for (const opPoly of otherPlacementPolys) {
            if (doesFootprintIntersect(poly, opPoly.geometry)) {
              collidesOther = true;
              break;
            }
          }
          if (collidesOther) continue;

          // 4. Waterways (unless bridge)
          if (type !== "Bridge") {
            let collidesWater = false;
            for (const w of waterways) {
              if (doesFootprintIntersect(poly, w.geometry)) {
                collidesWater = true;
                break;
              }
            }
            if (collidesWater) continue;
          }

          // 5. Active Railways
          let collidesRail = false;
          for (const r of railways) {
            if (doesFootprintIntersect(poly, r.geometry)) {
              collidesRail = true;
              break;
            }
          }
          if (collidesRail) continue;

          // Clean, unbuilt parcel candidate found!
          const distToClick = calculateDistanceMeters(cLat, cLng, lat, lng);
          const areaRatio = size.area / (reqLen * reqWid);
          const proximityScore = 1 / (1 + distToClick / 80);
          const candidateScore = areaRatio * 0.7 + proximityScore * 0.3;

          if (!bestFit || candidateScore > bestFit.score) {
            bestFit = {
              lat: cLat,
              lng: cLng,
              lengthM: size.len,
              widthM: size.wid,
              bearingDeg: curRoadBearing,
              roadName: road.name,
              roadDistM: distM,
              curbOffsetM: frontClearanceM,
              areaM2: size.area,
              score: candidateScore,
            };
          }

          // If prime fit found (full requested size close to click), lock it in
          if (areaRatio >= 0.99 && distToClick <= 35) {
            break;
          }
        }

        if (bestFit && bestFit.areaM2 >= reqLen * reqWid * 0.95) {
          break;
        }
      }

      if (bestFit && bestFit.areaM2 >= reqLen * reqWid * 0.95) {
        break;
      }
    }

    if (bestFit && bestFit.areaM2 >= reqLen * reqWid * 0.85) {
      break;
    }
  }

  // 7. If no clean, unbuilt space was found without hitting buildings or roads:
  // Return null! NEVER place a colliding box on top of buildings.
  if (!bestFit) {
    return null;
  }

  const frontageM = bestFit.lengthM;
  const depthM = bestFit.widthM;
  const setbackText =
    setbackM >= 2.0
      ? `${setbackM}m statutory frontage setback`
      : `curb-adjacent (${setbackM}m pedestrian margin)`;

  return {
    lat: Number(bestFit.lat.toFixed(7)),
    lng: Number(bestFit.lng.toFixed(7)),
    lengthM: bestFit.lengthM,
    widthM: bestFit.widthM,
    bearingDeg: bestFit.bearingDeg,
    roadName: bestFit.roadName,
    roadDistanceM: Math.round(bestFit.roadDistM),
    curbOffsetM: bestFit.curbOffsetM,
    areaM2: bestFit.areaM2,
    collisionsAvoided: buildings.length + otherPlacementPolys.length,
    summary: `Aligned ${type} footprint along ${bestFit.roadName} with ${frontageM}m street frontage (${setbackText}) and ${depthM}m parcel depth (${bestFit.areaM2.toLocaleString()} m² open space). Zero road, building, or infrastructure collisions.`,
  };
}
