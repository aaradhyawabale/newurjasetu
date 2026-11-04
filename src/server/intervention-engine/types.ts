/**
 * URJASETU PHASE 5 & PHASE 6: INTELLIGENT URBAN INTERVENTION PLANNING & DYNAMIC SPATIAL DISCOVERY
 * Comprehensive Type Definitions for Evidence-Based Urban Planning
 */

export type InterventionCategoryId = 
  | 'URBAN_GREENING_CORRIDOR'
  | 'COOL_ROOF_FEASIBILITY'
  | 'SOLAR_CANOPY_EV_COLOCATION'
  | 'GREEN_SPACE_ENHANCEMENT'
  | 'INTEGRATED_FACILITY_UPGRADE';

export type CandidateStatus =
  | 'ELIGIBLE_FOR_REVIEW'
  | 'CONDITIONALLY_ELIGIBLE'
  | 'REQUIRES_SITE_VALIDATION'
  | 'INSUFFICIENT_EVIDENCE'
  | 'INELIGIBLE'
  | 'EXCLUDED';

export type CandidateProvenanceType =
  | 'DATASET_DERIVED'
  | 'MANUALLY_CURATED'
  | 'SAMPLE_LOCATION'
  | 'INSUFFICIENT_PROVENANCE';

export type EvidenceCategory =
  | 'SATELLITE_OBSERVATION'
  | 'DETERMINISTIC_CALCULATION'
  | 'VERIFIED_TECHNICAL_REFERENCE'
  | 'GENERAL_ENGINEERING_GUIDANCE'
  | 'AI_INTERPRETATION'
  | 'UNVERIFIED_REQUIRES_ADDITIONAL_DATA';

export type EvidenceCompletenessLevel = 'STRONG' | 'MODERATE' | 'PRELIMINARY';

export interface EvidenceLedgerItem {
  id: string;
  category: EvidenceCategory;
  parameterName: string;
  observedValue: string | number | null;
  unit?: string;
  sourceDataset: string;
  retrievalTimestamp: string;
  uncertaintyOrDisclaimer: string;
  actionRequiredIfUnverified?: string;
}

export interface InterventionCategoryMetadata {
  id: InterventionCategoryId;
  name: string;
  shortDescription: string;
  planningObjective: string;
  targetFeatures: string[];
  requiredDatasets: string[];
  mandatorySurveyChecklist: string[];
  governingStandards: Array<{
    standardName: string;
    issuingBody: string;
    sectionOrClause: string;
    keyThresholdOrRequirement: string;
  }>;
  scientificDisclaimers: string[];
}

export interface CandidateCoordinates {
  lng: number;
  lat: number;
  utmX?: number;
  utmY?: number;
}

export interface CandidateThermalContext {
  surfaceTemperatureCelsius: number | null;
  baselineStudyAreaMeanLSTCelsius: number; // 46.3°C
  lstDeltaToBaselineCelsius: number | null;
  landsatStQaUncertaintyK: number | null;
  rawThermalDN: number;
  nativeResolutionNotice: string;
}

export interface CandidateVegetationContext {
  ndvi30m: number | null;
  baselineTerrestrialMeanNdvi: number; // 0.514
  ndviDeltaToBaseline: number | null;
  sclClassId: number;
  sclClassName: string;
  isTerrestrialVegetation: boolean;
}

export interface CandidateInfrastructureContext {
  primaryFeatureType: string;
  nearestRoadDistanceM: number;
  nearestRoadName: string;
  nearestSubstationDistanceM?: number;
  nearestSubstationName?: string;
  nearestParkingDistanceM?: number;
  nearestTransitHubDistanceM?: number;
  footprintAreaM2?: number; // e.g. for building or parking
}

export interface SiteConstraint {
  id: string;
  title: string;
  severity: 'CRITICAL_BLOCKER' | 'MODERATE_CONSTRAINT' | 'SURVEY_FLAG';
  description: string;
  mitigationRequirement: string;
}

export interface MissingSurveyItem {
  id: string;
  itemName: string;
  requiredForPhase: 'TECHNICAL_FEASIBILITY' | 'DETAILED_PROJECT_REPORT' | 'TENDERING';
  description: string;
  surveyStandardOrMethodology: string;
}

export interface InterventionCandidate {
  id: string;
  categoryId: InterventionCategoryId;
  name: string;
  wardOrPrabhag: string;
  locationSummary: string;
  coordinates: CandidateCoordinates;
  status: CandidateStatus;
  statusRationale: string;
  evidenceCompleteness: EvidenceCompletenessLevel;
  provenanceType: CandidateProvenanceType;
  sourceFeatureId?: string;
  sourceDatasetName?: string;
  sourceGeometryType?: 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon';
  analysisRunId?: string;
  thermalContext: CandidateThermalContext;
  vegetationContext: CandidateVegetationContext;
  infrastructureContext: CandidateInfrastructureContext;
  constraints: SiteConstraint[];
  missingSurveyChecklist: MissingSurveyItem[];
  evidenceLedger: EvidenceLedgerItem[];
  estimatedTargetAreaM2?: number;
  recommendedNextAction: string;
}

export interface CandidateComparison {
  generatedAt: string;
  analysisRunId?: string;
  candidateIds: string[];
  candidates: InterventionCandidate[];
  comparisonMatrix: {
    attribute: string;
    category: string;
    values: Record<string, string | number | null>;
  }[];
  tradeOffAnalysis: {
    dimension: string;
    observations: string[];
    governingConsideration: string;
  }[];
  planningNotice: string;
}

export interface PlanningDossier {
  dossierId: string;
  generatedAt: string;
  analysisRunId?: string;
  candidate: InterventionCandidate;
  categoryMetadata: InterventionCategoryMetadata;
  executiveSummary: string;
  spatialEvidenceSummary: {
    landsat9ThermalSummary: string;
    sentinel2VegetationSummary: string;
    infrastructureProximitySummary: string;
  };
  regulatoryAndStandardAlignment: string[];
  preImplementationSurveyPlan: {
    surveyTask: string;
    mandatedTechnique: string;
    responsibleDepartment: string;
  }[];
  nonAuthoritativeDisclaimer: string;
  modelCardSummary?: {
    modelName: string;
    rmse: number | null;
    r2: number | null;
    heldOutSceneDate: string;
    directionCheckPassed: boolean;
  };
}

export interface AnalysisRun {
  analysisId: string;
  executionTimestamp: string;
  studyAreaId: string;
  studyAreaName: string;
  categoriesRequested: InterventionCategoryId[];
  datasetVersions: Record<string, string>;
  parameters: Record<string, any>;
  featuresEvaluated: number;
  candidatesDiscovered: number;
  candidatesRejected: number;
  rejectionReasonsSummary: Record<string, number>;
  knownLimitations: string[];
  provenanceSummary: string;
}

export type VerificationStatus =
  | 'VERIFIED_OFFICIAL'
  | 'VERIFIED_PUBLIC_DISCLOSURE'
  | 'VERIFIED_OPENSTREETMAP'
  | 'RESEARCH_DERIVED'
  | 'MANUALLY_CURATED'
  | 'INSUFFICIENT_PROVENANCE'
  | 'STALE'
  | 'UNVERIFIED';

export type OperationalStatus =
  | 'MAPPED_IN_OSM'
  | 'OPERATIONAL_STATUS_UNVERIFIED'
  | 'OPERATIONAL_VERIFIED'
  | 'OPERATIONAL_STATUTORY_DISCLOSURE'
  | 'INACTIVE'
  | 'UNKNOWN';

export interface DatasetRegistryItem {
  id: string;
  name: string;
  sourceOrganization: string;
  sourceUrl?: string;
  acquisitionDate: string;
  publicationDate?: string;
  lastUpdate: string;
  applicationRefreshDate: string;
  geographicCoverage: string;
  crs: string;
  geometryTypeOrRasterResolution: string;
  featureOrPixelCount?: number | string;
  verificationStatus: VerificationStatus;
  operationalStatus?: OperationalStatus;
  sourceAuthenticity?: string;
  freshness?: string;
  transformationHistory?: string[];
  provenanceCategory: string;
  intendedUse: string;
  knownLimitations: string;
  license: string;
  isAvailable: boolean;
  missingCriticalElements?: string[];
}

export interface SensitivitySweepStep {
  parameterName: string;
  testedValue: number | string;
  candidatesDiscovered: number;
  candidatesRejected: number;
  rejectionReasons: Record<string, number>;
  yieldPercentage: number;
}

export interface SensitivityAnalysisResult {
  analysisTimestamp: string;
  baseCandidateCount: number;
  parameterSweeps: {
    lstThresholds: SensitivitySweepStep[];
    ndviThresholds: SensitivitySweepStep[];
    substationDistanceThresholds: SensitivitySweepStep[];
  };
  scientificSynthesis: {
    lstSensitivityObservation: string;
    ndviSensitivityObservation: string;
    substationSensitivityObservation: string;
    thermalSkinVsAirClarification: string;
  };
}

