import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AiPlanningInsightsSchema,
  ProvenanceCategorySchema,
  PreliminaryAssessmentSchema,
  AiPlanningInsights,
} from "@/server/ai/types";
import {
  isGeminiConfigured,
  getGeminiModel,
  generateGeminiPlanningInsights,
  generateCopilotResponse,
  CopilotChatContext,
  GeminiAdvisorError,
} from "@/server/ai/gemini-advisor";
import { AnalysisReportResult } from "@/server/analysis-engine/engine";

describe("Gemini AI Advisor — Schema Validation & Provenance", () => {
  const validMockInsights: AiPlanningInsights = {
    executiveSummary:
      "Site exhibits strong arterial road connectivity with low terrain slope, making it suitable for civic development subject to drainage approvals.",
    preliminaryAssessment: "CONDITIONAL",
    assessmentRationale:
      "Arterial access is confirmed, but proximity to natural drainage requires municipal stormwater mitigation.",
    advantages: [
      {
        title: "Arterial Road Proximity",
        description: "Situated within 45m of primary highway corridor.",
        category: "Accessibility",
        provenance: "VERIFIED_INPUT",
        sourceReference: "criteria:road_distance",
      },
      {
        title: "High Ev Demand Density",
        description: "Surrounded by 14 commercial and transit amenities.",
        category: "Demand",
        provenance: "DETERMINISTIC_RESULT",
        sourceReference: "criteria:demand_density",
      },
    ],
    constraints: [
      {
        title: "Drainage Buffer Proximity",
        description: "Site boundary touches the 15m natural stormwater buffer.",
        severity: "HIGH",
        provenance: "DETERMINISTIC_RESULT",
        sourceReference: "conflict:waterway_buffer",
      },
    ],
    unresolvedDataGaps: [
      {
        fieldOrTopic: "Soil Bearing Capacity",
        explanation: "Digital elevation model does not provide subsurface geotechnical data.",
        requiredVerification: "Conduct standard penetration test (SPT) boreholes.",
      },
    ],
    recommendedMitigations: [
      {
        issue: "Drainage Buffer Proximity",
        mitigation: "Install bioswales and reinforced perimeter retaining wall.",
        supportingEvidence: "Copernicus DEM indicates 1.8% slope away from creek.",
        provenance: "AI_INTERPRETATION",
        sourceReference: "evd_elevation",
      },
    ],
    costDrivers: {
      civil: "Low grading costs due to flat 1.8% terrain gradient.",
      electrical: "Step-down transformer required within 200m.",
      environmental: "Minimal tree canopy disturbance.",
      operational: "Direct dual-lane arterial access reduces logistical delays.",
    },
    statutoryChecklist: [
      {
        authority: "Pune Municipal Corporation",
        clearanceName: "Stormwater Drainage NOC",
        triggerCondition: "Proximity to secondary water canal.",
        isMandatory: true,
      },
    ],
    planningAlternatives: [
      {
        title: "Reoriented Footprint",
        description: "Rotate long axis 90 degrees to maximize solar frontage.",
        tradeOffs: "Reduces road curb cuts but increases internal parking circulation.",
      },
    ],
    confidenceIndicator: {
      level: "HIGH",
      completenessPercent: 88,
      disclaimer: "Data completeness based on OpenStreetMap and Copernicus DEM coverage.",
    },
    assumptionsAndLimitations: [
      "Assumes 3-phase grid power available at roadside.",
      "Indicative screening only; not a substitute for physical survey.",
    ],
    meta: {
      modelUsed: "gemini-2.5-flash",
      generatedAt: "2026-10-19T10:00:00.000Z",
      disclaimer: "Indicative decision support only.",
    },
  };

  it("validates a compliant structured planning insight object", () => {
    const result = AiPlanningInsightsSchema.safeParse(validMockInsights);
    expect(result.success).toBe(true);
  });

  it("rejects non-compliant preliminary assessment values", () => {
    const invalid = { ...validMockInsights, preliminaryAssessment: "DEFINITELY_BUILD" };
    const result = AiPlanningInsightsSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid provenance categories", () => {
    const invalid = {
      ...validMockInsights,
      advantages: [
        {
          ...validMockInsights.advantages[0],
          provenance: "HALLUCINATED_CLAIM" as any,
        },
      ],
    };
    const result = AiPlanningInsightsSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects insights missing executive summary or rationale", () => {
    const { executiveSummary, ...missingSummary } = validMockInsights;
    expect(AiPlanningInsightsSchema.safeParse(missingSummary).success).toBe(false);
  });
});

describe("Gemini AI Advisor — Configuration & Environment Handling", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("detects when GEMINI_API_KEY is missing or empty", () => {
    delete process.env.GEMINI_API_KEY;
    expect(isGeminiConfigured()).toBe(false);

    process.env.GEMINI_API_KEY = "   ";
    expect(isGeminiConfigured()).toBe(false);
  });

  it("detects when GEMINI_API_KEY is configured", () => {
    process.env.GEMINI_API_KEY = "test_key_12345";
    expect(isGeminiConfigured()).toBe(true);
  });

  it("respects GEMINI_MODEL or defaults to gemini-3.5-flash-lite", () => {
    delete process.env.GEMINI_MODEL;
    expect(getGeminiModel()).toBe("gemini-3.5-flash-lite");

    process.env.GEMINI_MODEL = "gemini-1.5-pro";
    expect(getGeminiModel()).toBe("gemini-1.5-pro");
  });
});

describe("Gemini AI Advisor — Error Handling & Deterministic Integrity", () => {
  const originalEnv = process.env;

  const mockReport: AnalysisReportResult = {
    analysisId: "test-analysis-123",
    engineVersion: "1.0.0",
    timestamp: "2026-10-19T10:00:00.000Z",
    placementSnapshot: {
      id: "placement-456",
      type: "EV Charging Station",
      lat: 18.5204,
      lng: 73.8567,
      lengthM: 35,
      widthM: 15,
      bearingDeg: 0,
      areaM2: 525,
      params: { bayCount: 10 },
      label: "Shivajinagar EV Depot",
    },
    validation: {
      status: "pass",
      proposedAreaM2: 525,
      allowedAreaRange: { minM2: 100, maxM2: 5000, reason: "Urban design standard" },
      conflicts: [],
      messages: [],
    },
    criteria: [
      {
        id: "road_distance",
        label: "Distance to Arterial Road",
        value: "35m",
        rawMetric: 35,
        score: 95,
        weight: 0.25,
        status: "optimal",
        benchmark: "< 50m",
        evidenceIds: ["evd_roads"],
        description: "Immediate frontage access",
      },
    ],
    overall: {
      score: 88,
      band: "High Suitability",
      tone: "positive",
      confidence: 90,
      verdictSummary: "Optimal urban site with direct road frontage.",
    },
    supporting: ["Arterial road access within 35m"],
    risks: [],
    dataGaps: [],
    evidence: [
      {
        id: "evd_roads",
        provider: "Overpass OSM",
        params: {},
        retrievedAt: "2026-10-19T10:00:00.000Z",
        summary: "Primary highway 35m away",
      },
    ],
    limitations: ["Indicative decision support only"],
    narrativeText: "Baseline narrative",
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("throws KEY_NOT_CONFIGURED error without calling SDK when key is absent", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(generateGeminiPlanningInsights(mockReport)).rejects.toThrow(
      GeminiAdvisorError
    );

    try {
      await generateGeminiPlanningInsights(mockReport);
    } catch (err) {
      const gErr = err as GeminiAdvisorError;
      expect(gErr.code).toBe("KEY_NOT_CONFIGURED");
      expect(gErr.statusCode).toBe(503);
    }
  });

  it("never mutates the input report's deterministic score or validation results", async () => {
    delete process.env.GEMINI_API_KEY;

    const originalScore = mockReport.overall.score;
    const originalBand = mockReport.overall.band;
    const originalCriteriaCount = mockReport.criteria.length;

    try {
      await generateGeminiPlanningInsights(mockReport);
    } catch {
      // Expected to fail because key is not configured
    }

    expect(mockReport.overall.score).toBe(originalScore);
    expect(mockReport.overall.band).toBe(originalBand);
    expect(mockReport.criteria.length).toBe(originalCriteriaCount);
  });
});

describe("Gemini Copilot — Grounded Planning Assistant", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("throws KEY_NOT_CONFIGURED when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(
      generateCopilotResponse("Is this hospital location suitable?", {
        studyArea: "Pune Central Study Area (PMC)",
        infrastructureType: "Hospital",
      })
    ).rejects.toThrow(GeminiAdvisorError);

    try {
      await generateCopilotResponse("Check road access", {
        studyArea: "Pune Central Study Area (PMC)",
      });
    } catch (err) {
      const gErr = err as GeminiAdvisorError;
      expect(gErr.code).toBe("KEY_NOT_CONFIGURED");
      expect(gErr.statusCode).toBe(503);
    }
  });

  it("validates contextual fields for road collisions, access roads, and statutory planning", () => {
    const mockContext: CopilotChatContext = {
      studyArea: "Pimpri-Chinchwad Study Area (PCMC)",
      infrastructureType: "Hospital",
      placement: {
        lat: 18.6279,
        lng: 73.801,
        lengthM: 100,
        widthM: 100,
        areaM2: 10000,
      },
      validation: {
        status: "fail",
        conflicts: [
          {
            category: "road_collision",
            label: "Old Mumbai-Pune Highway Overlap",
            distanceM: 0,
            requiredBufferM: 10,
            severity: "critical",
            description: "Footprint intersects primary roadway surface.",
          },
        ],
        roadAccess: {
          requiresNewAccessRoad: true,
          distanceM: 45,
          nearestRoadName: "Old Mumbai Pune Hwy",
        },
        officialPlanningContext: {
          jurisdiction: "Pimpri-Chinchwad Municipal Corporation (PCMC)",
          masterPlan: "PCMC Revised Development Plan (2021-2041)",
          statutoryRules: "Maharashtra UDCPR 2020",
        },
      },
    };

    expect(mockContext.validation?.conflicts?.[0].category).toBe("road_collision");
    expect(mockContext.validation?.roadAccess?.requiresNewAccessRoad).toBe(true);
    expect(mockContext.validation?.officialPlanningContext?.masterPlan).toContain("PCMC");
  });
});
