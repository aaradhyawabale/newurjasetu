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
  generateLocalCopilotResponse,
  movePointGeodesic,
  extractSpatialAdjustmentFromIntent,
  CopilotAdjustment,
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

  it("accepts model severity variants like warning and suboptimal gracefully", () => {
    const withVariants = {
      ...validMockInsights,
      constraints: [
        {
          title: "Road Access Buffer",
          description: "Minor encroachment on road buffer",
          severity: "warning" as any,
          provenance: "AI_INTERPRETATION" as const,
          sourceReference: "buffer:road",
        },
        {
          title: "Suboptimal Orientation",
          description: "Orientation requires minor panel azimuth adjustment",
          severity: "suboptimal" as any,
          provenance: "AI_INTERPRETATION" as const,
          sourceReference: "solar:orientation",
        },
      ],
    };
    const result = AiPlanningInsightsSchema.safeParse(withVariants);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.constraints[0].severity).toBe("MODERATE");
      expect(result.data.constraints[1].severity).toBe("HIGH");
    }
  });

  it("accepts assumptionsAndLimitations as objects and flattens to strings", () => {
    const withObjects = {
      ...validMockInsights,
      assumptionsAndLimitations: [
        { assumption: "Soil test required", limitation: "Subsurface data unavailable" } as any,
        { text: "Assumes standard municipal road access" } as any,
      ],
    };
    const result = AiPlanningInsightsSchema.safeParse(withObjects);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.assumptionsAndLimitations[0]).toBe("string");
      expect(typeof result.data.assumptionsAndLimitations[1]).toBe("string");
      expect(result.data.assumptionsAndLimitations[0]).toContain("Soil test required");
      expect(result.data.assumptionsAndLimitations[1]).toContain("Assumes standard municipal road access");
    }
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

  it("generateLocalCopilotResponse provides accurate road collision advice without external API key", () => {
    const mockContext: CopilotChatContext = {
      studyArea: "Pune Central Study Area (PMC)",
      infrastructureType: "Hospital",
      validation: {
        status: "fail",
        conflicts: [
          {
            category: "road_collision",
            label: "Jangali Maharaj Road Carriageway",
            distanceM: 0,
            requiredBufferM: 10,
            severity: "critical",
            description: "Footprint intersects road carriageway surface.",
          },
        ],
        roadAccess: {
          requiresNewAccessRoad: false,
          distanceM: 0,
          nearestRoadName: "JM Road",
        },
      },
    };

    const result = generateLocalCopilotResponse("Check road collision", mockContext);
    expect(result.modelUsed).toBe("local-gis-rules-engine");
    expect(result.groundedFacts.hasRoadCollision).toBe(true);
    expect(result.reply).toContain("Encroachment Detected");
    expect(result.reply).toContain("Snap to Road & Open Land");
  });

  it("generateLocalCopilotResponse advises on access road requirements and statutory UDCPR rules", () => {
    const mockContext: CopilotChatContext = {
      studyArea: "Nashik Urban Study Area (NMC)",
      infrastructureType: "School",
      validation: {
        status: "warn",
        conflicts: [],
        roadAccess: {
          requiresNewAccessRoad: true,
          distanceM: 65,
          nearestRoadName: "Gangapur Road",
        },
        officialPlanningContext: {
          jurisdiction: "Nashik Municipal Corporation (NMC)",
          masterPlan: "NMC Development Plan (2016-2036)",
          statutoryRules: "Maharashtra UDCPR 2020",
        },
      },
    };

    const result = generateLocalCopilotResponse("What are the official rules?", mockContext);
    expect(result.reply).toContain("UDCPR 2020");
    expect(result.reply).toContain("Nashik Municipal Corporation");
  });

  it("generateLocalCopilotResponse evaluates solar farm setup, sizing, and yield properly", () => {
    const mockContext: CopilotChatContext = {
      studyArea: "Malegaon Siting Zone",
      infrastructureType: "Solar Farm",
      placement: {
        lat: 20.3506,
        lng: 74.3626,
        lengthM: 250,
        widthM: 200,
        areaM2: 50000,
      },
      validation: {
        status: "pass",
        conflicts: [],
        roadAccess: {
          requiresNewAccessRoad: false,
          distanceM: 0,
          nearestRoadName: "SH-17 State Highway",
        },
      },
    };

    const result = generateLocalCopilotResponse(
      "is the solar farm properly setup at the location",
      mockContext
    );
    expect(result.modelUsed).toBe("local-gis-rules-engine");
    expect(result.reply).toContain("Technical Siting & Feasibility Assessment: Solar Farm");
    expect(result.reply).toContain("50,000 m²");
    expect(result.reply).toContain("MWp");
    expect(result.reply).toContain("Optimal Fixed Tilt & Azimuth");
    expect(result.reply).toContain("Carriageway Buffer");
  });

  describe("Copilot Conversational Spatial Adjustments", () => {
    const basePlacement = {
      lat: 20.3506,
      lng: 74.3626,
      lengthM: 200,
      widthM: 100,
      bearingDeg: 0,
      areaM2: 20000,
    };

    it("movePointGeodesic moves points accurately along cardinal bearings", () => {
      // Move 111,139 meters north (~1 degree latitude)
      const movedNorth = movePointGeodesic(20.0, 74.0, 111139, 0);
      expect(movedNorth.lat).toBeCloseTo(21.0, 1);
      expect(movedNorth.lng).toBeCloseTo(74.0, 3);

      // Move east
      const movedEast = movePointGeodesic(20.0, 74.0, 50, 90);
      expect(movedEast.lat).toBeCloseTo(20.0, 3);
      expect(movedEast.lng).toBeGreaterThan(74.0);
    });

    it("extractSpatialAdjustmentFromIntent parses directional move commands", () => {
      const adj1 = extractSpatialAdjustmentFromIntent("move 50m north", basePlacement);
      expect(adj1).not.toBeNull();
      expect(adj1?.actionType).toBe("move");
      expect(adj1?.lat).toBeGreaterThan(basePlacement.lat);
      expect(adj1?.lng).toBeCloseTo(basePlacement.lng, 4);
      expect(adj1?.summary).toContain("Move 50m North");
      expect(adj1?.autoApply).toBe(true);

      const adj2 = extractSpatialAdjustmentFromIntent("shift 30 meters south", basePlacement);
      expect(adj2).not.toBeNull();
      expect(adj2?.lat).toBeLessThan(basePlacement.lat);
      expect(adj2?.summary).toContain("Move 30m South");

      const adj3 = extractSpatialAdjustmentFromIntent("move east 100m", basePlacement);
      expect(adj3).not.toBeNull();
      expect(adj3?.lng).toBeGreaterThan(basePlacement.lng);
      expect(adj3?.summary).toContain("Move 100m East");
    });

    it("extractSpatialAdjustmentFromIntent parses rotation commands", () => {
      const rot1 = extractSpatialAdjustmentFromIntent("rotate 90 degrees", basePlacement);
      expect(rot1).not.toBeNull();
      expect(rot1?.actionType).toBe("rotate");
      expect(rot1?.bearingDeg).toBe(90);
      expect(rot1?.summary).toContain("Rotate by 90° CW");

      const rot2 = extractSpatialAdjustmentFromIntent("turn 45 deg counterclockwise", {
        ...basePlacement,
        bearingDeg: 90,
      });
      expect(rot2).not.toBeNull();
      expect(rot2?.bearingDeg).toBe(45);

      const rot3 = extractSpatialAdjustmentFromIntent("set bearing to 180", basePlacement);
      expect(rot3).not.toBeNull();
      expect(rot3?.bearingDeg).toBe(180);
      expect(rot3?.summary).toContain("Set orientation to 180°");
    });

    it("extractSpatialAdjustmentFromIntent parses dimensional resize commands", () => {
      const size1 = extractSpatialAdjustmentFromIntent("increase length to 300m", basePlacement);
      expect(size1).not.toBeNull();
      expect(size1?.actionType).toBe("resize");
      expect(size1?.lengthM).toBe(300);

      const size2 = extractSpatialAdjustmentFromIntent("set width to 60m", basePlacement);
      expect(size2).not.toBeNull();
      expect(size2?.widthM).toBe(60);

      const size3 = extractSpatialAdjustmentFromIntent("make size 250m by 120m", basePlacement);
      expect(size3).not.toBeNull();
      expect(size3?.lengthM).toBe(250);
      expect(size3?.widthM).toBe(120);

      const size4 = extractSpatialAdjustmentFromIntent("expand size by 25%", basePlacement);
      expect(size4).not.toBeNull();
      expect(size4?.lengthM).toBe(250); // 200 * 1.25
      expect(size4?.widthM).toBe(125); // 100 * 1.25

      const size5 = extractSpatialAdjustmentFromIntent("shrink footprint by 20%", basePlacement);
      expect(size5).not.toBeNull();
      expect(size5?.lengthM).toBe(160); // 200 * 0.8
      expect(size5?.widthM).toBe(80); // 100 * 0.8
    });

    it("extractSpatialAdjustmentFromIntent parses snap to road and bridge crossing commands", () => {
      const roadAdj = extractSpatialAdjustmentFromIntent("align to the road corridor", basePlacement);
      expect(roadAdj).not.toBeNull();
      expect(roadAdj?.actionType).toBe("snap_to_road");
      expect(roadAdj?.summary).toContain("Align footprint tangent to road corridor");

      const overlapAdj = extractSpatialAdjustmentFromIntent("fix road collision", basePlacement);
      expect(overlapAdj).not.toBeNull();
      expect(overlapAdj?.actionType).toBe("snap_to_road");

      const bridgeAdj = extractSpatialAdjustmentFromIntent("relocate bridge to river crossing", basePlacement);
      expect(bridgeAdj).not.toBeNull();
      expect(bridgeAdj?.actionType).toBe("relocate_to_crossing");
      expect(bridgeAdj?.summary).toContain("Relocate bridge span");
    });

    it("generateLocalCopilotResponse returns proposedAdjustment with full civil engineering summary", () => {
      const mockContext: CopilotChatContext = {
        studyArea: "Pune Central",
        infrastructureType: "Hospital",
        placement: basePlacement,
      };

      const result = generateLocalCopilotResponse("move 40m north and rotate 90 degrees", mockContext);
      expect(result.modelUsed).toBe("local-gis-rules-engine");
      expect(result.proposedAdjustment).toBeDefined();
      expect(result.proposedAdjustment?.lat).toBeGreaterThan(basePlacement.lat);
      expect(result.proposedAdjustment?.bearingDeg).toBe(90);
      expect(result.reply).toContain("Infrastructure Spatial Adjustment Executed");
      expect(result.reply).toContain("Site Coordinates");
      expect(result.reply).toContain("Orientation / Bearing");
    });
  });
});

