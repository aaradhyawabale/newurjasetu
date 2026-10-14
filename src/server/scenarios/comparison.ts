import { InfrastructureTypeId } from "@/config/infra-types";
import { calculateDistanceMeters } from "@/server/gis/geometry";
import {
  AnalysisReportResult,
  CriterionResult,
  DataSourceSummary,
  EvidenceItem,
} from "@/server/analysis-engine/engine";
import { ConflictingFeature } from "@/server/analysis-engine/validation";
import {
  BaselineSiteCondition,
  CandidateImpactSummary,
  CandidateRanking,
  CandidateSummary,
  CandidateUncertaintyProfile,
  CriterionDelta,
  ScenarioComparisonResult,
  SpatialSeparationPair,
} from "./types";

/**
 * Builds a normalized CandidateSummary from a placement record and its analysis report.
 */
export function buildCandidateSummary(params: {
  placement: {
    id: string;
    scenarioId: string;
    type: string;
    lat: number;
    lng: number;
    lengthM: number;
    widthM: number;
    bearingDeg: number;
    params?: any;
    label?: string | null;
    createdAt: Date | string;
  };
  analysis: {
    id: string;
    engineVersion: string;
    overallScore: number;
    scoreBand: string;
    result: string | AnalysisReportResult;
    createdAt: Date | string;
  };
  scenarioName: string;
}): CandidateSummary {
  const { placement, analysis, scenarioName } = params;

  let report: AnalysisReportResult;
  if (typeof analysis.result === "string") {
    try {
      report = JSON.parse(analysis.result);
    } catch {
      report = {
        engineVersion: analysis.engineVersion,
        timestamp: new Date(analysis.createdAt).toISOString(),
        placementSnapshot: {
          id: placement.id,
          type: placement.type as InfrastructureTypeId,
          lat: placement.lat,
          lng: placement.lng,
          lengthM: placement.lengthM,
          widthM: placement.widthM,
          bearingDeg: placement.bearingDeg,
          areaM2: placement.lengthM * placement.widthM,
          params: placement.params || {},
        },
        validation: {
          status: "pass",
          proposedAreaM2: placement.lengthM * placement.widthM,
          allowedAreaRange: { minM2: 0, maxM2: 1000000, reason: "Fallback" },
          conflicts: [],
          messages: [],
        },
        criteria: [],
        overall: {
          score: analysis.overallScore,
          band: analysis.scoreBand,
          tone: "moderate",
          confidence: 0.7,
          verdictSummary: "Loaded from stored analysis record.",
        },
        supporting: [],
        risks: [],
        dataGaps: [],
        evidence: [],
        limitations: [],
        narrativeText: "",
      };
    }
  } else {
    report = analysis.result;
  }

  const footprintAreaM2 = placement.lengthM * placement.widthM;

  // Identify mandatory constraint violations
  const rawConstraints: ConflictingFeature[] =
    report.constraints || report.validation?.conflicts || [];
  const mandatoryViolations = rawConstraints.filter(
    (c) => c.severity === "critical"
  );
  const hasMandatoryViolation = mandatoryViolations.length > 0;

  // Extract arterial distance from criteria
  const roadCriterion = report.criteria?.find(
    (c) =>
      c.id.includes("road") ||
      c.id.includes("arterial") ||
      c.label.toLowerCase().includes("road") ||
      c.label.toLowerCase().includes("access")
  );
  const arterialDistanceM =
    typeof roadCriterion?.rawMetric === "number" ? Math.round(roadCriterion.rawMetric) : null;

  // Extract facility / substation / demand distance
  const amenityCriterion = report.criteria?.find(
    (c) =>
      c.id.includes("facility") ||
      c.id.includes("substation") ||
      c.id.includes("demand") ||
      c.id.includes("hospital") ||
      c.label.toLowerCase().includes("proximity")
  );
  const nearestAmenityDistanceM =
    typeof amenityCriterion?.rawMetric === "number"
      ? Math.round(amenityCriterion.rawMetric)
      : null;

  // Assess access quality
  let accessQuality: CandidateImpactSummary["accessQuality"] = "Unknown";
  if (arterialDistanceM !== null) {
    if (arterialDistanceM <= 100) accessQuality = "Optimal";
    else if (arterialDistanceM <= 350) accessQuality = "Acceptable";
    else accessQuality = "Constrained";
  }

  // Solar potential screening if Solar Farm
  let solarPotentialAnnualMwh: number | null = null;
  let solarSpecificYieldKwhPerKwp: number | null = null;

  if (placement.type === "Solar Farm") {
    const ghiCriterion = report.criteria?.find((c) => c.id.includes("solar_ghi"));
    const ghiDaily = ghiCriterion?.rawMetric ?? 5.2; // kWh/m²/day
    const capacityKw =
      placement.params?.capacityKw ||
      Math.max(50, Math.round((footprintAreaM2 * 0.15) / 5)); // ~1 kWp per 6.6 m²
    const pr = 0.78; // Performance ratio screening baseline
    const annualHoursEquiv = ghiDaily * 365;
    solarSpecificYieldKwhPerKwp = Math.round(annualHoursEquiv * pr);
    solarPotentialAnnualMwh = Math.round((capacityKw * solarSpecificYieldKwhPerKwp) / 1000);
  }

  // Environmental exclusion count
  const environmentalExclusionCount = rawConstraints.filter((c) => {
    const text = (c.description + " " + c.label + " " + c.category).toLowerCase();
    return (
      text.includes("water") ||
      text.includes("flood") ||
      text.includes("conservation") ||
      text.includes("forest") ||
      text.includes("wetland") ||
      text.includes("river")
    );
  }).length;

  // Service Catchment Proxy
  const nearbyAmenitiesCount =
    report.analyzedFeatures?.filter((f) => {
      const cat = f.category.toLowerCase();
      return (
        cat.includes("health") ||
        cat.includes("education") ||
        cat.includes("amenity") ||
        cat.includes("transport")
      );
    }).length || (nearestAmenityDistanceM !== null && nearestAmenityDistanceM <= 1000 ? 1 : 0);

  const impacts: CandidateImpactSummary = {
    spatialFootprintM2: footprintAreaM2,
    arterialDistanceM,
    nearestAmenityDistanceM,
    accessQuality,
    solarPotentialAnnualMwh,
    solarSpecificYieldKwhPerKwp,
    serviceCatchmentProxy: {
      bufferRadiusM: 500,
      nearbyAmenitiesCount,
      proxyType: "Straight-line Euclidean catchment proxy (radius 500m)",
      limitations:
        "Measures straight-line geographic proximity only. Does not account for census population figures, demographic density, or pedestrian/vehicle route networks.",
    },
    environmentalExclusionCount,
  };

  return {
    placementId: placement.id,
    scenarioId: placement.scenarioId,
    scenarioName,
    analysisId: analysis.id,
    type: placement.type as InfrastructureTypeId,
    label: placement.label || `${placement.type} (${placement.lat.toFixed(4)}, ${placement.lng.toFixed(4)})`,
    lat: placement.lat,
    lng: placement.lng,
    lengthM: placement.lengthM,
    widthM: placement.widthM,
    bearingDeg: placement.bearingDeg,
    footprintAreaM2,
    params: placement.params || {},
    createdAt: new Date(placement.createdAt).toISOString(),
    analysisTimestamp: report.timestamp,
    engineVersion: report.engineVersion || analysis.engineVersion,
    overallScore: analysis.overallScore,
    scoreBand: analysis.scoreBand,
    tone: report.overall?.tone || "moderate",
    confidence: report.overall?.confidence ?? 0.75,
    evidenceCompleteness: report.overall?.evidenceCompleteness ?? 0.8,
    hasMandatoryViolation,
    mandatoryViolationsCount: mandatoryViolations.length,
    criteria: report.criteria || [],
    constraints: rawConstraints,
    dataSources: report.dataSources || [],
    evidence: report.evidence || [],
    impacts,
  };
}

/**
 * Computes comparative multi-candidate analysis across candidate placements.
 */
export function compareCandidates(
  candidates: CandidateSummary[],
  scenarioInfo?: { id?: string; name?: string }
): ScenarioComparisonResult {
  const generatedAt = new Date().toISOString();

  if (!candidates || candidates.length === 0) {
    return {
      scenarioId: scenarioInfo?.id,
      scenarioName: scenarioInfo?.name,
      candidates: [],
      comparability: {
        isCompatible: true,
        mode: "direct_identical_criteria",
        types: [],
      },
      ranking: [],
      criteriaMatrix: [],
      spatialSeparation: [],
      uncertaintyProfiles: {},
      baselineComparison: {
        baseline: {
          label: "Undeveloped Baseline",
          preConstructionState: "Natural / undeveloped site surface",
          existingLandUseProxy: "Unsurveyed Open Land",
          existingRoadDistanceM: null,
          topographySlopeEstimate: "Terrain slope screening baseline",
          environmentalNotice: "No civil construction footprint.",
        },
        modeledVsObservedNotice:
          "Modeled impacts are geometric and spatial estimations derived from OpenStreetMap, Open-Meteo, and NASA POWER datasets. Real-world civil engineering outcomes require on-site geotechnical surveying, utility locates, and environmental impact assessments.",
        keyTradeoffs: [],
      },
      executiveSummary: "No candidates available for comparison.",
      generatedAt,
    };
  }

  // 1. Determine comparability mode
  const uniqueTypes = Array.from(new Set(candidates.map((c) => c.type)));
  const isCompatible = uniqueTypes.length <= 1;
  const comparabilityMode = isCompatible
    ? ("direct_identical_criteria" as const)
    : ("cross_type_advisory" as const);

  const advisoryNotice = !isCompatible
    ? `Candidates represent heterogeneous infrastructure types (${uniqueTypes.join(", ")}). Criteria weights and metrics differ by domain; compare score bands, spatial footprints, and mandatory constraints rather than raw criterion deltas.`
    : undefined;

  // 2. Compute Criteria Differential Matrix
  const criteriaMap = new Map<string, { label: string; unit?: string; weight: number; benchmark: string }>();
  candidates.forEach((cand) => {
    cand.criteria.forEach((crit) => {
      if (!criteriaMap.has(crit.id)) {
        criteriaMap.set(crit.id, {
          label: crit.label,
          unit: crit.unit,
          weight: crit.weight,
          benchmark: crit.benchmark,
        });
      }
    });
  });

  const criteriaMatrix: CriterionDelta[] = [];
  const winningCountsByPlacement: Record<string, number> = {};
  candidates.forEach((c) => {
    winningCountsByPlacement[c.placementId] = 0;
  });

  criteriaMap.forEach((meta, critId) => {
    const valuesByPlacement: CriterionDelta["valuesByPlacement"] = {};
    let maxScore = -Infinity;
    let minScore = Infinity;
    let bestPlacementId: string | null = null;
    let worstPlacementId: string | null = null;

    candidates.forEach((cand) => {
      const match = cand.criteria.find((c) => c.id === critId);
      if (match) {
        const sc = match.score ?? 0;
        valuesByPlacement[cand.placementId] = {
          rawMetric: match.rawMetric,
          score: match.score,
          valueText: match.value,
          status: match.status,
          missingReason: match.missingReason,
        };
        if (sc > maxScore) {
          maxScore = sc;
          bestPlacementId = cand.placementId;
        }
        if (sc < minScore) {
          minScore = sc;
          worstPlacementId = cand.placementId;
        }
      } else {
        valuesByPlacement[cand.placementId] = {
          rawMetric: null,
          score: null,
          valueText: "N/A",
          status: "unknown",
          missingReason: "Not evaluated for this infrastructure type",
        };
      }
    });

    const deltaScore = maxScore > -Infinity && minScore < Infinity ? Math.round(maxScore - minScore) : 0;
    if (bestPlacementId && deltaScore > 0) {
      winningCountsByPlacement[bestPlacementId] = (winningCountsByPlacement[bestPlacementId] || 0) + 1;
    }

    let explanation = `Evaluates ${meta.label.toLowerCase()} across candidate sites.`;
    if (candidates.length >= 2 && bestPlacementId && worstPlacementId && bestPlacementId !== worstPlacementId) {
      const bestCand = candidates.find((c) => c.placementId === bestPlacementId);
      const worstCand = candidates.find((c) => c.placementId === worstPlacementId);
      explanation = `${bestCand?.label || "Candidate"} outperforms ${worstCand?.label || "Candidate"} by ${deltaScore} pts (${valuesByPlacement[bestPlacementId].valueText} vs ${valuesByPlacement[worstPlacementId].valueText}).`;
    }

    criteriaMatrix.push({
      criterionId: critId,
      label: meta.label,
      unit: meta.unit,
      weight: meta.weight,
      valuesByPlacement,
      bestPlacementId: deltaScore > 0 ? bestPlacementId : null,
      worstPlacementId: deltaScore > 0 ? worstPlacementId : null,
      deltaScore,
      benchmark: meta.benchmark,
      explanation,
    });
  });

  // Sort criteria by weight descending
  criteriaMatrix.sort((a, b) => b.weight - a.weight);

  // 3. Compute Candidate Ranking
  // Enforce mandatory constraints: candidates violating mandatory exclusions suffer effective ranking penalty
  const sortedCandidates = [...candidates].sort((a, b) => {
    const penaltyA = a.hasMandatoryViolation ? 1000 : 0;
    const penaltyB = b.hasMandatoryViolation ? 1000 : 0;
    const adjustedA = a.overallScore - penaltyA;
    const adjustedB = b.overallScore - penaltyB;
    return adjustedB - adjustedA;
  });

  const ranking: CandidateRanking[] = sortedCandidates.map((cand, idx) => {
    const rank = idx + 1;

    // Identify top advantages (criteria where candidate scored >= 80 or won with >= 10 pt margin)
    const topAdvantages: string[] = [];
    cand.criteria.forEach((crit) => {
      if ((crit.score ?? 0) >= 80) {
        topAdvantages.push(`${crit.label}: ${crit.value} (score ${crit.score})`);
      }
    });

    // Identify top disadvantages / constraints
    const topDisadvantages: string[] = [];
    if (cand.hasMandatoryViolation) {
      cand.constraints.forEach((c) => {
        if (c.severity === "critical") {
          topDisadvantages.push(`Mandatory Conflict: ${c.description}`);
        }
      });
    }
    cand.criteria.forEach((crit) => {
      if (crit.score !== null && crit.score <= 40) {
        topDisadvantages.push(`Low ${crit.label}: ${crit.value} (score ${crit.score})`);
      }
    });

    // Plain-language ranking rationale
    let rankingRationale = "";
    if (cand.hasMandatoryViolation) {
      rankingRationale = `Ranked lower due to ${cand.mandatoryViolationsCount} unresolved mandatory constraint violation(s) that override general suitability.`;
    } else if (rank === 1) {
      const winningCount = winningCountsByPlacement[cand.placementId] || 0;
      rankingRationale = `Highest-performing candidate (${cand.overallScore}/100, ${cand.scoreBand}) with 0 mandatory violations and leading performance across ${winningCount} criteria.`;
    } else {
      const leader = sortedCandidates[0];
      const gap = leader.overallScore - cand.overallScore;
      rankingRationale = `Trails Rank 1 (${leader.label}) by ${gap} overall points, primarily in ${topDisadvantages[0] || "secondary criteria performance"}.`;
    }

    return {
      rank,
      placementId: cand.placementId,
      label: cand.label,
      scenarioName: cand.scenarioName,
      type: cand.type,
      overallScore: cand.overallScore,
      scoreBand: cand.scoreBand,
      hasMandatoryViolation: cand.hasMandatoryViolation,
      mandatoryViolationsCount: cand.mandatoryViolationsCount,
      winningCriteriaCount: winningCountsByPlacement[cand.placementId] || 0,
      topAdvantages: topAdvantages.slice(0, 3),
      topDisadvantages: topDisadvantages.slice(0, 3),
      rankingRationale,
    };
  });

  // 4. Spatial Separation Matrix (Geodesic Haversine Distance)
  const spatialSeparation: SpatialSeparationPair[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const distanceMeters = Math.round(
        calculateDistanceMeters(a.lat, a.lng, b.lat, b.lng)
      );
      spatialSeparation.push({
        placementAId: a.placementId,
        placementBId: b.placementId,
        labelA: a.label,
        labelB: b.label,
        distanceMeters,
      });
    }
  }

  // 5. Uncertainty Profiles & Data Quality
  const uncertaintyProfiles: Record<string, CandidateUncertaintyProfile> = {};
  candidates.forEach((cand) => {
    let confirmedConstraints = 0;
    let evidenceSupported = 0;
    let estimatedProxies = 0;
    let unknownCount = 0;

    cand.criteria.forEach((crit) => {
      switch (crit.uncertaintyClassification) {
        case "confirmed_constraint":
          confirmedConstraints++;
          break;
        case "evidence_supported":
          evidenceSupported++;
          break;
        case "estimated_proxy":
          estimatedProxies++;
          break;
        case "unknown":
        case "incomplete_evidence":
        default:
          unknownCount++;
          break;
      }
    });

    const staleSources = cand.dataSources
      .filter((ds) => ds.isStale || ds.status === "stale")
      .map((ds) => ds.provider);

    uncertaintyProfiles[cand.placementId] = {
      evidenceCompleteness: cand.evidenceCompleteness,
      confirmedConstraints,
      evidenceSupported,
      estimatedProxies,
      unknownCount,
      staleSources,
    };
  });

  // 6. Baseline Site Condition & Modeled vs Observed Tradeoffs
  const firstCand = sortedCandidates[0];
  const baseline: BaselineSiteCondition = {
    label: "Undeveloped Baseline Site",
    preConstructionState: "Pre-construction natural or unmanaged land surface",
    existingLandUseProxy: "Open land / road right-of-way corridor",
    existingRoadDistanceM: firstCand?.impacts.arterialDistanceM ?? null,
    topographySlopeEstimate: "Screened terrain slope from digital elevation model",
    environmentalNotice:
      "Baseline state presents zero civil construction footprint and zero impervious surface addition.",
  };

  const keyTradeoffs: string[] = [];
  if (candidates.length >= 2) {
    const c1 = sortedCandidates[0];
    const c2 = sortedCandidates[1];
    keyTradeoffs.push(
      `Access vs Constraint: ${c1.label} offers ${c1.impacts.accessQuality} arterial access with ${c1.mandatoryViolationsCount} violations, compared to ${c2.label} with ${c2.mandatoryViolationsCount} violations.`
    );
    if (c1.impacts.solarPotentialAnnualMwh && c2.impacts.solarPotentialAnnualMwh) {
      const deltaMwh = c1.impacts.solarPotentialAnnualMwh - c2.impacts.solarPotentialAnnualMwh;
      keyTradeoffs.push(
        `Solar Generation: ${c1.label} produces an estimated ${Math.abs(deltaMwh)} MWh/year ${deltaMwh >= 0 ? "more" : "less"} than ${c2.label}.`
      );
    }
    const pair = spatialSeparation.find(
      (p) =>
        (p.placementAId === c1.placementId && p.placementBId === c2.placementId) ||
        (p.placementAId === c2.placementId && p.placementBId === c1.placementId)
    );
    if (pair) {
      keyTradeoffs.push(
        `Spatial Proximity: Top candidates are separated by ${pair.distanceMeters.toLocaleString()} meters, representing geographically distinct siting alternatives.`
      );
    }
  }

  // 7. Executive Summary
  const topCandidate = sortedCandidates[0];
  let executiveSummary = "";
  if (candidates.length === 1) {
    executiveSummary = `Single candidate evaluated: ${topCandidate.label} scored ${topCandidate.overallScore}/100 (${topCandidate.scoreBand}). Add additional candidates to enable comparative differential analysis.`;
  } else if (topCandidate.hasMandatoryViolation) {
    executiveSummary = `Warning: All candidate locations violate at least one mandatory exclusion or separation rule. Re-siting or dimensional modifications are strongly advised prior to design commitment.`;
  } else {
    const secondCandidate = sortedCandidates[1];
    const margin = topCandidate.overallScore - secondCandidate.overallScore;
    executiveSummary = `Candidate "${topCandidate.label}" is the recommended placement, leading the alternatives with an overall score of ${topCandidate.overallScore}/100 (+${margin} pt margin over "${secondCandidate.label}"). It satisfies all mandatory spatial constraints and delivers superior accessibility and site suitability.`;
  }

  return {
    scenarioId: scenarioInfo?.id,
    scenarioName: scenarioInfo?.name,
    candidates,
    comparability: {
      isCompatible,
      mode: comparabilityMode,
      types: uniqueTypes,
      advisoryNotice,
    },
    ranking,
    criteriaMatrix,
    spatialSeparation,
    uncertaintyProfiles,
    baselineComparison: {
      baseline,
      modeledVsObservedNotice:
        "Modeled impacts are geometric and spatial estimations derived from OpenStreetMap, Open-Meteo, and NASA POWER datasets. Real-world civil engineering outcomes require on-site geotechnical surveying, utility locates, and environmental impact assessments.",
      keyTradeoffs,
    },
    executiveSummary,
    generatedAt,
  };
}
