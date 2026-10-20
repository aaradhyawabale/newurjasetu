import { GoogleGenAI } from "@google/genai";
import { AnalysisReportResult } from "../analysis-engine/engine";
import {
  AiPlanningInsights,
  AiPlanningInsightsSchema,
  PreliminaryAssessment,
} from "./types";

export type GeminiAdvisorErrorCode =
  | "KEY_NOT_CONFIGURED"
  | "RATE_LIMIT_EXCEEDED"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "SERVICE_ERROR";

export class GeminiAdvisorError extends Error {
  public readonly code: GeminiAdvisorErrorCode;
  public readonly statusCode: number;

  constructor(code: GeminiAdvisorErrorCode, message: string, statusCode = 500) {
    super(message);
    this.name = "GeminiAdvisorError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Checks whether the server environment has a configured Gemini API key.
 */
export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

/**
 * Returns the configured Gemini model identifier.
 * Defaults to 'gemini-3.5-flash-lite', configurable via GEMINI_MODEL.
 */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
}

/**
 * Prepares a concise, sanitized evidence grounding payload from the analysis report.
 * Strictly limits token size by extracting relevant structural metrics without redundant raw geometries.
 */
function extractGroundingContext(report: AnalysisReportResult) {
  const { placementSnapshot, validation, criteria, overall, supporting, risks, sensitivity } = report;

  return {
    infrastructure: {
      type: placementSnapshot.type,
      label: placementSnapshot.label,
      latitude: placementSnapshot.lat,
      longitude: placementSnapshot.lng,
      dimensionsMeters: `${placementSnapshot.lengthM}m x ${placementSnapshot.widthM}m`,
      footprintAreaM2: placementSnapshot.areaM2,
      bearingDeg: placementSnapshot.bearingDeg,
      parameters: placementSnapshot.params,
    },
    deterministicEvaluation: {
      overallScore: overall.score,
      suitabilityBand: overall.band,
      confidencePercent: overall.confidence,
      evidenceCompleteness: overall.evidenceCompleteness,
      verdictSummary: overall.verdictSummary,
    },
    hardConstraintsViolations: validation.conflicts.map((c) => ({
      feature: c.label,
      type: c.category,
      distanceMeters: c.distanceM,
      bufferThresholdMeters: c.requiredBufferM,
      severity: c.severity,
      description: c.description,
    })),
    criteriaBreakdown: criteria.map((c) => ({
      id: c.id,
      label: c.label,
      recordedValue: c.value,
      rawMetric: c.rawMetric,
      unit: c.unit,
      score: c.score,
      weightPercent: Math.round(c.weight * 100),
      status: c.status,
      benchmark: c.benchmark,
      uncertainty: c.uncertaintyClassification,
      evidenceIds: c.evidenceIds,
    })),
    deterministicSupportingIndicators: supporting,
    deterministicRisks: risks,
    sensitivityProfileStability: sensitivity
      ? {
          stability: sensitivity.rankStability,
          summary: sensitivity.sensitivitySummary,
          penaltyApplied: sensitivity.mandatoryConstraintActive,
        }
      : null,
    roadAccessAnalysis: validation.roadAccess
      ? {
          nearestRoadName: validation.roadAccess.nearestRoadName,
          nearestRoadClass: validation.roadAccess.nearestRoadClass,
          distanceMeters: validation.roadAccess.distanceM,
          requiresNewAccessRoad: validation.roadAccess.requiresNewAccessRoad,
          crossesObstacle: validation.roadAccess.crossesObstacle,
          obstacleDetails: validation.roadAccess.obstacleDetails || null,
          preliminaryNotice: validation.roadAccess.preliminaryNotice,
        }
      : null,
    officialPlanningContext: validation.planningContext
      ? {
          jurisdiction: validation.planningContext.jurisdiction,
          masterPlan: validation.planningContext.masterPlan,
          statutoryRules: validation.planningContext.statutoryRules,
          zoningStatus: validation.planningContext.zoningStatus,
          verifiedSources: validation.planningContext.verifiedSources,
          unverifiedAttributes: validation.planningContext.unverifiedAttributes,
          complianceDisclaimer: validation.planningContext.complianceDisclaimer,
        }
      : null,
  };
}

/**
 * Builds the rigorous system prompt enforcing UrjaSetu's data provenance and ethical standards.
 */
function buildSystemInstruction(): string {
  return `You are UrjaSetu's Senior Urban Planning AI Advisor. UrjaSetu is an explainable decision-support platform for municipal civil engineers, town planners, and clean energy developers in India (specialized in Maharashtra urban areas like Pune, PCMC, and Nashik).

YOUR MISSION:
Synthesize the provided deterministic spatial analysis into high-trust, actionable urban planning insights, strategic trade-offs, and risk mitigations for executive decision-makers.

MANDATORY DATA PROVENANCE & FACTUALITY RULES:
1. NEVER fabricate datasets, exact coordinates, unvalidated site shifts, fictional government schemes, or fake engineering numbers.
2. Every item in advantages, constraints, and recommendedMitigations MUST specify one of the following exact provenance classifications:
   - VERIFIED_INPUT: Sourced directly from user parameters or verified site coordinates.
   - DETERMINISTIC_RESULT: Computed directly by UrjaSetu's GIS, Overpass, Open-Meteo, NASA POWER, or piecewise scoring engine.
   - AI_INTERPRETATION: Qualitative reasoning synthesized from the supplied evidence.
   - UNVERIFIED_ASSUMPTION: A planning hypothesis or field condition that requires statutory or physical verification.
3. Every advantage, constraint, and mitigation MUST include a specific "sourceReference" identifying the supporting evidence (e.g., "evd_roads", "evd_elevation", "criteria:road_distance", "conflict:railway_buffer", "road_access", "official_dp").
4. PRELIMINARY ASSESSMENT MAPPING:
   - "FAVORABLE": Score >= 80, zero hard constraint violations, high data completeness.
   - "CONDITIONAL": Score 65-79, or moderate slope/utility constraints that can be resolved with standard engineering.
   - "REQUIRES_FURTHER_REVIEW": Significant data gaps, sensitive rank stability, or proximity to environmental/rail buffers.
   - "UNFAVORABLE": Score < 50, or confirmed hard constraint violation (e.g., building inside active street, railway, or river buffer).
5. DO NOT alter or contradict the deterministic numerical site score. You explain it and contextualize it, but never override it.
6. ROAD ACCESS GROUNDING: When roadAccessAnalysis is provided, you must explicitly evaluate vehicular accessibility. If requiresNewAccessRoad is true, state the required alignment length (~X m) and identify any obstacle (waterway, building, railway) crossed.
7. STATUTORY REALISM: Reference the specific official planning context provided in officialPlanningContext (e.g., Pune Municipal Corporation (PMC) DP 2007-2027, PCMC Development Plan, NMC Development Plan, and Maharashtra UDCPR 2020). Transparently disclose that cadastral land ownership (7/12 extract) and official zoning are unverified until town planning records are inspected.
8. DECISION SUPPORT NOTICE: Emphasize that your output is indicative decision support, not a statutory NOC or engineering certification.`;
}

/**
 * Lightweight JSON repair for common model output issues.
 * Fixes: trailing commas, JS-style comments, markdown code fences,
 * and unquoted property names.
 */
function repairJson(text: string): string {
  let s = text.trim();

  // Strip markdown code fences if wrapping the JSON
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  // Remove single-line comments (// ...)
  s = s.replace(/\/\/[^\n]*/g, "");

  // Remove multi-line comments (/* ... */)
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");

  // Fix trailing commas before } or ]
  s = s.replace(/,\s*([\]}])/g, "$1");

  // Quote unquoted property names: { key: "value" } -> { "key": "value" }
  s = s.replace(/(?<=[\{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '"$1":');

  return s;
}

/**
 * Normalizes variant field names and structural quirks from lighter Gemini models
 * to match the expected Zod schema.
 *
 * gemini-3.5-flash-lite has two common divergences:
 * 1. Key remapping: Uses "name" instead of "title", "gap" instead of "fieldOrTopic", etc.
 * 2. Structural simplification: Returns flat strings where the schema expects objects
 *    (e.g., unresolvedDataGaps as string[] instead of AiDataGap[]).
 *
 * This layer handles both cases without relaxing the schema itself.
 */
function normalizeGeminiResponse(raw: unknown, modelName: string): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const obj = raw as Record<string, any>;

  // Helper: remap keys in an object, preferring the canonical key if present
  const remap = (item: Record<string, any>, mappings: Record<string, string[]>): Record<string, any> => {
    const result = { ...item };
    for (const [canonical, variants] of Object.entries(mappings)) {
      if (result[canonical] === undefined) {
        for (const v of variants) {
          if (result[v] !== undefined) {
            result[canonical] = result[v];
            delete result[v];
            break;
          }
        }
      }
    }
    return result;
  };

  // Helper: ensure a field has a default value if missing
  const ensureField = (item: Record<string, any>, field: string, defaultValue: any): void => {
    if (item[field] === undefined || item[field] === null) {
      item[field] = defaultValue;
    }
  };

  // Normalize advantages array (handle string items or objects with missing fields)
  if (Array.isArray(obj.advantages)) {
    obj.advantages = obj.advantages.map((a: any) => {
      if (typeof a === "string") {
        return {
          title: a,
          description: a,
          category: "General",
          provenance: "AI_INTERPRETATION" as const,
          sourceReference: "ai_synthesis",
        };
      }
      if (typeof a === "object" && a !== null) {
        const remapped = remap(a, {
          title: ["name", "heading", "label", "advantage"],
          description: ["detail", "details", "explanation", "summary"],
          category: ["type", "domain", "area"],
          provenance: ["provenanceCategory", "source_type", "dataProvenance"],
          sourceReference: ["source", "sourceRef", "evidenceSource", "reference", "evidence"],
        });
        ensureField(remapped, "title", remapped.description || "Site Advantage");
        ensureField(remapped, "description", remapped.title || "Identified advantage");
        ensureField(remapped, "category", "General");
        ensureField(remapped, "provenance", "AI_INTERPRETATION");
        ensureField(remapped, "sourceReference", "ai_synthesis");
        return remapped;
      }
      return a;
    });
  }

  // Normalize constraints array
  if (Array.isArray(obj.constraints)) {
    obj.constraints = obj.constraints.map((c: any) => {
      if (typeof c === "string") {
        return {
          title: c,
          description: c,
          severity: "MODERATE" as const,
          provenance: "AI_INTERPRETATION" as const,
          sourceReference: "ai_synthesis",
        };
      }
      if (typeof c === "object" && c !== null) {
        const remapped = remap(c, {
          title: ["name", "heading", "label", "constraint"],
          description: ["detail", "details", "explanation", "summary"],
          severity: ["level", "impact", "risk"],
          provenance: ["provenanceCategory", "source_type", "dataProvenance"],
          sourceReference: ["source", "sourceRef", "evidenceSource", "reference", "evidence"],
        });
        ensureField(remapped, "title", remapped.description || "Site Constraint");
        ensureField(remapped, "description", remapped.title || "Identified constraint");
        ensureField(remapped, "severity", "MODERATE");
        ensureField(remapped, "provenance", "AI_INTERPRETATION");
        ensureField(remapped, "sourceReference", "ai_synthesis");
        return remapped;
      }
      return c;
    });
  }

  // Normalize unresolvedDataGaps array (commonly returned as flat strings)
  if (Array.isArray(obj.unresolvedDataGaps)) {
    obj.unresolvedDataGaps = obj.unresolvedDataGaps.map((g: any) => {
      if (typeof g === "string") {
        return {
          fieldOrTopic: g,
          explanation: g,
          requiredVerification: "On-site verification or municipal data audit required",
        };
      }
      if (typeof g === "object" && g !== null) {
        const remapped = remap(g, {
          fieldOrTopic: ["field", "topic", "gap", "name", "title", "dataGap", "missingField"],
          explanation: ["detail", "details", "description", "reason", "why", "summary"],
          requiredVerification: ["verification", "action", "resolution", "verificationNeeded", "actionRequired", "requiredAction"],
        });
        ensureField(remapped, "fieldOrTopic", remapped.explanation || "Data gap identified");
        ensureField(remapped, "explanation", remapped.fieldOrTopic || "Details pending");
        ensureField(remapped, "requiredVerification", "On-site verification required");
        return remapped;
      }
      return g;
    });
  }

  // Normalize recommendedMitigations array
  if (Array.isArray(obj.recommendedMitigations)) {
    obj.recommendedMitigations = obj.recommendedMitigations.map((m: any) => {
      if (typeof m === "string") {
        return {
          issue: m,
          mitigation: m,
          supportingEvidence: "AI-synthesized recommendation",
          provenance: "AI_INTERPRETATION" as const,
          sourceReference: "ai_synthesis",
        };
      }
      if (typeof m === "object" && m !== null) {
        const remapped = remap(m, {
          issue: ["risk", "constraint", "problem", "name", "title", "concern"],
          mitigation: ["action", "recommendation", "solution", "measure", "description", "intervention"],
          supportingEvidence: ["evidence", "basis", "justification", "rationale"],
          provenance: ["provenanceCategory", "source_type", "dataProvenance"],
          sourceReference: ["source", "sourceRef", "evidenceSource", "reference"],
        });
        ensureField(remapped, "issue", remapped.mitigation || "Risk identified");
        ensureField(remapped, "mitigation", remapped.issue || "Mitigation pending");
        ensureField(remapped, "supportingEvidence", "AI-synthesized recommendation");
        ensureField(remapped, "provenance", "AI_INTERPRETATION");
        ensureField(remapped, "sourceReference", "ai_synthesis");
        return remapped;
      }
      return m;
    });
  }

  // Normalize statutoryChecklist array (commonly returned as flat strings)
  if (Array.isArray(obj.statutoryChecklist)) {
    obj.statutoryChecklist = obj.statutoryChecklist.map((s: any) => {
      if (typeof s === "string") {
        return {
          authority: "Relevant Municipal/State Authority",
          clearanceName: s,
          triggerCondition: "Triggered by site conditions as identified in analysis",
          isMandatory: true,
        };
      }
      if (typeof s === "object" && s !== null) {
        const remapped = remap(s, {
          authority: ["body", "governingBody", "issuingAuthority", "agency"],
          clearanceName: ["name", "clearance", "permit", "nocName", "title", "noc"],
          triggerCondition: ["trigger", "condition", "reason", "why", "triggerReason"],
          isMandatory: ["mandatory", "required", "isRequired", "compulsory"],
        });
        ensureField(remapped, "authority", "Relevant Authority");
        ensureField(remapped, "clearanceName", "Clearance Required");
        ensureField(remapped, "triggerCondition", "Triggered by site conditions");
        ensureField(remapped, "isMandatory", true);
        return remapped;
      }
      return s;
    });
  }

  // Normalize planningAlternatives array (commonly returned as flat strings)
  if (Array.isArray(obj.planningAlternatives)) {
    obj.planningAlternatives = obj.planningAlternatives.map((p: any) => {
      if (typeof p === "string") {
        return {
          title: p,
          description: p,
          tradeOffs: "Trade-off analysis pending detailed evaluation",
        };
      }
      if (typeof p === "object" && p !== null) {
        const remapped = remap(p, {
          title: ["name", "heading", "label", "alternative", "option"],
          description: ["detail", "details", "explanation", "summary"],
          tradeOffs: ["tradeoffs", "trade_offs", "pros_cons", "prosAndCons", "comparison"],
        });
        ensureField(remapped, "title", remapped.description || "Alternative Option");
        ensureField(remapped, "description", remapped.title || "Alternative configuration");
        ensureField(remapped, "tradeOffs", "Trade-off analysis pending detailed evaluation");
        return remapped;
      }
      return p;
    });
  }

  // Ensure meta block exists
  if (!obj.meta || typeof obj.meta !== "object") {
    obj.meta = {
      modelUsed: modelName,
      generatedAt: new Date().toISOString(),
      disclaimer: "Indicative decision support only. Not an official statutory approval.",
    };
  } else {
    const meta = obj.meta as Record<string, any>;
    if (!meta.modelUsed) meta.modelUsed = modelName;
    if (!meta.generatedAt) meta.generatedAt = new Date().toISOString();
    if (!meta.disclaimer) meta.disclaimer = "Indicative decision support only. Not an official statutory approval.";
  }

  return obj;
}

/**
 * Main service function to generate AI Planning Insights for an analysis report using Gemini API.
 */
export async function generateGeminiPlanningInsights(
  report: AnalysisReportResult
): Promise<AiPlanningInsights> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiAdvisorError(
      "KEY_NOT_CONFIGURED",
      "GEMINI_API_KEY is not set in the server environment. Please configure it in .env to enable AI insights.",
      503
    );
  }

  const modelName = getGeminiModel();
  const groundingData = extractGroundingContext(report);
  const systemInstruction = buildSystemInstruction();

  const userPrompt = `Perform a comprehensive urban planning and site feasibility assessment for the following infrastructure siting analysis:

GROUNDING EVIDENCE:
${JSON.stringify(groundingData, null, 2)}

Produce a structured JSON response matching the required schema with:
1. executiveSummary: High-level overview and synthesis of the site's feasibility.
2. preliminaryAssessment: One of FAVORABLE, CONDITIONAL, REQUIRES_FURTHER_REVIEW, UNFAVORABLE.
3. assessmentRationale: Clear explanation of why this preliminary band was assigned.
4. advantages: Evidence-backed site strengths with provenance tags and source references.
5. constraints: Detected physical, spatial, or regulatory constraints with severity levels.
6. unresolvedDataGaps: Missing attributes or unverified parameters requiring field surveys.
7. recommendedMitigations: Actionable, practical mitigations with supporting evidence.
8. costDrivers: Qualitative assessment across civil, electrical, environmental, and operational factors.
9. statutoryChecklist: Municipal and state NOCs triggered by the site conditions.
10. planningAlternatives: Realistic alternative configurations or layout trade-offs.
11. confidenceIndicator: Level (HIGH/MEDIUM/LOW), completeness percentage, and disclaimer.
12. assumptionsAndLimitations: List of boundary conditions and analytical assumptions.
13. meta: Model name, ISO timestamp, and decision support disclaimer.`;

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Request structured JSON response
    let response;
    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.2, // Low temperature for high factual consistency and adherence to evidence
        },
      });
    } catch (modelErr: any) {
      if (modelErr?.status === 404 && modelName !== "gemini-3.5-flash-lite") {
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash-lite",
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        });
      } else {
        throw modelErr;
      }
    }

    const rawText = response.text;
    if (!rawText || rawText.trim() === "") {
      throw new GeminiAdvisorError(
        "INVALID_RESPONSE",
        "Gemini returned an empty response.",
        502
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (parseErr) {
      // Attempt lightweight JSON repair for common lite model issues
      // (trailing commas, single-line comments, unquoted keys)
      try {
        const repaired = repairJson(rawText);
        parsedJson = JSON.parse(repaired);
      } catch (repairErr) {
        throw new GeminiAdvisorError(
          "INVALID_RESPONSE",
          `Failed to parse Gemini response as JSON: ${(parseErr as Error).message}`,
          502
        );
      }
    }

    // Normalize field names for lite models that may use variant keys
    parsedJson = normalizeGeminiResponse(parsedJson, modelName);

    // Validate with Zod schema
    const validation = AiPlanningInsightsSchema.safeParse(parsedJson);
    if (!validation.success) {
      // In case minor meta fields were omitted by the model, patch meta and retry
      if (typeof parsedJson === "object" && parsedJson !== null) {
        const candidate = parsedJson as Record<string, any>;
        if (!candidate.meta) {
          candidate.meta = {
            modelUsed: modelName,
            generatedAt: new Date().toISOString(),
            disclaimer:
              "Indicative decision support only. Not an official statutory approval.",
          };
        }
        const secondValidation = AiPlanningInsightsSchema.safeParse(candidate);
        if (secondValidation.success) {
          return secondValidation.data;
        }
      }

      const issues = validation.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new GeminiAdvisorError(
        "INVALID_RESPONSE",
        `Gemini response did not match the required schema: ${issues}`,
        502
      );
    }

    return validation.data;
  } catch (err: unknown) {
    if (err instanceof GeminiAdvisorError) {
      throw err;
    }

    const message = err instanceof Error ? err.message : String(err);

    // Detect rate limits / quota issues
    if (message.includes("429") || message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate limit")) {
      throw new GeminiAdvisorError(
        "RATE_LIMIT_EXCEEDED",
        "Gemini API rate limit or quota exceeded. Please retry in a few moments.",
        429
      );
    }

    // Detect timeouts
    if (message.toLowerCase().includes("timeout") || message.toLowerCase().includes("deadline")) {
      throw new GeminiAdvisorError(
        "TIMEOUT",
        "Gemini API request timed out. Please retry.",
        504
      );
    }

    throw new GeminiAdvisorError(
      "SERVICE_ERROR",
      `Gemini API invocation error: ${message}`,
      500
    );
  }
}

export interface CopilotChatContext {
  studyArea?: string;
  infrastructureType?: string;
  placement?: {
    lat: number;
    lng: number;
    lengthM: number;
    widthM: number;
    areaM2: number;
    bearingDeg?: number;
    label?: string;
    params?: Record<string, any>;
  };
  validation?: {
    status?: string;
    geometryValid?: boolean;
    conflicts?: Array<{
      category: string;
      label: string;
      distanceM?: number;
      requiredBufferM?: number;
      severity: string;
      description?: string;
    }>;
    roadAccess?: {
      connected?: boolean;
      distanceM?: number;
      nearestRoadName?: string;
      nearestRoadClass?: string;
      requiresNewAccessRoad?: boolean;
      crossesObstacle?: boolean;
      obstacleDetails?: string;
      preliminaryNotice?: string;
    };
    officialPlanningContext?: {
      jurisdiction?: string;
      masterPlan?: string;
      statutoryRules?: string;
      zoningStatus?: string;
      verifiedSources?: string[];
      unverifiedAttributes?: string[];
      complianceDisclaimer?: string;
    };
  };
  report?: {
    overallScore?: number;
    suitabilityBand?: string;
    verdictSummary?: string;
    supportingFactors?: string[];
    risks?: string[];
    dataGaps?: string[];
  };
}

export interface CopilotChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CopilotResponseResult {
  reply: string;
  modelUsed: string;
  groundedFacts: {
    city: string;
    infrastructureType: string;
    hasRoadCollision: boolean;
    roadAccessStatus: string;
    statutoryFramework: string;
  };
}

/**
 * Interactive Copilot conversational query grounded in active GIS evidence and statutory planning rules.
 */
export async function generateCopilotResponse(
  message: string,
  context?: CopilotChatContext,
  history?: CopilotChatMessage[]
): Promise<CopilotResponseResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new GeminiAdvisorError(
      "KEY_NOT_CONFIGURED",
      "Gemini API key is not configured on the server. Please add GEMINI_API_KEY to your .env file.",
      503
    );
  }

  const modelName = getGeminiModel();
  const ai = new GoogleGenAI({ apiKey });

  const city = context?.studyArea || "Pune Urban Study Area (PMC)";
  const infraType = context?.infrastructureType || "Civic Infrastructure";
  const hasRoadCollision =
    context?.validation?.conflicts?.some(
      (c) => c.category === "road_collision" || c.category === "major_road"
    ) || false;
  const roadAccessStatus = context?.validation?.roadAccess
    ? context.validation.roadAccess.requiresNewAccessRoad
      ? "PRELIMINARY_ACCESS_REQUIRED"
      : "DIRECT_CONNECTED"
    : "UNKNOWN";
  const statutoryFramework =
    context?.validation?.officialPlanningContext?.statutoryRules ||
    context?.validation?.officialPlanningContext?.masterPlan ||
    "Maharashtra Unified Development Control and Promotion Regulations (UDCPR 2020)";

  const systemInstruction = `You are UrjaSetu's AI Urban Planning Copilot and Statutory Geospatial Assistant.
You advise city planners, civil engineers, municipal officials, and citizens on infrastructure siting for Pune (PMC), Pimpri-Chinchwad (PCMC), and Nashik (NMC), Maharashtra.

STRICT GROUNDING & PLANNING PRINCIPLES:
1. Always ground your analysis strictly in the provided GIS coordinates, road collision findings, access road alignment, and statutory municipal framework.
2. NEVER fabricate non-existent roads, cadastral survey numbers, 7/12 land records, or municipal approvals.
3. Distinguish clearly between geometric clearance (e.g., "No road collision detected in available OSM network") and legal land ownership / statutory approval (which requires municipal DP reservation check, 7/12 extract verification from Mahabhulekh, and Maha-UDCPR 2020 building permission).
4. Road Collision / Overlap: If a road collision conflict is present, explain precisely which roadway category it collides with and advise setback or dimensional adjustment.
5. Road Access & Preliminary Access: If the facility is disconnected from the road network, explain the required access road length and note whether it crosses obstacles (e.g. waterways, existing structures). Clarify that preliminary access roads are conceptual planning corridors, not approved construction rights-of-way.
6. Statutory Planning: Refer accurately to the applicable authority (PMC, PCMC, or NMC) and the governing development plan (e.g. PMC DP 2007-2027, PCMC Revised DP, NMC DP 2016-2036) and Maharashtra UDCPR 2020.
7. Tone: Objective, authoritative, helpful, and accessible. Structure answers using markdown with clear headings, bullet points, and actionable next steps.`;

  const contextSummary = JSON.stringify(
    {
      studyArea: city,
      infrastructureType: infraType,
      proposedPlacement: context?.placement || null,
      geometricValidation: context?.validation
        ? {
            status: context.validation.status,
            geometryValid: context.validation.geometryValid,
            conflicts: context.validation.conflicts,
            roadAccess: context.validation.roadAccess,
            officialPlanningContext: context.validation.officialPlanningContext,
          }
        : null,
      evaluationReport: context?.report || null,
    },
    null,
    2
  );

  let prompt = `Current Verified Geospatial and Planning Context from UrjaSetu GIS Engine:\n\`\`\`json\n${contextSummary}\n\`\`\`\n\n`;

  if (history && history.length > 0) {
    const recentHistory = history.slice(-6);
    prompt += `Recent Conversation History:\n${recentHistory
      .map((h) => `${h.role === "user" ? "User" : "Copilot"}: ${h.content}`)
      .join("\n")}\n\n`;
  }

  prompt += `User Question: ${message}`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const reply = response.text || "No response received from model.";

    return {
      reply,
      modelUsed: modelName,
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
    };
  } catch (err: unknown) {
    if (err instanceof GeminiAdvisorError) {
      throw err;
    }

    const errMsg = err instanceof Error ? err.message : String(err);

    if (
      errMsg.includes("429") ||
      errMsg.toLowerCase().includes("quota") ||
      errMsg.toLowerCase().includes("rate limit")
    ) {
      throw new GeminiAdvisorError(
        "RATE_LIMIT_EXCEEDED",
        "Gemini API rate limit or quota exceeded. Please retry in a few moments.",
        429
      );
    }

    if (
      errMsg.toLowerCase().includes("timeout") ||
      errMsg.toLowerCase().includes("deadline")
    ) {
      throw new GeminiAdvisorError(
        "TIMEOUT",
        "Gemini API request timed out. Please retry.",
        504
      );
    }

    throw new GeminiAdvisorError(
      "SERVICE_ERROR",
      `Gemini Copilot API invocation error: ${errMsg}`,
      500
    );
  }
}
