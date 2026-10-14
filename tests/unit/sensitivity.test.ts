import { describe, it, expect } from "vitest";
import {
  INFRASTRUCTURE_WEIGHT_PROFILES,
  validateCriterionWeights,
} from "@/server/analysis-engine/weight-profiles";
import { calculateSensitivityAnalysis } from "@/server/analysis-engine/sensitivity";
import { CriterionResult } from "@/server/analysis-engine/engine";
import { INFRASTRUCTURE_TYPES, InfrastructureTypeId } from "@/config/infra-types";

describe("MCDA Weight Profiles, Sensitivity Analysis & Constraint Enforcement", () => {
  const allTypes = Object.keys(INFRASTRUCTURE_TYPES) as InfrastructureTypeId[];

  it("defines at least 3 distinct weight profiles summing to 1.0 for every infrastructure type", () => {
    const errors: string[] = [];
    for (const infraType of allTypes) {
      const profiles = INFRASTRUCTURE_WEIGHT_PROFILES[infraType];
      expect(profiles).toBeDefined();
      expect(profiles.length).toBeGreaterThanOrEqual(3);

      const cfg = INFRASTRUCTURE_TYPES[infraType];
      const configuredCriterionIds = cfg.criteria.map((c) => c.id);

      for (const prof of profiles) {
        expect(prof.id).toBeDefined();
        expect(prof.name).toBeDefined();
        expect(prof.rationale).toBeDefined();

        const validation = validateCriterionWeights(infraType, prof.weights, configuredCriterionIds);
        if (!validation.valid) {
          errors.push(`[${infraType}] [${prof.id}]: ${validation.reason}`);
        } else {
          const sum = Object.values(validation.normalizedWeights).reduce((a, b) => a + b, 0);
          expect(Math.abs(sum - 1.0)).toBeLessThanOrEqual(0.01);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it("rejects invalid or negative weights and handles normalization safely", () => {
    const criterionIds = ["arterial_access", "healthcare_gap", "residential_catchment"];

    // Negative weight
    const negRes = validateCriterionWeights("Hospital", {
      arterial_access: -0.5,
      healthcare_gap: 0.5,
      residential_catchment: 0.5,
    }, criterionIds);
    expect(negRes.valid).toBe(false);

    // Sum to zero
    const zeroRes = validateCriterionWeights("Hospital", {
      arterial_access: 0,
      healthcare_gap: 0,
      residential_catchment: 0,
    }, criterionIds);
    expect(zeroRes.valid).toBe(false);

    // Valid raw weights that sum to 10 (auto-normalized to 1.0)
    const normRes = validateCriterionWeights("Hospital", {
      arterial_access: 5,
      healthcare_gap: 3,
      residential_catchment: 2,
    }, criterionIds);
    expect(normRes.valid).toBe(true);
    expect(normRes.normalizedWeights["arterial_access"]).toBe(0.5);
    expect(normRes.normalizedWeights["healthcare_gap"]).toBe(0.3);
    expect(normRes.normalizedWeights["residential_catchment"]).toBe(0.2);
  });

  it("strictly enforces mandatory constraint penalty: critical conflict caps ALL profile scores to <= 24", () => {
    const mockCriteria: CriterionResult[] = [
      {
        id: "arterial_access",
        label: "Arterial Road Proximity",
        value: "40 m",
        rawMetric: 40,
        score: 100, // Perfect score!
        weight: 0.5,
        status: "optimal",
        benchmark: "< 400m",
        evidenceIds: ["evd_osm"],
        description: "Arterial access",
        computed: true,
      },
      {
        id: "healthcare_gap",
        label: "Healthcare Service Gap",
        value: "0 nearby",
        rawMetric: 0,
        score: 98, // Near perfect score!
        weight: 0.5,
        status: "optimal",
        benchmark: "Gap indicator",
        evidenceIds: ["evd_osm"],
        description: "Gap indicator",
        computed: true,
      },
    ];

    // Under PASS status -> high overall score (~99)
    const passResult = calculateSensitivityAnalysis({
      type: "Hospital",
      criteria: mockCriteria,
      validationStatus: "pass",
    });
    expect(passResult.baselineScore).toBeGreaterThanOrEqual(95);
    expect(passResult.mandatoryConstraintActive).toBe(false);

    // Under FAIL status (e.g. prohibited building overlap or waterway collision)
    // Mandatory constraint MUST cap baseline and ALL sensitivity profile scores to <= 24
    const failResult = calculateSensitivityAnalysis({
      type: "Hospital",
      criteria: mockCriteria,
      validationStatus: "fail",
    });

    expect(failResult.mandatoryConstraintActive).toBe(true);
    expect(failResult.baselineScore).toBeLessThanOrEqual(24);
    expect(failResult.baselineBand).toBe("Unsuitable");
    expect(failResult.constraintPenaltyNote).toContain("critical spatial conflict");

    for (const prof of failResult.profiles) {
      expect(prof.score).toBeLessThanOrEqual(24);
      expect(prof.band).toBe("Unsuitable");
    }
  });

  it("produces deterministic and reproducible sensitivity results for identical inputs", () => {
    const mockCriteria: CriterionResult[] = [
      {
        id: "solar_irradiance",
        label: "Solar Irradiance",
        value: "5.4 kWh/m2/day",
        rawMetric: 5.4,
        score: 100,
        weight: 0.30,
        status: "optimal",
        benchmark: "GHI",
        evidenceIds: ["evd_solar"],
        description: "Solar GHI",
        computed: true,
      },
      {
        id: "grid_substation_proximity",
        label: "Grid Substation Proximity",
        value: "350 m",
        rawMetric: 350,
        score: 95,
        weight: 0.25,
        status: "optimal",
        benchmark: "< 800m",
        evidenceIds: ["evd_osm"],
        description: "Substation distance",
        computed: true,
      },
      {
        id: "shading_obstruction_proxy",
        label: "Solar Horizon Shading",
        value: "Setback 400m",
        rawMetric: 400,
        score: 94,
        weight: 0.20,
        status: "optimal",
        benchmark: "Clear horizon",
        evidenceIds: ["evd_osm"],
        description: "Horizon proxy",
        computed: true,
      },
      {
        id: "terrain_slope",
        label: "Terrain Slope & Stability",
        value: "2.1%",
        rawMetric: 2.1,
        score: 98,
        weight: 0.15,
        status: "optimal",
        benchmark: "< 5%",
        evidenceIds: ["evd_elevation"],
        description: "Slope",
        computed: true,
      },
      {
        id: "road_maintenance_access",
        label: "Road Maintenance Access",
        value: "80 m",
        rawMetric: 80,
        score: 88,
        weight: 0.10,
        status: "optimal",
        benchmark: "< 150m",
        evidenceIds: ["evd_osm"],
        description: "Road access",
        computed: true,
      },
    ];

    const run1 = calculateSensitivityAnalysis({
      type: "Solar Farm",
      criteria: mockCriteria,
      validationStatus: "pass",
    });

    const run2 = calculateSensitivityAnalysis({
      type: "Solar Farm",
      criteria: mockCriteria,
      validationStatus: "pass",
    });

    expect(run1).toEqual(run2);
    expect(run1.rankStability).toBe("stable");
    expect(run1.profiles.length).toBe(3);
  });
});
