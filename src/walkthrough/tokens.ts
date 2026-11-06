/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TokenDictionary {
  [key: string]: string;
}

export const KNOWN_TOKENS = [
  'model.cv_rmse_c',
  'model.cv_r2',
  'model.held_out_rmse_c',
  'model.ensemble_members',
  'model.spatial_blocks',
  'model.block_size_km',
  'solar.gamma',
  'solar.gamma_ci_low',
  'solar.gamma_ci_high',
  'solar.gamma_datasheet',
  'solar.alpha_default',
  'solar.alpha_min',
  'solar.alpha_max',
  'cells.total_count',
  'cells.grid_res_m',
  'cells.cell_ha',
  'green_loss.status',
  'plans.status',
] as const;

export type KnownTokenKey = typeof KNOWN_TOKENS[number];
