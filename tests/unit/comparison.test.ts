import { describe, it, expect } from "vitest";
import { compareCandidates, buildCandidateSummary } from "@/server/scenarios/comparison";
import { CandidateSummary } from "@/server/scenarios/types";

describe("Scenario Simulator & Candidate Comparison Unit Tests", () => {
  const mockCandidateA: CandidateSummary = {
    placementId: "cand-a",
    scenarioId: "sc-1",
    scenarioName: "Scenario Alpha",
    type: "Hospital",
    label: "Candidate Site A (Connaught Place)",
    lat: 28.6315,
    lng: 77.2167,
    lengthM: 80,
    widthM: 60,
    bearingDeg: 0,
    footprintAreaM2: 4800,
    params: {},
    createdAt: "2026-10-10T10:00:00Z",
    overallScore: 88,
    scoreBand: "High Suitability",
    tone: "positive",
    confidence: 0.9,
    evidenceCompleteness: 0.95,
    hasMandatoryViolation: false,
    mandatoryViolationsCount: 0,
    criteria: [
      {
        id: "c_road_dist",
        label: "Arterial Road Proximity",
        value: "25 m",
        rawMetric: 25,
        unit: "m",
        score: 95,
        weight: 25,
        status: "optimal",
        benchmark: "Within 100m of primary or secondary road",
        evidenceIds: ["ev-1"],
        description: "Optimal proximity to major arterial network",
      },
      {
        id: "c_slope",
        label: "Terrain Slope",
        value: "1.2 %",
        rawMetric: 1.2,
        unit: "%",
        score: 90,
        weight: 15,
        status: "optimal",
        benchmark: "Slope <= 3%",
        evidenceIds: ["ev-2"],
        description: "Nearly flat terrain suitable for hospital foundation",
      },
      {
        id: "c_demand",
        label: "Local Service Gap",
        value: "High Need",
        rawMetric: 80,
        unit: "%",
        score: 85,
        weight: 20,
        status: "optimal",
        benchmark: "Elevated regional service deficit",
        evidenceIds: ["ev-3"],
        description: "High healthcare catchment demand",
      },
    ],
    constraints: [],
    dataSources: [
      { provider: "Overpass OSM", status: "ok" },
      { provider: "Open-Meteo", status: "ok" },
    ],
    evidence: [],
    impacts: {
      spatialFootprintM2: 4800,
      arterialDistanceM: 25,
      nearestAmenityDistanceM: 450,
      accessQuality: "Optimal",
      solarPotentialAnnualMwh: null,
      solarSpecificYieldKwhPerKwp: null,
      serviceCatchmentProxy: {
        bufferRadiusM: 500,
        nearbyAmenitiesCount: 4,
        proxyType: "Straight-line Euclidean catchment proxy (radius 500m)",
        limitations: "Measures straight-line geographic proximity only.",
      },
      environmentalExclusionCount: 0,
    },
  };

  const mockCandidateB: CandidateSummary = {
    placementId: "cand-b",
    scenarioId: "sc-1",
    scenarioName: "Scenario Alpha",
    type: "Hospital",
    label: "Candidate Site B (Outer Ring Road)",
    lat: 28.5500,
    lng: 77.2000,
    lengthM: 80,
    widthM: 60,
    bearingDeg: 0,
    footprintAreaM2: 4800,
    params: {},
    createdAt: "2026-10-10T10:00:00Z",
    overallScore: 68,
    scoreBand: "Moderate Suitability",
    tone: "moderate",
    confidence: 0.85,
    evidenceCompleteness: 0.88,
    hasMandatoryViolation: false,
    mandatoryViolationsCount: 0,
    criteria: [
      {
        id: "c_road_dist",
        label: "Arterial Road Proximity",
        value: "220 m",
        rawMetric: 220,
        unit: "m",
        score: 65,
        weight: 25,
        status: "acceptable",
        benchmark: "Within 100m of primary or secondary road",
        evidenceIds: ["ev-1"],
        description: "Moderate distance to arterial road",
      },
      {
        id: "c_slope",
        label: "Terrain Slope",
        value: "4.5 %",
        rawMetric: 4.5,
        unit: "%",
        score: 60,
        weight: 15,
        status: "acceptable",
        benchmark: "Slope <= 3%",
        evidenceIds: ["ev-2"],
        description: "Gentle slope requiring grading",
      },
      {
        id: "c_demand",
        label: "Local Service Gap",
        value: "Moderate Need",
        rawMetric: 60,
        unit: "%",
        score: 70,
        weight: 20,
        status: "acceptable",
        benchmark: "Elevated regional service deficit",
        evidenceIds: ["ev-3"],
        description: "Moderate healthcare catchment demand",
      },
    ],
    constraints: [],
    dataSources: [
      { provider: "Overpass OSM", status: "ok" },
      { provider: "Open-Meteo", status: "ok" },
    ],
    evidence: [],
    impacts: {
      spatialFootprintM2: 4800,
      arterialDistanceM: 220,
      nearestAmenityDistanceM: 950,
      accessQuality: "Acceptable",
      solarPotentialAnnualMwh: null,
      solarSpecificYieldKwhPerKwp: null,
      serviceCatchmentProxy: {
        bufferRadiusM: 500,
        nearbyAmenitiesCount: 1,
        proxyType: "Straight-line Euclidean catchment proxy (radius 500m)",
        limitations: "Measures straight-line geographic proximity only.",
      },
      environmentalExclusionCount: 0,
    },
  };

  it("correctly ranks candidates by overall suitability score when no mandatory violations exist", () => {
    const result = compareCandidates([mockCandidateB, mockCandidateA]);

    expect(result.ranking).toHaveLength(2);
    expect(result.ranking[0].rank).toBe(1);
    expect(result.ranking[0].placementId).toBe("cand-a");
    expect(result.ranking[0].overallScore).toBe(88);
    expect(result.ranking[1].rank).toBe(2);
    expect(result.ranking[1].placementId).toBe("cand-b");
    expect(result.ranking[1].overallScore).toBe(68);
    expect(result.ranking[0].rankingRationale).toContain("Highest-performing candidate");
  });

  it("penalizes candidate ranking when mandatory constraints are violated", () => {
    // Clone candidate A with a higher raw score (92), but add a mandatory critical violation
    const violatorCandidate: CandidateSummary = {
      ...mockCandidateA,
      placementId: "cand-violator",
      label: "Violator Site (Railway Buffer)",
      overallScore: 92,
      hasMandatoryViolation: true,
      mandatoryViolationsCount: 1,
      constraints: [
        {
          id: "viol-1",
          category: "railway",
          label: "Railway Track Conflict",
          severity: "critical",
          description: "Footprint intersects 30m statutory railway safety buffer",
        },
      ],
    };

    const result = compareCandidates([violatorCandidate, mockCandidateB]);

    // Even though violatorCandidate has 92 score, Candidate B (68 score) has 0 violations and must be Rank 1
    expect(result.ranking[0].placementId).toBe("cand-b");
    expect(result.ranking[0].rank).toBe(1);
    expect(result.ranking[1].placementId).toBe("cand-violator");
    expect(result.ranking[1].rank).toBe(2);
    expect(result.ranking[1].rankingRationale).toContain("mandatory constraint violation");
  });

  it("calculates criteria delta score and correctly assigns winning candidate per criterion", () => {
    const result = compareCandidates([mockCandidateA, mockCandidateB]);

    const roadCrit = result.criteriaMatrix.find((c) => c.criterionId === "c_road_dist");
    expect(roadCrit).toBeDefined();
    expect(roadCrit?.bestPlacementId).toBe("cand-a");
    expect(roadCrit?.worstPlacementId).toBe("cand-b");
    expect(roadCrit?.deltaScore).toBe(30); // 95 - 65 = 30 pts delta
    expect(roadCrit?.explanation).toContain("outperforms");
  });

  it("identifies cross-type comparisons and surfaces transparent advisory notice", () => {
    const solarCandidate: CandidateSummary = {
      ...mockCandidateB,
      placementId: "cand-solar",
      type: "Solar Farm",
      label: "Solar Plant Alpha",
    };

    const result = compareCandidates([mockCandidateA, solarCandidate]);

    expect(result.comparability.isCompatible).toBe(false);
    expect(result.comparability.mode).toBe("cross_type_advisory");
    expect(result.comparability.advisoryNotice).toContain("heterogeneous infrastructure types");
  });

  it("handles missing evidence and incomplete criteria gracefully", () => {
    const incompleteCandidate: CandidateSummary = {
      ...mockCandidateB,
      placementId: "cand-incomplete",
      criteria: [
        {
          id: "c_road_dist",
          label: "Arterial Road Proximity",
          value: "N/A",
          rawMetric: null,
          score: null,
          weight: 25,
          status: "unknown",
          benchmark: "Within 100m",
          evidenceIds: [],
          description: "Missing road data",
          missingReason: "Provider returned empty feature set",
        },
      ],
    };

    const result = compareCandidates([mockCandidateA, incompleteCandidate]);

    const roadDelta = result.criteriaMatrix.find((c) => c.criterionId === "c_road_dist");
    expect(roadDelta).toBeDefined();
    expect(roadDelta?.valuesByPlacement["cand-incomplete"].score).toBeNull();
    expect(roadDelta?.valuesByPlacement["cand-incomplete"].missingReason).toBe(
      "Provider returned empty feature set"
    );
  });

  it("calculates geodesic spatial separation distance between candidate coordinates", () => {
    const result = compareCandidates([mockCandidateA, mockCandidateB]);

    expect(result.spatialSeparation).toHaveLength(1);
    const pair = result.spatialSeparation[0];
    expect(pair.placementAId).toBe("cand-a");
    expect(pair.placementBId).toBe("cand-b");
    // Distance between Delhi Connaught Place (28.6315, 77.2167) and Outer Ring (28.5500, 77.2000) is ~9.2 km
    expect(pair.distanceMeters).toBeGreaterThan(8000);
    expect(pair.distanceMeters).toBeLessThan(11000);
  });

  it("preserves calculation consistency across identical inputs", () => {
    const run1 = compareCandidates([mockCandidateA, mockCandidateB]);
    const run2 = compareCandidates([mockCandidateA, mockCandidateB]);

    expect(run1.ranking).toEqual(run2.ranking);
    expect(run1.criteriaMatrix).toEqual(run2.criteriaMatrix);
    expect(run1.spatialSeparation).toEqual(run2.spatialSeparation);
  });

  it("explicitly includes straight-line catchment proxy disclaimer and does not claim population census counts", () => {
    const summary = buildCandidateSummary({
      placement: {
        id: "p-test",
        scenarioId: "sc-test",
        type: "Hospital",
        lat: 28.61,
        lng: 77.20,
        lengthM: 50,
        widthM: 50,
        bearingDeg: 0,
        createdAt: new Date(),
      },
      analysis: {
        id: "an-test",
        engineVersion: "1.0.0",
        overallScore: 80,
        scoreBand: "High Suitability",
        result: JSON.stringify({
          engineVersion: "1.0.0",
          timestamp: new Date().toISOString(),
          placementSnapshot: {
            id: "p-test",
            type: "Hospital",
            lat: 28.61,
            lng: 77.20,
            lengthM: 50,
            widthM: 50,
            bearingDeg: 0,
            areaM2: 2500,
            params: {},
          },
          validation: { status: "pass", proposedAreaM2: 2500, allowedAreaRange: { minM2: 0, maxM2: 10000, reason: "" }, conflicts: [], messages: [] },
          criteria: [],
          overall: { score: 80, band: "High Suitability", tone: "positive", confidence: 0.8, verdictSummary: "Test" },
          supporting: [],
          risks: [],
          dataGaps: [],
          evidence: [],
          limitations: [],
          narrativeText: "",
        }),
        createdAt: new Date(),
      },
      scenarioName: "Test Scenario",
    });

    expect(summary.impacts.serviceCatchmentProxy.limitations).toContain("straight-line geographic proximity only");
    expect(summary.impacts.serviceCatchmentProxy.limitations).toContain("Does not account for census population figures");
  });
});
