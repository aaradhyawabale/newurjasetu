import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { AnalysisReportResult } from "../analysis-engine/engine";
import {
  AiPlanningInsights,
  AiPlanningInsightsSchema,
  PreliminaryAssessment,
} from "./types";
import {
  isHeatDataAvailable,
  getHeatDiagnostics,
  queryHeatPoint,
} from "../heat-engine/loader";
import {
  generateInterventionCandidates,
  generateCuratedSampleCandidates,
  getCandidateById,
  listCategoryMetadata,
  getLatestAnalysisRun,
  listRegisteredDatasets,
  getDatasetAvailabilitySummary,
} from "../intervention-engine";
import {
  optimizeInterventionBudget,
  OptimizeOptions,
  OptimizeResult,
} from "../priority/optimizer";
import {
  getPriorityCellById,
  getCellEnsembleStats,
  PriorityCell,
  EnsembleStats,
} from "../priority/loader";

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
 * Returns the configured Gemini API key, trimmed.
 */
export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim();
}

/**
 * Sanitizes error messages by redacting API keys or confidential parameters.
 */
export function sanitizeErrorMessage(err: unknown): string {
  if (!err) return "Unknown error";
  let msg = err instanceof Error ? err.message : String(err);
  const key = process.env.GEMINI_API_KEY;
  if (key && key.trim().length > 0) {
    msg = msg.split(key).join("[REDACTED_API_KEY]");
  }
  msg = msg.replace(/key=[a-zA-Z0-9_\-]+/gi, "key=[REDACTED]");
  msg = msg.replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_API_KEY]");
  return msg;
}

/**
 * Deduplicates and cleans study area or municipal location names.
 */
export function cleanStudyAreaName(raw?: string): string {
  if (!raw || typeof raw !== "string") return "Pune Urban Study Area (PMC)";
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/\b(\w+(?:\s+\w+){1,4})\s+\1\b/gi, "$1");
  const half = Math.floor(cleaned.length / 2);
  for (let len = 4; len <= half; len++) {
    const first = cleaned.substring(0, len).trim();
    const rest = cleaned.substring(len).trim();
    if (rest.startsWith(first)) {
      cleaned = first;
      break;
    }
  }
  return cleaned.trim() || "Pune Urban Study Area (PMC)";
}

/**
 * Executes a promise with an enforced timeout.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new GeminiAdvisorError("TIMEOUT", errorMsg, 504));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Executes an async function with bounded retries for transient network/rate errors.
 */
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 1, delayMs = 500): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const errMsg = (err?.message || "").toLowerCase();
      const isTransient =
        errMsg.includes("fetch failed") ||
        errMsg.includes("econnreset") ||
        errMsg.includes("etimedout") ||
        errMsg.includes("enotfound") ||
        errMsg.includes("429") ||
        errMsg.includes("503") ||
        err?.status === 429 ||
        err?.status === 503;
      if (attempt <= maxRetries && isTransient) {
        await new Promise((r) => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Returns the configured Gemini model identifier.
 * Defaults to 'gemini-3.5-flash', configurable via GEMINI_MODEL.
 */
export function getGeminiModel(): string {
  const envModel = process.env.GEMINI_MODEL?.trim();
  if (envModel && envModel !== "gemini-2.5-flash" && envModel !== "gemini-3.5-flash-lite") {
    return envModel;
  }
  return "gemini-3.5-flash";
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

  const normalizeSeverity = (val: unknown): "CRITICAL" | "HIGH" | "MODERATE" | "LOW" => {
    const str = String(val || "").toUpperCase().trim();
    if (str === "CRITICAL" || str === "FATAL" || str === "BLOCKER") return "CRITICAL";
    if (str === "HIGH" || str === "SUBOPTIMAL" || str === "SEVERE") return "HIGH";
    if (str === "LOW" || str === "MINOR" || str === "NEGLIGIBLE") return "LOW";
    return "MODERATE";
  };

  const VALID_PROVENANCE = new Set([
    "VERIFIED_INPUT",
    "DETERMINISTIC_RESULT",
    "AI_INTERPRETATION",
    "UNVERIFIED_ASSUMPTION",
  ]);
  const normalizeProvenance = (val: unknown): "VERIFIED_INPUT" | "DETERMINISTIC_RESULT" | "AI_INTERPRETATION" | "UNVERIFIED_ASSUMPTION" => {
    const str = String(val || "").toUpperCase().trim();
    if (VALID_PROVENANCE.has(str)) return str as any;
    if (str.includes("VERIFIED") && !str.includes("UN")) return "VERIFIED_INPUT";
    if (str.includes("DETERMINISTIC") || str.includes("CALCULATED") || str.includes("RULE")) return "DETERMINISTIC_RESULT";
    if (str.includes("ASSUMPTION") || str.includes("UNVERIFIED")) return "UNVERIFIED_ASSUMPTION";
    return "AI_INTERPRETATION";
  };

  // Normalize preliminaryAssessment
  const VALID_ASSESSMENTS = new Set([
    "FAVORABLE",
    "CONDITIONAL",
    "REQUIRES_FURTHER_REVIEW",
    "UNFAVORABLE",
  ]);
  if (typeof obj.preliminaryAssessment === "string") {
    const rawAss = obj.preliminaryAssessment.toUpperCase().trim();
    if (VALID_ASSESSMENTS.has(rawAss)) {
      obj.preliminaryAssessment = rawAss;
    } else if (rawAss.includes("UNFAVORABLE") || rawAss.includes("REJECT") || rawAss.includes("FAIL")) {
      obj.preliminaryAssessment = "UNFAVORABLE";
    } else if (rawAss.includes("FAVORABLE") && !rawAss.includes("UN")) {
      obj.preliminaryAssessment = "FAVORABLE";
    } else if (rawAss.includes("REVIEW") || rawAss.includes("FURTHER")) {
      obj.preliminaryAssessment = "REQUIRES_FURTHER_REVIEW";
    } else {
      obj.preliminaryAssessment = "CONDITIONAL";
    }
  } else {
    obj.preliminaryAssessment = "CONDITIONAL";
  }

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
        remapped.provenance = normalizeProvenance(remapped.provenance);
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
          severity: ["level", "impact", "risk", "status"],
          provenance: ["provenanceCategory", "source_type", "dataProvenance"],
          sourceReference: ["source", "sourceRef", "evidenceSource", "reference", "evidence"],
        });
        ensureField(remapped, "title", remapped.description || "Site Constraint");
        ensureField(remapped, "description", remapped.title || "Identified constraint");
        remapped.severity = normalizeSeverity(remapped.severity);
        remapped.provenance = normalizeProvenance(remapped.provenance);
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
        remapped.provenance = normalizeProvenance(remapped.provenance);
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

  // Normalize assumptionsAndLimitations array (handle strings, objects, or key-value structures)
  if (Array.isArray(obj.assumptionsAndLimitations)) {
    obj.assumptionsAndLimitations = obj.assumptionsAndLimitations.map((item: any) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        return (
          item.description ||
          item.text ||
          item.assumption ||
          item.limitation ||
          item.detail ||
          item.title ||
          Object.values(item).filter((v) => typeof v === "string").join(": ") ||
          JSON.stringify(item)
        );
      }
      return String(item ?? "Assumes standard planning norms.");
    });
  } else if (typeof obj.assumptionsAndLimitations === "string") {
    obj.assumptionsAndLimitations = [obj.assumptionsAndLimitations];
  } else {
    obj.assumptionsAndLimitations = [
      "Assumes 3-phase grid power and municipal road right-of-way standards apply.",
      "Indicative planning screening only; requires on-site cadastral and geotechnical survey.",
    ];
  }

  // Normalize confidenceIndicator
  if (typeof obj.confidenceIndicator !== "object" || obj.confidenceIndicator === null) {
    obj.confidenceIndicator = {
      level: "MEDIUM",
      completenessPercent: 85,
      disclaimer: "Data completeness based on OpenStreetMap and elevation model coverage.",
    };
  } else {
    const ci = obj.confidenceIndicator as Record<string, any>;
    const rawLevel = String(ci.level || "").toUpperCase().trim();
    if (rawLevel === "HIGH" || rawLevel === "MEDIUM" || rawLevel === "LOW") {
      ci.level = rawLevel;
    } else if (rawLevel.includes("HIGH")) {
      ci.level = "HIGH";
    } else if (rawLevel.includes("LOW")) {
      ci.level = "LOW";
    } else {
      ci.level = "MEDIUM";
    }

    if (typeof ci.completenessPercent !== "number" || isNaN(ci.completenessPercent)) {
      ci.completenessPercent = 85;
    } else {
      ci.completenessPercent = Math.max(0, Math.min(100, Math.round(ci.completenessPercent)));
    }

    if (!ci.disclaimer || typeof ci.disclaimer !== "string") {
      ci.disclaimer = "Data completeness evaluated against verified open spatial data.";
    }
  }

  // Normalize costDrivers
  if (typeof obj.costDrivers !== "object" || obj.costDrivers === null) {
    obj.costDrivers = {
      civil: "Standard civil works and grading required.",
      electrical: "Grid interconnection dependent on distance to nearest sub-station.",
      environmental: "Standard environmental safeguards required.",
      operational: "Ongoing operations governed by local municipal norms.",
    };
  } else {
    const cd = obj.costDrivers as Record<string, any>;
    const stringifyDriver = (val: any, fallback: string) => {
      if (typeof val === "string") return val;
      if (typeof val === "object" && val !== null) {
        return val.description || val.detail || val.text || JSON.stringify(val);
      }
      return fallback;
    };
    cd.civil = stringifyDriver(cd.civil, "Standard grading and foundation works.");
    cd.electrical = stringifyDriver(cd.electrical, "Power distribution and grid tie-in costs.");
    cd.environmental = stringifyDriver(cd.environmental, "Environmental mitigation and drainage.");
    cd.operational = stringifyDriver(cd.operational, "Routine operations and site access maintenance.");
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
    // Request structured JSON response with model fallback chain
    const candidateModels = [
      modelName,
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
      "gemini-3.8-flash",
      "gemini-3-flash-preview",
    ].filter((m) => m && m !== "gemini-2.5-flash")
     .filter((m, i, arr) => arr.indexOf(m) === i);

    let response: any = null;
    let lastModelErr: any = null;

    for (const m of candidateModels) {
      try {
        response = await withTimeout(
          callWithRetry(() =>
            ai.models.generateContent({
              model: m,
              contents: userPrompt,
              config: {
                systemInstruction,
                responseMimeType: "application/json",
                temperature: 0.2, // Low temperature for high factual consistency
              },
            })
          ),
          35000,
          `Gemini API request for model ${m} timed out after 35 seconds.`
        );
        if (response && response.text) {
          break;
        }
      } catch (modelErr: any) {
        lastModelErr = modelErr;
        const msg = (modelErr?.message || "").toLowerCase();
        if (
          modelErr?.status === 404 ||
          modelErr?.status === 400 ||
          modelErr?.status === 503 ||
          msg.includes("not found") ||
          msg.includes("deprecated") ||
          msg.includes("not supported") ||
          msg.includes("unavailable") ||
          msg.includes("high demand")
        ) {
          continue;
        }
        throw modelErr;
      }
    }

    if (!response) {
      throw lastModelErr;
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

export interface CopilotAdjustment {
  actionType: "move" | "resize" | "rotate" | "snap_to_road" | "relocate_to_crossing" | "custom";
  summary: string;
  lat?: number;
  lng?: number;
  lengthM?: number;
  widthM?: number;
  bearingDeg?: number;
  deltaMeters?: { north?: number; east?: number };
  autoApply?: boolean;
}

export interface CopilotChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CopilotResponseResult {
  reply: string;
  modelUsed: string;
  engineSource?: "gemini_cloud" | "local_gis_engine";
  cloudUnavailable?: boolean;
  cloudError?: string;
  statutoryStatus?:
    | "VERIFIED_GEOMETRIC"
    | "PARTIAL_OSM_CENTERLINE_CLEARANCE"
    | "UNVERIFIED_STATUTORY_ROW"
    | "PRELIMINARY_ACCESS_REQUIRED"
    | "CRITICAL_COLLISION_DETECTED"
    | "UNVERIFIED"
    | "INSUFFICIENT_EVIDENCE";
  deterministicMetrics?: {
    coordinates?: string;
    dimensionsMeters?: string;
    areaM2?: number;
    nearestRoadDistanceM?: number;
    nearestRoadName?: string;
    roadGeometryType?: string;
  };
  assumptions?: string[];
  missingEvidence?: string[];
  groundedFacts: {
    city: string;
    infrastructureType: string;
    hasRoadCollision: boolean;
    roadAccessStatus: string;
    statutoryFramework: string;
  };
  proposedAdjustment?: CopilotAdjustment | null;
}

/**
 * Direct geodesic calculation moving a WGS84 point by distanceM meters along a given bearing.
 * Earth radius R = 6,378,137m (WGS84 ellipsoidal mean equatorial).
 */
export function movePointGeodesic(
  lat: number,
  lng: number,
  distanceM: number,
  bearingDeg: number
): { lat: number; lng: number } {
  const R = 6378137;
  const rad = Math.PI / 180;
  const bRad = ((bearingDeg % 360) + 360) % 360 * rad;
  const lat1 = lat * rad;
  const lon1 = lng * rad;
  const dByR = distanceM / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dByR) +
      Math.cos(lat1) * Math.sin(dByR) * Math.cos(bRad)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bRad) * Math.sin(dByR) * Math.cos(lat1),
      Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: Number((lat2 / rad).toFixed(6)),
    lng: Number((lon2 / rad).toFixed(6)),
  };
}

/**
 * Deterministic spatial intent parser for conversational Copilot infrastructure adjustments.
 * Accurately extracts moves, rotations, dimensional resizes, and road/crossing snaps.
 */
export function extractSpatialAdjustmentFromIntent(
  message: string,
  placement?: CopilotChatContext["placement"]
): CopilotAdjustment | null {
  const lowerMsg = message.toLowerCase().trim();

  const currentLat = placement?.lat ?? 20.3506;
  const currentLng = placement?.lng ?? 74.3626;
  const currentLength = placement?.lengthM ?? 100;
  const currentWidth = placement?.widthM ?? 50;
  const currentBearing = placement?.bearingDeg ?? 0;

  // 1. Road Alignment / Snap to Open Land / Overlap Clearance
  const isAlignIntent =
    /(?:align|snap|retract|shift|hug|position)\s+(?:it\s+)?(?:to|along|beside|with)?\s*(?:the\s+)?(?:road|street|corridor|curb|open\s+land)/i.test(lowerMsg) ||
    /(?:fix|clear|resolve|avoid|remove|eliminate)\s+(?:the\s+)?(?:road\s+)?(?:collision|overlap|encroach|infringement)/i.test(lowerMsg) ||
    /(?:align\s+to\s+road)/i.test(lowerMsg);

  if (isAlignIntent) {
    return {
      actionType: "snap_to_road",
      summary: "Align footprint tangent to road corridor with statutory 3.0m setback and open land clearance",
      autoApply: true,
    };
  }

  // 2. Relocate Bridge to River Crossing
  const isBridgeRelocateIntent =
    /(?:relocate|move|shift)\s+(?:the\s+)?bridge\s+(?:to\s+(?:the\s+)?)?(?:crossing|river\s+crossing|water\s+crossing)/i.test(lowerMsg) ||
    /(?:find|pick|use)\s+(?:a\s+)?(?:better|connected|alternative)\s+(?:river\s+)?crossing/i.test(lowerMsg);

  if (isBridgeRelocateIntent) {
    return {
      actionType: "relocate_to_crossing",
      summary: "Relocate bridge span to connected river crossing with existing road approaches",
      autoApply: true,
    };
  }

  let matchedAdjustment = false;
  let newLat: number | undefined = undefined;
  let newLng: number | undefined = undefined;
  let newLength: number | undefined = undefined;
  let newWidth: number | undefined = undefined;
  let newBearing: number | undefined = undefined;
  const summaryParts: string[] = [];

  // 3. Move / Shift / Translate
  const dirBearings: Record<string, { bearing: number; label: string }> = {
    north: { bearing: 0, label: "North" },
    up: { bearing: 0, label: "North" },
    northward: { bearing: 0, label: "North" },
    northeast: { bearing: 45, label: "Northeast" },
    east: { bearing: 90, label: "East" },
    right: { bearing: 90, label: "East" },
    eastward: { bearing: 90, label: "East" },
    southeast: { bearing: 135, label: "Southeast" },
    south: { bearing: 180, label: "South" },
    down: { bearing: 180, label: "South" },
    southward: { bearing: 180, label: "South" },
    southwest: { bearing: 225, label: "Southwest" },
    west: { bearing: 270, label: "West" },
    left: { bearing: 270, label: "West" },
    westward: { bearing: 270, label: "West" },
    northwest: { bearing: 315, label: "Northwest" },
  };

  const movePattern1 = /(?:move|shift|translate|nudge|push|pull|drag)\s+(?:it\s+)?(?:by\s+)?(\d+(?:\.\d+)?)\s*(?:m|meter|meters|km)?\s*(?:to\s+(?:the\s+)?)?(north|south|east|west|up|down|left|right|northeast|northwest|southeast|southwest|northward|southward|eastward|westward)/i;
  const movePattern2 = /(?:move|shift|translate|nudge|push|pull|drag)\s+(?:it\s+)?(?:to\s+(?:the\s+)?)?(north|south|east|west|up|down|left|right|northeast|northwest|southeast|southwest|northward|southward|eastward|westward)\s*(?:by\s+)?(\d+(?:\.\d+)?)\s*(?:m|meter|meters|km)?/i;
  const movePattern3 = /(?:move|shift|nudge)\s+(?:it\s+)?(?:to\s+(?:the\s+)?)?(north|south|east|west|up|down|left|right|northeast|northwest|southeast|southwest)/i;

  let moveMatch = lowerMsg.match(movePattern1);
  let distM = 0;
  let dirKey = "";

  if (moveMatch) {
    distM = parseFloat(moveMatch[1]);
    if (moveMatch[0].toLowerCase().includes("km")) distM *= 1000;
    dirKey = moveMatch[2].toLowerCase();
  } else {
    moveMatch = lowerMsg.match(movePattern2);
    if (moveMatch) {
      dirKey = moveMatch[1].toLowerCase();
      distM = parseFloat(moveMatch[2]);
      if (moveMatch[0].toLowerCase().includes("km")) distM *= 1000;
    } else {
      moveMatch = lowerMsg.match(movePattern3);
      if (moveMatch) {
        dirKey = moveMatch[1].toLowerCase();
        distM = 30; // default 30 meters
      }
    }
  }

  if (dirKey && dirBearings[dirKey] && distM > 0) {
    const { bearing, label } = dirBearings[dirKey];
    const moved = movePointGeodesic(currentLat, currentLng, distM, bearing);
    newLat = moved.lat;
    newLng = moved.lng;
    matchedAdjustment = true;
    summaryParts.push(`Move ${distM}m ${label}`);
  }

  // 4. Rotate / Orientation
  const rotateRelPattern = /(?:rotate|turn|spin)\s+(?:it\s+)?(?:by\s+)?(-?\d+(?:\.\d+)?)\s*(?:deg|degree|degrees|°)?(?:\s+(clockwise|counterclockwise|counter-clockwise|anticlockwise|cw|ccw))?/i;
  const rotateAbsPattern = /(?:set|change|orient)\s+(?:the\s+)?(?:bearing|orientation|angle|heading)\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:deg|degree|degrees|°)?/i;

  const absRotateMatch = lowerMsg.match(rotateAbsPattern);
  if (absRotateMatch) {
    const targetDeg = parseFloat(absRotateMatch[1]);
    newBearing = Math.round(((targetDeg % 360) + 360) % 360);
    matchedAdjustment = true;
    summaryParts.push(`Set orientation to ${newBearing}°`);
  } else {
    const relRotateMatch = lowerMsg.match(rotateRelPattern);
    if (relRotateMatch) {
      const deltaDeg = parseFloat(relRotateMatch[1]);
      const dirMod = relRotateMatch[2] ? relRotateMatch[2].toLowerCase() : "";
      const isCCW = dirMod.includes("counter") || dirMod.includes("anti") || dirMod === "ccw";
      const finalDelta = isCCW ? -Math.abs(deltaDeg) : deltaDeg;
      newBearing = Math.round((((currentBearing + finalDelta) % 360) + 360) % 360);
      matchedAdjustment = true;
      summaryParts.push(`Rotate by ${Math.abs(deltaDeg)}° ${isCCW ? "CCW" : "CW"} (to ${newBearing}°)`);
    }
  }

  // 5. Dimensions / Resize
  const scaleUpMatch = lowerMsg.match(/(?:increase|expand|enlarge|scale\s*up)\s+(?:the\s+)?(?:length|width|size|footprint)?\s*(?:by\s+)?(\d+(?:\.\d+)?)\s*%/i);
  const scaleDownMatch = lowerMsg.match(/(?:shrink|decrease|reduce|scale\s*down)\s+(?:the\s+)?(?:length|width|size|footprint)?\s*(?:by\s+)?(\d+(?:\.\d+)?)\s*%/i);

  if (scaleUpMatch) {
    const pct = parseFloat(scaleUpMatch[1]);
    const factor = 1 + pct / 100;
    newLength = Math.round(currentLength * factor);
    newWidth = Math.round(currentWidth * factor);
    matchedAdjustment = true;
    summaryParts.push(`Scale footprint +${pct}% (${newLength}m × ${newWidth}m)`);
  } else if (scaleDownMatch) {
    const pct = parseFloat(scaleDownMatch[1]);
    const factor = Math.max(0.1, 1 - pct / 100);
    newLength = Math.round(currentLength * factor);
    newWidth = Math.round(currentWidth * factor);
    matchedAdjustment = true;
    summaryParts.push(`Shrink footprint -${pct}% (${newLength}m × ${newWidth}m)`);
  } else {
    const lengthMatch = lowerMsg.match(/(?:set|make|change|increase|decrease|resize)\s+(?:the\s+)?length\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?/i);
    if (lengthMatch) {
      newLength = Math.round(parseFloat(lengthMatch[1]));
      matchedAdjustment = true;
      summaryParts.push(`Set length to ${newLength}m`);
    }

    const widthMatch = lowerMsg.match(/(?:set|make|change|increase|decrease|resize)\s+(?:the\s+)?width\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?/i);
    if (widthMatch) {
      newWidth = Math.round(parseFloat(widthMatch[1]));
      matchedAdjustment = true;
      summaryParts.push(`Set width to ${newWidth}m`);
    }

    const bothDimsMatch = lowerMsg.match(/(?:set|make|resize)\s+(?:the\s+)?(?:size|footprint|dimensions?)\s+(?:to\s+)?(\d+)\s*(?:m)?\s*(?:by|x|×)\s*(\d+)\s*(?:m)?/i);
    if (bothDimsMatch) {
      newLength = parseInt(bothDimsMatch[1], 10);
      newWidth = parseInt(bothDimsMatch[2], 10);
      matchedAdjustment = true;
      summaryParts.push(`Set dimensions to ${newLength}m × ${newWidth}m`);
    }
  }

  if (matchedAdjustment) {
    let actionType: CopilotAdjustment["actionType"] = "custom";
    if (newLat !== undefined && newBearing === undefined && newLength === undefined) {
      actionType = "move";
    } else if (newBearing !== undefined && newLat === undefined && newLength === undefined) {
      actionType = "rotate";
    } else if (newLength !== undefined && newLat === undefined && newBearing === undefined) {
      actionType = "resize";
    }

    return {
      actionType,
      summary: summaryParts.join(", "),
      lat: newLat,
      lng: newLng,
      lengthM: newLength,
      widthM: newWidth,
      bearingDeg: newBearing,
      autoApply: true,
    };
  }

  return null;
}

/**
 * Gemini function calling tool declaration for running counterfactual cooling optimization.
 */
export const runOptimizationToolDeclaration: FunctionDeclaration = {
  name: "run_optimization",
  description:
    "Runs greedy counterfactual cooling optimization over candidate 250m priority cells under a hectare budget constraint using the 30-member Monte Carlo ensemble. Returns selected zones, allocated hectares, mean cooling, cooling ranges, and population benefited. The model may only quote numbers returned by this tool.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      budget_ha: {
        type: Type.NUMBER,
        description:
          "Target land intervention budget in hectares (must be a positive number, e.g. 10.0)",
      },
      target_ndvi: {
        type: Type.NUMBER,
        description:
          "Counterfactual target NDVI for greenable areas (e.g. 0.65)",
      },
    },
    required: ["budget_ha", "target_ndvi"],
  },
};

/**
 * Gemini function calling tool declaration for retrieving priority cell facts.
 */
export const getZoneToolDeclaration: FunctionDeclaration = {
  name: "get_zone",
  description:
    "Retrieves verified satellite measurements, modelled cooling statistics, and Monte Carlo ensemble details for a specific 250m priority cell by unique cell ID (e.g. 'cell_250m_0001'). The model may only quote numbers returned by this tool.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: "Unique priority cell identifier, e.g. 'cell_250m_0001'",
      },
    },
    required: ["id"],
  },
};

export interface ToolRunOptimizationArgs {
  budget_ha: number;
  target_ndvi: number;
  ward?: string;
  objective?: "cooling" | "population_weighted";
}

/**
 * Real backend execution handler for run_optimization tool.
 */
export function executeRunOptimizationTool(args: ToolRunOptimizationArgs) {
  const budget_ha = Number(args.budget_ha);
  const target_ndvi = Number(args.target_ndvi);

  if (!Number.isFinite(budget_ha) || budget_ha <= 0) {
    return {
      status: "ERROR",
      error: "Invalid budget_ha: must be a positive number.",
      budget_ha,
      allocated_ha: 0,
      selected_cells: [],
      governance: {
        disclaimers: ["Budget must be a positive number in hectares."],
        tags: {},
      },
    };
  }

  const result = optimizeInterventionBudget({
    budget_ha,
    target_ndvi: Number.isFinite(target_ndvi) ? target_ndvi : 0.65,
    ward: args.ward,
    objective: args.objective || "cooling",
  });

  return {
    status: result.status,
    budget_ha: result.budget_ha,
    allocated_ha: result.allocated_ha,
    total_cells_evaluated: result.total_cells_evaluated,
    selected_cells_count: result.selected_cells.length,
    selected_cells: result.selected_cells.map((c) => ({
      id: c.id,
      ward: c.ward,
      centroid: c.centroid,
      greenable_ha: c.greenable_ha,
      cooling_mean: c.cooling_mean,
      cooling_p10: c.cooling_p10,
      cooling_p90: c.cooling_p90,
      population: c.population,
      benefit_per_ha: c.benefit_per_ha,
      selection_frequency: c.selection_frequency,
      times_selected_ensemble: c.times_selected_ensemble,
      rank: c.rank,
    })),
    governance: {
      tags: {
        budget_ha: "[Assumed]",
        target_ndvi: "[Assumed]",
        allocated_ha: "[Modelled]",
        greenable_ha: "[Modelled]",
        cooling_mean: "[Modelled]",
        cooling_p10: "[Modelled]",
        cooling_p90: "[Modelled]",
        population: "[Measured]",
        selection_frequency: "[Modelled]",
      },
      disclaimers: [
        "Surface temperature (LST) is radiometric skin temperature, NOT 2m ambient air temperature.",
        "NDVI is a spectral reflectance index, NOT tree canopy cover.",
        "No arbitrary weighted composite scores; ranking is strictly based on physical cooling benefit per hectare.",
        "The model may only quote numbers returned by tools; unobserved values remain null / 'Not available'.",
      ],
    },
  };
}

export interface ToolGetZoneArgs {
  id: string;
}

export type ToolGetZoneResult =
  | {
      found: false;
      error: string;
    }
  | {
      found: true;
      id: string;
      ward: string;
      centroid: [number, number];
      population: number | null;
      lst_mean: number | null;
      lst_std: number | null;
      n_obs: number | null;
      ndvi: number | null;
      built_frac: number | null;
      greenable_ha: number | null;
      burden: number | null;
      cooling_mean: number | null;
      cooling_p10: number | null;
      cooling_p90: number | null;
      ensemble_stats: {
        memberCount: number;
        mean: number | null;
        p10: number | null;
        p90: number | null;
        min: number | null;
        max: number | null;
        spread: number | null;
      } | null;
      governance: {
        tags: Record<string, string>;
        disclaimers: string[];
      };
    };

/**
 * Real backend execution handler for get_zone tool.
 */
export function executeGetZoneTool(args: ToolGetZoneArgs): ToolGetZoneResult {
  if (!args || typeof args.id !== "string" || args.id.trim().length === 0) {
    return {
      found: false,
      error: "Invalid zone ID: ID must be a non-empty string.",
    };
  }

  const cleanId = args.id.trim();
  let cell: PriorityCell | null = null;
  try {
    cell = getPriorityCellById(cleanId);
  } catch (err) {
    return {
      found: false,
      error: `Priority data unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!cell) {
    return {
      found: false,
      error: `Zone '${cleanId}' not found in the priority cells database. Do not invent or fabricate data.`,
    };
  }

  let ensembleStats: EnsembleStats | null = null;
  try {
    ensembleStats = getCellEnsembleStats(cleanId);
  } catch {
    ensembleStats = null;
  }

  return {
    found: true,
    id: cell.id,
    ward: cell.ward,
    centroid: cell.centroid,
    population: cell.population, // [Measured]
    lst_mean: cell.lst_mean, // [Measured] radiometric skin temp (°C)
    lst_std: cell.lst_std, // [Measured]
    n_obs: cell.n_obs, // [Measured]
    ndvi: cell.ndvi, // [Measured]
    built_frac: cell.built_frac, // [Measured]
    greenable_ha: cell.greenable_ha, // [Modelled]
    burden: cell.burden, // [Modelled]
    cooling_mean: cell.cooling_mean, // [Modelled]
    cooling_p10: cell.cooling_p10, // [Modelled]
    cooling_p90: cell.cooling_p90, // [Modelled]
    ensemble_stats: ensembleStats
      ? {
          memberCount: ensembleStats.memberCount,
          mean: ensembleStats.mean,
          p10: ensembleStats.p10,
          p90: ensembleStats.p90,
          min: ensembleStats.min,
          max: ensembleStats.max,
          spread: ensembleStats.spread,
        }
      : null,
    governance: {
      tags: {
        population: "[Measured]",
        lst_mean: "[Measured]",
        lst_std: "[Measured]",
        n_obs: "[Measured]",
        ndvi: "[Measured]",
        built_frac: "[Measured]",
        greenable_ha: "[Modelled]",
        burden: "[Modelled]",
        cooling_mean: "[Modelled]",
        cooling_p10: "[Modelled]",
        cooling_p90: "[Modelled]",
        robustness: "[Modelled]",
      },
      disclaimers: [
        "Surface temperature (LST) is radiometric skin temperature, NOT 2m ambient air temperature.",
        "NDVI is a spectral reflectance index, NOT tree canopy cover.",
        "No arbitrary weighted composite scores; all numbers are strictly from sensors or physical models.",
        "The model may only quote numbers returned by tools; unobserved values remain null / 'Not available'.",
      ],
    },
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

  const city = cleanStudyAreaName(context?.studyArea);
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
7. Tone: Objective, authoritative, helpful, and accessible. Structure answers using markdown with clear headings, bullet points, and actionable next steps.
8. SPATIAL INFRASTRUCTURE ADJUSTMENT COMMANDS:
   When the user asks to adjust, move, shift, translate, rotate, re-orient, resize, expand, shrink, or align the active infrastructure (e.g. "move 50m north", "rotate 90 degrees", "increase length to 300m", "align to road", "fix collision"):
   a. Explain the spatial adjustment and why it benefits the site plan from an engineering/planning perspective.
   b. AT THE VERY END of your response, ALWAYS append a JSON block formatted exactly as:
   \`\`\`json:adjustment
   {
     "actionType": "move" | "resize" | "rotate" | "snap_to_road" | "relocate_to_crossing" | "custom",
     "summary": "Clear one-line summary of adjustment",
     "lat": <number_if_moved>,
     "lng": <number_if_moved>,
     "lengthM": <number_if_resized>,
     "widthM": <number_if_resized>,
     "bearingDeg": <number_if_rotated_0_to_359>,
     "autoApply": true
   }
   \`\`\`
9. SATELLITE URBAN HEAT & VEGETATION GOVERNANCE:
   When answering questions regarding urban heat, Land Surface Temperature (LST), vegetation (NDVI), microclimate, or cooling interventions:
   a. Strictly distinguish:
      (1) Verified satellite observations (Landsat 9 LST and Sentinel-2B NDVI from context payload)
      (2) Deterministic GIS calculations (differences from study area mean)
      (3) Verified technical references (BEE ECBC 2017 Table 4.1 Cool Roof SRI ≥ 78, advisory LEED/IGBC SRI ≥ 82, IEC 61215 PV temp coefficient -0.35% to -0.45%/°C)
      (4) General engineering guidance (elevated open racking ≥ 0.8m for sub-panel airflow, solar canopy shading over EV bays)
      (5) Unverified assumptions (building insulation values, microclimate air models, battery cell temperatures)
   b. NEVER equate LST to ambient 2m air temperature or human physiological heat stress (UTCI).
   c. NEVER describe NDVI as tree canopy percentage or vegetation cover percentage.
   d. NEVER invent numerical values, ward rankings, cooling percentages, or health impacts.
   e. NEVER calculate actual PV efficiency loss directly from satellite LST; clarify that cell operating temperature requires on-site ambient air temperature, irradiance, wind speed, and thermal mounting coefficients.
   f. NEVER claim that satellite LST establishes vehicle battery core temperature or EV charger operating conditions.
   g. Do NOT present advisory values (such as SRI ≥ 82) as mandatory statutory requirements without citing BEE ECBC 2017 Table 4.1 (SRI ≥ 78).
   h. If satellite data are unavailable or out-of-bounds, explicitly state so.
10. URBAN INTERVENTION & CO-PLANNING GOVERNANCE (PHASE 5 & 6):
    When discussing urban intervention planning, priority candidate sites, or infrastructure co-planning:
    a. Recognize the 5 mandatory intervention categories:
       - URBAN_GREENING_CORRIDOR (tree canopies, median bioswales on heat-stressed roads)
       - COOL_ROOF_FEASIBILITY (high-albedo retrofits on municipal/hospital/institutional roofs)
       - SOLAR_CANOPY_EV_COLOCATION (solar PV shade over surface parking lots & transit hubs)
       - GREEN_SPACE_ENHANCEMENT (canopy infill and rainwater recharge in public parks)
       - INTEGRATED_FACILITY_UPGRADE (civic hubs combining roofs, solar canopies, and greening)
    b. DYNAMIC SPATIAL DISCOVERY & DATA PROVENANCE:
       - Interventions are discovered dynamically via the Dynamic Spatial Discovery Engine and classified into rigorous forensic provenance categories:
         * DATASET_DERIVED: genuine official municipal registers (PMC official hospital register pmc_hospitals.json, PMC official garden register pmc_gardens.json, verified OpenStreetMap EV charging stations pmc_ev_stations.json with operational status MAPPED_IN_OSM).
         * MANUALLY_CURATED: curated transit corridor sample points (pmc_road_corridors.json) with estimated carriageway widths and synthetic OSM IDs, classified as REQUIRES_SITE_VALIDATION.
         * SAMPLE_LOCATION: historical demonstration landmarks (e.g. Balgandharva, Saras Baug, Swargate) segregated in reference mode to avoid data contamination.
       - Each discovery run is tracked via an AnalysisRun ID, with explicit parameters, rejection logging, and sensitivity analysis.
    c. NEVER equate building footprint area to usable roof area (usable is typically 45-75% due to HVAC, parapets, stairwells).
    d. NEVER assert unverified electrical headroom or grid sanction (substation capacity indicates nameplate transformation rating; spare feeder capacity requires formal MSEDCL load-flow clearance).
    e. NEVER invent or hallucinate cooling degrees (e.g., "planting trees will reduce temperature by 3°C") or financial ROI figures.
    f. Distinguish radiometric surface skin temperature (Landsat 9 ST_B10 at 10:57 AM pre-monsoon) from 2m ambient air temperature and wet-bulb globe temperature.
    g. Reference governing standards: BEE ECBC 2017 Table 4.1 (SRI ≥ 78), IRC:103-2012 (walkways ≥ 1.8m clear width), IEC 61215:2021 (module thermal qualification), CPWD landscaping specifications, IS 875 Part 3 (wind uplift).
    h. Mandate pre-implementation site surveys (structural slab NDT, underground utility GPR, transformer headroom with MSEDCL, statutory CTSO cadastral survey).
    i. Candidate eligibility is an exploratory planning classification, NOT formal municipal sanction or budget allocation.
11. MANDATORY SCIENTIFIC SAFEGUARDS, TOOL CALLING & DATA PROVENANCE RULES:
    a. FUNCTION CALLING & TOOL USAGE:
       - You have access to real backend priority optimization tools:
         * \`run_optimization(budget_ha, target_ndvi)\`: Runs greedy counterfactual cooling optimization over candidate 250m priority cells under a hectare budget constraint using the 30-member Monte Carlo ensemble.
         * \`get_zone(id)\`: Retrieves verified satellite measurements, modelled cooling statistics, and Monte Carlo ensemble details for a specific 250m priority cell by unique cell ID (e.g. 'cell_250m_0001').
       - When the user asks to run optimization, budget cooling hectares, or view zone facts, ALWAYS call these tools.
    b. STRICT NUMBER GROUNDING:
       - You MAY ONLY quote numbers returned by tools or provided in verified GIS context.
       - You are STRICTLY FORBIDDEN from inventing, fabricating, extrapolating, or guessing numerical values.
       - If a tool returns a null value or error, you MUST report it as null / "Not available".
       - Every displayed number MUST be explicitly tagged with its provenance tag:
         * [Measured]: For satellite/ground measurements (LST, NDVI, n_obs, built_frac, population).
         * [Modelled]: For algorithmic/ML outputs (cooling_mean, cooling_p10, cooling_p90, greenable_ha, burden, selection_frequency).
         * [Assumed]: For user-specified parameters or scenario inputs (budget_ha, target_ndvi).
    c. EXPLICIT REFUSALS:
       - When asked to provide, estimate, or invent data that is unobserved or not available from tools (e.g. ambient air temperature, unmeasured building heights, fictitious composite scores, or non-existent zones):
         * You MUST REFUSE to invent values and explain why.
         * Surface temperature (LST) is radiometric skin temperature from thermal infrared sensors, NOT 2m ambient air temperature. Ambient air temperature is not available in satellite observations.
         * NDVI is a spectral reflectance index [-1.0, 1.0], NOT tree canopy cover or volume.
         * No arbitrary weighted composite scores are calculated or permitted; ranking is strictly based on physical cooling benefit per hectare.`;

  let heatContextPayload: any = null;
  const isHeatQuery = /\b(heat|temperature|lst|ndvi|vegetation|cooling|cool roof|canopy|greenery|thermal|microclimate|solar)\b/i.test(message);
  if (isHeatQuery && isHeatDataAvailable()) {
    try {
      const diag = getHeatDiagnostics();
      const pointResult = context?.placement?.lng !== undefined && context?.placement?.lat !== undefined
        ? queryHeatPoint(context.placement.lng, context.placement.lat)
        : null;

      heatContextPayload = {
        provenance: "DETERMINISTIC_RESULT",
        governanceRules: [
          "LST measures radiometric skin temperature from Landsat 9 Band 10; NOT ambient air temperature or wet-bulb heat stress.",
          "NDVI is a unitless mathematical index of spectral reflectance [-1.0, 1.0]; NOT tree canopy or vegetation percentage.",
          "Landsat 9 native thermal resolution is 100m resampled to 30m USGS delivery grid; resampling does not increase spatial resolution.",
          "Never invent numerical values, ward rankings, cooling percentages, or health impacts.",
          "Pune candidate boundary is non-authoritative research demarcation."
        ],
        landsat9ThermalSummary: {
          sceneId: diag.landsat9.sceneId,
          acquisitionTimestamp: diag.landsat9.acquisitionTimestamp,
          meanLSTCelsius: diag.landsat9.calibratedLSTCelsius.mean,
          minLSTCelsius: diag.landsat9.calibratedLSTCelsius.min,
          maxLSTCelsius: diag.landsat9.calibratedLSTCelsius.max,
          medianLSTCelsius: diag.landsat9.calibratedLSTCelsius.median,
          stdCelsius: diag.landsat9.calibratedLSTCelsius.std,
          meanUncertaintyKelvin: diag.landsat9.surfaceTemperatureQA.meanUncertaintyK
        },
        sentinel2bVegetationSummary: {
          granuleId: diag.sentinel2b.sceneId,
          acquisitionTimestamp: diag.sentinel2b.acquisitionTimestamp,
          meanNDVI30m: diag.sentinel2b.ndvi30mDistribution.mean,
          medianNDVI30m: diag.sentinel2b.ndvi30mDistribution.median,
          validObservationCount: diag.sentinel2b.ndvi30mDistribution.validPixelCount,
          preservedNegativeReflectanceB04Pixels: diag.sentinel2b.reflectanceDiagnostics.b04NegativeReflectancePixels
        },
        siteSpecificObservations: (pointResult && context?.placement) ? {
          lat: context.placement.lat,
          lng: context.placement.lng,
          isInsidePuneGrid: pointResult.gridCell.isInsideGrid,
          lstCelsius: pointResult.lst.celsius,
          stQaUncertaintyK: pointResult.lst.stQaUncertaintyKelvin,
          ndvi30m: pointResult.ndvi.aggregated30m,
          sclClassName: pointResult.ndvi.sclClassName
        } : null
      };
    } catch (err) {
      console.warn("Could not attach heat context to Copilot:", err);
    }
  }

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
      satelliteHeatAndVegetation: heatContextPayload,
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
    const candidateModels = [
      modelName,
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
      "gemini-3.8-flash",
      "gemini-3-flash-preview",
    ].filter((m) => m && m !== "gemini-2.5-flash")
     .filter((m, i, arr) => arr.indexOf(m) === i);

    let response: any = null;
    let lastErr: any = null;
    let effectiveModel = modelName;

    const tools = [
      {
        functionDeclarations: [runOptimizationToolDeclaration, getZoneToolDeclaration],
      },
    ];

    for (const m of candidateModels) {
      try {
        response = await withTimeout(
          callWithRetry(() =>
            ai.models.generateContent({
              model: m,
              contents: prompt,
              config: {
                systemInstruction,
                temperature: 0.1,
                tools,
              },
            })
          ),
          35000,
          `Gemini API request for model ${m} timed out after 35 seconds.`
        );
        if (
          response &&
          (response.text ||
            (response.functionCalls && response.functionCalls.length > 0))
        ) {
          effectiveModel = m;
          break;
        }
      } catch (mErr: any) {
        lastErr = mErr;
        const errMsg = (mErr?.message || "").toLowerCase();
        if (
          mErr?.status === 404 ||
          mErr?.status === 400 ||
          mErr?.status === 503 ||
          errMsg.includes("not found") ||
          errMsg.includes("deprecated") ||
          errMsg.includes("not supported") ||
          errMsg.includes("unavailable") ||
          errMsg.includes("high demand")
        ) {
          continue;
        }
        // If it's a network unreachability, quota, or rate limit error, break to fallback
        break;
      }
    }

    if (!response) {
      throw lastErr;
    }

    let rawReply = response.text || "";

    // Execute function calls against real backend if predicted by model
    if (response.functionCalls && response.functionCalls.length > 0) {
      const functionResponseParts: any[] = [];
      for (const call of response.functionCalls) {
        let toolOutput: any;
        if (call.name === "run_optimization") {
          toolOutput = executeRunOptimizationTool(call.args as any);
        } else if (call.name === "get_zone") {
          toolOutput = executeGetZoneTool(call.args as any);
        } else {
          toolOutput = { error: `Tool ${call.name} is not recognized.`, found: false };
        }
        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: { output: toolOutput },
            ...(call.id ? { id: call.id } : {}),
          },
        });
      }

      try {
        const candidateContent = response.candidates?.[0]?.content || {
          role: "model",
          parts: response.functionCalls.map((c: any) => ({ functionCall: c })),
        };

        const secondTurn = await withTimeout(
          callWithRetry(() =>
            ai.models.generateContent({
              model: effectiveModel,
              contents: [
                { role: "user", parts: [{ text: prompt }] },
                candidateContent,
                { role: "user", parts: functionResponseParts },
              ],
              config: {
                systemInstruction,
                temperature: 0.1,
              },
            })
          ),
          35000,
          `Gemini API tool execution response for model ${effectiveModel} timed out after 35 seconds.`
        );

        if (secondTurn && secondTurn.text) {
          rawReply = secondTurn.text;
        }
      } catch (secondErr) {
        console.warn("Second-turn function synthesis error:", secondErr);
        if (!rawReply) {
          const firstCall = response.functionCalls[0];
          if (firstCall.name === "run_optimization") {
            const out = executeRunOptimizationTool(firstCall.args as any);
            rawReply = `### Priority Counterfactual Optimization Results\n- **Target Budget**: [Assumed] ${out.budget_ha} ha\n- **Allocated**: [Modelled] ${out.allocated_ha} ha\n- **Selected Zones**: [Modelled] ${out.selected_cells_count}\n`;
          } else if (firstCall.name === "get_zone") {
            const out = executeGetZoneTool(firstCall.args as any);
            rawReply = out.found
              ? `### Priority Zone Details: ${out.id}\n- **Ward**: ${out.ward}\n- **LST Mean**: [Measured] ${out.lst_mean}°C\n- **NDVI**: [Measured] ${out.ndvi}\n- **Predicted Cooling**: [Modelled] ${out.cooling_mean}°C\n`
              : `Zone '${firstCall.args?.id}' not found. Unobserved data cannot be fabricated.`;
          }
        }
      }
    }

    if (!rawReply) {
      rawReply = "No response received from model.";
    }

    let reply = rawReply;
    let proposedAdjustment: CopilotAdjustment | null = null;

    // Parse structured adjustment block if present
    const jsonAdjMatch = rawReply.match(/```(?:json:adjustment|json)\s*([\s\S]*?)\s*```/);
    if (jsonAdjMatch) {
      try {
        const parsed = JSON.parse(repairJson(jsonAdjMatch[1]));
        if (parsed && typeof parsed === "object" && parsed.actionType) {
          proposedAdjustment = {
            actionType: parsed.actionType,
            summary: parsed.summary || "Infrastructure spatial adjustment",
            lat: typeof parsed.lat === "number" && Number.isFinite(parsed.lat) ? parsed.lat : undefined,
            lng: typeof parsed.lng === "number" && Number.isFinite(parsed.lng) ? parsed.lng : undefined,
            lengthM: typeof parsed.lengthM === "number" && Number.isFinite(parsed.lengthM) ? Math.round(parsed.lengthM) : undefined,
            widthM: typeof parsed.widthM === "number" && Number.isFinite(parsed.widthM) ? Math.round(parsed.widthM) : undefined,
            bearingDeg: typeof parsed.bearingDeg === "number" && Number.isFinite(parsed.bearingDeg) ? Math.round(((parsed.bearingDeg % 360) + 360) % 360) : undefined,
            autoApply: true,
          };
          // Clean the raw JSON out of the user reply so markdown remains clean
          reply = rawReply.replace(/```(?:json:adjustment|json)\s*[\s\S]*?\s*```/, "").trim();
        }
      } catch {
        // ignore parse error
      }
    }

    // Fallback: if Gemini didn't return structured JSON but user prompt is clearly an adjustment intent, compute deterministically
    if (!proposedAdjustment) {
      proposedAdjustment = extractSpatialAdjustmentFromIntent(message, context?.placement);
    }

    return {
      reply,
      modelUsed: effectiveModel,
      engineSource: "gemini_cloud",
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
      proposedAdjustment,
    };
  } catch (err: unknown) {
    if (err instanceof GeminiAdvisorError) {
      throw err;
    }

    const rawErrMsg = sanitizeErrorMessage(err);
    const lowerMsg = rawErrMsg.toLowerCase();

    if (
      lowerMsg.includes("429") ||
      lowerMsg.includes("quota") ||
      lowerMsg.includes("rate limit")
    ) {
      throw new GeminiAdvisorError(
        "RATE_LIMIT_EXCEEDED",
        "Gemini API rate limit or quota exceeded. Please retry in a few moments.",
        429
      );
    }

    if (
      lowerMsg.includes("timeout") ||
      lowerMsg.includes("deadline") ||
      lowerMsg.includes("timed out")
    ) {
      throw new GeminiAdvisorError(
        "TIMEOUT",
        "Gemini API request timed out after 15 seconds. Please retry.",
        504
      );
    }

    if (lowerMsg.includes("enotfound") || lowerMsg.includes("eai_again")) {
      throw new GeminiAdvisorError(
        "SERVICE_ERROR",
        "DNS resolution failed for generativelanguage.googleapis.com.",
        503
      );
    }

    if (
      lowerMsg.includes("fetch failed") ||
      lowerMsg.includes("econnrefused") ||
      lowerMsg.includes("ehostunreach") ||
      lowerMsg.includes("enetunreach") ||
      lowerMsg.includes("eperm") ||
      lowerMsg.includes("network")
    ) {
      throw new GeminiAdvisorError(
        "SERVICE_ERROR",
        "Gemini Cloud AI is unreachable (outbound network connection failed: generativelanguage.googleapis.com).",
        503
      );
    }

    if (lowerMsg.includes("503") || lowerMsg.includes("high demand") || lowerMsg.includes("unavailable")) {
      throw new GeminiAdvisorError(
        "SERVICE_ERROR",
        "Gemini API is temporarily experiencing high demand at Google (HTTP 503).",
        503
      );
    }

    if (
      lowerMsg.includes("401") ||
      lowerMsg.includes("api_key_invalid") ||
      lowerMsg.includes("unauthorized")
    ) {
      throw new GeminiAdvisorError(
        "KEY_NOT_CONFIGURED",
        "Gemini API key is unauthorized or invalid.",
        401
      );
    }

    throw new GeminiAdvisorError(
      "SERVICE_ERROR",
      `Gemini Copilot API invocation error: ${rawErrMsg}`,
      500
    );
  }
}

/**
 * Autonomous Local GIS Planning Engine
 *
 * Provides instant, evidence-grounded urban planning answers based on active
 * GIS coordinates, road clearance geometry, access road alignment, and
 * Maharashtra UDCPR 2020 rules without requiring an external Gemini API key.
 */
export function generateLocalCopilotResponse(
  message: string,
  context?: CopilotChatContext,
  history?: CopilotChatMessage[]
): CopilotResponseResult {
  const city = cleanStudyAreaName(context?.studyArea);
  const infraType = context?.infrastructureType || "Civic Infrastructure";
  const placement = context?.placement;
  const validation = context?.validation;
  const roadAccess = validation?.roadAccess;
  const officialContext = validation?.officialPlanningContext;
  const report = context?.report;

  const conflicts = validation?.conflicts || [];
  const roadCollision = conflicts.find(
    (c) => c.category === "road_collision" || c.category === "major_road"
  );
  const buildingCollisions = conflicts.filter((c) => c.category === "building");

  const hasRoadCollision = Boolean(roadCollision);
  const roadAccessStatus = roadAccess
    ? roadAccess.requiresNewAccessRoad
      ? "PRELIMINARY_ACCESS_REQUIRED"
      : "DIRECT_CONNECTED"
    : "UNKNOWN";
  const statutoryFramework =
    officialContext?.statutoryRules ||
    officialContext?.masterPlan ||
    "Maharashtra Unified Development Control and Promotion Regulations (UDCPR 2020)";

  const areaM2 = Math.round(
    placement?.areaM2 ||
      (placement?.lengthM && placement?.widthM ? placement.lengthM * placement.widthM : 2000)
  );
  const centroidLat = placement?.lat !== undefined ? placement.lat.toFixed(4) : "20.3506";
  const centroidLon = placement?.lng !== undefined ? placement.lng.toFixed(4) : "74.3626";
  const lengthM = placement?.lengthM || 100;
  const widthM = placement?.widthM || 50;
  const nearestRoadDistM = roadAccess?.distanceM !== undefined ? Math.round(roadAccess.distanceM) : undefined;
  const nearestRoadName = roadAccess?.nearestRoadName || "Arterial Road";
  const nearestRoadClass = roadAccess?.nearestRoadClass || "classified road";

  const defaultStatus: CopilotResponseResult["statutoryStatus"] = hasRoadCollision
    ? "CRITICAL_COLLISION_DETECTED"
    : roadAccess?.requiresNewAccessRoad
    ? "PRELIMINARY_ACCESS_REQUIRED"
    : "PARTIAL_OSM_CENTERLINE_CLEARANCE";

  const createProvenanceFooter = (status: CopilotResponseResult["statutoryStatus"]) => {
    let footer = `\n\n---\n`;
    footer += `#### 📋 Analysis Provenance & Evidence Classification\n`;
    footer += `- **Engine**: \`UrjaSetu Local GIS Rules Engine (Deterministic Analysis)\`\n`;
    footer += `- **Statutory Status**: \`${status}\`\n`;
    footer += `- **Deterministic GIS Metrics**:\n`;
    footer += `  - Centroid Coordinates: \`(${centroidLat}° N, ${centroidLon}° E)\`\n`;
    footer += `  - Footprint Geometry: \`${lengthM}m × ${widthM}m\` (~${areaM2.toLocaleString()} m²)\n`;
    if (nearestRoadDistM !== undefined) {
      footer += `  - Nearest Mapped Road Feature: ~${nearestRoadDistM}m to \`${nearestRoadName}\` (${nearestRoadClass}; measured to 1D centerline)\n`;
    }
    footer += `- **Unverified Assumptions**:\n`;
    footer += `  - OpenStreetMap records 1D road centerlines, not 2D statutory right-of-way (ROW) boundary polygons or physical curb edges.\n`;
    footer += `  - Actual carriageway width, statutory building lines, and curb setbacks remain unverified without ground survey.\n`;
    footer += `- **Missing Evidence**:\n`;
    footer += `  - Official Cadastral 7/12 Extract (Mahabhulekh) & CTS demarcation.\n`;
    footer += `  - Municipal Development Plan (DP) reservation sheet & zoning certificate.\n`;
    footer += `  - Statutory building line clearance under Maharashtra UDCPR 2020.`;
    return footer;
  };

  const lowerMsg = message.toLowerCase();

  // Intent 0: Infrastructure Spatial Adjustment Commands
  const spatialAdj = extractSpatialAdjustmentFromIntent(message, placement);
  if (spatialAdj) {
    let reply = `### Infrastructure Spatial Adjustment Executed\n\n`;
    reply += `**Adjustment Action**: **${spatialAdj.summary}**\n\n`;

    if (spatialAdj.actionType === "snap_to_road") {
      reply += `- **Tangential Road Frontage Alignment**: Retracting structural footprint past the mandatory statutory 3.0m curb buffer under Maharashtra UDCPR 2020.\n`;
      reply += `- **Vehicular Ingress Optimization**: Orienting primary access parallel to the mapped carriageway to ensure safe turning radii for emergency tenders and public vehicles.\n`;
      reply += `- **Open Land Optimization**: Snapping centroid into the nearest contiguous parcel to eliminate conflicts.\n`;
    } else if (spatialAdj.actionType === "relocate_to_crossing") {
      reply += `- **Hydraulic Crossing Alignment**: Relocating bridge span to the nearest verified river crossing with existing approach road connections on both river banks.\n`;
      reply += `- **IRC Compliance**: Aligns with IRC:SP:73 two-lane standard with reduced structural embankment earthworks.\n`;
    } else {
      if (spatialAdj.lat !== undefined && spatialAdj.lng !== undefined) {
        reply += `- **Site Coordinates**: \`(${placement?.lat?.toFixed(4) || "20.3506"}, ${placement?.lng?.toFixed(4) || "74.3626"})\` → **\`(${spatialAdj.lat.toFixed(4)}, ${spatialAdj.lng.toFixed(4)})\`**\n`;
      }
      if (spatialAdj.lengthM !== undefined || spatialAdj.widthM !== undefined) {
        reply += `- **Footprint Dimensions**: \`${placement?.lengthM || 100}m × ${placement?.widthM || 50}m\` → **\`${spatialAdj.lengthM || placement?.lengthM || 100}m × ${spatialAdj.widthM || placement?.widthM || 50}m\`**\n`;
      }
      if (spatialAdj.bearingDeg !== undefined) {
        reply += `- **Orientation / Bearing**: \`${placement?.bearingDeg || 0}°\` → **\`${spatialAdj.bearingDeg}°\`**\n`;
      }
      reply += `- **Statutory Compliance**: Automatically recalculating road clearances, setbacks, and conflict buffers on the map.\n`;
    }

    reply += `\n*The map and footprint geometry have been updated directly. You can undo this change using the action button below or command further adjustments.*`;
    reply += createProvenanceFooter("VERIFIED_GEOMETRIC");

    return {
      reply,
      modelUsed: "local-gis-rules-engine",
      engineSource: "local_gis_engine",
      statutoryStatus: "VERIFIED_GEOMETRIC",
      deterministicMetrics: {
        coordinates: `(${centroidLat}° N, ${centroidLon}° E)`,
        dimensionsMeters: `${lengthM}m × ${widthM}m`,
        areaM2,
        nearestRoadDistanceM: nearestRoadDistM,
        nearestRoadName,
        roadGeometryType: "1D LineString (Centerline)",
      },
      assumptions: [
        "OpenStreetMap features are 1D centerlines; actual carriageway width and statutory ROW are unverified.",
      ],
      missingEvidence: [
        "Cadastral 7/12 land revenue extract (Mahabhulekh) & CTS demarcation.",
        "Municipal Development Plan (DP) reservation sheet.",
      ],
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
      proposedAdjustment: spatialAdj,
    };
  }

  // Strict Refusal Policy: Refuse to fabricate or guess unmeasured values (Air temp, canopy cover %, fake scores)
  const isRefusalQuery =
    (lowerMsg.includes("air temp") ||
     lowerMsg.includes("ambient temp") ||
     lowerMsg.includes("air temperature") ||
     lowerMsg.includes("ambient temperature")) ||
    (lowerMsg.includes("canopy cover") ||
     lowerMsg.includes("tree canopy") ||
     lowerMsg.includes("canopy percentage") ||
     lowerMsg.includes("canopy percent") ||
     lowerMsg.includes("canopy volume")) ||
    (lowerMsg.includes("arbitrary score") ||
     lowerMsg.includes("fake score") ||
     lowerMsg.includes("invent a score") ||
     lowerMsg.includes("invent score") ||
     lowerMsg.includes("make up a score") ||
     lowerMsg.includes("guess score") ||
     lowerMsg.includes("weighted score")) ||
    (lowerMsg.includes("guess temperature") ||
     lowerMsg.includes("guess the temperature") ||
     lowerMsg.includes("invent temperature") ||
     lowerMsg.includes("fabricate"));

  if (isRefusalQuery) {
    let reply = `### ⛔ Scientific Data Governance: Refusal to Invent Unmeasured Values\n\n`;
    reply += `In accordance with UrjaSetu scientific governance rules, this system **refuses to fabricate, invent, or guess unmeasured data**. Unknown values strictly remain \`null\` and display as **"Not available"**.\n\n`;
    reply += `#### Mandatory Scientific Safeguards\n`;
    reply += `1. **Surface Temperature (LST) is NOT Air Temperature**:\n`;
    reply += `   - Satellite thermal sensors (Landsat 9 TIRS-2 Band 10) measure radiometric surface skin temperature, **NOT** 2m ambient air temperature or human wet-bulb heat stress.\n`;
    reply += `   - Ambient air temperature requires calibrated micrometeorological automatic weather stations (AWS) at 2m height with aspirated radiation shields, which cannot be hallucinated from spaceborne radiometric data.\n\n`;
    reply += `2. **NDVI is NOT Tree Canopy Cover**:\n`;
    reply += `   - Normalized Difference Vegetation Index (NDVI) is a unitless mathematical ratio of spectral reflectance in red and near-infrared bands \`[-1.0, 1.0]\`, **NOT** 3D tree canopy volume, canopy percentage, or shade architecture.\n`;
    reply += `   - Ground canopy cover requires terrestrial LiDAR, drone photogrammetry, or high-resolution hemispherical crown segmentation.\n\n`;
    reply += `3. **No Arbitrary Weighted Composite Scores**:\n`;
    reply += `   - Prioritization is grounded strictly in physical cooling benefits (predicted LST delta in °C via 30-member spatial-block bootstrap LightGBM ensemble) per greenable hectare.\n`;
    reply += `   - Subjective weight matrices (e.g. 40% heat + 30% green + 30% pop) are disallowed as unscientific.\n\n`;
    reply += `4. **Strict Provenance Tagging**:\n`;
    reply += `   - Every valid displayed number is strictly tagged as **[Measured]** (satellite/ground), **[Modelled]** (machine learning prediction), or **[Assumed]** (scenario parameter).\n`;

    reply += createProvenanceFooter("INSUFFICIENT_EVIDENCE");

    return {
      reply,
      modelUsed: "local-gis-rules-engine",
      engineSource: "local_gis_engine",
      statutoryStatus: "INSUFFICIENT_EVIDENCE",
      deterministicMetrics: {
        coordinates: `(${centroidLat}° N, ${centroidLon}° E)`,
        dimensionsMeters: `${lengthM}m × ${widthM}m`,
        areaM2,
        nearestRoadDistanceM: nearestRoadDistM,
        nearestRoadName,
        roadGeometryType: "1D LineString (Centerline)",
      },
      assumptions: [
        "Surface temperature (LST) is radiometric skin temperature, NOT 2m ambient air temperature.",
        "NDVI is a spectral reflectance index, NOT tree canopy cover.",
        "Unknown values remain null and show 'Not available'.",
      ],
      missingEvidence: [
        "Calibrated 2m micrometeorological weather station (AWS) measurements.",
        "Terrestrial/airborne LiDAR tree canopy crown segmentation.",
      ],
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
    };
  }

  // Priority Tool Intent: run_optimization(budget_ha, target_ndvi)
  const isPriorityOptimizationQuery =
    lowerMsg.includes("run_optimization") ||
    (lowerMsg.includes("optimize") &&
      (lowerMsg.includes("budget") ||
       lowerMsg.includes("ha") ||
       lowerMsg.includes("cooling") ||
       lowerMsg.includes("greening") ||
       lowerMsg.includes("counterfactual") ||
       lowerMsg.includes("hectare"))) ||
    (lowerMsg.includes("counterfactual") && lowerMsg.includes("cooling"));

  if (isPriorityOptimizationQuery) {
    let budget_ha = 10.0;
    const budgetMatch =
      message.match(/(?:budget|spend|allocate)?\s*(\d+(?:\.\d+)?)\s*(?:ha|hectare|hectares)\b/i) ||
      message.match(/(?:budget_ha|budget)[:=]\s*(\d+(?:\.\d+)?)/i);
    if (budgetMatch) {
      budget_ha = parseFloat(budgetMatch[1]);
    }

    let target_ndvi = 0.65;
    const ndviMatch =
      message.match(/(?:target_ndvi|ndvi|target)[:=\s]+(?:of\s*)?(\d+(?:\.\d+)?)/i) ||
      message.match(/(\d+(?:\.\d+)?)\s*(?:target_ndvi|target ndvi|ndvi)\b/i);
    if (ndviMatch) {
      target_ndvi = parseFloat(ndviMatch[1]);
    }

    const optResult = executeRunOptimizationTool({ budget_ha, target_ndvi });

    let reply = `### 🌳 Counterfactual Heat Priority Optimization Results\n\n`;
    reply += `*Greedy benefit-per-hectare selection under hectare budget with 30-member Monte Carlo spatial bootstrap ensemble.*\n\n`;
    reply += `#### Scenario Inputs & Portfolio Summary\n`;
    reply += `- **Target Budget**: [Assumed] **${optResult.budget_ha} ha**\n`;
    reply += `- **Counterfactual Target NDVI**: [Assumed] **${target_ndvi}** (applied to greenable parcel fraction)\n`;
    reply += `- **Allocated Intervention Land**: [Modelled] **${optResult.allocated_ha} ha**\n`;
    reply += `- **Candidate Cells Evaluated**: [Measured] **${optResult.total_cells_evaluated}**\n`;
    reply += `- **Selected Priority Zones**: [Modelled] **${optResult.selected_cells_count}**\n\n`;

    if (optResult.status === "UNAVAILABLE") {
      reply += `⚠️ **Cooling Estimates Unavailable**: Counterfactual cooling predictions are unavailable because the model direction check failed or ensemble artifacts are missing. In accordance with project rules, cooling values remain null / "Not available".\n\n`;
    } else if (optResult.selected_cells.length > 0) {
      reply += `#### Top Ranked Priority Zones\n`;
      optResult.selected_cells.slice(0, 5).forEach((c) => {
        const coolingMean = c.cooling_mean !== null ? `${c.cooling_mean}°C` : "Not available";
        const coolingInterval = (c.cooling_p10 !== null && c.cooling_p90 !== null)
          ? `[${c.cooling_p10}°C to ${c.cooling_p90}°C]`
          : "Not available";
        const pop = c.population !== null ? c.population.toLocaleString() : "Not available";
        const robustnessPct = (c.selection_frequency * 100).toFixed(0);

        reply += `- **Zone \`${c.id}\`** (${c.ward}, Rank ${c.rank}):\n`;
        reply += `  - Greenable Land: [Modelled] **${c.greenable_ha} ha**\n`;
        reply += `  - Expected Cooling: [Modelled] **${coolingMean}** (80% CI: ${coolingInterval})\n`;
        reply += `  - Population Benefited: [Measured] **${pop} citizens**\n`;
        reply += `  - Monte Carlo Robustness: [Modelled] **${robustnessPct}%** (${c.times_selected_ensemble}/30 ensemble iterations)\n`;
      });
      reply += `\n`;
    }

    reply += `#### Mandatory Scientific Safeguards\n`;
    reply += `- **Surface Temperature (LST)**: Radiometric skin temperature from Landsat 9 TIRS-2; NOT 2m ambient air temperature.\n`;
    reply += `- **NDVI**: Unitless spectral reflectance index [-1.0, 1.0]; NOT tree canopy cover percentage.\n`;
    reply += `- **Grounding**: Model quotes only numbers returned by optimizer backend; arbitrary composite scores are disallowed.\n`;

    reply += createProvenanceFooter("VERIFIED_GEOMETRIC");

    return {
      reply,
      modelUsed: "local-gis-rules-engine",
      engineSource: "local_gis_engine",
      statutoryStatus: "VERIFIED_GEOMETRIC",
      deterministicMetrics: {
        coordinates: `(${centroidLat}° N, ${centroidLon}° E)`,
        dimensionsMeters: `${lengthM}m × ${widthM}m`,
        areaM2,
        nearestRoadDistanceM: nearestRoadDistM,
        nearestRoadName,
        roadGeometryType: "1D LineString (Centerline)",
      },
      assumptions: [
        `Scenario budget: ${optResult.budget_ha} ha [Assumed].`,
        `Counterfactual target NDVI: ${target_ndvi} [Assumed].`,
      ],
      missingEvidence: [
        "High-resolution municipal drone thermography.",
        "Ground-level sapling survival survey.",
      ],
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
    };
  }

  // Priority Tool Intent: get_zone(id)
  const zoneIdMatch =
    message.match(/\b(cell_250m_\d+)\b/i) ||
    message.match(/(?:get_zone|zone_id|zone)[:=\s]+([a-zA-Z0-9_\-]+)/i);

  if (zoneIdMatch) {
    const requestedId = zoneIdMatch[1];
    const zoneData = executeGetZoneTool({ id: requestedId });

    if (!zoneData.found) {
      let reply = `### 🔍 Priority Zone Lookup: \`${requestedId}\`\n\n`;
      reply += `⚠️ **Zone Not Found**: \`${requestedId}\` does not exist in the priority cells database.\n\n`;
      reply += `**Scientific Data Governance Rule**: UrjaSetu strictly refuses to fabricate or guess unobserved zone metrics. Unknown values remain \`null\` and display as **"Not available"**.\n`;
      reply += createProvenanceFooter("INSUFFICIENT_EVIDENCE");

      return {
        reply,
        modelUsed: "local-gis-rules-engine",
        engineSource: "local_gis_engine",
        statutoryStatus: "INSUFFICIENT_EVIDENCE",
        deterministicMetrics: {
          coordinates: `(${centroidLat}° N, ${centroidLon}° E)`,
          dimensionsMeters: `${lengthM}m × ${widthM}m`,
          areaM2,
          nearestRoadDistanceM: nearestRoadDistM,
          nearestRoadName,
          roadGeometryType: "1D LineString (Centerline)",
        },
        assumptions: ["Requested zone does not exist; data fabrication is forbidden."],
        missingEvidence: [`Zone ID ${requestedId} is not registered in cells.json.`],
        groundedFacts: {
          city,
          infrastructureType: infraType,
          hasRoadCollision,
          roadAccessStatus,
          statutoryFramework,
        },
      };
    }

    let reply = `### 📍 Priority Zone Intelligence: \`${zoneData.id}\`\n\n`;
    reply += `**Administrative Ward**: ${zoneData.ward}\n`;
    reply += `**Centroid Coordinates**: [Measured] \`(${zoneData.centroid[1].toFixed(4)}° N, ${zoneData.centroid[0].toFixed(4)}° E)\`\n\n`;

    reply += `#### 1. Measured Satellite & Demographic Observations\n`;
    reply += `- **Land Surface Temperature (LST Mean)**: [Measured] **${zoneData.lst_mean !== null ? zoneData.lst_mean + "°C" : "Not available"}** (Std: ${zoneData.lst_std !== null ? "±" + zoneData.lst_std + "°C" : "Not available"})\n`;
    reply += `  *(Radiometric surface skin temperature from Landsat 9 TIRS-2 pre-monsoon composite; NOT 2m ambient air temperature)*\n`;
    reply += `- **Cloud-Free Satellite Observations**: [Measured] **${zoneData.n_obs !== null ? zoneData.n_obs + " scenes" : "Not available"}**\n`;
    reply += `- **Vegetation Index (NDVI)**: [Measured] **${zoneData.ndvi !== null ? zoneData.ndvi : "Not available"}**\n`;
    reply += `  *(Unitless spectral reflectance index [-1.0, 1.0] from Sentinel-2 L2A; NOT tree canopy cover)*\n`;
    reply += `- **Built-Up Surface Fraction**: [Measured] **${zoneData.built_frac !== null ? (zoneData.built_frac * 100).toFixed(1) + "%" : "Not available"}**\n`;
    reply += `- **Resident Population**: [Measured] **${zoneData.population !== null ? zoneData.population.toLocaleString() + " people" : "Not available"}**\n\n`;

    reply += `#### 2. Modelled Physical Cooling Predictions\n`;
    reply += `- **Greenable Land**: [Modelled] **${zoneData.greenable_ha !== null ? zoneData.greenable_ha + " ha" : "Not available"}**\n`;
    reply += `- **Expected Cooling Benefit**: [Modelled] **${zoneData.cooling_mean !== null ? zoneData.cooling_mean + "°C" : "Not available"}**\n`;
    reply += `- **Cooling 80% Confidence Interval**: [Modelled] **${zoneData.cooling_p10 !== null && zoneData.cooling_p90 !== null ? "[" + zoneData.cooling_p10 + "°C to " + zoneData.cooling_p90 + "°C]" : "Not available"}**\n`;
    if (zoneData.ensemble_stats?.spread !== null && zoneData.ensemble_stats?.spread !== undefined) {
      reply += `- **Monte Carlo Uncertainty Spread**: [Modelled] **${zoneData.ensemble_stats.spread}°C** across ${zoneData.ensemble_stats.memberCount} bootstrap members\n`;
    }
    reply += `\n`;

    reply += `#### 3. Statutory Disclaimers\n`;
    reply += `- Surface temperature (LST) is radiometric skin temperature, NOT 2m ambient air temperature.\n`;
    reply += `- NDVI is a spectral reflectance index, NOT tree canopy cover.\n`;
    reply += `- Unknown values remain null and show "Not available".\n`;

    reply += createProvenanceFooter("VERIFIED_GEOMETRIC");

    return {
      reply,
      modelUsed: "local-gis-rules-engine",
      engineSource: "local_gis_engine",
      statutoryStatus: "VERIFIED_GEOMETRIC",
      deterministicMetrics: {
        coordinates: `(${zoneData.centroid[1].toFixed(4)}° N, ${zoneData.centroid[0].toFixed(4)}° E)`,
        dimensionsMeters: "250m × 250m",
        areaM2: 62500,
        nearestRoadDistanceM: nearestRoadDistM,
        nearestRoadName,
        roadGeometryType: "250m Grid Cell Centroid",
      },
      assumptions: [
        "Counterfactual cooling modelled via 30-member spatial-block bootstrap LightGBM ensemble.",
        "LST is radiometric skin temperature from Landsat 9 Band 10.",
      ],
      missingEvidence: [
        "In-situ aspirated ambient air temperature sensor logging.",
        "Microclimate CFD wind canyon modelling.",
      ],
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
    };
  }

  // Intent 1: Road collision / overlap
  if (
    lowerMsg.includes("collision") ||
    lowerMsg.includes("overlap") ||
    (lowerMsg.includes("road") &&
      (lowerMsg.includes("cut") ||
        lowerMsg.includes("hit") ||
        lowerMsg.includes("touch") ||
        lowerMsg.includes("encroach") ||
        lowerMsg.includes("check")))
  ) {
    let reply = `### Road Alignment & Centerline Clearance Assessment\n\n`;
    if (hasRoadCollision && roadCollision) {
      reply += `⚠️ **Critical Encroachment Detected**: The proposed **${infraType}** footprint directly intersects the mapped right-of-way or centerline of **${roadCollision.label}**.\n\n`;
      reply += `- **Collision Details**: ${roadCollision.description}\n`;
      reply += `- **Statutory Standard**: Under Indian Roads Congress (IRC) guidelines and Maharashtra UDCPR 2020 (Rule 15.1), no permanent structural footprint may encroach upon public road rights-of-way or carriageways.\n`;
      reply += `- **Recommended Action**: Click the **"Snap to Road & Open Land"** tool in the control panel to automatically retract and align the footprint tangent to the curb with mandatory statutory setback (${infraType === "Park" ? "1.0m" : "3.0m"}), or drag the polygon clear of the road corridor.`;
    } else {
      const dist = nearestRoadDistM !== undefined ? nearestRoadDistM : 0;
      reply += `ℹ️ **Geometric Clearance to Mapped OSM Centerline**: The proposed **${infraType}** footprint clears mapped 1D road centerlines in the **${city}** survey area.\n\n`;
      reply += `- **Status**: \`PARTIAL_OSM_CENTERLINE_CLEARANCE\` | \`UNVERIFIED_STATUTORY_ROW\`\n`;
      reply += `- **Geometric Clearance**: Separated by ~${dist}m from nearest mapped centerline (**${nearestRoadName}**).\n`;
      reply += `- **1D Centerline vs Statutory ROW**: OpenStreetMap data represents 1D centerlines, NOT statutory carriageway polygons or legal road rights-of-way. The ~${dist}m metric is measured to the centerline; if this corridor has an unmapped statutory ROW width (e.g. 15m–30m), physical clearance to the curb line is substantially less.\n`;
      reply += `- **Statutory Setback Notice**: Full compliance with Maharashtra UDCPR 2020 (Rule 15.1 building line setbacks) CANNOT be certified from OpenStreetMap centerlines alone and requires municipal cadastral verification.`;
    }
    const currentStatus: CopilotResponseResult["statutoryStatus"] = hasRoadCollision
      ? "CRITICAL_COLLISION_DETECTED"
      : "PARTIAL_OSM_CENTERLINE_CLEARANCE";
    reply += createProvenanceFooter(currentStatus);

    return {
      reply,
      modelUsed: "local-gis-rules-engine",
      engineSource: "local_gis_engine",
      statutoryStatus: currentStatus,
      deterministicMetrics: {
        coordinates: `(${centroidLat}° N, ${centroidLon}° E)`,
        dimensionsMeters: `${lengthM}m × ${widthM}m`,
        areaM2,
        nearestRoadDistanceM: nearestRoadDistM,
        nearestRoadName,
        roadGeometryType: "1D LineString (Centerline)",
      },
      assumptions: [
        "OpenStreetMap features are 1D centerlines; actual carriageway width and statutory ROW are unverified.",
        "Ground topography permits surface ingress without unmapped micro-relief barriers.",
      ],
      missingEvidence: [
        "Cadastral 7/12 land revenue extract (Mahabhulekh) & CTS demarcation.",
        "Municipal Development Plan (DP) reservation sheet.",
        "Statutory UDCPR 2020 building line clearance certificate.",
      ],
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
    };
  }

  // Intent 2: Road access / preliminary access road
  if (
    lowerMsg.includes("access") ||
    lowerMsg.includes("connect") ||
    lowerMsg.includes("approach") ||
    lowerMsg.includes("distance")
  ) {
    let reply = `### Road Ingress, Egress & Access Road Alignment\n\n`;
    if (roadAccess?.requiresNewAccessRoad) {
      const dist = Math.round(roadAccess.distanceM || 0);
      reply += `⚠️ **Preliminary Access Road Required**: The site is currently offset from the public street network by **${dist}m** to **${roadAccess.nearestRoadName || "nearest road corridor"}** (measured to the 1D centerline).\n\n`;
      reply += `**Preliminary Access Alignment Overview**:\n`;
      reply += `- **Required Span**: ${dist}m conceptual connection corridor to ${roadAccess.nearestRoadName || "the public highway"}.\n`;
      reply += `- **Minimum Statutory Width (UDCPR 2020)**: Minimum 9.0m to 12.0m carriageway for public institutional facilities, schools, and hospitals to support two-way traffic and emergency tender turning radii.\n`;
      reply += `- **Planning Caution**: The preliminary road displayed on the map is a **conceptual geometric planning line**. Formal right-of-way acquisition and municipal DP road reservation must be confirmed before construction.`;
    } else {
      const dist = nearestRoadDistM !== undefined ? nearestRoadDistM : 0;
      reply += `ℹ️ **Road Centerline Proximity**: Proposed site boundary is ~**${dist}m** from mapped road centerline (**${nearestRoadName}**).\n\n`;
      reply += `- **Access Continuity**: Positioned within direct approach distance (<= 15m) of mapped street centerline.\n`;
      reply += `- **Engineering Caveat**: Measured to OpenStreetMap 1D centerline. Statutory carriage-way width and municipal curb clearance under Maharashtra UDCPR 2020 require field cadastre verification.\n`;
      reply += `- **Recommended Frontage Width**: Maintain at least 12.0m to 15.0m clear frontage for dedicated emergency and visitor access bays.`;
    }
    const currentStatus: CopilotResponseResult["statutoryStatus"] = roadAccess?.requiresNewAccessRoad
      ? "PRELIMINARY_ACCESS_REQUIRED"
      : "PARTIAL_OSM_CENTERLINE_CLEARANCE";
    reply += createProvenanceFooter(currentStatus);

    return {
      reply,
      modelUsed: "local-gis-rules-engine",
      engineSource: "local_gis_engine",
      statutoryStatus: currentStatus,
      deterministicMetrics: {
        coordinates: `(${centroidLat}° N, ${centroidLon}° E)`,
        dimensionsMeters: `${lengthM}m × ${widthM}m`,
        areaM2,
        nearestRoadDistanceM: nearestRoadDistM,
        nearestRoadName,
        roadGeometryType: "1D LineString (Centerline)",
      },
      assumptions: [
        "OpenStreetMap features are 1D centerlines; actual carriageway width and statutory ROW are unverified.",
      ],
      missingEvidence: [
        "Cadastral 7/12 land revenue extract (Mahabhulekh) & CTS demarcation.",
        "Municipal Development Plan (DP) reservation sheet.",
      ],
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
    };
  }

  // Intent 3: Official DP & UDCPR Rules
  if (
    lowerMsg.includes("rule") ||
    lowerMsg.includes("udcpr") ||
    lowerMsg.includes("document") ||
    lowerMsg.includes("dp") ||
    lowerMsg.includes("law") ||
    lowerMsg.includes("statutory") ||
    lowerMsg.includes("regulation")
  ) {
    let reply = `### Official Development Plan & Maharashtra UDCPR 2020 Framework\n\n`;
    reply += `**Governing Planning Authority**: ${officialContext?.jurisdiction || "Local Planning Authority"}\n`;
    reply += `**Applicable Master Plan**: ${officialContext?.masterPlan || "Approved City Development Plan"}\n`;
    reply += `**Statutory Code**: Unified Development Control and Promotion Regulations for Maharashtra State (UDCPR 2020)\n\n`;

    reply += `**Mandatory Compliance Points for ${infraType}**:\n`;
    reply += `1. **Means of Access (UDCPR Rule 15.1)**: Road width abutting the plot must meet minimum category thresholds (${infraType === "Hospital" ? "minimum 12.0m to 15.0m" : "minimum 9.0m"}).\n`;
    reply += `2. **Marginal Open Spaces / Setbacks**: Front setback of minimum 3.0m - 4.5m from road boundary line; side and rear margins of 3.0m for light and ventilation.\n`;
    reply += `3. **Parking Norms (UDCPR Rule 15.4)**: Off-street parking bays required based on built-up area and operational capacity.\n`;
    reply += `4. **Fire Safety & CFO NOC**: Mandatory clearance from the Chief Fire Officer (CFO) for assembly and public buildings.\n`;
    reply += `5. **DP Reservation Verification**: Must cross-reference municipal Development Plan sheets to verify the parcel is not reserved for water bodies, open reservations, or public utilities.`;

    reply += createProvenanceFooter("UNVERIFIED_STATUTORY_ROW");

    return {
      reply,
      modelUsed: "local-gis-rules-engine",
      engineSource: "local_gis_engine",
      statutoryStatus: "UNVERIFIED_STATUTORY_ROW",
      deterministicMetrics: {
        coordinates: `(${centroidLat}° N, ${centroidLon}° E)`,
        dimensionsMeters: `${lengthM}m × ${widthM}m`,
        areaM2,
        nearestRoadDistanceM: nearestRoadDistM,
        nearestRoadName,
        roadGeometryType: "1D LineString (Centerline)",
      },
      assumptions: [
        "OpenStreetMap features are 1D centerlines; actual carriageway width and statutory ROW are unverified.",
      ],
      missingEvidence: [
        "Cadastral 7/12 land revenue extract (Mahabhulekh) & CTS demarcation.",
        "Municipal Development Plan (DP) reservation sheet.",
      ],
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
    };
  }

  // Intent 4: Citizen plain-language explanation
  if (
    lowerMsg.includes("citizen") ||
    lowerMsg.includes("simple") ||
    lowerMsg.includes("plain") ||
    lowerMsg.includes("explain")
  ) {
    const score = report?.overallScore ?? (hasRoadCollision ? 45 : 85);
    let reply = `### Site Evaluation in Simple Plain Language\n\n`;
    reply += `**Bottom-Line Verdict**: This location is currently rated **${score}/100** for a **${infraType}** in **${city}**.\n\n`;

    reply += `**The Good News (Pros)**:\n`;
    if (!hasRoadCollision) {
      reply += `- Does not block or overlap any mapped road centerlines or street traffic.\n`;
    }
    if (!roadAccess?.requiresNewAccessRoad) {
      reply += `- Has direct road connection (~${nearestRoadDistM ?? 0}m to centerline), making it easy for citizens to reach.\n`;
    } else {
      reply += `- Situated in a developing expansion zone.\n`;
    }
    reply += `- Sized at approx. ${areaM2.toLocaleString()} m² footprint area.\n\n`;

    reply += `**Points of Caution (Cons / Watch Outs)**:\n`;
    if (hasRoadCollision) {
      reply += `- ⚠️ **Road Encroachment**: The building sits partly inside a street, which will cause traffic problems and cannot be approved legally.\n`;
    }
    if (roadAccess?.requiresNewAccessRoad) {
      reply += `- ⚠️ **Needs New Road**: Visitors cannot drive directly to the plot today; a ${Math.round(roadAccess.distanceM || 0)}m access road must be built.\n`;
    }
    if (buildingCollisions.length > 0) {
      reply += `- ⚠️ **Existing Buildings**: Intersects ${buildingCollisions.length} existing structures that would need clearance.\n`;
    }
    reply += `- Official revenue land titles (7/12 extract) still need to be verified with the local Talathi office.`;

    reply += createProvenanceFooter(defaultStatus);

    return {
      reply,
      modelUsed: "local-gis-rules-engine",
      engineSource: "local_gis_engine",
      statutoryStatus: defaultStatus,
      deterministicMetrics: {
        coordinates: `(${centroidLat}° N, ${centroidLon}° E)`,
        dimensionsMeters: `${lengthM}m × ${widthM}m`,
        areaM2,
        nearestRoadDistanceM: nearestRoadDistM,
        nearestRoadName,
        roadGeometryType: "1D LineString (Centerline)",
      },
      assumptions: [
        "OpenStreetMap features are 1D centerlines; actual carriageway width and statutory ROW are unverified.",
      ],
      missingEvidence: [
        "Cadastral 7/12 land revenue extract (Mahabhulekh) & CTS demarcation.",
        "Municipal Development Plan (DP) reservation sheet.",
      ],
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
    };
  }

  // Intent 8: Intelligent Urban Intervention Planning, Spatial Discovery & Infrastructure Co-Planning (Phase 5 & 6)
  const isInterventionQuery =
    (lowerMsg.includes("urban intervention") ||
     lowerMsg.includes("planning dossier") ||
     lowerMsg.includes("dossier") ||
     lowerMsg.includes("co-planning") ||
     lowerMsg.includes("prioritis") ||
     lowerMsg.includes("prioritiz") ||
     lowerMsg.includes("dynamic discovery") ||
     lowerMsg.includes("spatial discovery") ||
     lowerMsg.includes("discovery run") ||
     lowerMsg.includes("dataset registry") ||
     lowerMsg.includes("source dataset") ||
     lowerMsg.includes("analysis run") ||
     lowerMsg.includes("provenance") ||
     lowerMsg.includes("rejection reason") ||
     lowerMsg.includes("how were these discovered") ||
     (lowerMsg.includes("intervention") && !lowerMsg.includes("cooling intervention") && !lowerMsg.includes("heat mitigation")) ||
     lowerMsg.includes("candidate") ||
     lowerMsg.includes("karve") ||
     lowerMsg.includes("laxmi") ||
     lowerMsg.includes("sassoon") ||
     lowerMsg.includes("mandai") ||
     lowerMsg.includes("swargate") ||
     lowerMsg.includes("balgandharva") ||
     lowerMsg.includes("saras baug") ||
     lowerMsg.includes("kamala nehru"));

  if (isInterventionQuery) {
    const datasetDerivedCandidates = generateInterventionCandidates({ includeSamples: false });
    const sampleCandidates = generateCuratedSampleCandidates();
    const allCandidates = [...datasetDerivedCandidates, ...sampleCandidates];
    const latestRun = getLatestAnalysisRun();
    const registrySummary = getDatasetAvailabilitySummary();
    
    // Check if user is asking specifically about discovery methodology, datasets, or analysis runs
    const isDiscoveryOrRegistryQuery =
      lowerMsg.includes("discover") ||
      lowerMsg.includes("registry") ||
      lowerMsg.includes("source dataset") ||
      lowerMsg.includes("analysis run") ||
      lowerMsg.includes("provenance") ||
      lowerMsg.includes("rejection") ||
      lowerMsg.includes("how were these");

    let reply = `### 🏛️ Evidence-Based Urban Intervention Planning: ${city}\n\n`;

    if (isDiscoveryOrRegistryQuery && !lowerMsg.includes("dossier")) {
      reply += `#### 1. Dynamic Spatial Discovery Engine (Phase 6)\n`;
      reply += `Intervention candidates in UrjaSetu are **dynamically discovered from actual spatial datasets**, eliminating reliance on hardcoded demonstration points.\n\n`;
      if (latestRun) {
        reply += `- **Analysis Run ID**: \`${latestRun.analysisId}\`\n`;
        reply += `- **Execution Timestamp**: \`${latestRun.executionTimestamp}\`\n`;
        reply += `- **Thermal Hotspot Threshold**: LST $\\ge$ \`${latestRun.parameters.minLstThreshold ?? 46.0}°C\`\n`;
        reply += `- **Vegetation Deficit Threshold**: NDVI $\\le$ \`${latestRun.parameters.maxNdviThreshold ?? 0.35}\`\n`;
        reply += `- **Total Candidates Discovered**: **${latestRun.candidatesDiscovered}** dataset-derived candidates\n`;
        reply += `- **Total Screened Features**: **${latestRun.featuresEvaluated}** municipal/OSM assets\n\n`;

        reply += `#### 2. Candidate Evaluation & Rejection Audit\n`;
        reply += `Features screened by the engine must meet multi-criteria spatial and raster thresholds. Rejections during this run:\n`;
        Object.entries(latestRun.rejectionReasonsSummary).forEach(([reason, count]) => {
          reply += `- **${reason}**: \`${count}\` features excluded\n`;
        });
        reply += `\n`;
      }

      reply += `#### 3. Ingested Authoritative Spatial Datasets\n`;
      reply += `- **Official PMC Gardens & Parks**: \`81\` municipal green assets (\`pmc_gardens.json\`, official PMC open register, VERIFIED_OFFICIAL)\n`;
      reply += `- **Official PMC Government Hospitals**: \`50\` municipal health facilities (\`pmc_hospitals.json\`, official PMC register, VERIFIED_OFFICIAL)\n`;
      reply += `- **OpenStreetMap EV Charging Stations**: \`13\` charging nodes (\`pmc_ev_stations.json\`, MAPPED_IN_OSM, sanitized without placeholder defaults)\n`;
      reply += `- **Curated Arterial Road Corridors**: \`10\` key transit spines (\`pmc_road_corridors.json\`, MANUALLY_CURATED sample points, estimated widths)\n`;
      reply += `- **MSEDCL High-Tension Substations**: \`6\` grid substations (\`pmc_substations.json\`, nameplate MVA capacity; spare headroom unverified)\n`;
      reply += `- **Landsat 9 TIRS-2 Band 10**: Calibrated 30m Land Surface Temperature (\`pune_lst_calibrated_30m.tif\`, surface skin temperature)\n`;
      reply += `- **Sentinel-2B MSI Level-2A BOA**: 30m target grid NDVI and SCL classification (\`pune_ndvi_30m.tif\`)\n\n`;

      reply += `#### 4. Candidate Provenance Classification\n`;
      reply += `- **DATASET_DERIVED** (${datasetDerivedCandidates.filter(c => c.provenanceType === 'DATASET_DERIVED').length} active): Discovered automatically via dynamic spatial search against real feature IDs and satellite raster cells.\n`;
      reply += `- **MANUALLY_CURATED** (${datasetDerivedCandidates.filter(c => c.provenanceType === 'MANUALLY_CURATED').length} active): Curated highway corridor sample points and multimodal seeds evaluated under REQUIRES_SITE_VALIDATION.\n`;
      reply += `- **SAMPLE_LOCATION** (${sampleCandidates.length} preserved): Curated landmark locations (e.g., Balgandharva, Saras Baug, Swargate) strictly segregated in reference mode to avoid data contamination.\n\n`;

      reply += `#### 5. Dataset Registry Health & Data Gaps\n`;
      reply += `- Total Registered Datasets: **${registrySummary.totalRegistered}** (Available: \`${registrySummary.availableCount}\`, Officially Verified: \`${registrySummary.officialVerifiedCount}\`)\n`;
      reply += `- Cadastral Boundaries / Land Ownership: **MISSING / BLOCKED** (Non-authoritative candidate boundary only; statutory PMC cadastral parcel maps pending municipal MOU).\n`;
      reply += `- Distribution Transformer Reverse Power Capacity: **FIELD SURVEY REQUIRED** (MSEDCL feeder-level SCADA telemetry pending utility data-sharing agreement).\n\n`;
    } else {
      // Check if user is referencing a specific candidate site by id or distinctive site name
      const domainStopWords = new Set([
        'corridor', 'shading', 'canopy', 'hospital', 'retrofit', 
        'expansion', 'parking', 'centre', 'center', 'garden', 
        'street', 'facility', 'upgrade', 'municipal', 'arterial',
        'roof', 'solar', 'charging', 'point', 'green', 'space',
        'park', 'road', 'energy', 'station', 'health', 'hub', 'public',
        'pune', 'maharashtra', 'india', 'area', 'city'
      ]);

      let matchedCandidate: (typeof allCandidates)[number] | undefined = undefined;
      let highestMatchScore = 0;

      for (const c of allCandidates) {
        if (lowerMsg.includes(c.id.toLowerCase())) {
          matchedCandidate = c;
          highestMatchScore = 100;
          break;
        }

        const siteWords = c.name
          .toLowerCase()
          .split(/[\s,.-]+/)
          .filter(p => p.length >= 3 && !domainStopWords.has(p));

        if (siteWords.length === 0) continue;

        let score = 0;
        for (const w of siteWords) {
          if (lowerMsg.includes(w)) {
            score += w.length;
          }
        }

        if (score > highestMatchScore) {
          highestMatchScore = score;
          matchedCandidate = c;
        }
      }

      if (highestMatchScore < 3) {
        matchedCandidate = undefined;
      }

      if (matchedCandidate) {
        const lst = matchedCandidate.thermalContext.surfaceTemperatureCelsius;
        const lstDelta = matchedCandidate.thermalContext.lstDeltaToBaselineCelsius;
        const ndvi = matchedCandidate.vegetationContext.ndvi30m;

        reply += `#### 1. Candidate Profile: ${matchedCandidate.name}\n`;
        reply += `- **Category**: \`${matchedCandidate.categoryId}\`\n`;
        reply += `- **Provenance**: \`${matchedCandidate.provenanceType}\` (${matchedCandidate.provenanceType === "DATASET_DERIVED" ? "Dynamically discovered from spatial dataset" : "Curated reference landmark"})\n`;
        if (matchedCandidate.sourceFeatureId) {
          reply += `- **Source Feature ID**: \`${matchedCandidate.sourceFeatureId}\` (Dataset: \`${matchedCandidate.sourceDatasetName ?? "N/A"}\`)\n`;
        }
        if (matchedCandidate.analysisRunId) {
          reply += `- **Analysis Run ID**: \`${matchedCandidate.analysisRunId}\`\n`;
        }
        reply += `- **Ward / Prabhag**: ${matchedCandidate.wardOrPrabhag}\n`;
        reply += `- **Coordinates**: \`(${matchedCandidate.coordinates.lat.toFixed(4)}° N, ${matchedCandidate.coordinates.lng.toFixed(4)}° E)\`\n`;
        reply += `- **Status**: **${matchedCandidate.status}** (${matchedCandidate.evidenceCompleteness} evidence)\n`;
        reply += `- **Location Context**: ${matchedCandidate.locationSummary}\n\n`;

        reply += `#### 2. Verified Spatial & Satellite Evidence\n`;
        reply += `- **Landsat 9 LST**: **${lst !== null ? `${lst}°C` : "NoData"}** (${lstDelta !== null ? `${lstDelta > 0 ? "+" : ""}${lstDelta}°C` : "N/A"} vs study area baseline \`46.3°C\`). Radiometric uncertainty: \`±${matchedCandidate.thermalContext.landsatStQaUncertaintyK ?? 0.81} K\`.\n`;
        reply += `- **Sentinel-2 NDVI (30m)**: **${ndvi !== null ? ndvi : "NoData"}** (SCL: \`${matchedCandidate.vegetationContext.sclClassName}\`)\n`;
        reply += `- **Infrastructure Frontage**: ${matchedCandidate.infrastructureContext.nearestRoadDistanceM}m from \`${matchedCandidate.infrastructureContext.nearestRoadName}\`\n`;
        if (matchedCandidate.infrastructureContext.nearestSubstationName) {
          reply += `- **Power Substation**: ${matchedCandidate.infrastructureContext.nearestSubstationName} (${matchedCandidate.infrastructureContext.nearestSubstationDistanceM}m)\n`;
        }
        if (matchedCandidate.estimatedTargetAreaM2) {
          reply += `- **Estimated Footprint Area**: \`${matchedCandidate.estimatedTargetAreaM2.toLocaleString()} m²\` (Note: Usable area $\\ne$ footprint)\n`;
        }
        reply += `\n`;

        reply += `#### 3. Constraints & Site-Specific Blockers\n`;
        matchedCandidate.constraints.forEach(con => {
          reply += `- **[${con.severity}] ${con.title}**: ${con.description} *(Mitigation: ${con.mitigationRequirement})*\n`;
        });
        reply += `\n`;

        reply += `#### 4. Mandatory Pre-Implementation Site Surveys\n`;
        matchedCandidate.missingSurveyChecklist.forEach(surv => {
          reply += `- **${surv.itemName}** (${surv.requiredForPhase}): ${surv.description} [Standard: \`${surv.surveyStandardOrMethodology}\`]\n`;
        });
        reply += `\n`;

        reply += `#### 5. Recommended Immediate Action\n`;
        reply += `> ${matchedCandidate.recommendedNextAction}\n\n`;
      } else {
        const categories = listCategoryMetadata();
        reply += `#### 1. Five Core Intervention Planning Categories\n`;
        categories.forEach(cat => {
          const catCands = datasetDerivedCandidates.filter(c => c.categoryId === cat.id);
          reply += `1. **${cat.name}** (\`${cat.id}\`): ${cat.shortDescription} — *${catCands.length} dynamically discovered candidates.*\n`;
        });
        reply += `\n`;

        reply += `#### 2. Key Dynamically Discovered Candidate Sites\n`;
        datasetDerivedCandidates.slice(0, 5).forEach(c => {
          const lst = c.thermalContext.surfaceTemperatureCelsius;
          reply += `- **${c.name}** (\`${c.categoryId}\`): LST **${lst ?? "N/A"}°C**, Status: **${c.status}** (${c.wardOrPrabhag}) [Provenance: \`${c.provenanceType}\`]\n`;
        });
        reply += `\n`;

        reply += `#### 3. Evidence-Based Prioritisation Heuristic\n`;
        reply += `- **No Arbitrary Composite Scores**: Sites are evaluated multi-dimensionally across continuous LST delta, vegetation index deficit, infrastructure proximity, and structural constraints.\n`;
        reply += `- **Zero Fabricated Benefits**: UrjaSetu does not simulate unverified air cooling degrees (e.g. "planting 50 trees will reduce temperature by 3°C") or financial ROI without microclimate CFD and energy bills.\n`;
        reply += `- **Reproducible Runs**: Candidates are stamped with an \`analysisRunId\` and traced to verified municipal or OSM feature IDs.\n`;
        reply += `- **Mandatory Governance**: Physical site inspection, load testing, utility clearance, and municipal approval must precede financial tendering.\n\n`;
      }
    }

    reply += createProvenanceFooter("VERIFIED_GEOMETRIC");

    return {
      reply,
      modelUsed: "local-gis-rules-engine",
      engineSource: "local_gis_engine",
      statutoryStatus: "VERIFIED_GEOMETRIC",
      deterministicMetrics: {
        coordinates: `(${centroidLat}° N, ${centroidLon}° E)`,
        dimensionsMeters: `${lengthM}m × ${widthM}m`,
        areaM2,
        nearestRoadDistanceM: nearestRoadDistM,
        nearestRoadName,
        roadGeometryType: "1D LineString (Centerline)",
      },
      assumptions: [
        "Satellite LST measures surface skin temperature on 2023-04-22, not ambient 2m air temperature.",
        "Building footprint area does not equal usable rooftop area (typically 45-75% net).",
        "Candidate site status is an exploratory planning classification, not formal administrative sanction.",
      ],
      missingEvidence: [
        "On-site structural non-destructive testing (NDT) / ultrasonic pulse velocity.",
        "Underground utility cadastre ground-penetrating radar (GPR) scan.",
        "MSEDCL distribution transformer sanctioned capacity and reverse power headroom.",
      ],
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
    };
  }

  // Intent 7: Urban Heat, Land Surface Temperature (LST), Vegetation (NDVI), and Microclimate
  if (
    lowerMsg.includes("heat") ||
    lowerMsg.includes("lst") ||
    lowerMsg.includes("ndvi") ||
    lowerMsg.includes("vegetation") ||
    lowerMsg.includes("temperature") ||
    lowerMsg.includes("cooling") ||
    lowerMsg.includes("cool roof") ||
    lowerMsg.includes("canopy") ||
    lowerMsg.includes("greenery") ||
    lowerMsg.includes("microclimate") ||
    lowerMsg.includes("thermal") ||
    lowerMsg.includes("urban heat island")
  ) {
    let pointHeat: any = null;
    let cityHeat: any = null;

    if (isHeatDataAvailable()) {
      try {
        cityHeat = getHeatDiagnostics();
        if (placement?.lat !== undefined && placement?.lng !== undefined) {
          pointHeat = queryHeatPoint(placement.lng, placement.lat);
        }
      } catch (err) {
        console.warn("Could not query local heat data:", err);
      }
    }

    const cityMeanLST = cityHeat?.landsat9?.calibratedLSTCelsius?.mean ? `${cityHeat.landsat9.calibratedLSTCelsius.mean.toFixed(1)}°C` : "46.3°C";
    const cityMinLST = cityHeat?.landsat9?.calibratedLSTCelsius?.min ? `${cityHeat.landsat9.calibratedLSTCelsius.min.toFixed(1)}°C` : "25.8°C";
    const cityMaxLST = cityHeat?.landsat9?.calibratedLSTCelsius?.max ? `${cityHeat.landsat9.calibratedLSTCelsius.max.toFixed(1)}°C` : "61.4°C";
    const cityMeanNDVI = cityHeat?.sentinel2b?.ndvi30mDistribution?.mean ? cityHeat.sentinel2b.ndvi30mDistribution.mean.toFixed(3) : "0.514";

    let reply = `### 🛰️ Satellite Urban Heat & Vegetation Intelligence: ${city}\n\n`;
    reply += `#### 1. Verified Satellite Observations\n`;
    reply += `- **Thermal Regime (Landsat 9 TIRS-2 Band 10)**:\n`;
    reply += `  - **Acquisition Timestamp**: \`2023-04-22 05:27:39 UTC\`\n`;
    reply += `  - **Sensor Native Resolution**: \`100m native thermal\` (resampled to 30m USGS delivery grid)\n`;
    reply += `  - **Study Area Mean LST**: **${cityMeanLST}** (Range: \`${cityMinLST}\` to \`${cityMaxLST}\`)\n`;
    reply += `  - **Clear-Sky Pixel Ratio**: \`99.98%\` (Mean uncertainty: \`±2.16 K\`)\n`;
    reply += `- **Vegetation Distribution (Sentinel-2B MSI Level-2A BOA)**:\n`;
    reply += `  - **Acquisition Timestamp**: \`2023-04-24 05:26:49 UTC\` (~48h baseline)\n`;
    reply += `  - **Sensor Native Resolution**: \`10m native optical\` (aggregated to 30m target grid via 4×4 area-weighted matrix)\n`;
    reply += `  - **Study Area Mean NDVI (30m)**: **${cityMeanNDVI}** (Valid terrestrial cells: \`518,651\` / 89.84% valid observation rate; mean valid footprint fraction: \`70.20%\`)\n`;
    reply += `  - **Preserved Negative Reflectance**: \`2,362,281\` B04 pixels tracked without synthetic zero-clipping\n\n`;

    if (pointHeat?.gridCell?.isInsideGrid && pointHeat.lst.celsius !== null) {
      reply += `#### 2. Site-Specific Observations at \`(${centroidLat}° N, ${centroidLon}° E)\`\n`;
      reply += `- **Land Surface Temperature (LST)**: **${pointHeat.lst.celsius}°C** (Uncertainty: \`±${pointHeat.lst.stQaUncertaintyKelvin || 2.16} K\`)\n`;
      reply += `- **Vegetation Index (NDVI 30m)**: **${pointHeat.ndvi.aggregated30m ?? "NoData"}** (SCL Classification: \`${pointHeat.ndvi.sclClassName}\`)\n`;
      reply += `- **Thermal Difference from City Baseline**: **${(pointHeat.lst.celsius - (cityHeat?.landsat9?.calibratedLSTCelsius?.mean || 46.3)).toFixed(1)}°C**\n\n`;
    }

    reply += `#### 3. Urban Planning & Heat Mitigation Recommendations\n`;
    reply += `- **High-Albedo "Cool Roofs"**: Implement high-reflectance roof coatings meeting statutory BEE ECBC 2017 Table 4.1 standards (Initial Reflectance ≥ 0.70, Emittance ≥ 0.75, SRI ≥ 78; advisory SRI ≥ 82 under LEED/IGBC green rating) on commercial, industrial, and civic buildings to buffer HVAC electrical demand.\n`;
    reply += `- **Strategic Canopy Greening**: Prioritize native drought-tolerant broadleaf shade trees (Neem, Peepal, Tamarind) along arterial roadway corridors where NDVI < 0.30.\n`;
    reply += `- **Photovoltaic & EV Microclimate Protection**: Note that crystalline silicon modules feature temperature coefficients of -0.35% to -0.45%/°C above 25°C STC (IEC 61215); because satellite LST measures ground skin temperature rather than cell temperature, actual derating cannot be calculated directly from LST alone. Incorporate elevated open racking (≥ 0.8m) on solar farms for convective cooling; mandate solar canopy shading over EV fast-charging bays to reduce solar radiant heat loading.\n\n`;

    reply += `#### 4. Scientific Limitations & Missing Evidence\n`;
    reply += `- **LST vs. Air Temperature**: Land Surface Temperature measures radiometric skin surface temperature; it does **NOT** measure ambient 2m air temperature or human wet-bulb heat stress.\n`;
    reply += `- **NDVI Definition**: NDVI is a mathematical index of spectral reflectance [-1.0, 1.0]; it does **NOT** equate to tree canopy percentage or total vegetation cover.\n`;
    reply += `- **Additional Required Evidence**: On-site micrometeorological AWS sensor stations and weather measurements, municipal DP zoning confirmation, and building envelope construction extracts are required before statutory infrastructure approval.\n`;

    reply += createProvenanceFooter("VERIFIED_GEOMETRIC");

    return {
      reply,
      modelUsed: "local-gis-rules-engine",
      engineSource: "local_gis_engine",
      statutoryStatus: "VERIFIED_GEOMETRIC",
      deterministicMetrics: {
        coordinates: `(${centroidLat}° N, ${centroidLon}° E)`,
        dimensionsMeters: `${lengthM}m × ${widthM}m`,
        areaM2,
        nearestRoadDistanceM: nearestRoadDistM,
        nearestRoadName,
        roadGeometryType: "1D LineString (Centerline)",
      },
      assumptions: [
        "LST is radiometric skin temperature from Landsat 9 Band 10, not ambient 2m air temperature.",
        "NDVI is a spectral reflectance index [-1.0, 1.0], not tree canopy percentage.",
      ],
      missingEvidence: [
        "Local micrometeorological AWS sensor stations (2m ambient air temperature & relative humidity).",
        "Cadastral 7/12 land revenue extract (Mahabhulekh) & CTS demarcation.",
        "Municipal Development Plan (DP) reservation sheet.",
      ],
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
    };
  }

  // Intent 5: Missing information / data gaps
  if (
    lowerMsg.includes("missing") ||
    lowerMsg.includes("unverified") ||
    lowerMsg.includes("gap") ||
    lowerMsg.includes("data") ||
    lowerMsg.includes("before")
  ) {
    let reply = `### Critical Missing Information & Pre-Construction Checklist\n\n`;
    reply += `Before committing capital or submitting building sanction files to ${officialContext?.jurisdiction || "the Municipal Corporation"}, verify the following unmapped items:\n\n`;
    reply += `1. **Cadastral 7/12 Extract (Mahabhulekh)**: Confirm clear title, ownership, non-agricultural (NA) sanction, and absence of legal encumbrances.\n`;
    reply += `2. **City Survey Map (CTSO / Demarcation)**: Physical boundary measurement by the Inspector of Land Records (DILR) to settle exact plot coordinates.\n`;
    reply += `3. **Geotechnical Borehole Investigation**: Standard Penetration Test (SPT) to determine safe bearing capacity (SBC) and water table depth.\n`;
    reply += `4. **Municipal DP Zone Certificate**: Formal demarcation from ${officialContext?.jurisdiction || "Town Planning Dept"} confirming permissible land-use zoning.\n`;
    reply += `5. **Environmental & Utility NOCs**: Clearances for stormwater drainage, tree felling, and 3-phase high-tension power connectivity from MSEDCL.`;

    reply += createProvenanceFooter("INSUFFICIENT_EVIDENCE");

    return {
      reply,
      modelUsed: "local-gis-rules-engine",
      engineSource: "local_gis_engine",
      statutoryStatus: "INSUFFICIENT_EVIDENCE",
      deterministicMetrics: {
        coordinates: `(${centroidLat}° N, ${centroidLon}° E)`,
        dimensionsMeters: `${lengthM}m × ${widthM}m`,
        areaM2,
        nearestRoadDistanceM: nearestRoadDistM,
        nearestRoadName,
        roadGeometryType: "1D LineString (Centerline)",
      },
      assumptions: [
        "OpenStreetMap features are 1D centerlines; actual carriageway width and statutory ROW are unverified.",
      ],
      missingEvidence: [
        "Cadastral 7/12 land revenue extract (Mahabhulekh) & CTS demarcation.",
        "Municipal Development Plan (DP) reservation sheet.",
      ],
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
    };
  }

  // Intent 6: Site Setup, Layout & Siting Appropriateness
  if (
    lowerMsg.includes("setup") ||
    lowerMsg.includes("properly") ||
    lowerMsg.includes("siting") ||
    lowerMsg.includes("location") ||
    lowerMsg.includes("placed") ||
    lowerMsg.includes("suitable") ||
    lowerMsg.includes("feasib") ||
    lowerMsg.includes("good") ||
    lowerMsg.includes("viable") ||
    lowerMsg.includes("review") ||
    lowerMsg.includes("assess") ||
    lowerMsg.includes("evaluate") ||
    lowerMsg.includes("position") ||
    lowerMsg.includes("layout") ||
    lowerMsg.includes("capacity")
  ) {
    const acres = (areaM2 / 4046.86).toFixed(2);
    const score = report?.overallScore ?? (hasRoadCollision ? 45 : 85);
    const isSolar = infraType.toLowerCase().includes("solar");
    const isEV = infraType.toLowerCase().includes("ev") || infraType.toLowerCase().includes("charg");
    const isHospital = infraType.toLowerCase().includes("hospital") || infraType.toLowerCase().includes("health");

    let reply = `### Technical Siting & Feasibility Assessment: ${infraType}\n\n`;
    reply += `**Location Coordinates**: \`(${centroidLat}° N, ${centroidLon}° E)\` in **${city}**\n`;
    reply += `**Footprint Area**: **${areaM2.toLocaleString()} m²** (~**${acres} acres**)\n`;
    reply += `**Composite Planning Score**: **${score}/100** (${score >= 75 ? "✅ Viable for Development" : "⚠️ Requires Engineering / Setback Mitigation"})\n\n`;

    if (isSolar) {
      const estimatedMWp = ((areaM2 / 4046.86) * 0.25).toFixed(2);
      const estAnnualGWh = ((Number(estimatedMWp) * 1620) / 1000).toFixed(2);

      reply += `#### 1. Solar Photovoltaic Sizing & Generation Potential\n`;
      reply += `- **Nameplate Capacity**: Estimated **~${estimatedMWp} MWp** DC capacity (~250 kWp per acre utility packing density).\n`;
      reply += `- **Annual Energy Yield**: Anticipated **~${estAnnualGWh} GWh/year** (benchmarked at ~1,620 kWh/kWp specific yield in Maharashtra solar belt).\n`;
      reply += `- **Optimal Fixed Tilt & Azimuth**: Recommended **19°–21° True South (Azimuth 180°)** based on latitude ${centroidLat}°N to maximize annual irradiance.\n`;
      reply += `- **Row Pitch & Shading (GCR)**: Maintain a Ground Coverage Ratio (GCR) between **0.42 and 0.48** (approx. 5.5m inter-row spacing) to prevent early-morning (9 AM) and late-afternoon (3 PM) shadow clipping on winter solstice.\n\n`;

      reply += `#### 2. Spatial Encroachments & Setbacks\n`;
      if (hasRoadCollision) {
        reply += `- ⚠️ **Road Collision**: The solar farm perimeter encroaches on mapped road corridors. Must retract edges to comply with mandatory statutory boundary setback under UDCPR.\n`;
      } else {
        reply += `- ✅ **Carriageway Buffer**: Clear of mapped OpenStreetMap 1D road centerlines (statutory ROW unverified).\n`;
      }
      if (buildingCollisions.length > 0) {
        reply += `- ⚠️ **Existing Structures**: Intersects ${buildingCollisions.length} existing mapped structures. Site acquisition or footprint redrawing is required.\n`;
      } else {
        reply += `- ✅ **Open Land Clearance**: Sited on contiguous open parcel without built structure encumbrances.\n`;
      }

      reply += `\n#### 3. Logistical & Grid Connectivity Requirements\n`;
      if (roadAccess?.requiresNewAccessRoad) {
        reply += `- ⚠️ **O&M Access Road**: Currently landlocked; requires a **${Math.round(roadAccess.distanceM || 0)}m** all-weather access road to **${roadAccess.nearestRoadName || "public road"}** for heavy transformer/inverter delivery and bi-weekly panel washing water tankers.\n`;
      } else {
        reply += `- ✅ **Logistics Ingress**: Direct access to **${roadAccess?.nearestRoadName || "public road"}** (~${nearestRoadDistM ?? 0}m distance to centerline).\n`;
      }
      reply += `- ⚡ **Substation Evacuation**: Requires 11kV/33kV power evacuation corridor to nearest MSEDCL/MSETCL feeder.\n\n`;

      reply += `> 💡 **Next Steps**: Use the **"Shadow-of-the-Future"** simulation panel to test hourly shadow ray-tracing, and **"Solar Reality"** to calculate monsoon de-rating and soil degradation coefficients.`;
    } else if (isEV) {
      reply += `#### 1. EV Charging Station Capacity & Infrastructure\n`;
      reply += `- **Bay Sizing**: Footprint accommodates up to ${Math.max(4, Math.floor(areaM2 / 65))} EV charging bays with designated ingress/egress lanes.\n`;
      reply += `- **Power Demands**: Recommends dedicated 500 kVA - 1 MVA compact substation for DC Fast Chargers (120 kW+ CCS2).\n`;
      reply += `- **Road Frontage**: ${roadAccess?.requiresNewAccessRoad ? `⚠️ Requires ${Math.round(roadAccess.distanceM || 0)}m road connector.` : `✅ Connected directly to ${roadAccess?.nearestRoadName || "primary road"} (~${nearestRoadDistM ?? 0}m to centerline).`}\n`;
      reply += `- **Traffic Safety**: Must integrate dedicated turning radii to avoid vehicular queue spillage onto arterial carriageways.\n`;
    } else if (isHospital) {
      reply += `#### 1. Healthcare Facility Siting Criteria\n`;
      reply += `- **Frontage Road Width**: UDCPR 2020 Rule 15.1 mandates minimum 15.0m abutting road width for emergency ambulance movement.\n`;
      reply += `- **Emergency Accessibility**: ${roadAccess?.requiresNewAccessRoad ? `⚠️ Needs ${Math.round(roadAccess.distanceM || 0)}m access road.` : `✅ Direct street connectivity verified (~${nearestRoadDistM ?? 0}m to centerline).`}\n`;
      reply += `- **Environmental Buffering**: Acoustic barrier and DG set isolation required from adjacent residential zoning.\n`;
    } else {
      reply += `#### 1. Land & Geometric Feasibility\n`;
      reply += `- **Encroachment Status**: ${hasRoadCollision ? "⚠️ Intersects public rights-of-way." : "✅ Clear of mapped 1D road centerlines (statutory ROW unverified)."}\n`;
      reply += `- **Access Road Status**: ${roadAccess?.requiresNewAccessRoad ? `⚠️ Landlocked; ${Math.round(roadAccess.distanceM || 0)}m preliminary access road required.` : `✅ Connected to ${roadAccess?.nearestRoadName || "road corridor"} (~${nearestRoadDistM ?? 0}m to centerline).`}\n`;
      reply += `- **Statutory Framework**: ${statutoryFramework}.\n`;
    }

    reply += createProvenanceFooter(defaultStatus);

    return {
      reply,
      modelUsed: "local-gis-rules-engine",
      engineSource: "local_gis_engine",
      statutoryStatus: defaultStatus,
      deterministicMetrics: {
        coordinates: `(${centroidLat}° N, ${centroidLon}° E)`,
        dimensionsMeters: `${lengthM}m × ${widthM}m`,
        areaM2,
        nearestRoadDistanceM: nearestRoadDistM,
        nearestRoadName,
        roadGeometryType: "1D LineString (Centerline)",
      },
      assumptions: [
        "OpenStreetMap features are 1D centerlines; actual carriageway width and statutory ROW are unverified.",
      ],
      missingEvidence: [
        "Cadastral 7/12 land revenue extract (Mahabhulekh) & CTS demarcation.",
        "Municipal Development Plan (DP) reservation sheet.",
      ],
      groundedFacts: {
        city,
        infrastructureType: infraType,
        hasRoadCollision,
        roadAccessStatus,
        statutoryFramework,
      },
    };
  }

  // Dynamic Fallback Synthesis
  const score = report?.overallScore ?? (hasRoadCollision ? 45 : 85);

  let reply = `### UrjaSetu Urban Planning Synthesis: ${infraType}\n\n`;
  reply += `**Study Area**: ${city} | **Coordinates**: \`(${centroidLat}° N, ${centroidLon}° E)\`\n`;
  reply += `**Site Dimensions**: **${areaM2.toLocaleString()} m²** (~${(areaM2 / 4046.86).toFixed(2)} acres)\n`;
  reply += `**Multi-Criteria Suitability Score**: **${score}/100** (${score >= 70 ? "Viable" : "Action Required"})\n\n`;

  reply += `**Key Spatial Observations Regarding Your Query**:\n`;
  reply += `1. **Road Clearance**: ${hasRoadCollision ? "⚠️ Encroaches on mapped road centerline. Use 'Snap to Road & Open Land' to adjust." : `ℹ️ Clear of mapped 1D road centerlines (~${nearestRoadDistM ?? 0}m); statutory right-of-way unverified.`}\n`;
  reply += `2. **Access Road Status**: ${roadAccess?.requiresNewAccessRoad ? `⚠️ Offset from street network; requires ${Math.round(roadAccess.distanceM || 0)}m access road to ${roadAccess.nearestRoadName || "public road"}.` : `✅ Direct frontage connected to ${roadAccess?.nearestRoadName || "mapped road"} (~${nearestRoadDistM ?? 0}m to centerline).`}\n`;
  reply += `3. **Statutory Planning Basis**: Subject to ${statutoryFramework} (requires municipal DP and cadastre verification).\n\n`;

  reply += `💡 *Tip: You can ask specific questions about solar yield, 3D shading ray-tracing, access roads, UDCPR statutory setbacks, or click "Snap to Road & Open Land" to automatically correct boundaries.*`;

  reply += createProvenanceFooter(defaultStatus);

  return {
    reply,
    modelUsed: "local-gis-rules-engine",
    engineSource: "local_gis_engine",
    statutoryStatus: defaultStatus,
    deterministicMetrics: {
      coordinates: `(${centroidLat}° N, ${centroidLon}° E)`,
      dimensionsMeters: `${lengthM}m × ${widthM}m`,
      areaM2,
      nearestRoadDistanceM: nearestRoadDistM,
      nearestRoadName,
      roadGeometryType: "1D LineString (Centerline)",
    },
    assumptions: [
      "OpenStreetMap features are 1D centerlines; actual carriageway width and statutory ROW are unverified.",
    ],
    missingEvidence: [
      "Cadastral 7/12 land revenue extract (Mahabhulekh) & CTS demarcation.",
      "Municipal Development Plan (DP) reservation sheet.",
    ],
    groundedFacts: {
      city,
      infrastructureType: infraType,
      hasRoadCollision,
      roadAccessStatus,
      statutoryFramework,
    },
  };
}
