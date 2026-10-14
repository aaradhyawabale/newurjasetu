import { InfrastructureTypeId } from "@/config/infra-types";
import { CriterionResult } from "./engine";
import { determineSuitabilityBand } from "./scoring";
import {
  INFRASTRUCTURE_WEIGHT_PROFILES,
  WeightProfile,
  validateCriterionWeights,
} from "./weight-profiles";

export interface SensitivityProfileResult {
  profileId: string;
  profileName: string;
  description: string;
  rationale: string;
  score: number;
  band: string;
  tone: "positive" | "moderate" | "cautious" | "negative";
  scoreDeltaFromBaseline: number;
  weights: Record<string, number>;
  criterionContributions: Record<
    string,
    {
      score: number | null;
      weight: number;
      contribution: number;
    }
  >;
}

export interface SensitivityAnalysisResult {
  baselineScore: number;
  baselineBand: string;
  mandatoryConstraintActive: boolean;
  constraintPenaltyNote?: string;
  profiles: SensitivityProfileResult[];
  rankStability: "stable" | "sensitive" | "highly_sensitive";
  sensitivitySummary: string;
}

/**
 * Deterministically computes suitability scores under alternative weight profiles.
 * Preserves mandatory constraint overrides: if a location violates a mandatory constraint,
 * it CANNOT achieve a high score regardless of weighting profile.
 */
export function calculateSensitivityAnalysis(params: {
  type: InfrastructureTypeId;
  criteria: CriterionResult[];
  validationStatus: "pass" | "warn" | "fail";
  customProfiles?: WeightProfile[];
}): SensitivityAnalysisResult {
  const { type, criteria, validationStatus, customProfiles } = params;

  const defaultProfiles = INFRASTRUCTURE_WEIGHT_PROFILES[type] || [];
  const profilesToRun = customProfiles && customProfiles.length > 0 ? customProfiles : defaultProfiles;

  const criterionIds = criteria.map((c) => c.id);
  const criterionScores = new Map<string, number | null>();
  for (const c of criteria) {
    criterionScores.set(c.id, c.computed ? c.score : null);
  }

  const profileResults: SensitivityProfileResult[] = [];
  let baselineScore = 0;
  let baselineBand = "";

  for (let idx = 0; idx < profilesToRun.length; idx++) {
    const prof = profilesToRun[idx];
    const validation = validateCriterionWeights(type, prof.weights, criterionIds);
    const activeWeights = validation.valid ? validation.normalizedWeights : prof.weights;

    let weightedSum = 0;
    let computedWeight = 0;
    const criterionContributions: Record<
      string,
      { score: number | null; weight: number; contribution: number }
    > = {};

    for (const cid of criterionIds) {
      const score = criterionScores.get(cid) ?? null;
      const weight = activeWeights[cid] ?? 0;

      if (score !== null && score !== undefined) {
        weightedSum += score * weight;
        computedWeight += weight;
        criterionContributions[cid] = {
          score,
          weight,
          contribution: Math.round(score * weight * 10) / 10,
        };
      } else {
        criterionContributions[cid] = {
          score: null,
          weight,
          contribution: 0,
        };
      }
    }

    let rawScore = computedWeight > 0 ? Math.round(weightedSum / computedWeight) : 0;

    // Enforce mandatory constraints: hard spatial conflict must cap overall score
    if (validationStatus === "fail") {
      rawScore = Math.min(rawScore, 24);
    } else if (validationStatus === "warn") {
      rawScore = Math.min(rawScore, 65);
    }

    const bandInfo = determineSuitabilityBand(rawScore);

    if (idx === 0) {
      baselineScore = rawScore;
      baselineBand = bandInfo.band;
    }

    profileResults.push({
      profileId: prof.id,
      profileName: prof.name,
      description: prof.description,
      rationale: prof.rationale,
      score: rawScore,
      band: bandInfo.band,
      tone: bandInfo.tone,
      scoreDeltaFromBaseline: rawScore - baselineScore,
      weights: activeWeights,
      criterionContributions,
    });
  }

  // Calculate score spread across profiles
  const scores = profileResults.map((p) => p.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const spread = maxScore - minScore;

  let rankStability: "stable" | "sensitive" | "highly_sensitive" = "stable";
  if (spread >= 15) {
    rankStability = "highly_sensitive";
  } else if (spread >= 7) {
    rankStability = "sensitive";
  }

  const mandatoryConstraintActive = validationStatus !== "pass";
  let constraintPenaltyNote: string | undefined;
  if (validationStatus === "fail") {
    constraintPenaltyNote = "Mandatory constraint active: critical spatial conflict limits all profile scores to <= 24 (Unsuitable).";
  } else if (validationStatus === "warn") {
    constraintPenaltyNote = "Mandatory setback warning active: localized buffer constraint limits profile scores to <= 65 (Moderate).";
  }

  let sensitivitySummary = "";
  if (mandatoryConstraintActive) {
    sensitivitySummary = `Site viability is governed by mandatory spatial constraints rather than criterion weighting. Even under alternative priority weighting, scores remain capped at ${maxScore}/100.`;
  } else if (rankStability === "stable") {
    sensitivitySummary = `Evaluation is robust and stable across all priority profiles (score variance is only ±${Math.round(spread / 2)} points). Siting conclusions do not hinge on subjective stakeholder weighting.`;
  } else {
    sensitivitySummary = `Evaluation exhibits ${rankStability} sensitivity (score range ${minScore}–${maxScore}, spread of ${spread} points). Siting viability depends noticeably on whether ${
      profileResults.find((p) => p.score === maxScore)?.profileName || "specific criteria"
    } is prioritized.`;
  }

  return {
    baselineScore,
    baselineBand,
    mandatoryConstraintActive,
    ...(constraintPenaltyNote ? { constraintPenaltyNote } : {}),
    profiles: profileResults,
    rankStability,
    sensitivitySummary,
  };
}
