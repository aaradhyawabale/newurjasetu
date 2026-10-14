import { InfrastructureTypeId } from "@/config/infra-types";
import {
  CriterionResult,
  DataSourceSummary,
  EvidenceItem,
} from "@/server/analysis-engine/engine";
import { ConflictingFeature } from "@/server/analysis-engine/validation";

export interface CandidateImpactSummary {
  spatialFootprintM2: number;
  arterialDistanceM: number | null;
  nearestAmenityDistanceM: number | null;
  accessQuality: "Optimal" | "Acceptable" | "Constrained" | "Unknown";
  solarPotentialAnnualMwh: number | null;
  solarSpecificYieldKwhPerKwp: number | null;
  serviceCatchmentProxy: {
    bufferRadiusM: number;
    nearbyAmenitiesCount: number;
    proxyType: string;
    limitations: string;
  };
  environmentalExclusionCount: number;
}

export interface CandidateSummary {
  placementId: string;
  scenarioId: string;
  scenarioName: string;
  analysisId?: string;
  type: InfrastructureTypeId;
  label: string;
  lat: number;
  lng: number;
  lengthM: number;
  widthM: number;
  bearingDeg: number;
  footprintAreaM2: number;
  params: Record<string, any>;
  createdAt: string;
  analysisTimestamp?: string;
  engineVersion?: string;
  overallScore: number;
  scoreBand: string;
  tone: "positive" | "moderate" | "cautious" | "negative";
  confidence: number;
  evidenceCompleteness: number;
  hasMandatoryViolation: boolean;
  mandatoryViolationsCount: number;
  criteria: CriterionResult[];
  constraints: ConflictingFeature[];
  dataSources: DataSourceSummary[];
  evidence: EvidenceItem[];
  impacts: CandidateImpactSummary;
}

export interface CriterionDelta {
  criterionId: string;
  label: string;
  unit?: string;
  weight: number;
  valuesByPlacement: Record<
    string,
    {
      rawMetric: number | null;
      score: number | null;
      valueText: string;
      status: "optimal" | "acceptable" | "suboptimal" | "constrained" | "unknown";
      missingReason?: string;
    }
  >;
  bestPlacementId: string | null;
  worstPlacementId: string | null;
  deltaScore: number; // maxScore - minScore
  benchmark: string;
  explanation: string;
}

export interface CandidateRanking {
  rank: number;
  placementId: string;
  label: string;
  scenarioName: string;
  type: InfrastructureTypeId;
  overallScore: number;
  scoreBand: string;
  hasMandatoryViolation: boolean;
  mandatoryViolationsCount: number;
  winningCriteriaCount: number;
  topAdvantages: string[];
  topDisadvantages: string[];
  rankingRationale: string;
}

export interface SpatialSeparationPair {
  placementAId: string;
  placementBId: string;
  labelA: string;
  labelB: string;
  distanceMeters: number;
}

export interface CandidateUncertaintyProfile {
  evidenceCompleteness: number;
  confirmedConstraints: number;
  evidenceSupported: number;
  estimatedProxies: number;
  unknownCount: number;
  staleSources: string[];
}

export interface BaselineSiteCondition {
  label: string;
  preConstructionState: string;
  existingLandUseProxy: string;
  existingRoadDistanceM: number | null;
  topographySlopeEstimate: string;
  environmentalNotice: string;
}

export interface ScenarioComparisonResult {
  scenarioId?: string;
  scenarioName?: string;
  candidates: CandidateSummary[];
  comparability: {
    isCompatible: boolean;
    mode: "direct_identical_criteria" | "cross_type_advisory";
    types: InfrastructureTypeId[];
    advisoryNotice?: string;
  };
  ranking: CandidateRanking[];
  criteriaMatrix: CriterionDelta[];
  spatialSeparation: SpatialSeparationPair[];
  uncertaintyProfiles: Record<string, CandidateUncertaintyProfile>;
  baselineComparison: {
    baseline: BaselineSiteCondition;
    modeledVsObservedNotice: string;
    keyTradeoffs: string[];
  };
  executiveSummary: string;
  generatedAt: string;
}
