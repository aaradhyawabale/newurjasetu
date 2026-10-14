import { SolarPosition } from "./types";

/**
 * High-precision NOAA Astronomical Solar Position Algorithm.
 * Adapted from NOAA Global Monitoring Laboratory Solar Calculator / Jean Meeus Astronomical Algorithms.
 * Computes solar azimuth, elevation, zenith, declination, and equation of time.
 *
 * Coordinate Convention:
 * - Latitude: -90° (South Pole) to +90° (North Pole)
 * - Longitude: -180° (West) to +180° (East)
 * - Azimuth: Clockwise from True North (0° = North, 90° = East, 180° = South, 270° = West)
 * - Elevation: Altitude above astronomical horizon (-90° to +90°)
 */

const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Calculates Julian Day number from a JavaScript Date.
 */
export function getJulianDay(date: Date): number {
  const time = date.getTime();
  return time / 86400000.0 + 2440587.5;
}

/**
 * Calculates Julian Century from Julian Day.
 */
export function getJulianCentury(jd: number): number {
  return (jd - 2451545.0) / 36525.0;
}

/**
 * Calculates solar position for given geographic coordinates, date, and timezone offset.
 *
 * @param lat Latitude in decimal degrees (-90 to +90)
 * @param lng Longitude in decimal degrees (-180 to +180)
 * @param date Date object (UTC or local)
 * @param timezoneOffsetMinutes Optional local timezone offset in minutes (e.g. +330 for IST UTC+5:30)
 */
export function calculateSolarPosition(
  lat: number,
  lng: number,
  date: Date,
  timezoneOffsetMinutes: number = 0
): SolarPosition {
  const jd = getJulianDay(date);
  const t = getJulianCentury(jd);

  // Geometric Mean Longitude of the Sun (degrees)
  let l0 = 280.46646 + t * (36000.76983 + 0.0003032 * t);
  l0 = ((l0 % 360) + 360) % 360;

  // Geometric Mean Anomaly of the Sun (degrees)
  let m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  m = ((m % 360) + 360) % 360;
  const mRad = m * DEG2RAD;

  // Eccentricity of Earth's orbit
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  // Sun Equation of the Center (degrees)
  const c =
    Math.sin(mRad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2.0 * mRad) * (0.019993 - 0.000101 * t) +
    Math.sin(3.0 * mRad) * 0.000289;

  // Sun True Longitude (degrees)
  const sunTrueLong = l0 + c;

  // Sun Apparent Longitude (degrees)
  const omega = 125.04 - 1934.136 * t;
  const lambdaSun = sunTrueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG2RAD);
  const lambdaSunRad = lambdaSun * DEG2RAD;

  // Mean Obliquity of the Ecliptic (degrees)
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const eps0 = 23.0 + (26.0 + seconds / 60.0) / 60.0;

  // Corrected Obliquity (degrees)
  const eps = eps0 + 0.00256 * Math.cos(omega * DEG2RAD);
  const epsRad = eps * DEG2RAD;

  // Solar Declination (degrees)
  const sinDelta = Math.sin(epsRad) * Math.sin(lambdaSunRad);
  const deltaRad = Math.asin(clamp(sinDelta, -1.0, 1.0));
  const declinationDeg = deltaRad * RAD2DEG;

  // Equation of Time (minutes)
  const y = Math.tan(epsRad / 2.0) * Math.tan(epsRad / 2.0);
  const l0Rad = l0 * DEG2RAD;
  const eotRad =
    y * Math.sin(2.0 * l0Rad) -
    2.0 * e * Math.sin(mRad) +
    4.0 * e * y * Math.sin(mRad) * Math.cos(2.0 * l0Rad) -
    0.5 * y * y * Math.sin(4.0 * l0Rad) -
    1.25 * e * e * Math.sin(2.0 * mRad);
  const equationOfTimeMinutes = 4.0 * eotRad * RAD2DEG;

  // Time in UTC fractional hours
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60.0 + date.getUTCSeconds() / 3600.0;
  const timeOffsetMinutes = equationOfTimeMinutes + 4.0 * lng;

  // True Solar Time (minutes of day)
  let trueSolarTimeMinutes = (utcHours * 60.0 + timeOffsetMinutes) % 1440.0;
  if (trueSolarTimeMinutes < 0) {
    trueSolarTimeMinutes += 1440.0;
  }

  // Solar Hour Angle (degrees)
  let hourAngleDeg = trueSolarTimeMinutes / 4.0 - 180.0;
  if (hourAngleDeg < -180.0) {
    hourAngleDeg += 360.0;
  }
  const haRad = hourAngleDeg * DEG2RAD;
  const latRad = lat * DEG2RAD;

  // Solar Zenith Angle (degrees)
  const cosZenith =
    Math.sin(latRad) * Math.sin(deltaRad) + Math.cos(latRad) * Math.cos(deltaRad) * Math.cos(haRad);
  const zenithRad = Math.acos(clamp(cosZenith, -1.0, 1.0));
  const zenithDeg = zenithRad * RAD2DEG;
  let elevationDeg = 90.0 - zenithDeg;

  // Atmospheric Refraction Correction (Bennett formula)
  if (elevationDeg > -0.85) {
    let refractionDeg = 0;
    if (elevationDeg > 5.0) {
      refractionDeg =
        (58.1 / Math.tan(elevationDeg * DEG2RAD) -
          0.07 / Math.pow(Math.tan(elevationDeg * DEG2RAD), 3) +
          0.000086 / Math.pow(Math.tan(elevationDeg * DEG2RAD), 5)) /
        3600.0;
    } else if (elevationDeg > -0.575) {
      refractionDeg =
        (1735.0 +
          elevationDeg * (-518.2 + elevationDeg * (103.4 + elevationDeg * (-12.79 + elevationDeg * 0.711)))) /
        3600.0;
    } else {
      refractionDeg = -20.774 / Math.tan(elevationDeg * DEG2RAD) / 3600.0;
    }
    elevationDeg += refractionDeg;
  }

  // Solar Azimuth Angle (measured clockwise from True North: 0° = North, 90° = East, 180° = South, 270° = West)
  const azY = -Math.sin(haRad);
  const azX = Math.tan(deltaRad) * Math.cos(latRad) - Math.sin(latRad) * Math.cos(haRad);
  let azimuthDeg = Math.atan2(azY, azX) * RAD2DEG;
  azimuthDeg = ((azimuthDeg % 360.0) + 360.0) % 360.0;

  const isDaylight = elevationDeg > 0.0;

  // Format Apparent Solar Time HH:MM
  const astHours = Math.floor(trueSolarTimeMinutes / 60.0);
  const astMins = Math.floor(trueSolarTimeMinutes % 60.0);
  const apparentSolarTime = `${String(astHours).padStart(2, "0")}:${String(astMins).padStart(2, "0")}`;

  return {
    azimuthDeg: Math.round(azimuthDeg * 100) / 100,
    elevationDeg: Math.round(elevationDeg * 100) / 100,
    zenithDeg: Math.round((90.0 - elevationDeg) * 100) / 100,
    isDaylight,
    declinationDeg: Math.round(declinationDeg * 100) / 100,
    equationOfTimeMinutes: Math.round(equationOfTimeMinutes * 100) / 100,
    hourAngleDeg: Math.round(hourAngleDeg * 100) / 100,
    apparentSolarTime,
  };
}
