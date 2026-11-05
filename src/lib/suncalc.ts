import { calculateSolarPosition } from '@/server/solar/solar-position';

/**
 * SunCalc compatible getPosition interface powered by the project's NOAA astronomical algorithm.
 */
export function getPosition(date: Date, lat: number, lng: number): { altitude: number; azimuth: number } {
  const pos = calculateSolarPosition(lat, lng, date);
  const altitude = (pos.elevationDeg * Math.PI) / 180;
  // SunCalc azimuth convention: South = 0, West = PI/2, North = PI, East = -PI/2
  // pos.azimuthDeg: North = 0, East = 90, South = 180, West = 270
  const azimuth = ((pos.azimuthDeg - 180) * Math.PI) / 180;
  return { altitude, azimuth };
}

const SunCalc = { getPosition };
export default SunCalc;
