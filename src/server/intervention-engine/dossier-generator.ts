import { InterventionCandidate, PlanningDossier } from './types';
import { getCategoryMetadata } from './intervention-registry';
import { getCandidateById } from './candidate-generator';
import { getModelCardSync } from '../priority/loader';

export function generatePlanningDossier(candidateId: string): PlanningDossier {
  const candidate = getCandidateById(candidateId);
  if (!candidate) {
    throw new Error(`Candidate not found with id: ${candidateId}`);
  }

  const categoryMeta = getCategoryMetadata(candidate.categoryId);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const lstVal = candidate.thermalContext.surfaceTemperatureCelsius;
  const lstDelta = candidate.thermalContext.lstDeltaToBaselineCelsius;
  const ndviVal = candidate.vegetationContext.ndvi30m;
  const ndviDelta = candidate.vegetationContext.ndviDeltaToBaseline;

  const executiveSummary = `Municipal Planning Dossier prepared for ${candidate.name} located in ${candidate.wardOrPrabhag}. ` +
    `Evaluated under the '${categoryMeta.name}' category. ` +
    `Source Feature Provenance: [${candidate.provenanceType}] Feature ID: ${candidate.sourceFeatureId || 'N/A'} (Source Dataset: ${candidate.sourceDatasetName || 'Municipal Cadastre'}). ` +
    `The candidate exhibits an observed Landsat 9 Land Surface Temperature ` +
    `of ${lstVal !== null ? `${lstVal}°C` : 'N/A'} (${lstDelta !== null ? `${lstDelta > 0 ? '+' : ''}${lstDelta}°C` : 'N/A'} relative to the Pune study area baseline of 46.3°C) ` +
    `and a Sentinel-2 30m aggregated NDVI of ${ndviVal !== null ? ndviVal : 'N/A'} (SCL: ${candidate.vegetationContext.sclClassName}). ` +
    `Overall evidence completeness is rated as ${candidate.evidenceCompleteness}. ` +
    `Implementation readiness is classified as '${candidate.status}'. ${candidate.statusRationale}`;

  const spatialEvidenceSummary = {
    landsat9ThermalSummary: `Observed LST is ${lstVal !== null ? `${lstVal}°C` : 'No Data'} with radiometric uncertainty estimate ±${candidate.thermalContext.landsatStQaUncertaintyK !== null && candidate.thermalContext.landsatStQaUncertaintyK !== undefined ? candidate.thermalContext.landsatStQaUncertaintyK.toFixed(2) : '2.16 (study area mean)'} K. ` +
      `Native ST_B10 thermal pixel is 100m, resampled onto the 30m Pune project grid. ${candidate.thermalContext.nativeResolutionNotice}`,
    sentinel2VegetationSummary: `Aggregated 30m NDVI is ${ndviVal !== null ? ndviVal : 'No Data'} (${ndviDelta !== null ? `${ndviDelta > 0 ? '+' : ''}${ndviDelta}` : 'N/A'} relative to terrestrial baseline 0.514). ` +
      `SCL classification code is ${candidate.vegetationContext.sclClassId} (${candidate.vegetationContext.sclClassName}).`,
    infrastructureProximitySummary: `Located ${candidate.infrastructureContext.nearestRoadDistanceM}m from ${candidate.infrastructureContext.nearestRoadName}. ` +
      (candidate.infrastructureContext.nearestSubstationName 
        ? `Electrical distribution node: ${candidate.infrastructureContext.nearestSubstationName} at ${candidate.infrastructureContext.nearestSubstationDistanceM}m (spare headroom unconfirmed — requires formal MSEDCL sanction). ` 
        : '') +
      (candidate.infrastructureContext.nearestTransitHubDistanceM !== undefined 
        ? `Transit node proximity: ${candidate.infrastructureContext.nearestTransitHubDistanceM}m. ` 
        : '') +
      `Footprint area: ${candidate.estimatedTargetAreaM2 ? `${candidate.estimatedTargetAreaM2.toLocaleString()} m² (planning estimate)` : 'Not established from point geometry (requires CTSO cadastre demarcation)'}.`
  };

  const regulatoryAndStandardAlignment = categoryMeta.governingStandards.map(std => {
    return `${std.standardName} (${std.issuingBody}) — ${std.sectionOrClause}: ${std.keyThresholdOrRequirement}`;
  });

  const preImplementationSurveyPlan = candidate.missingSurveyChecklist.map(item => {
    let dept = 'PMC Public Works / Road Department';
    if (candidate.categoryId === 'COOL_ROOF_FEASIBILITY') {
      dept = 'PMC Building Inspection / Structural Cell';
    } else if (candidate.categoryId === 'SOLAR_CANOPY_EV_COLOCATION') {
      dept = 'MSEDCL & PMC Electrical Engineering Division';
    } else if (candidate.categoryId === 'GREEN_SPACE_ENHANCEMENT') {
      dept = 'PMC Garden Department & Central Ground Water Authority';
    } else if (candidate.categoryId === 'INTEGRATED_FACILITY_UPGRADE') {
      dept = 'High-Powered Joint Taskforce (PMC, MahaMetro, MSEDCL)';
    }

    return {
      surveyTask: item.itemName,
      mandatedTechnique: item.surveyStandardOrMethodology,
      responsibleDepartment: dept
    };
  });

  const nonAuthoritativeDisclaimer = 'DISCLAIMER: This planning dossier is generated autonomously by UrjaSetu based on satellite observations, ' +
    'open geospatial extracts, and engineering heuristics. It is non-authoritative and does NOT constitute formal administrative sanction, ' +
    'statutory environmental clearance, structural certification, or budget authorization. Physical site inspection, load testing, ' +
    'utility verification, and municipal council approval are mandatory prior to project execution.';

  return {
    dossierId: `DOSSIER-PUNE-${candidate.id.toUpperCase()}-${dateStr}`,
    generatedAt: now.toISOString(),
    analysisRunId: candidate.analysisRunId || 'RUN-STATIC-DEMO',
    candidate,
    categoryMetadata: categoryMeta,
    executiveSummary,
    spatialEvidenceSummary,
    regulatoryAndStandardAlignment,
    preImplementationSurveyPlan,
    nonAuthoritativeDisclaimer,
    modelCardSummary: (() => {
      const mc = getModelCardSync();
      if (!mc) return undefined;
      return {
        modelName: mc.model_name,
        rmse: mc.metrics?.rmse ?? null,
        r2: mc.metrics?.r2 ?? null,
        heldOutSceneDate: mc.held_out_scene?.date ?? "N/A",
        directionCheckPassed: mc.direction_check?.passed ?? false,
      };
    })(),
  };
}
