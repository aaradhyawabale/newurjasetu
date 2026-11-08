import { 
  PriorityCell, 
  getPriorityCellsSync, 
  getEnsembleEffectsSync,
  isPriorityDataAvailable,
  ENSEMBLE_MEMBERS_PER_CELL
} from './loader';

export interface OptimizeOptions {
  /** Target budget in hectares (must be positive) */
  budget_ha: number;

  /** Optimization objective: direct thermal cooling, population-weighted thermal relief, or hazard-based ranking */
  objective?: 'cooling' | 'population_weighted' | 'hazard_based';

  /** If true, fall back to hazard-based ranking when cooling fields are null */
  fallback_to_hazard?: boolean;

  /** Optional filter by PMC administrative ward */
  ward?: string;

  /** Optional filter for specific candidate cell IDs (e.g. Green Loss Watch: Protect / Restore First mode) */
  candidate_cell_ids?: string[];

  /** Minimum greenable land in hectares required to consider a cell (default: 0.1 ha) */
  min_greenable_ha?: number;

  /** Target NDVI for counterfactual scenario */
  target_ndvi?: number;
}

export interface SelectedCellResult {
  id: string;
  ward: string;
  centroid: [number, number];
  greenable_ha: number;
  cooling_mean: number | null;
  cooling_p10: number | null;
  cooling_p90: number | null;
  population: number | null;
  benefit_per_ha: number;
  selection_frequency: number; // 0.0 to 1.0 from 30 Monte Carlo ensemble runs
  times_selected_ensemble: number; // 0 to 30
  rank: number;
}

export interface OptimizeResult {
  status: 'OK' | 'UNAVAILABLE' | 'EMPTY';
  budget_ha: number;
  allocated_ha: number;
  selected_cells: SelectedCellResult[];
  ensemble_runs: number;
  total_cells_evaluated: number;
  selection_frequencies: Record<string, number>;
  governance: {
    disclaimers: string[];
    provenance: Record<string, string>;
  };
  message?: string;
}

/**
 * Greedily selects candidate cells by benefit-per-hectare under a hectare budget constraint.
 * Runs Monte Carlo optimization over the 30 ensemble members to compute robust selection frequency.
 * 
 * If cooling fields are null (e.g. direction check failed), returns status 'UNAVAILABLE'.
 */
export function optimizeInterventionBudget(
  options: OptimizeOptions,
  customCells?: PriorityCell[],
  customEnsembleBuffer?: Float32Array
): OptimizeResult {
  const budgetHa = options.budget_ha;
  const objective = options.objective || 'cooling';
  const minGreenable = options.min_greenable_ha ?? 0.1;
  const wardFilter = options.ward ? options.ward.trim().toLowerCase() : null;

  const governanceDisclaimers = [
    "Surface temperature (LST) is radiometric skin temperature, NOT 2m ambient air temperature or human heat stress.",
    "NDVI is a spectral vegetation index, NOT 3D tree canopy cover or shade architecture.",
    "No arbitrary weighted composite scores; ranking is strictly based on physical cooling benefit per hectare.",
    "Selection frequency reflects robustness across 30 Monte Carlo ensemble members."
  ];

  const provenanceMap: Record<string, string> = {
    greenable_ha: "Modelled",
    cooling_mean: "Modelled",
    cooling_p10: "Modelled",
    cooling_p90: "Modelled",
    benefit_per_ha: "Modelled",
    selection_frequency: "Modelled",
    population: "Modelled"
  };

  // Load cells from memory or sync loader
  let cells: PriorityCell[];
  try {
    cells = customCells || getPriorityCellsSync();
  } catch (err: any) {
    return {
      status: 'UNAVAILABLE',
      budget_ha: budgetHa,
      allocated_ha: 0,
      selected_cells: [],
      ensemble_runs: 0,
      total_cells_evaluated: 0,
      selection_frequencies: {},
      governance: { disclaimers: governanceDisclaimers, provenance: provenanceMap },
      message: `Priority data unavailable on server: ${err.message}`
    };
  }

  // Filter by ward if requested
  let candidates = cells;
  if (wardFilter) {
    candidates = candidates.filter(c => c.ward.trim().toLowerCase() === wardFilter);
  }

  // Filter by candidate cell IDs if provided (e.g. Green Loss Watch: Protect / Restore First mode)
  if (options.candidate_cell_ids && options.candidate_cell_ids.length > 0) {
    const targetIdSet = new Set(options.candidate_cell_ids);
    candidates = candidates.filter(c => targetIdSet.has(c.id));
  }

  // Filter by minimum greenable land
  candidates = candidates.filter(c => c.greenable_ha !== null && c.greenable_ha >= minGreenable);

  if (candidates.length === 0) {
    return {
      status: 'EMPTY',
      budget_ha: budgetHa,
      allocated_ha: 0,
      selected_cells: [],
      ensemble_runs: 0,
      total_cells_evaluated: cells.length,
      selection_frequencies: {},
      governance: { disclaimers: governanceDisclaimers, provenance: provenanceMap },
      message: 'No cells match the specified filtering criteria or minimum greenable area.'
    };
  }

  // Case check: Are cooling fields null? (e.g. model quality gate failed)
  const cellsWithValidCooling = candidates.filter(c => c.cooling_mean !== null);
  const isHazardFallback = options.objective === 'hazard_based' || (cellsWithValidCooling.length === 0 && options.fallback_to_hazard === true);

  if (cellsWithValidCooling.length === 0 && !isHazardFallback) {
    return {
      status: 'UNAVAILABLE',
      budget_ha: budgetHa,
      allocated_ha: 0,
      selected_cells: [],
      ensemble_runs: 0,
      total_cells_evaluated: candidates.length,
      selection_frequencies: {},
      governance: { disclaimers: governanceDisclaimers, provenance: provenanceMap },
      message: 'Cooling fields are null (thermodynamic direction check unverified or missing). Cannot optimize intervention allocation without valid cooling observations.'
    };
  }

  // Get binary ensemble buffer for 30 Monte Carlo runs (only used if cooling is available)
  let ensembleBuffer: Float32Array | null = null;
  if (!isHazardFallback) {
    try {
      ensembleBuffer = customEnsembleBuffer || getEnsembleEffectsSync();
    } catch {
      ensembleBuffer = null;
    }
  }

  // Map each candidate cell to its index in the full cell list (for ensemble slicing)
  const cellIdToIndex = new Map<string, number>();
  cells.forEach((c, idx) => cellIdToIndex.set(c.id, idx));

  // --- Step 1: High-Performance Monte Carlo Simulation over 30 Ensemble Members ---
  const N = candidates.length;
  const candGreenable = new Float32Array(N);
  const candPopMult = new Float32Array(N);
  const candFullIdx = new Int32Array(N);

  for (let i = 0; i < N; i++) {
    const c = candidates[i];
    candGreenable[i] = c.greenable_ha!;
    candPopMult[i] = objective === 'population_weighted' ? ((c.population || 1) / 1000.0) : 1.0;
    candFullIdx[i] = cellIdToIndex.get(c.id) ?? -1;
  }

  const scores = new Float64Array(N);
  const order = new Int32Array(N);
  const memberCounts = new Int32Array(N);
  const totalRuns = ensembleBuffer ? ENSEMBLE_MEMBERS_PER_CELL : 1;

  for (let m = 0; m < totalRuns; m++) {
    for (let i = 0; i < N; i++) {
      order[i] = i;
      const gHa = candGreenable[i];
      if (isHazardFallback) {
        // Hazard-based ranking: people x heat excess per hectare
        const lstVal = candidates[i].lst_mean ?? 37.0;
        const heatExcess = Math.max(0.1, (candidates[i] as any).heat_excess_celsius ?? (lstVal - 32.1));
        const hazard = ((candidates[i].population || 1) * heatExcess) / 1000.0;
        scores[i] = gHa > 0 ? Number((hazard / gHa).toFixed(4)) : -1;
      } else {
        let coolingMember = candidates[i].cooling_mean;

        if (ensembleBuffer && candFullIdx[i] >= 0) {
          const val = ensembleBuffer[candFullIdx[i] * ENSEMBLE_MEMBERS_PER_CELL + m];
          if (!Number.isNaN(val)) {
            coolingMember = val;
          }
        }

        if (coolingMember === null || coolingMember <= 0 || gHa <= 0) {
          scores[i] = -1;
        } else {
          const benefit = coolingMember * candPopMult[i];
          scores[i] = Number((benefit / gHa).toFixed(4));
        }
      }
    }

    // Sort descending by benefit-per-hectare
    order.sort((a, b) => scores[b] - scores[a]);

    // Greedy knapsack packing under budgetHa
    let budgetLeft = budgetHa;
    for (let j = 0; j < N; j++) {
      const idx = order[j];
      if (scores[idx] <= 0) break;
      const gHa = candGreenable[idx];
      if (gHa <= budgetLeft) {
        budgetLeft -= gHa;
        memberCounts[idx]++;
      }
    }
  }

  const memberSelectionCounts = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    memberSelectionCounts.set(candidates[i].id, memberCounts[i]);
  }

  // --- Step 2: Deterministic Baseline Greedy Selection ---
  for (let i = 0; i < N; i++) {
    order[i] = i;
    const c = candidates[i];
    const gHa = candGreenable[i];
    if (isHazardFallback) {
      const lstVal = c.lst_mean ?? 37.0;
      const heatExcess = Math.max(0.1, (c as any).heat_excess_celsius ?? (lstVal - 32.1));
      const hazard = ((c.population || 1) * heatExcess) / 1000.0;
      scores[i] = gHa > 0 ? Number((hazard / gHa).toFixed(4)) : -1;
    } else if (c.cooling_mean === null || c.cooling_mean <= 0 || gHa <= 0) {
      scores[i] = -1;
    } else {
      const benefit = c.cooling_mean * candPopMult[i];
      scores[i] = Number((benefit / gHa).toFixed(4));
    }
  }

  order.sort((a, b) => scores[b] - scores[a]);

  let allocatedHa = 0;
  const selectedCells: SelectedCellResult[] = [];
  let rank = 1;

  for (let j = 0; j < N; j++) {
    const idx = order[j];
    if (scores[idx] <= 0) break;
    const cell = candidates[idx];
    const gHa = candGreenable[idx];
    if (allocatedHa + gHa <= budgetHa) {
      allocatedHa += gHa;
      const timesSelected = memberCounts[idx];
      const selectionFreq = Number((timesSelected / totalRuns).toFixed(2));

      selectedCells.push({
        id: cell.id,
        ward: cell.ward,
        centroid: cell.centroid,
        greenable_ha: gHa,
        cooling_mean: isHazardFallback ? null : cell.cooling_mean,
        cooling_p10: isHazardFallback ? null : cell.cooling_p10,
        cooling_p90: isHazardFallback ? null : cell.cooling_p90,
        population: cell.population,
        benefit_per_ha: scores[idx],
        selection_frequency: selectionFreq,
        times_selected_ensemble: timesSelected,
        rank: rank++
      });
    }
  }

  // Build full frequency dictionary
  const selectionFrequencies: Record<string, number> = {};
  for (const [cellId, count] of memberSelectionCounts.entries()) {
    selectionFrequencies[cellId] = Number((count / totalRuns).toFixed(2));
  }

  return {
    status: 'OK',
    budget_ha: budgetHa,
    allocated_ha: Number(allocatedHa.toFixed(2)),
    selected_cells: selectedCells,
    ensemble_runs: totalRuns,
    total_cells_evaluated: candidates.length,
    selection_frequencies: selectionFrequencies,
    message: isHazardFallback
      ? 'Hazard-based ranking, no cooling estimate: Model quality gate not met or cooling estimates unavailable; prioritised by population heat exposure per hectare.'
      : undefined,
    governance: {
      disclaimers: isHazardFallback
        ? [
            ...governanceDisclaimers,
            'Hazard-based ranking, no cooling estimate: Quality gate not met; cooling estimates suppressed.'
          ]
        : governanceDisclaimers,
      provenance: provenanceMap
    }
  };
}
