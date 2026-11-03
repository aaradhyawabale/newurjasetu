import { InterventionCandidate } from './types';

export interface MultiDimensionalEvaluation {
  candidateId: string;
  candidateName: string;
  categoryId: string;
  status: string;
  thermalDimension: {
    lstCelsius: number | null;
    deltaToBaselineCelsius: number | null;
    classification: 'HIGH_THERMAL_STRESS' | 'MODERATE_THERMAL_STRESS' | 'NOMINAL_BASELINE';
    scientificContext: string;
  };
  vegetationDimension: {
    ndvi30m: number | null;
    deltaToBaseline: number | null;
    vegetationDeficitLevel: 'PRONOUNCED_DEFICIT' | 'MODERATE_COVER' | 'DENSE_CANOPY';
    scientificContext: string;
  };
  infrastructureReadiness: {
    roadAccessTier: 'IMMEDIATE_FRONTAGE' | 'LOCAL_ACCESS' | 'DISTANT';
    substationProximityTier?: 'ADJACENT' | 'VICINITY' | 'REMOTE';
    transitHubProximityTier?: 'CO_LOCATED' | 'WALKING_DISTANCE' | 'ISOLATED';
    readinessStatement: string;
  };
  governanceAndConstraints: {
    criticalBlockerCount: number;
    moderateConstraintCount: number;
    missingMandatorySurveysCount: number;
    primaryObstacle: string;
  };
  actionReadinessPhase: 'PRE_FEASIBILITY_SITE_VISIT' | 'SURVEY_COMMISSIONING' | 'INTER_AGENCY_CLEARANCE';
}

export function evaluateCandidate(candidate: InterventionCandidate): MultiDimensionalEvaluation {
  const lstDelta = candidate.thermalContext.lstDeltaToBaselineCelsius;
  let thermalClassification: 'HIGH_THERMAL_STRESS' | 'MODERATE_THERMAL_STRESS' | 'NOMINAL_BASELINE' = 'NOMINAL_BASELINE';
  let thermalContextStr = 'Within nominal study area range (+/-1.0°C).';

  if (lstDelta !== null && lstDelta >= 1.5) {
    thermalClassification = 'HIGH_THERMAL_STRESS';
    thermalContextStr = `Surface temperature is +${lstDelta}°C above candidate boundary mean (46.3°C). Radiative skin emission is elevated.`;
  } else if (lstDelta !== null && lstDelta > 0) {
    thermalClassification = 'MODERATE_THERMAL_STRESS';
    thermalContextStr = `Surface temperature is +${lstDelta}°C above candidate boundary mean (46.3°C).`;
  } else if (lstDelta !== null) {
    thermalContextStr = `Surface temperature is ${lstDelta}°C relative to candidate boundary mean (46.3°C).`;
  }

  const ndviDelta = candidate.vegetationContext.ndviDeltaToBaseline;
  let vegDeficit: 'PRONOUNCED_DEFICIT' | 'MODERATE_COVER' | 'DENSE_CANOPY' = 'MODERATE_COVER';
  let vegContextStr = 'Moderate vegetative reflectance.';

  if (ndviDelta !== null && ndviDelta <= -0.15) {
    vegDeficit = 'PRONOUNCED_DEFICIT';
    vegContextStr = `NDVI is ${ndviDelta} below terrestrial mean (0.514), confirming heavily paved or unshaded surface.`;
  } else if (ndviDelta !== null && ndviDelta > 0.05) {
    vegDeficit = 'DENSE_CANOPY';
    vegContextStr = `NDVI is +${ndviDelta} above terrestrial mean, indicating established green canopy or lawn.`;
  }

  let roadTier: 'IMMEDIATE_FRONTAGE' | 'LOCAL_ACCESS' | 'DISTANT' = 'IMMEDIATE_FRONTAGE';
  if (candidate.infrastructureContext.nearestRoadDistanceM > 50) {
    roadTier = 'DISTANT';
  } else if (candidate.infrastructureContext.nearestRoadDistanceM > 15) {
    roadTier = 'LOCAL_ACCESS';
  }

  let subTier: 'ADJACENT' | 'VICINITY' | 'REMOTE' | undefined;
  if (candidate.infrastructureContext.nearestSubstationDistanceM !== undefined) {
    const dist = candidate.infrastructureContext.nearestSubstationDistanceM;
    if (dist <= 200) subTier = 'ADJACENT';
    else if (dist <= 500) subTier = 'VICINITY';
    else subTier = 'REMOTE';
  }

  let transitTier: 'CO_LOCATED' | 'WALKING_DISTANCE' | 'ISOLATED' | undefined;
  if (candidate.infrastructureContext.nearestTransitHubDistanceM !== undefined) {
    const dist = candidate.infrastructureContext.nearestTransitHubDistanceM;
    if (dist <= 50) transitTier = 'CO_LOCATED';
    else if (dist <= 400) transitTier = 'WALKING_DISTANCE';
    else transitTier = 'ISOLATED';
  }

  const criticalCount = candidate.constraints.filter(c => c.severity === 'CRITICAL_BLOCKER').length;
  const moderateCount = candidate.constraints.filter(c => c.severity === 'MODERATE_CONSTRAINT').length;
  const missingSurveys = candidate.missingSurveyChecklist.length;

  let primaryObstacle = 'No critical blockers identified.';
  const blocker = candidate.constraints.find(c => c.severity === 'CRITICAL_BLOCKER');
  if (blocker) {
    primaryObstacle = `${blocker.title}: ${blocker.description}`;
  } else if (moderateCount > 0) {
    const mod = candidate.constraints.find(c => c.severity === 'MODERATE_CONSTRAINT');
    primaryObstacle = `${mod?.title}: ${mod?.description}`;
  }

  let actionPhase: 'PRE_FEASIBILITY_SITE_VISIT' | 'SURVEY_COMMISSIONING' | 'INTER_AGENCY_CLEARANCE' = 'SURVEY_COMMISSIONING';
  if (criticalCount > 0 && candidate.categoryId === 'INTEGRATED_FACILITY_UPGRADE') {
    actionPhase = 'INTER_AGENCY_CLEARANCE';
  } else if (missingSurveys >= 2) {
    actionPhase = 'SURVEY_COMMISSIONING';
  } else {
    actionPhase = 'PRE_FEASIBILITY_SITE_VISIT';
  }

  return {
    candidateId: candidate.id,
    candidateName: candidate.name,
    categoryId: candidate.categoryId,
    status: candidate.status,
    thermalDimension: {
      lstCelsius: candidate.thermalContext.surfaceTemperatureCelsius,
      deltaToBaselineCelsius: lstDelta,
      classification: thermalClassification,
      scientificContext: thermalContextStr
    },
    vegetationDimension: {
      ndvi30m: candidate.vegetationContext.ndvi30m,
      deltaToBaseline: ndviDelta,
      vegetationDeficitLevel: vegDeficit,
      scientificContext: vegContextStr
    },
    infrastructureReadiness: {
      roadAccessTier: roadTier,
      substationProximityTier: subTier,
      transitHubProximityTier: transitTier,
      readinessStatement: `Road: ${candidate.infrastructureContext.nearestRoadName} (${candidate.infrastructureContext.nearestRoadDistanceM}m).`
    },
    governanceAndConstraints: {
      criticalBlockerCount: criticalCount,
      moderateConstraintCount: moderateCount,
      missingMandatorySurveysCount: missingSurveys,
      primaryObstacle
    },
    actionReadinessPhase: actionPhase
  };
}

export function evaluateAllCandidates(candidates: InterventionCandidate[]): MultiDimensionalEvaluation[] {
  return candidates.map(evaluateCandidate);
}
