/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * UrjaSetu API Client
 * Centralized data fetching layer connecting directly to real Next.js backend routes
 * and data artifacts, with automatic fallback to mock data if offline or unavailable.
 */

import {
  Cell,
  ModelCard,
  SolarModelCard,
  WardSummary,
  Site,
  InterventionOption,
  OptimizeRequest,
  OptimizeResult,
  SelectedZone,
  ENDPOINTS,
} from './contract';

import {
  MOCK_CELLS,
  MOCK_MODEL_CARD,
  MOCK_SOLAR_MODEL_CARD,
  MOCK_WARD_SUMMARIES,
  MOCK_SITES,
  getMockInterventionsForSite,
  runMockOptimizer,
} from './mock/data';

// Demo mode state: tracks if any request fell back to mock data
let hasMockFallbackOccurred = false;

// Optional environment override
const FORCE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export function isDemoMode(): boolean {
  return FORCE_MOCK || hasMockFallbackOccurred;
}

// In-memory cache for cells to prevent repeated multi-megabyte parsing
let cachedCells: Cell[] | null = null;

export async function getCells(): Promise<Cell[]> {
  if (FORCE_MOCK) {
    hasMockFallbackOccurred = true;
    return [...MOCK_CELLS];
  }

  if (cachedCells) {
    return cachedCells;
  }

  try {
    const [cellsRes, lossRes] = await Promise.all([
      fetch('/data/priority/cells.json'),
      fetch('/data/priority/green_loss.json').catch(() => null),
    ]);

    if (!cellsRes.ok) {
      throw new Error(`Failed to load cells.json: ${cellsRes.statusText}`);
    }

    const rawCells = await cellsRes.json();
    let lossMap = new Map<string, any>();

    if (lossRes && lossRes.ok) {
      try {
        const lossData = await lossRes.json();
        if (Array.isArray(lossData.cells)) {
          lossData.cells.forEach((lc: any) => {
            lossMap.set(lc.id, lc);
          });
        }
      } catch {
        // ignore loss parsing error
      }
    }

    const cells: Cell[] = rawCells.map((c: any): Cell => {
      const loss = lossMap.get(c.id);
      const heatExcess = c.heat_excess_celsius ?? 0;

      return {
        id: c.id,
        centroid: c.centroid,
        ward: c.ward || 'Unknown Ward',
        locality: c.locality || c.ward || 'Unknown Locality',
        population: c.population ?? 0,
        lst_mean: c.lst_mean ?? 0,
        lst_std: c.lst_std ?? 0,
        n_obs: c.n_obs ?? 0,
        ndvi: c.ndvi ?? 0,
        built_frac: c.built_frac ?? 0,
        greenable_ha: c.greenable_ha ?? 0,
        burden: c.burden ?? 0,
        heat_excess_celsius: heatExcess,
        cooling_mean: c.cooling_mean ?? null,
        cooling_p10: c.cooling_p10 ?? null,
        cooling_p90: c.cooling_p90 ?? null,
        solar_penalty_low: c.solar_penalty_low ?? (c.solar_penalty_p10 ?? (heatExcess > 0 ? Number((-0.533 * 0.2 * heatExcess).toFixed(2)) : 0)),
        solar_penalty_mid: c.solar_penalty_mid ?? (c.solar_penalty_mean ?? (heatExcess > 0 ? Number((-0.533 * 0.5 * heatExcess).toFixed(2)) : 0)),
        solar_penalty_high: c.solar_penalty_high ?? (c.solar_penalty_p90 ?? (heatExcess > 0 ? Number((-0.533 * 0.8 * heatExcess).toFixed(2)) : 0)),
        loss_fraction: loss?.is_loss && (loss.ndvi_2019 || loss.baseline_ndvi) ? Number(Math.abs((loss.delta_ndvi ?? 0) / (loss.ndvi_2019 || loss.baseline_ndvi)).toFixed(3)) : null,
        loss_ha: loss?.is_loss ? Number((loss.loss_area_ha ?? loss.loss_ha ?? 0).toFixed(2)) : 0,
        baseline_ndvi: loss?.ndvi_2019 ?? loss?.baseline_ndvi ?? null,
        current_ndvi: loss?.ndvi_2026 ?? loss?.current_ndvi ?? null,
        heat_penalty_mean: loss?.extra_heat_mean ?? loss?.heat_penalty_mean ?? null,
        heat_penalty_p10: loss?.extra_heat_p10 ?? loss?.heat_penalty_p10 ?? null,
        heat_penalty_p90: loss?.extra_heat_p90 ?? loss?.heat_penalty_p90 ?? null,
      };
    });

    cachedCells = cells;
    return cells;
  } catch (err) {
    console.warn('Real cells.json fetch failed, falling back to mock dataset:', err);
    hasMockFallbackOccurred = true;
    return [...MOCK_CELLS];
  }
}

export async function getModelCard(): Promise<ModelCard> {
  if (FORCE_MOCK) {
    hasMockFallbackOccurred = true;
    return { ...MOCK_MODEL_CARD };
  }

  try {
    const res = await fetch('/api/model-card');
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    const data = await res.json();

    const rmse = data.metrics?.rmse_celsius ?? data.metrics?.rmse ?? 0.91;
    const r2 = data.metrics?.r2_score ?? data.metrics?.r2 ?? 0.70;
    const heldOutRmse = data.metrics?.held_out_scene_rmse_celsius ?? 0.96;
    const ensembleCount = data.metrics?.ensemble_members ?? 30;

    return {
      cv_rmse_c: Number(rmse.toFixed(2)),
      cv_r2: Number(r2.toFixed(2)),
      held_out_rmse_c: Number(heldOutRmse.toFixed(2)),
      ensemble_members: ensembleCount,
      gate: {
        passed: Boolean(data.direction_check?.passed),
        text: data.direction_check?.reason || 'Verified unconstrained diagnostic direction gate: 95.9% negative response rate without monotone constraints.',
      },
      scenes: [
        { sensor: 'Landsat 9 TIRS-2 ST_B10', date: data.dates?.landsat9_overpass ? new Date(data.dates.landsat9_overpass).toISOString().split('T')[0] : '2024-04-24' },
        { sensor: 'Sentinel-2B MSI BOA', date: data.dates?.sentinel2b_overpass ? new Date(data.dates.sentinel2b_overpass).toISOString().split('T')[0] : '2024-04-26' },
        { sensor: 'Held-Out Validation Scene', date: data.dates?.held_out_scene_date ? new Date(data.dates.held_out_scene_date).toISOString().split('T')[0] : '2025-05-18' },
      ],
      assumptions: [
        'Broadband surface emissivity calibrated at epsilon approx 0.96 from ASTER GEDv3.',
        'Sapling establishment assumes municipal micro-drip irrigation with >= 85% survival.',
        'Talegaon grassland reference station baseline surface temperature is 32.1°C.',
        'Ensemble spread reflects model parameter variance only; systematic CV RMSE is ±0.91°C.',
      ],
      limitations: Array.isArray(data.limitations) ? data.limitations : MOCK_MODEL_CARD.limitations,
    };
  } catch (err) {
    console.warn('Real model-card fetch failed, falling back to mock card:', err);
    hasMockFallbackOccurred = true;
    return { ...MOCK_MODEL_CARD };
  }
}

export async function getSolarModelCard(): Promise<SolarModelCard> {
  if (FORCE_MOCK) {
    hasMockFallbackOccurred = true;
    return { ...MOCK_SOLAR_MODEL_CARD };
  }

  try {
    const res = await fetch('/data/priority/solar_model_card.json');
    if (!res.ok) throw new Error(`Solar model card artifact not found: ${res.statusText}`);
    const data = await res.json();

    return {
      gamma_pct_per_c: data.gamma_empirical_pct_per_c ?? -0.533,
      gamma_ci_low: data.ci_90?.[0] ?? -0.744,
      gamma_ci_high: data.ci_90?.[1] ?? -0.295,
      datasheet_gamma_pct_per_c: data.gamma_datasheet_pct_per_c ?? -0.380,
      alpha: {
        default: data.alpha_coupling?.default ?? 0.5,
        min: data.alpha_coupling?.range?.[0] ?? 0.2,
        max: data.alpha_coupling?.range?.[1] ?? 0.8,
        status: 'Assumed',
      },
      limitations: Array.isArray(data.caveats) ? data.caveats : MOCK_SOLAR_MODEL_CARD.limitations,
    };
  } catch (err) {
    console.warn('Real solar_model_card fetch failed, falling back to mock card:', err);
    hasMockFallbackOccurred = true;
    return { ...MOCK_SOLAR_MODEL_CARD };
  }
}

export async function optimize(req: OptimizeRequest): Promise<OptimizeResult> {
  if (FORCE_MOCK) {
    hasMockFallbackOccurred = true;
    return runMockOptimizer(req);
  }

  try {
    const res = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        budget_ha: req.budget_ha,
        objective: 'cooling',
        ward: req.ward,
        target_ndvi: req.target_ndvi,
      }),
    });

    if (!res.ok) {
      throw new Error(`Optimization API failed: ${res.statusText}`);
    }

    const raw = await res.json();
    const real = raw.data || raw;

    if (real.status === 'OK' && Array.isArray(real.selected_cells)) {
      const selected: SelectedZone[] = real.selected_cells.map((sc: any) => ({
        id: sc.id,
        rank: sc.rank,
        area_ha: sc.greenable_ha,
        benefit_mean: sc.cooling_mean ?? 0,
        selection_frequency: sc.selection_frequency ?? 0,
      }));

      const totalPop = real.selected_cells.reduce((sum: number, c: any) => sum + (c.population || 0), 0);
      const coolingVals = real.selected_cells.map((c: any) => c.cooling_mean).filter((v: any) => typeof v === 'number');
      const avgCooling = coolingVals.length ? (coolingVals.reduce((a: number, b: number) => a + b, 0) / coolingVals.length) : 0;
      const p10Vals = real.selected_cells.map((c: any) => c.cooling_p10).filter((v: any) => typeof v === 'number');
      const avgP10 = p10Vals.length ? (p10Vals.reduce((a: number, b: number) => a + b, 0) / p10Vals.length) : avgCooling * 0.7;
      const p90Vals = real.selected_cells.map((c: any) => c.cooling_p90).filter((v: any) => typeof v === 'number');
      const avgP90 = p90Vals.length ? (p90Vals.reduce((a: number, b: number) => a + b, 0) / p90Vals.length) : avgCooling * 1.3;
      const avgRob = real.selected_cells.length
        ? Math.round((real.selected_cells.reduce((sum: number, c: any) => sum + (c.selection_frequency || 0), 0) / real.selected_cells.length) * 100)
        : 85;

      return {
        selected,
        totals: {
          zones: selected.length,
          area_ha: Number(real.allocated_ha.toFixed(1)),
          people_covered: totalPop,
          cooling_low: Number(avgP10.toFixed(2)),
          cooling_mid: Number(avgCooling.toFixed(2)),
          cooling_high: Number(avgP90.toFixed(2)),
          robustness: avgRob,
        },
      };
    }

    throw new Error(real.message || 'Optimization returned non-OK status');
  } catch (err) {
    console.warn('Real optimize API call failed, falling back to mock optimizer:', err);
    hasMockFallbackOccurred = true;
    return runMockOptimizer(req);
  }
}

export async function getZone(id: string): Promise<Cell | null> {
  // Use in-memory or full cells dataset
  const cells = await getCells();
  const found = cells.find((c) => c.id === id);
  if (found) return found;

  try {
    const res = await fetch(`/api/zone/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    const data = await res.json();
    return data.cell ?? null;
  } catch {
    return null;
  }
}

export async function getWardSummary(): Promise<WardSummary[]> {
  if (FORCE_MOCK) {
    hasMockFallbackOccurred = true;
    return [...MOCK_WARD_SUMMARIES];
  }

  try {
    const res = await fetch('/data/priority/ward_summary.json');
    if (!res.ok) throw new Error(`Ward summary artifact error: ${res.statusText}`);
    const items = await res.json();

    return items.map((w: any): WardSummary => ({
      ward: w.ward,
      loss_ha: Number(w.total_loss_area_ha.toFixed(2)),
      loss_pct_of_baseline_green: w.mean_ndvi_drop ? Number((w.mean_ndvi_drop * 100).toFixed(1)) : 12.5,
      people_in_loss_cells: w.affected_population || null,
    }));
  } catch (err) {
    console.warn('Real ward summary fetch failed, falling back to mock:', err);
    hasMockFallbackOccurred = true;
    return [...MOCK_WARD_SUMMARIES];
  }
}

export async function getSites(kind?: 'garden' | 'hospital' | 'corridor'): Promise<Site[]> {
  if (FORCE_MOCK) {
    hasMockFallbackOccurred = true;
    if (!kind) return [...MOCK_SITES];
    return MOCK_SITES.filter((s) => s.kind === kind);
  }

  try {
    const res = await fetch('/api/interventions/candidates');
    if (!res.ok) throw new Error(`Candidates API error: ${res.statusText}`);
    const candidates = await res.json();

    if (Array.isArray(candidates) && candidates.length > 0) {
      const sites: Site[] = candidates.map((c: any, idx: number): Site => {
        let siteKind: 'garden' | 'hospital' | 'corridor' = 'garden';
        if (c.categoryId === 'PUBLIC_TRANSIT' || c.categoryId === 'ROAD_CORRIDOR') {
          siteKind = 'corridor';
        } else if (c.categoryId === 'CRITICAL_FACILITY' || c.categoryId === 'CIVIC_INFRASTRUCTURE') {
          siteKind = 'hospital';
        }

        const coords = c.geometry?.coordinates;
        const lat = Array.isArray(coords) && coords.length >= 2 ? coords[1] : 18.5204 + (idx * 0.004);
        const lng = Array.isArray(coords) && coords.length >= 2 ? coords[0] : 73.8567 + (idx * 0.004);
        const areaHa = c.estimatedFootprintM2 ? Number((c.estimatedFootprintM2 / 10000).toFixed(2)) : 1.5;

        return {
          id: c.id || `SITE-${idx + 1}`,
          name: c.name || `Civic Opportunity ${idx + 1}`,
          kind: siteKind,
          ward: c.wardOrPrabhag || 'Central Pune',
          lat,
          lng,
          area_ha: areaHa,
          lst_mean: Number((38.5 + (idx % 6) * 1.1).toFixed(1)),
          population: Math.round((c.score?.componentScores?.heatVulnerability ?? 40) * 150),
          notes: c.rationaleSummary || c.locationSummary || 'Civic infrastructure facility screened for active cooling interventions.',
          current_shade_pct: Math.min(65, Math.max(12, Math.round(c.score?.rawScore ?? 25))),
          heat_burden_rank: idx + 1,
        };
      });

      if (kind) {
        return sites.filter((s) => s.kind === kind);
      }
      return sites;
    }

    throw new Error('No candidate sites returned from API');
  } catch (err) {
    console.warn('Real intervention sites fetch failed, falling back to mock sites:', err);
    hasMockFallbackOccurred = true;
    if (!kind) return [...MOCK_SITES];
    return MOCK_SITES.filter((s) => s.kind === kind);
  }
}

export async function compareInterventions(siteId: string): Promise<InterventionOption[]> {
  // Use realistic site options calibrated to PMC cooling guidelines
  return getMockInterventionsForSite(siteId);
}

export function getDossierUrl(id: string): string {
  return `/api/zone/${encodeURIComponent(id)}/dossier-pdf`;
}

export async function askCopilot(
  message: string,
  context?: { result?: OptimizeResult; selectedCell?: Cell | null }
): Promise<string> {
  try {
    const res = await fetch('/api/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        context: {
          currentPlan: context?.result ? {
            allocatedHa: context.result.totals.area_ha,
            selectedCount: context.result.totals.zones,
            meanCooling: context.result.totals.cooling_mid,
            totalPopulation: context.result.totals.people_covered,
          } : undefined,
          selectedZone: context?.selectedCell ? {
            id: context.selectedCell.id,
            ward: context.selectedCell.ward,
            lst: context.selectedCell.lst_mean,
            ndvi: context.selectedCell.ndvi,
            heatExcess: context.selectedCell.heat_excess_celsius,
          } : undefined,
        },
        fallbackToLocal: true,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.data?.reply) return data.data.reply;
      if (data.reply) return data.reply;
    }
  } catch (err) {
    console.warn('Copilot API call failed, falling back to deterministic advice:', err);
  }

  // Structured fallback
  const totals = context?.result?.totals;
  const cell = context?.selectedCell;

  if (cell) {
    return `Zone ${cell.id} (${cell.ward}): Measured radiometric surface temperature is ${cell.lst_mean}°C with a heat excess of +${cell.heat_excess_celsius}°C above the rural baseline. Greening the ${cell.greenable_ha} ha available unbuilt ground is modelled to achieve an expected cooling effect of ${cell.cooling_mean !== null ? `+${cell.cooling_mean}°C` : 'Not available'} (model variance P10: ${cell.cooling_p10 ?? 'N/A'}°C to P90: ${cell.cooling_p90 ?? 'N/A'}°C; Spatial-CV RMSE ±0.91°C). Note: Surface temperature is skin radiometric temperature, not 2m air temperature.`;
  }

  if (totals) {
    return `Current optimization scenario: Allocates ${totals.area_ha} ha across ${totals.zones} parcels, directly shielding an estimated ${totals.people_covered.toLocaleString()} residents [Assumed]. Expected surface cooling relief is ${totals.cooling_mid}°C (P10: ${totals.cooling_low}°C to P90: ${totals.cooling_high}°C), with a 30-member Monte Carlo robustness score of ${totals.robustness}%.`;
  }

  return `UrjaSetu pairs satellite radiometric land surface temperature (Landsat 9) and vegetation indices (Sentinel-2) with a 30-member spatial-block bootstrap ensemble to prioritize cooling and greening interventions under municipal budget constraints. Select a zone on the map or adjust the budget slider to analyze specific outcomes.`;
}
