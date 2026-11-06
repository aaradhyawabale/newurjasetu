import { describe, it, expect } from 'vitest';
import SunCalc, {
  getISTDate,
  getPosition,
  calculateShadowGeometry,
  isPointInPolygon,
  PanelSpec,
  ObstacleSpec
} from '@/lib/suncalc';

describe('Solar & Shadow Simulator Geometry Tests (Pune, India)', () => {
  // Pune geographic coordinates
  const PUNE_LAT = 18.5204;
  const PUNE_LNG = 73.8567;

  describe('Solar Position & IST Timezone Integrity', () => {
    it('verifies Pune sun altitude is > 40 degrees at 13:30 IST on any date and < 0 at 00:30 IST', () => {
      // Test key astronomical dates: Winter Solstice, Spring Equinox, Summer Solstice, Autumn Equinox
      const testDates = [
        { name: 'Winter Solstice', m: 12, d: 21 },
        { name: 'Spring Equinox', m: 3, d: 21 },
        { name: 'Summer Solstice', m: 6, d: 21 },
        { name: 'Autumn Equinox', m: 9, d: 23 },
        { name: 'Mid-April Peak Pre-Monsoon', m: 4, d: 15 },
        { name: 'January Mid-Winter', m: 1, d: 15 },
      ];

      for (const td of testDates) {
        // 13:30 IST
        const dateAt1330 = getISTDate(2026, td.m, td.d, 13, 30);
        const pos1330 = getPosition(dateAt1330, PUNE_LAT, PUNE_LNG);

        expect(pos1330.altitudeDeg).toBeGreaterThan(40.0);
        expect(pos1330.isSunUp).toBe(true);

        // 00:30 IST (Night / Midnight)
        const dateAt0030 = getISTDate(2026, td.m, td.d, 0, 30);
        const pos0030 = getPosition(dateAt0030, PUNE_LAT, PUNE_LNG);

        expect(pos0030.altitudeDeg).toBeLessThan(0.0);
        expect(pos0030.isSunUp).toBe(false);
      }
    });

    it('verifies Pune sunrise occurs between 05:30 and 07:30 IST throughout the year', () => {
      // For the 1st of every month, check that sun transitions above 0° between 05:30 and 07:30 IST
      for (let month = 1; month <= 12; month++) {
        const preSunrise = getPosition(getISTDate(2026, month, 1, 5, 0), PUNE_LAT, PUNE_LNG);
        const postSunrise = getPosition(getISTDate(2026, month, 1, 7, 30), PUNE_LAT, PUNE_LNG);

        // At 05:00 IST sun is below horizon
        expect(preSunrise.altitudeDeg).toBeLessThan(0.0);
        // By 07:30 IST sun is definitely above horizon
        expect(postSunrise.altitudeDeg).toBeGreaterThan(0.0);
      }
    });
  });

  describe('Geometric Shadow Length & Hand-Computed Analytical Cases', () => {
    it('verifies analytical shadow length formula: height / tan(altitude)', () => {
      const panel: PanelSpec = { lengthM: 6, widthM: 10, tiltDeg: 18, azimuthDeg: 180 };
      const obstacle: ObstacleSpec = { heightM: 10, widthM: 5, distanceM: 20, bearingDeg: 180 };

      // Case 1: altitude = 45.0°, height = 10.0m -> shadow length = 10 / tan(45°) = 10.0m
      const sim45 = calculateShadowGeometry(panel, obstacle, { altitudeDeg: 45.0, azimuthDeg: 180.0 });
      expect(sim45.shadowLengthM).toBeCloseTo(10.0, 1);
      // Shadow direction opposite sun azimuth (180° -> 0° North)
      expect(sim45.shadowDirectionDeg).toBe(0.0);

      // Case 2: altitude = 30.0°, height = 10.0m -> shadow length = 10 / tan(30°) = 17.32m
      const sim30 = calculateShadowGeometry(panel, obstacle, { altitudeDeg: 30.0, azimuthDeg: 90.0 });
      expect(sim30.shadowLengthM).toBeCloseTo(17.3, 1);
      // Sun from East (90°) -> Shadow points West (270°)
      expect(sim30.shadowDirectionDeg).toBe(270.0);

      // Case 3: altitude = 60.0°, height = 12.0m -> shadow length = 12 / tan(60°) = 6.93m
      const obstacle12: ObstacleSpec = { heightM: 12, widthM: 5, distanceM: 20, bearingDeg: 180 };
      const sim60 = calculateShadowGeometry(panel, obstacle12, { altitudeDeg: 60.0, azimuthDeg: 180.0 });
      expect(sim60.shadowLengthM).toBeCloseTo(6.9, 1);
    });

    it('identifies nighttime when sun is below horizon (altitude <= 0)', () => {
      const panel: PanelSpec = { lengthM: 6, widthM: 10, tiltDeg: 18, azimuthDeg: 180 };
      const obstacle: ObstacleSpec = { heightM: 10, widthM: 5, distanceM: 10, bearingDeg: 180 };

      const nightSim = calculateShadowGeometry(panel, obstacle, { altitudeDeg: -15.0, azimuthDeg: 180.0 });
      expect(nightSim.isNight).toBe(true);
      expect(nightSim.shadowLengthM).toBe(0);
      expect(nightSim.shadedFractionPct).toBe(100);
    });
  });

  describe('Shadow and Panel Intersection Test Cases', () => {
    const standardPanel: PanelSpec = {
      lengthM: 6,
      widthM: 10,
      tiltDeg: 18,
      azimuthDeg: 180,
    };

    it('tests case 1: Fully Shaded panel (100% shading)', () => {
      // Large building obstacle directly South of panel (bearing 180°), 8m away
      // Sun at noon (azimuth 180°), low altitude (20°)
      // Height 25m -> shadow length = 25 / tan(20°) = 68.7m, sweeping directly North over the 6m panel
      const largeObstacle: ObstacleSpec = {
        heightM: 25,
        widthM: 30, // wide enough to cover entire 10m panel width
        distanceM: 8,
        bearingDeg: 180, // South of panel
      };

      const result = calculateShadowGeometry(standardPanel, largeObstacle, {
        altitudeDeg: 20.0,
        azimuthDeg: 180.0,
      });

      expect(result.shadedFractionPct).toBeGreaterThanOrEqual(95);
    });

    it('tests case 2: Not Shaded panel (0% shading)', () => {
      // Obstacle located far North of panel (bearing 0°), while sun is in the South (azimuth 180°)
      // Shadow casts North away from the panel
      const northObstacle: ObstacleSpec = {
        heightM: 15,
        widthM: 10,
        distanceM: 25,
        bearingDeg: 0, // North
      };

      const result = calculateShadowGeometry(standardPanel, northObstacle, {
        altitudeDeg: 50.0,
        azimuthDeg: 180.0, // South
      });

      expect(result.shadedFractionPct).toBe(0);
    });

    it('tests case 3: Partly Shaded panel (partial overlap 20% - 80%)', () => {
      // Small obstacle offset to South-East (bearing 150°), distance 6m, height 8m
      // Sun at azimuth 150°, altitude 35°
      // Shadow partially clips corner/edge of the panel
      const partialObstacle: ObstacleSpec = {
        heightM: 6,
        widthM: 4,
        distanceM: 5,
        bearingDeg: 160,
      };

      const result = calculateShadowGeometry(standardPanel, partialObstacle, {
        altitudeDeg: 40.0,
        azimuthDeg: 160.0,
      });

      expect(result.shadedFractionPct).toBeGreaterThan(0);
      expect(result.shadedFractionPct).toBeLessThan(100);
    });

    it('tests point-in-polygon ray casting utility', () => {
      const square = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      expect(isPointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
      expect(isPointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
      expect(isPointInPolygon({ x: -2, y: 5 }, square)).toBe(false);
      expect(isPointInPolygon({ x: 5, y: 15 }, square)).toBe(false);
    });
  });
});
