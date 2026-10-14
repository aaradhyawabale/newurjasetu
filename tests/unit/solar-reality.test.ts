import { describe, it, expect } from "vitest";
import {
  calculateTiltTranspositionFactor,
  calculateTemperatureDerate,
  estimateSolarGeneration,
} from "@/server/solar/solar-reality";
import { SolarResult } from "@/server/providers/types";

describe("Solar Reality: Solar Generation & Feasibility Engine", () => {
  const dummySolarResource: SolarResult = {
    annualAverageGhiKwhM2Day: 5.35,
    monthlyGhiKwhM2Day: {
      JAN: 4.1,
      FEB: 4.9,
      MAR: 5.8,
      APR: 6.5,
      MAY: 6.8,
      JUN: 5.9,
      JUL: 4.8,
      AUG: 4.6,
      SEP: 5.2,
      OCT: 5.4,
      NOV: 4.5,
      DEC: 3.8,
    },
    annualMeanTempC: 25.0,
    monthlyMeanTempC: {
      JAN: 14.2,
      FEB: 17.5,
      MAR: 23.1,
      APR: 29.4,
      MAY: 33.2,
      JUN: 33.8,
      JUL: 31.0,
      AUG: 29.8,
      SEP: 28.5,
      OCT: 25.4,
      NOV: 19.8,
      DEC: 15.1,
    },
    retrievedAt: new Date().toISOString(),
    source: "NASA POWER Agroclimatology",
    license: "Public Domain",
  };

  describe("Liu-Jordan Tilt Transposition (STEP 3)", () => {
    it("returns 1.0 for flat horizontal panel (0° tilt)", () => {
      const factor = calculateTiltTranspositionFactor(28.6139, 0, 0); // Jan
      expect(factor).toBe(1.0);
    });

    it("boosts winter plane-of-array irradiance when tilted toward the equator", () => {
      // In January (monthIndex 0), sun is low in Northern sky (declination ~ -20°)
      // A 28° south-facing tilted panel captures significantly more sunlight than flat ground
      const factorJan = calculateTiltTranspositionFactor(28.6139, 28, 0); // Jan
      expect(factorJan).toBeGreaterThan(1.15);
      expect(factorJan).toBeLessThanOrEqual(1.45);
    });

    it("maintains physically bounded transposition factors across all months", () => {
      for (let m = 0; m < 12; m++) {
        const factor = calculateTiltTranspositionFactor(28.6139, 22, m);
        expect(factor).toBeGreaterThanOrEqual(0.65);
        expect(factor).toBeLessThanOrEqual(1.45);
      }
    });
  });

  describe("PV Cell Temperature Derating (STEP 3)", () => {
    it("calculates realistic cell operating temperature above ambient", () => {
      const ambient = 25.0; // 25°C ambient
      const res = calculateTemperatureDerate(ambient);

      // Cell temp should be ambient + ~23.4°C = ~48.4°C
      expect(res.cellTempC).toBeGreaterThan(45.0);
      expect(res.cellTempC).toBeLessThan(52.0);

      // Derate factor = 1 - 0.38% * (48.4 - 25) ≈ 0.911 (~8.9% loss)
      expect(res.tempDerateFactor).toBeLessThan(1.0);
      expect(res.tempDerateFactor).toBeGreaterThan(0.85);
      expect(res.lossPct).toBeGreaterThan(5.0);
    });

    it("predicts higher temperature losses in extreme summer conditions", () => {
      const summerRes = calculateTemperatureDerate(42.0); // 42°C summer heatwave
      const winterRes = calculateTemperatureDerate(15.0); // 15°C winter

      expect(summerRes.lossPct).toBeGreaterThan(winterRes.lossPct);
      expect(summerRes.tempDerateFactor).toBeLessThan(winterRes.tempDerateFactor);
    });
  });

  describe("Generation Estimation & Unit Consistency (STEP 4)", () => {
    it("rejects zero or negative installed capacity", () => {
      expect(() =>
        estimateSolarGeneration(
          { lat: 28.6139, lng: 77.209, capacityKwp: 0 },
          dummySolarResource
        )
      ).toThrowError("Invalid installed capacity");

      expect(() =>
        estimateSolarGeneration(
          { lat: 28.6139, lng: 77.209, capacityKwp: -500 },
          dummySolarResource
        )
      ).toThrowError("Invalid installed capacity");
    });

    it("guarantees mathematical unit consistency: monthly generation sums to annual total", () => {
      const input = {
        lat: 28.6139,
        lng: 77.209,
        capacityKwp: 1000, // 1 MWp = 1000 kWp
        panelTiltDeg: 22,
      };

      const result = estimateSolarGeneration(input, dummySolarResource);

      expect(result.installedCapacityKwp).toBe(1000);
      expect(result.installedCapacityMwp).toBe(1.0);

      // Sum of all 12 monthly kWh must match annualGenerationKwh exactly
      const monthlySum = result.monthlyBreakdown.reduce((acc, m) => acc + m.productionKwh, 0);
      expect(monthlySum).toBe(result.annualGenerationKwh);

      // MWh conversion consistency: annualGenerationMwh ≈ annualGenerationKwh / 1000
      expect(result.annualGenerationMwh).toBeCloseTo(result.annualGenerationKwh / 1000.0, 1);

      // Daily average consistency
      expect(result.dailyAverageKwh).toBeCloseTo(result.annualGenerationKwh / 365.0, 0);

      // Specific yield should be realistic for North India sunbelt (1400 - 1800 kWh/kWp/year)
      expect(result.specificYieldKwhPerKwp).toBeGreaterThanOrEqual(1350);
      expect(result.specificYieldKwhPerKwp).toBeLessThanOrEqual(1850);

      // Capacity Utilization Factor (CUF) should be in realistic 15% - 22% range
      expect(result.capacityUtilizationFactorPct).toBeGreaterThanOrEqual(15.0);
      expect(result.capacityUtilizationFactorPct).toBeLessThanOrEqual(22.0);

      // Net System Performance Ratio should be in realistic 72% - 84% range
      expect(result.systemPerformanceRatio).toBeGreaterThanOrEqual(0.72);
      expect(result.systemPerformanceRatio).toBeLessThanOrEqual(0.84);
    });

    it("falls back gracefully when monthly NASA arrays are missing", () => {
      const fallbackResource: SolarResult = {
        annualAverageGhiKwhM2Day: 5.2,
        annualMeanTempC: 24.0,
        retrievedAt: new Date().toISOString(),
        source: "NASA POWER Annual Fallback",
      };

      const result = estimateSolarGeneration(
        { lat: 28.6139, lng: 77.209, capacityKwp: 500 },
        fallbackResource
      );

      expect(result.monthlyBreakdown).toHaveLength(12);
      expect(result.annualGenerationKwh).toBeGreaterThan(0);
      expect(result.specificYieldKwhPerKwp).toBeGreaterThan(1300);
    });
  });

  describe("Shading & Loss Waterfall (STEP 3)", () => {
    it("correctly reduces energy generation when shading loss increases", () => {
      const baseInput = {
        lat: 28.6139,
        lng: 77.209,
        capacityKwp: 2000,
        panelTiltDeg: 22,
        shadingLossPct: 0.0, // Unshaded
      };

      const shadedInput = {
        ...baseInput,
        shadingLossPct: 8.0, // 8% shading from nearby towers
      };

      const baseResult = estimateSolarGeneration(baseInput, dummySolarResource);
      const shadedResult = estimateSolarGeneration(shadedInput, dummySolarResource);

      expect(shadedResult.annualGenerationKwh).toBeLessThan(baseResult.annualGenerationKwh);

      // Generation ratio should be approximately (1 - 0.08) = 0.92
      const ratio = shadedResult.annualGenerationKwh / baseResult.annualGenerationKwh;
      expect(ratio).toBeCloseTo(0.92, 2);
    });

    it("decomposes all loss factors without double-counting", () => {
      const result = estimateSolarGeneration(
        { lat: 28.6139, lng: 77.209, capacityKwp: 1000 },
        dummySolarResource
      );

      expect(result.lossWaterfall.length).toBeGreaterThanOrEqual(6);
      const lossIds = result.lossWaterfall.map((l) => l.id);
      expect(lossIds).toContain("temperature_loss");
      expect(lossIds).toContain("inverter_loss");
      expect(lossIds).toContain("dc_ac_wiring_loss");
      expect(lossIds).toContain("soiling_dust_loss");
      expect(lossIds).toContain("mismatch_tolerance_loss");
      expect(lossIds).toContain("shading_obstruction_loss");

      for (const item of result.lossWaterfall) {
        expect(item.lossPct).toBeGreaterThan(0);
        expect(item.derateFactor).toBeLessThan(1.0);
        expect(item.derateFactor).toBeGreaterThan(0.7);
        expect(item.explanation.length).toBeGreaterThan(10);
      }
    });
  });

  describe("Economic Feasibility & Sensitivity Analysis (STEP 5)", () => {
    it("calculates realistic Capex, Simple Payback, and 25-year LCOE", () => {
      const input = {
        lat: 28.6139,
        lng: 77.209,
        capacityKwp: 1000, // 1 MWp
        capexPerKwpInr: 42000, // ₹4.2 Cr / MWp
        tariffPerKwhInr: 6.50, // ₹6.50 / kWh
      };

      const result = estimateSolarGeneration(input, dummySolarResource);
      const econ = result.economics;

      // Capex total = 1000 * 42000 = ₹42,000,000 (₹4.2 Cr)
      expect(econ.capexTotalInr).toBe(42000000);

      // Annual revenue should be > ₹9,000,000 for 1 MWp in Delhi
      expect(econ.annualRevenueInr).toBeGreaterThan(9000000);

      // Simple payback period for commercial solar is typically 3.5 to 5.5 years
      expect(econ.simplePaybackYears).toBeGreaterThanOrEqual(3.0);
      expect(econ.simplePaybackYears).toBeLessThanOrEqual(6.0);

      // LCOE should be ₹2.0 to ₹3.5 / kWh for utility/C&I scale in India
      expect(econ.lcoeInrPerKwh).toBeGreaterThanOrEqual(1.8);
      expect(econ.lcoeInrPerKwh).toBeLessThanOrEqual(4.0);

      // 25-year net savings should be positive and substantial
      expect(econ.twentyFiveYearNetSavingsInr).toBeGreaterThan(100000000); // > ₹10 Cr

      // Sensitivity matrix has 5 distinct scenarios
      expect(econ.sensitivityMatrix).toHaveLength(5);
    });

    it("verifies directional consistency in sensitivity matrix", () => {
      const result = estimateSolarGeneration(
        { lat: 28.6139, lng: 77.209, capacityKwp: 1000 },
        dummySolarResource
      );

      const baseline = result.economics.sensitivityMatrix.find((s) => s.scenarioName.includes("Baseline"))!;
      const capexLow = result.economics.sensitivityMatrix.find((s) => s.scenarioName.includes("-15%"))!;
      const capexHigh = result.economics.sensitivityMatrix.find((s) => s.scenarioName.includes("+15%"))!;
      const tariffLow = result.economics.sensitivityMatrix.find((s) => s.scenarioName.includes("-20%"))!;
      const tariffHigh = result.economics.sensitivityMatrix.find((s) => s.scenarioName.includes("+20%"))!;

      // Lower Capex yields shorter payback
      expect(capexLow.simplePaybackYears).toBeLessThan(baseline.simplePaybackYears);
      // Higher Capex yields longer payback
      expect(capexHigh.simplePaybackYears).toBeGreaterThan(baseline.simplePaybackYears);
      // Lower tariff yields longer payback
      expect(tariffLow.simplePaybackYears).toBeGreaterThan(baseline.simplePaybackYears);
      // Higher tariff yields shorter payback
      expect(tariffHigh.simplePaybackYears).toBeLessThan(baseline.simplePaybackYears);
    });

    it("includes required non-guaranteed financial disclaimer", () => {
      const result = estimateSolarGeneration(
        { lat: 28.6139, lng: 77.209, capacityKwp: 500 },
        dummySolarResource
      );

      expect(result.economics.economicDisclaimer).toContain("pre-feasibility");
      expect(result.economics.economicDisclaimer).toContain("NOT constitute an underwriting financial guarantee");
      expect(result.modelLimitations.length).toBeGreaterThanOrEqual(4);
    });
  });
});
