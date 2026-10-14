import { describe, it, expect } from "vitest";
import {
  calculateSolarPosition,
  getJulianDay,
  getJulianCentury,
} from "@/server/solar/solar-position";

describe("NOAA Astronomical Solar Position Algorithm", () => {
  it("calculates accurate Julian Day and Century", () => {
    // J2000.0 epoch: 2000-01-01 12:00:00 UTC = JD 2451545.0, Century = 0.0
    const j2000 = new Date("2000-01-01T12:00:00.000Z");
    const jd = getJulianDay(j2000);
    expect(jd).toBeCloseTo(2451545.0, 3);
    const jc = getJulianCentury(jd);
    expect(jc).toBeCloseTo(0.0, 5);
  });

  it("calculates accurate solar position for Summer Solstice in New Delhi", () => {
    // June 21, 2026 at solar noon (12:20 IST = 06:50 UTC) at lat 28.6139°N, lng 77.2090°E
    // At Summer Solstice, declination is approx +23.44°
    // Noon elevation in Delhi (28.6°N) ≈ 90° - (28.6° - 23.44°) ≈ 84.8°
    const summerSolsticeNoon = new Date("2026-06-21T06:50:00.000Z");
    const pos = calculateSolarPosition(28.6139, 77.2090, summerSolsticeNoon, 330);

    expect(pos.isDaylight).toBe(true);
    expect(pos.declinationDeg).toBeGreaterThanOrEqual(23.3);
    expect(pos.declinationDeg).toBeLessThanOrEqual(23.6);
    expect(pos.elevationDeg).toBeGreaterThanOrEqual(82.0);
    expect(pos.elevationDeg).toBeLessThanOrEqual(87.0);
    // Solar noon azimuth in northern hemisphere tropics/subtropics is near South or overhead
    expect(pos.zenithDeg).toBeLessThanOrEqual(10.0);
  });

  it("calculates accurate solar position for Winter Solstice in New Delhi", () => {
    // Dec 21, 2026 at solar noon (12:15 IST = 06:45 UTC) at lat 28.6139°N, lng 77.2090°E
    // Declination ≈ -23.44°
    // Noon elevation in Delhi (28.6°N) ≈ 90° - (28.6° - (-23.44°)) ≈ 37.9°
    const winterSolsticeNoon = new Date("2026-12-21T06:45:00.000Z");
    const pos = calculateSolarPosition(28.6139, 77.2090, winterSolsticeNoon, 330);

    expect(pos.isDaylight).toBe(true);
    expect(pos.declinationDeg).toBeLessThanOrEqual(-23.3);
    expect(pos.declinationDeg).toBeGreaterThanOrEqual(-23.6);
    expect(pos.elevationDeg).toBeGreaterThanOrEqual(36.0);
    expect(pos.elevationDeg).toBeLessThanOrEqual(40.0);
    // Azimuth at winter noon in Northern hemisphere points due South (around 180°)
    expect(pos.azimuthDeg).toBeGreaterThanOrEqual(175.0);
    expect(pos.azimuthDeg).toBeLessThanOrEqual(185.0);
  });

  it("calculates accurate solar position for Equinox", () => {
    // March 20, 2026 at solar noon
    // Declination near Equinox is approximately 0°
    const equinoxNoon = new Date("2026-03-20T06:45:00.000Z");
    const pos = calculateSolarPosition(28.6139, 77.2090, equinoxNoon, 330);

    expect(pos.declinationDeg).toBeGreaterThanOrEqual(-1.5);
    expect(pos.declinationDeg).toBeLessThanOrEqual(1.5);
    // Noon elevation ≈ 90° - 28.6° ≈ 61.4°
    expect(pos.elevationDeg).toBeGreaterThanOrEqual(59.0);
    expect(pos.elevationDeg).toBeLessThanOrEqual(63.0);
  });

  it("demonstrates diurnal azimuth rotation: East in morning, South at noon, West in evening", () => {
    // New Delhi: 28.6139°N, 77.2090°E on Oct 14
    // 08:30 IST = 03:00 UTC (Morning)
    const morning = new Date("2026-10-14T03:00:00.000Z");
    const morningPos = calculateSolarPosition(28.6139, 77.2090, morning, 330);

    // 12:10 IST = 06:40 UTC (Noon)
    const noon = new Date("2026-10-14T06:40:00.000Z");
    const noonPos = calculateSolarPosition(28.6139, 77.2090, noon, 330);

    // 16:30 IST = 11:00 UTC (Evening)
    const evening = new Date("2026-10-14T11:00:00.000Z");
    const eveningPos = calculateSolarPosition(28.6139, 77.2090, evening, 330);

    // Morning sun is in the East / Southeast (90° to 140°)
    expect(morningPos.azimuthDeg).toBeGreaterThanOrEqual(90);
    expect(morningPos.azimuthDeg).toBeLessThanOrEqual(140);
    expect(morningPos.elevationDeg).toBeGreaterThan(15);

    // Noon sun is in the South (170° to 190°)
    expect(noonPos.azimuthDeg).toBeGreaterThanOrEqual(170);
    expect(noonPos.azimuthDeg).toBeLessThanOrEqual(190);
    expect(noonPos.elevationDeg).toBeGreaterThan(morningPos.elevationDeg);

    // Evening sun is in the Southwest / West (220° to 270°)
    expect(eveningPos.azimuthDeg).toBeGreaterThanOrEqual(220);
    expect(eveningPos.azimuthDeg).toBeLessThanOrEqual(270);
    expect(eveningPos.elevationDeg).toBeGreaterThan(5);
  });

  it("correctly identifies nighttime when sun is below horizon", () => {
    // 23:00 IST = 17:30 UTC (Deep night in New Delhi)
    const night = new Date("2026-10-14T17:30:00.000Z");
    const pos = calculateSolarPosition(28.6139, 77.2090, night, 330);

    expect(pos.isDaylight).toBe(false);
    expect(pos.elevationDeg).toBeLessThan(0);
    expect(pos.zenithDeg).toBeGreaterThan(90);
  });

  it("handles southern hemisphere coordinates where solar noon faces North", () => {
    // Sydney, Australia: -33.8688°S, 151.2093°E at solar noon (approx 02:00 UTC) on Equinox
    const sydneyNoon = new Date("2026-03-20T02:00:00.000Z");
    const pos = calculateSolarPosition(-33.8688, 151.2093, sydneyNoon, 660);

    expect(pos.isDaylight).toBe(true);
    // In Southern Hemisphere, solar noon sun points North (azimuth ≈ 0° or 360°)
    const northDistance = Math.min(pos.azimuthDeg, 360 - pos.azimuthDeg);
    expect(northDistance).toBeLessThanOrEqual(15.0);
  });
});
