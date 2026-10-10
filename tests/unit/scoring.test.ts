import { describe, it, expect } from "vitest";
import {
  scoreDistanceToRoad,
  scoreSlopePercent,
  scoreDemandDensity,
  scoreGapNeed,
  scoreSolarGhi,
  scoreOsmDataCoverage,
  scoreManningHydraulicCapacity,
  determineSuitabilityBand,
} from "@/server/analysis-engine/scoring";

describe("Piecewise Scoring Functions & Thresholds", () => {
  it("scores road distance properly across piecewise bands", () => {
    expect(scoreDistanceToRoad(30).score).toBe(100);
    expect(scoreDistanceToRoad(120).score).toBe(88);
    expect(scoreDistanceToRoad(250).score).toBe(72);
    expect(scoreDistanceToRoad(500).score).toBe(50);
    expect(scoreDistanceToRoad(1000).score).toBe(30);
    expect(scoreDistanceToRoad(2000).score).toBe(12);
  });

  it("scores slope percentages correctly against design tolerances", () => {
    expect(scoreSlopePercent(1.5, 5).score).toBe(98);
    expect(scoreSlopePercent(4.5, 5).score).toBe(85);
    expect(scoreSlopePercent(7.0, 5).score).toBe(68);
    expect(scoreSlopePercent(10.0, 5).score).toBe(45);
    expect(scoreSlopePercent(25.0, 5).score).toBe(20);
  });

  it("calculates indicative Manning open channel hydraulic capacity", () => {
    // 1200 L/s design inflow, 3.5m width, 1.8m depth, 1.5% slope
    const score = scoreManningHydraulicCapacity(1200, 3.5, 1.8, 1.5);
    expect(score.score).toBeGreaterThanOrEqual(85);
    expect(score.status).toBe("optimal");

    // Undersized channel: 50,000 L/s inflow with narrow 1m channel on flat 0.1% slope
    const chokeScore = scoreManningHydraulicCapacity(50000, 1.0, 0.5, 0.1);
    expect(chokeScore.score).toBeLessThanOrEqual(35);
    expect(chokeScore.status).toBe("constrained");
  });

  it("maps score values to correct non-authoritative suitability bands", () => {
    expect(determineSuitabilityBand(88).band).toBe("High Suitability");
    expect(determineSuitabilityBand(70).band).toBe("Moderate Suitability");
    expect(determineSuitabilityBand(52).band).toBe("Low Suitability");
    expect(determineSuitabilityBand(32).band).toBe("Highly Constrained");
    expect(determineSuitabilityBand(15).band).toBe("Unsuitable");
  });
});
