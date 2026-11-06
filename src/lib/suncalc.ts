/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SunCalc & Shadow Geometry Engine for UrjaSetu
 * Precise astronomical solar position with deterministic IST (UTC+5:30) date handling
 * and 2D rooftop panel-obstacle shadow polygon intersection.
 */

import { calculateSolarPosition } from '@/server/solar/solar-position';

export interface SolarPositionResult {
  altitude: number;      // Altitude in radians (SunCalc compatible)
  azimuth: number;       // SunCalc azimuth in radians (South = 0, West = PI/2, East = -PI/2)
  altitudeDeg: number;   // Altitude / elevation in degrees (-90° to +90°)
  azimuthDeg: number;    // True compass azimuth in degrees from North (0° = North, 90° = East, 180° = South, 270° = West)
  isSunUp: boolean;      // True if altitudeDeg > 0
}

/**
 * Constructs a Date object corresponding exactly to year, month (1-12), day, hour (0-23), minute (0-59)
 * in Indian Standard Time (IST, UTC+5:30).
 * IST is fixed at UTC+5:30 throughout the year with no Daylight Saving Time.
 */
export function getISTDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  const utcMillis = Date.UTC(year, month - 1, day, hour - 5, minute - 30, 0, 0);
  return new Date(utcMillis);
}

/**
 * Returns solar position for given date, latitude and longitude.
 */
export function getPosition(date: Date, lat: number, lng: number): SolarPositionResult {
  const pos = calculateSolarPosition(lat, lng, date);
  const altitudeDeg = pos.elevationDeg;
  const azimuthDeg = pos.azimuthDeg;
  const altitude = (altitudeDeg * Math.PI) / 180;
  // SunCalc azimuth convention: South = 0, West = PI/2, North = PI, East = -PI/2
  const azimuth = ((azimuthDeg - 180) * Math.PI) / 180;

  return {
    altitude,
    azimuth,
    altitudeDeg,
    azimuthDeg,
    isSunUp: altitudeDeg > 0,
  };
}

export interface PanelSpec {
  lengthM: number;     // Array length along tilt slope (default 6m)
  widthM: number;      // Array width perpendicular to tilt (default 10m)
  tiltDeg: number;     // Panel tilt angle in degrees (default 18° for Pune)
  azimuthDeg: number;  // Panel azimuth (180° = True South)
}

export interface ObstacleSpec {
  heightM: number;     // Obstacle height above panel plane in meters
  widthM: number;      // Obstacle width in meters
  distanceM: number;   // Distance from panel center to obstacle center in meters
  bearingDeg: number;  // Compass bearing from panel center to obstacle (0° = North, 90° = East, etc.)
}

export interface Point2D {
  x: number; // East in meters (positive = East, negative = West)
  y: number; // North in meters (positive = North, negative = South)
}

export interface ShadowSimulationResult {
  sunAltitudeDeg: number;
  sunAzimuthDeg: number;
  isNight: boolean;
  shadowLengthM: number;
  shadowDirectionDeg: number;
  shadowVector: Point2D;
  obstacleCenter: Point2D;
  obstaclePolygon: Point2D[];
  shadowPolygon: Point2D[];
  panelPolygon: Point2D[];
  shadedFractionPct: number; // 0 to 100%
}

/**
 * Determines whether a 2D point is inside a polygon using ray-casting algorithm.
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Rotates a 2D point around origin by theta radians (clockwise from North).
 */
function rotatePoint(pt: Point2D, angleRad: number): Point2D {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: pt.x * cos + pt.y * sin,
    y: -pt.x * sin + pt.y * cos,
  };
}

/**
 * Computes 2D plan-view shadow polygon and panel intersection.
 * Local coordinate system: Center of panel is (0, 0), +X = East, +Y = North.
 */
export function calculateShadowGeometry(
  panel: PanelSpec,
  obstacle: ObstacleSpec,
  sun: { altitudeDeg: number; azimuthDeg: number }
): ShadowSimulationResult {
  const { altitudeDeg, azimuthDeg } = sun;
  const isNight = altitudeDeg <= 0;

  // Obstacle center in local meters (distance, bearing)
  const bearingRad = (obstacle.bearingDeg * Math.PI) / 180;
  const obsX = obstacle.distanceM * Math.sin(bearingRad);
  const obsY = obstacle.distanceM * Math.cos(bearingRad);
  const obstacleCenter: Point2D = { x: obsX, y: obsY };

  // Obstacle base rectangle (width along normal to bearing, depth ~ 2m)
  const halfW = obstacle.widthM / 2;
  const halfD = Math.max(1.0, obstacle.widthM * 0.15); // depth of parapet/wall
  const normalBearingRad = bearingRad + Math.PI / 2;
  const dxW = halfW * Math.sin(normalBearingRad);
  const dyW = halfW * Math.cos(normalBearingRad);
  const dxD = halfD * Math.sin(bearingRad);
  const dyD = halfD * Math.cos(bearingRad);

  const obsP1: Point2D = { x: obsX - dxW - dxD, y: obsY - dyW - dyD };
  const obsP2: Point2D = { x: obsX + dxW - dxD, y: obsY + dyW - dyD };
  const obsP3: Point2D = { x: obsX + dxW + dxD, y: obsY + dyW + dyD };
  const obsP4: Point2D = { x: obsX - dxW + dxD, y: obsY - dyW + dyD };
  const obstaclePolygon: Point2D[] = [obsP1, obsP2, obsP3, obsP4];

  // Panel 2D footprint (horizontal projection: length * cos(tilt), centered at 0, 0)
  const panelTiltRad = (panel.tiltDeg * Math.PI) / 180;
  const panelAzimuthRad = (panel.azimuthDeg * Math.PI) / 180;
  const projLength = panel.lengthM * Math.cos(panelTiltRad);
  const halfPLen = projLength / 2;
  const halfPWid = panel.widthM / 2;

  // Unrotated panel corners: length along Y (North-South), width along X (East-West)
  const panelCornersUnrotated: Point2D[] = [
    { x: -halfPWid, y: -halfPLen },
    { x: halfPWid, y: -halfPLen },
    { x: halfPWid, y: halfPLen },
    { x: -halfPWid, y: halfPLen },
  ];

  // Rotate panel corners by panel azimuth offset from South (180°)
  const panelRotRad = ((panel.azimuthDeg - 180) * Math.PI) / 180;
  const panelPolygon: Point2D[] = panelCornersUnrotated.map((pt) => ({
    x: pt.x * Math.cos(panelRotRad) - pt.y * Math.sin(panelRotRad),
    y: pt.x * Math.sin(panelRotRad) + pt.y * Math.cos(panelRotRad),
  }));

  if (isNight) {
    return {
      sunAltitudeDeg: altitudeDeg,
      sunAzimuthDeg: azimuthDeg,
      isNight: true,
      shadowLengthM: 0,
      shadowDirectionDeg: (azimuthDeg + 180) % 360,
      shadowVector: { x: 0, y: 0 },
      obstacleCenter,
      obstaclePolygon,
      shadowPolygon: [],
      panelPolygon,
      shadedFractionPct: 100, // Sun below horizon
    };
  }

  // Shadow length: S = height / tan(altitude)
  const altRad = (altitudeDeg * Math.PI) / 180;
  const shadowLengthM = Math.min(250, obstacle.heightM / Math.tan(altRad));
  const shadowDirectionDeg = (azimuthDeg + 180) % 360;
  const shadowDirRad = (shadowDirectionDeg * Math.PI) / 180;

  const dxShadow = shadowLengthM * Math.sin(shadowDirRad);
  const dyShadow = shadowLengthM * Math.cos(shadowDirRad);
  const shadowVector: Point2D = { x: dxShadow, y: dyShadow };

  // Shadow polygon: obstacle footprint swept along shadow vector
  // Swept polygon from 4 base points + 4 projected points
  const topPoints = obstaclePolygon.map((p) => ({
    x: p.x + dxShadow,
    y: p.y + dyShadow,
  }));

  // Build convex hull or ordered polygon enclosing base and top
  const allPoints = [...obstaclePolygon, ...topPoints];
  // Simple convex hull for shadow polygon
  allPoints.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

  const crossProduct = (o: Point2D, a: Point2D, b: Point2D) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point2D[] = [];
  for (const p of allPoints) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point2D[] = [];
  for (let i = allPoints.length - 1; i >= 0; i--) {
    const p = allPoints[i];
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  const shadowPolygon = lower.concat(upper);

  // Compute shaded fraction: discretize panel footprint into 10x10 = 100 sample points
  let shadedPoints = 0;
  const totalGridPoints = 100;
  const gridSize = 10;

  for (let u = 0; u < gridSize; u++) {
    const fracU = (u + 0.5) / gridSize - 0.5; // -0.45 to +0.45
    for (let v = 0; v < gridSize; v++) {
      const fracV = (v + 0.5) / gridSize - 0.5;

      const unrotatedPt: Point2D = {
        x: fracU * panel.widthM,
        y: fracV * projLength,
      };

      const pt: Point2D = {
        x: unrotatedPt.x * Math.cos(panelRotRad) - unrotatedPt.y * Math.sin(panelRotRad),
        y: unrotatedPt.x * Math.sin(panelRotRad) + unrotatedPt.y * Math.cos(panelRotRad),
      };

      if (isPointInPolygon(pt, shadowPolygon)) {
        shadedPoints++;
      }
    }
  }

  const shadedFractionPct = Math.round((shadedPoints / totalGridPoints) * 100);

  return {
    sunAltitudeDeg: Math.round(altitudeDeg * 10) / 10,
    sunAzimuthDeg: Math.round(azimuthDeg * 10) / 10,
    isNight: false,
    shadowLengthM: Math.round(shadowLengthM * 10) / 10,
    shadowDirectionDeg: Math.round(shadowDirectionDeg * 10) / 10,
    shadowVector,
    obstacleCenter,
    obstaclePolygon,
    shadowPolygon,
    panelPolygon,
    shadedFractionPct,
  };
}

const SunCalc = {
  getPosition,
  getISTDate,
  calculateShadowGeometry,
  isPointInPolygon,
};

export default SunCalc;
