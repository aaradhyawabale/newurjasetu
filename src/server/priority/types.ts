/**
 * UrjaSetu Priority Engine Data Types
 * 
 * Strict scientific schemas for 250m cell prioritization,
 * Monte Carlo ensemble cooling effects, and transparent model governance.
 */

export type ProvenanceCategory = 'Measured' | 'Modelled' | 'Assumed';

/**
 * Priority Cell Representation (250m x 250m cell)
 * Area: 6.25 hectares (0.0625 km²)
 */
export interface PriorityCell {
  /** Unique cell identifier (e.g., 'cell_250m_0001') */
  id: string;

  /** Geographic centroid in WGS84 [longitude, latitude] */
  centroid: [number, number];

  /** Administrative PMC ward name */
  ward: string;

  /** Estimated ambient resident population (null if unavailable) [Modelled / Assumed] */
  population: number | null;

  /** Mean Land Surface Temperature in °C from Landsat 9 TIRS-2 (null if missing/cloud) [Measured] */
  lst_mean: number | null;

  /** Spatial standard deviation of LST across subpixels within cell in °C [Modelled] */
  lst_std: number | null;

  /** Count of valid clear-sky 30m satellite observation pixels in cell [Measured] */
  n_obs: number;

  /** Mean Sentinel-2 NDVI [-1.0, 1.0] (null if missing/cloud) [Measured] */
  ndvi: number | null;

  /** Built-up impervious surface fraction [0.0, 1.0] [Modelled] */
  built_frac: number | null;

  /** Estimated potential greenable/permeable land area in hectares (max 6.25 ha) [Modelled / Assumed] */
  greenable_ha: number | null;

  /** Heat vulnerability / exposure burden metric (null if unassessed) [Modelled] */
  burden: number | null;

  /** Predicted ensemble mean thermal surface cooling effect in °C [Modelled] */
  cooling_mean: number | null;

  /** Conservative 10th percentile cooling effect in °C from 30 ensemble members [Modelled] */
  cooling_p10: number | null;

  /** Optimistic 90th percentile cooling effect in °C from 30 ensemble members [Modelled] */
  cooling_p90: number | null;

  /** Surface heat excess above cool baseline in °C [Modelled] */
  heat_excess_celsius?: number | null;

  /** Relative solar PV power output loss (%) from heat excess [Modelled] */
  solar_penalty_mean?: number | null;

  /** 10th percentile relative solar PV output loss (%) [Modelled] */
  solar_penalty_p10?: number | null;

  /** 90th percentile relative solar PV output loss (%) [Modelled] */
  solar_penalty_p90?: number | null;
}

/**
 * Solar PV Temperature Penalty Model Card Schema
 */
export interface SolarModelCard {
  model_name: string;
  version: string;
  training_dates: {
    start_date: string;
    end_date: string;
    total_days: number;
  };
  dataset_plants: Array<{
    plant_id: number;
    name: string;
    rmse_kw: number;
    r2_score: number;
    train_days: number;
    test_days: number;
  }>;
  temperature_penalty: {
    fixed_irradiation_kw_m2: number;
    base_module_temp_celsius: number;
    hot_module_temp_celsius: number;
    delta_temp_celsius: number;
    percent_change_per_10c_mean: number;
    percent_change_per_10c_p10: number;
    percent_change_per_10c_p90: number;
    bootstrap_samples: number;
    penalty_per_celsius_mean: number;
  };
  limitations: string[];
  governance: {
    disclaimers: string[];
    provenance_tag: ProvenanceCategory;
  };
  created_at: string;
}

/**
 * Summary statistics computed from a cell's 30-member ensemble
 */
export interface EnsembleStats {
  cellIndex: number;
  cellId: string;
  memberCount: number;
  mean: number | null;
  p10: number | null;
  p90: number | null;
  min: number | null;
  max: number | null;
  spread: number | null; // p90 - p10
  values: number[];
}

/**
 * Source dataset specification in model card
 */
export interface ModelCardSource {
  name: string;
  provider: string;
  resolution?: string;
  license?: string;
  usage?: string;
  url?: string;
}

/**
 * Model Card Schema for Model Governance and Provenance
 */
export interface PriorityModelCard {
  model_name: string;
  version: string;
  task: string;
  created_at: string;
  updated_at?: string;
  framework?: string;
  spatial_resolution: {
    cell_size_meters: number;
    cell_area_hectares: number;
    crs: string;
    display_crs: string;
  };
  features?: string[];
  target?: string;
  metrics: {
    rmse_celsius?: number | null;
    mae_celsius?: number | null;
    r2_score?: number | null;
    spatial_cv_folds?: number;
    ensemble_members: number;
    coverage_percentage?: number;
    [key: string]: any;
  };
  dates: {
    landsat9_overpass?: string;
    sentinel2b_overpass?: string;
    held_out_scene_date?: string;
    baseline_climatology_period?: string;
    demographics_reference_year?: number;
    [key: string]: any;
  };
  sources: ModelCardSource[];
  provenance_classification: Record<keyof Omit<PriorityCell, 'id' | 'centroid'> | 'id' | 'centroid', ProvenanceCategory>;
  limitations: string[];
  ensemble_members?: number;
  held_out_scene?: {
    date: string;
    r2?: number | null;
    rmse?: number | null;
  };
  direction_check?: {
    passed: boolean;
    status?: string;
    mean_cooling_celsius?: number | null;
    violations_count?: number;
    valid_interventions_evaluated?: number;
    target_ndvi_applied?: number;
    reason?: string;
    thermal_sensitivity?: number;
    [key: string]: any;
  };
}

/**
 * Green Loss Watch: Individual 250m cell vegetation loss and extra heat evaluation
 */
export interface GreenLossCell {
  id: string;
  centroid: [number, number];
  ward: string;
  ndvi_2019: number | null;
  ndvi_2026: number | null;
  delta_ndvi: number | null;
  ndbi_2019: number | null;
  ndbi_2026: number | null;
  delta_ndbi: number | null;
  is_loss: boolean;
  loss_area_ha: number;
  extra_heat_mean: number | null;
  extra_heat_p10: number | null;
  extra_heat_p90: number | null;
  population: number | null;
  burden: number | null;
}

/**
 * Ward-level aggregate for Green Loss Watch (23 PMC Wards)
 */
export interface WardGreenLossAggregate {
  ward: string;
  loss_cells_count: number;
  total_loss_area_ha: number;
  mean_ndvi_drop: number;
  mean_extra_heat_celsius: number | null;
  affected_population: number;
}

/**
 * Complete Green Loss Watch Dataset
 */
export interface GreenLossDataset {
  metadata: {
    title: string;
    version: string;
    seasons: {
      baseline_season: string;
      current_season: string;
    };
    thresholds: {
      ndvi_drop_threshold: number;
      ndbi_rise_required: boolean;
    };
    total_loss_area_ha: number;
    total_loss_cells: number;
    total_cells_evaluated: number;
    model_gate_passed: boolean;
    created_at: string;
  };
  governance: {
    disclaimers: string[];
    provenance_tags: Record<string, ProvenanceCategory>;
  };
  scene_manifest: {
    year_2019_scenes: Array<{ id: string; date: string; cloud_cover_percent: number }>;
    year_2026_scenes: Array<{ id: string; date: string; cloud_cover_percent: number }>;
  };
  cells: GreenLossCell[];
  ward_aggregates: WardGreenLossAggregate[];
}

