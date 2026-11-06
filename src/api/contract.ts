/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * UrjaSetu Data Contract & Types
 * SDG 13: Climate Action - Pune Surface Heat Intelligence Platform
 */

export type TruthLabel = 'Measured' | 'Modelled' | 'Assumed' | 'Input';

export interface Cell {
  id: string;
  centroid: [number, number]; // [lng, lat]
  ward: string;
  population: number;
  lst_mean: number; // Surface temperature (°C)
  lst_std: number;
  n_obs: number;
  ndvi: number; // Vegetation index (-1 to 1)
  built_frac: number; // 0 to 1
  greenable_ha: number; // Available unbuilt land in hectares
  burden: number; // Population-weighted heat excess index
  heat_excess_celsius: number; // Surface heat above rural baseline
  cooling_mean: number | null; // Modelled cooling potential (°C)
  cooling_p10: number | null;
  cooling_p90: number | null;
  solar_penalty_low: number | null; // % loss in PV efficiency
  solar_penalty_mid: number | null;
  solar_penalty_high: number | null;
  loss_fraction: number | null; // Fraction of baseline vegetation lost
  loss_ha: number | null; // Green cover lost in hectares
  baseline_ndvi: number | null;
  current_ndvi: number | null;
  heat_penalty_mean: number | null; // Heat increase associated with loss (°C)
  heat_penalty_p10: number | null;
  heat_penalty_p90: number | null;
}

/**
 * Calculates a 250m bounding box polygon [lat, lng][] from a cell centroid [lng, lat].
 * At Pune's latitude (~18.52° N), ~0.00113° lat and ~0.00118° lng corresponds to ~125m offset.
 */
export function cellToPolygon(cell: Cell): [number, number][] {
  const [lng, lat] = cell.centroid;
  const dLat = 0.00113;
  const dLng = 0.00118;
  return [
    [lat - dLat, lng - dLng],
    [lat - dLat, lng + dLng],
    [lat + dLat, lng + dLng],
    [lat + dLat, lng - dLng],
  ];
}

export interface OptimizeRequest {
  budget_ha: number;
  objective: 'people_cooling';
  ward?: string;
  target_ndvi: number;
}

export interface SelectedZone {
  id: string;
  rank: number;
  area_ha: number;
  benefit_mean: number; // cooling effect or people-cooling score
  selection_frequency: number; // 0 to 1 across 30 ensemble seeds
}

export interface OptimizeResult {
  selected: SelectedZone[];
  totals: {
    zones: number;
    area_ha: number;
    people_covered: number;
    cooling_low: number; // 10th percentile
    cooling_mid: number; // mean
    cooling_high: number; // 90th percentile
    robustness: number; // % agreement across ensemble runs
  };
}

export interface ModelScene {
  sensor: string;
  date: string;
}

export interface ModelCard {
  cv_rmse_c: number; // Cross-validation RMSE in °C
  cv_r2: number; // R² score
  held_out_rmse_c: number; // Held-out test RMSE in °C
  ensemble_members: number; // Number of models in ensemble
  gate: {
    passed: boolean;
    text: string;
  };
  scenes: ModelScene[];
  assumptions: string[];
  limitations: string[];
}

export interface SolarModelCard {
  gamma_pct_per_c: number; // Empirical loss % per °C above STC 25°C
  gamma_ci_low: number;
  gamma_ci_high: number;
  datasheet_gamma_pct_per_c: number; // Standard panel datasheet spec (-0.38 %/°C)
  alpha: {
    default: number;
    min: number;
    max: number;
    status: 'Assumed';
  };
  limitations: string[];
}

export interface WardSummary {
  ward: string;
  loss_ha: number;
  loss_pct_of_baseline_green: number;
  people_in_loss_cells: number | null;
}

export interface Site {
  id: string;
  name: string;
  kind: 'garden' | 'hospital' | 'corridor';
  ward: string;
  lat: number;
  lng: number;
  area_ha: number;
  lst_mean: number;
  population: number;
  notes: string;
  current_shade_pct: number;
  heat_burden_rank: number;
}

export interface InterventionOption {
  id: string;
  name: string;
  type: 'greening' | 'cool_roof' | 'shade';
  cost_inr_lakh: number;
  cost_status: 'Assumed';
  cooling_mean: number;
  cooling_p10: number;
  cooling_p90: number;
  feasibility_note: string;
  is_recommended: boolean;
  recommendation_reason: string;
}

// TODO-MAP: Match these endpoint path constants to real backend API routes in production
export const ENDPOINTS = {
  CELLS: '/api/v1/pune/cells', // TODO-MAP
  MODEL_CARD: '/api/v1/models/heat/card', // TODO-MAP
  SOLAR_MODEL_CARD: '/api/v1/models/solar/card', // TODO-MAP
  OPTIMIZE: '/api/v1/planner/optimize', // TODO-MAP
  ZONE_DETAILS: '/api/v1/pune/cells/:id', // TODO-MAP
  WARD_SUMMARY: '/api/v1/pune/wards/summary', // TODO-MAP
  SITES: '/api/v1/infrastructure/sites', // TODO-MAP
  INTERVENTIONS: '/api/v1/interventions/compare/:id', // TODO-MAP
  DOSSIER_DOWNLOAD: '/api/v1/dossiers/:id/download.pdf', // TODO-MAP
  COPILOT: '/api/v1/copilot/ask', // TODO-MAP
} as const;
