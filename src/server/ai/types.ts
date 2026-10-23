import { z } from "zod";

/**
 * Data Provenance Classification
 * Strictly enforces UrjaSetu's audit and provenance policy:
 * 1. VERIFIED_INPUT: Grounded directly in supplied parameters or verified spatial coordinates.
 * 2. DETERMINISTIC_RESULT: Calculated by UrjaSetu's deterministic GIS/scoring logic.
 * 3. AI_INTERPRETATION: Qualitative reasoning synthesized from the supplied evidence.
 * 4. UNVERIFIED_ASSUMPTION: A planning hypothesis that requires statutory/field verification.
 */
export const ProvenanceCategorySchema = z.enum([
  "VERIFIED_INPUT",
  "DETERMINISTIC_RESULT",
  "AI_INTERPRETATION",
  "UNVERIFIED_ASSUMPTION",
]);
export type ProvenanceCategory = z.infer<typeof ProvenanceCategorySchema>;

export const PreliminaryAssessmentSchema = z.enum([
  "FAVORABLE",
  "CONDITIONAL",
  "REQUIRES_FURTHER_REVIEW",
  "UNFAVORABLE",
]);
export type PreliminaryAssessment = z.infer<typeof PreliminaryAssessmentSchema>;

export const AiAdvantageSchema = z.object({
  title: z.string().describe("Concise heading for the key site advantage"),
  description: z.string().describe("Specific explanation grounded in evidence"),
  category: z.string().describe("e.g., Accessibility, Terrain, Demand, Solar Yield"),
  provenance: ProvenanceCategorySchema,
  sourceReference: z.string().describe("ID or name of evidence source (e.g., evd_roads, evd_elevation, criteria:road_distance)"),
});
export type AiAdvantage = z.infer<typeof AiAdvantageSchema>;

export const ConstraintSeveritySchema = z.preprocess((val) => {
  if (typeof val !== "string") return val;
  const s = val.toUpperCase().trim();
  if (s === "CRITICAL" || s === "FATAL" || s === "BLOCKER") return "CRITICAL";
  if (s === "HIGH" || s === "SUBOPTIMAL" || s === "SEVERE") return "HIGH";
  if (s === "LOW" || s === "MINOR" || s === "NEGLIGIBLE") return "LOW";
  if (s === "MODERATE" || s === "WARNING" || s === "MEDIUM" || s === "CAUTION") return "MODERATE";
  return val;
}, z.enum(["CRITICAL", "HIGH", "MODERATE", "LOW"]));
export type ConstraintSeverity = z.infer<typeof ConstraintSeveritySchema>;

export const AiConstraintSchema = z.object({
  title: z.string().describe("Concise heading for the spatial or regulatory constraint"),
  description: z.string().describe("Explanation of the constraint and its impact"),
  severity: ConstraintSeveritySchema,
  provenance: ProvenanceCategorySchema,
  sourceReference: z.string().describe("ID or name of evidence source (e.g., buffer:railway, slope_gradient, flood_risk)"),
});
export type AiConstraint = z.infer<typeof AiConstraintSchema>;

export const AiMitigationSchema = z.object({
  issue: z.string().describe("The specific constraint or risk being addressed"),
  mitigation: z.string().describe("Actionable engineering, operational, or design intervention"),
  supportingEvidence: z.string().describe("Evidence backing the feasibility of this mitigation"),
  provenance: ProvenanceCategorySchema,
  sourceReference: z.string().describe("Reference dataset or metric ID"),
});
export type AiMitigation = z.infer<typeof AiMitigationSchema>;

export const AiDataGapSchema = z.object({
  fieldOrTopic: z.string().describe("Missing dataset, attribute, or field observation"),
  explanation: z.string().describe("Why this data is missing and why it matters"),
  requiredVerification: z.string().describe("Action needed (e.g., on-site geotechnical soil bore test, municipal water head audit)"),
});
export type AiDataGap = z.infer<typeof AiDataGapSchema>;

export const AiStatutoryChecklistItemSchema = z.object({
  authority: z.string().describe("Governing body (e.g., Municipal Corporation, MPCB, NHAI, Discom)"),
  clearanceName: z.string().describe("Name of NOC or permit required"),
  triggerCondition: z.string().describe("Why this clearance is triggered by the site conditions"),
  isMandatory: z.boolean().describe("Whether this clearance is statutory before construction"),
});
export type AiStatutoryChecklistItem = z.infer<typeof AiStatutoryChecklistItemSchema>;

export const AiPlanningAlternativeSchema = z.object({
  title: z.string().describe("Alternative configuration or layout option"),
  description: z.string().describe("Description of the alternative (e.g., phased development, alternate footprint orientation)"),
  tradeOffs: z.string().describe("Key pros and cons compared to the current placement"),
});
export type AiPlanningAlternative = z.infer<typeof AiPlanningAlternativeSchema>;

export const AiCostDriversSchema = z.object({
  civil: z.string().describe("Terrain grading, foundation, earthwork, and drainage cost drivers"),
  electrical: z.string().describe("Grid interconnection, transformer, and power distribution drivers"),
  environmental: z.string().describe("Tree preservation, runoff management, and noise/air mitigation drivers"),
  operational: z.string().describe("Logistical accessibility, maintenance access, and utility ongoing drivers"),
});
export type AiCostDrivers = z.infer<typeof AiCostDriversSchema>;

export const AiPlanningInsightsSchema = z.object({
  executiveSummary: z.string().describe("High-level executive briefing for municipal decision makers"),
  preliminaryAssessment: PreliminaryAssessmentSchema.describe("Indicative classification: FAVORABLE, CONDITIONAL, REQUIRES_FURTHER_REVIEW, UNFAVORABLE"),
  assessmentRationale: z.string().describe("Explicit justification for the preliminary assessment band"),
  advantages: z.array(AiAdvantageSchema).describe("List of verified and evidence-backed positive site indicators"),
  constraints: z.array(AiConstraintSchema).describe("List of physical, regulatory, or operational constraints"),
  unresolvedDataGaps: z.array(AiDataGapSchema).describe("Unresolved information and data gaps requiring verification"),
  recommendedMitigations: z.array(AiMitigationSchema).describe("Practical mitigations for detected risks"),
  costDrivers: AiCostDriversSchema.describe("Qualitative review of major cost drivers across civil, electrical, environmental, and operations"),
  statutoryChecklist: z.array(AiStatutoryChecklistItemSchema).describe("Preliminary checklist of statutory NOCs and clearances"),
  planningAlternatives: z.array(AiPlanningAlternativeSchema).describe("Realistic alternative planning options and trade-offs"),
  confidenceIndicator: z.object({
    level: z.enum(["HIGH", "MEDIUM", "LOW"]),
    completenessPercent: z.number().min(0).max(100),
    disclaimer: z.string().describe("Note distinguishing data completeness from model certainty"),
  }),
  assumptionsAndLimitations: z.array(
    z.preprocess((val) => {
      if (typeof val === "string") return val;
      if (typeof val === "object" && val !== null) {
        const item = val as Record<string, any>;
        return (
          item.description ||
          item.text ||
          item.assumption ||
          item.limitation ||
          item.detail ||
          item.title ||
          Object.values(item).filter((v) => typeof v === "string").join(": ") ||
          JSON.stringify(val)
        );
      }
      return String(val ?? "");
    }, z.string())
  ).describe("Explicit planning assumptions and model boundary conditions"),
  meta: z.object({
    modelUsed: z.string(),
    generatedAt: z.string(),
    disclaimer: z.string(),
  }),
});

export type AiPlanningInsights = z.infer<typeof AiPlanningInsightsSchema>;
