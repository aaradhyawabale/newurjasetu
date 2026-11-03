import { InterventionCandidate, CandidateComparison } from './types';
import { getCandidateById } from './candidate-generator';

export function compareCandidates(candidateIds: string[]): CandidateComparison {
  if (candidateIds.length < 2) {
    throw new Error('Candidate comparison requires at least 2 candidates.');
  }
  if (candidateIds.length > 4) {
    throw new Error('Candidate comparison is capped at a maximum of 4 candidates.');
  }

  const candidates: InterventionCandidate[] = [];
  for (const id of candidateIds) {
    const c = getCandidateById(id);
    if (!c) {
      throw new Error(`Candidate not found with id: ${id}`);
    }
    candidates.push(c);
  }

  // Build comparison matrix
  const matrix: CandidateComparison['comparisonMatrix'] = [
    {
      attribute: 'Intervention Category',
      category: 'General',
      values: Object.fromEntries(candidates.map(c => [c.id, c.categoryId]))
    },
    {
      attribute: 'Candidate Status',
      category: 'General',
      values: Object.fromEntries(candidates.map(c => [c.id, c.status]))
    },
    {
      attribute: 'Ward / Prabhag',
      category: 'General',
      values: Object.fromEntries(candidates.map(c => [c.id, c.wardOrPrabhag]))
    },
    {
      attribute: 'Coordinates (WGS84)',
      category: 'Spatial',
      values: Object.fromEntries(candidates.map(c => [c.id, `${c.coordinates.lat.toFixed(4)}°N, ${c.coordinates.lng.toFixed(4)}°E`]))
    },
    {
      attribute: 'Land Surface Temp (LST)',
      category: 'Thermal Evidence',
      values: Object.fromEntries(candidates.map(c => [c.id, c.thermalContext.surfaceTemperatureCelsius !== null ? `${c.thermalContext.surfaceTemperatureCelsius}°C` : 'No Data']))
    },
    {
      attribute: 'LST Delta vs Study Area (46.3°C)',
      category: 'Thermal Evidence',
      values: Object.fromEntries(candidates.map(c => {
        const d = c.thermalContext.lstDeltaToBaselineCelsius;
        return [c.id, d !== null ? `${d > 0 ? '+' : ''}${d}°C` : 'N/A'];
      }))
    },
    {
      attribute: 'Thermal Uncertainty (ST_QA)',
      category: 'Thermal Evidence',
      values: Object.fromEntries(candidates.map(c => [c.id, c.thermalContext.landsatStQaUncertaintyK !== null ? `±${c.thermalContext.landsatStQaUncertaintyK} K` : 'N/A']))
    },
    {
      attribute: 'Sentinel-2 NDVI (30m)',
      category: 'Vegetation Evidence',
      values: Object.fromEntries(candidates.map(c => [c.id, c.vegetationContext.ndvi30m !== null ? c.vegetationContext.ndvi30m : 'No Data']))
    },
    {
      attribute: 'Scene Classification (SCL)',
      category: 'Vegetation Evidence',
      values: Object.fromEntries(candidates.map(c => [c.id, `${c.vegetationContext.sclClassId} (${c.vegetationContext.sclClassName})`]))
    },
    {
      attribute: 'Nearest Mapped Road',
      category: 'Infrastructure',
      values: Object.fromEntries(candidates.map(c => [c.id, `${c.infrastructureContext.nearestRoadName} (${c.infrastructureContext.nearestRoadDistanceM}m)`]))
    },
    {
      attribute: 'Nearest Substation',
      category: 'Infrastructure',
      values: Object.fromEntries(candidates.map(c => [c.id, c.infrastructureContext.nearestSubstationName ? `${c.infrastructureContext.nearestSubstationName} (${c.infrastructureContext.nearestSubstationDistanceM}m)` : 'Not Applicable']))
    },
    {
      attribute: 'Estimated Footprint Area',
      category: 'Physical Dimensions',
      values: Object.fromEntries(candidates.map(c => [c.id, c.estimatedTargetAreaM2 ? `${c.estimatedTargetAreaM2.toLocaleString()} m²` : 'Linear / Corridor']))
    },
    {
      attribute: 'Critical Blockers Count',
      category: 'Constraints & Risk',
      values: Object.fromEntries(candidates.map(c => [c.id, c.constraints.filter(x => x.severity === 'CRITICAL_BLOCKER').length]))
    },
    {
      attribute: 'Missing Surveys Count',
      category: 'Constraints & Risk',
      values: Object.fromEntries(candidates.map(c => [c.id, c.missingSurveyChecklist.length]))
    }
  ];

  // Synthesize objective trade-offs across dimensions
  const tradeOffAnalysis: CandidateComparison['tradeOffAnalysis'] = [
    {
      dimension: 'Thermal Exposure & Heat Stress Profile',
      observations: candidates.map(c => {
        const delta = c.thermalContext.lstDeltaToBaselineCelsius;
        const deltaStr = delta !== null ? `${delta > 0 ? '+' : ''}${delta}°C` : 'unknown';
        return `${c.name}: Radiating LST is ${c.thermalContext.surfaceTemperatureCelsius ?? 'N/A'}°C (${deltaStr} relative to study area baseline).`;
      }),
      governingConsideration: 'Landsat 9 LST records surface skin temperature on 2023-04-22 under clear-sky conditions. Candidates with higher surface temperatures indicate elevated radiative thermal load on surrounding surfaces.'
    },
    {
      dimension: 'Civil & Structural Complexity',
      observations: candidates.map(c => {
        const blockers = c.constraints.filter(x => x.severity === 'CRITICAL_BLOCKER');
        return `${c.name}: ${blockers.length} critical constraint(s) recorded: ${blockers.map(b => b.title).join('; ') || 'None'}.`;
      }),
      governingConsideration: 'Rooftops and parking canopies require structural load and wind-uplift testing; linear greening corridors require subsurface utility clearance (GPR).'
    },
    {
      dimension: 'Data Completeness & Implementation Readiness',
      observations: candidates.map(c => {
        return `${c.name}: Evidence is ${c.evidenceCompleteness}; requires ${c.missingSurveyChecklist.length} pre-implementation site surveys.`;
      }),
      governingConsideration: 'No candidate may be cleared for financial tendering without completing mandatory pre-implementation site surveys.'
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    candidateIds,
    candidates,
    comparisonMatrix: matrix,
    tradeOffAnalysis,
    planningNotice: 'This comparative analysis is deterministic and based on verified spatial observations. It does not establish municipal spending priority or legal site approvals.'
  };
}
