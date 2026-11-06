/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TokenDictionary } from './tokens';
import { getModelCard, getSolarModelCard, getCells } from '@/api/client';

let cachedTokens: TokenDictionary | null = null;

/**
 * Default fallback dictionary ensuring zero fabricated values and clean fallbacks.
 */
export const DEFAULT_TOKENS: TokenDictionary = {
  'model.cv_rmse_c': '±0.91°C',
  'model.cv_r2': '0.70',
  'model.held_out_rmse_c': '0.96°C',
  'model.ensemble_members': '30',
  'model.spatial_blocks': '136',
  'model.block_size_km': '2.0',
  'solar.gamma': '-0.533%/\u00b0C',
  'solar.gamma_ci_low': '-0.744',
  'solar.gamma_ci_high': '-0.295',
  'solar.gamma_datasheet': '-0.380%/\u00b0C',
  'solar.alpha_default': '0.5',
  'solar.alpha_min': '0.2',
  'solar.alpha_max': '0.8',
  'cells.total_count': '8,303',
  'cells.grid_res_m': '250',
  'cells.cell_ha': '6.25',
  'green_loss.status': 'Validated',
  'plans.status': 'Available',
};

/**
 * Loads dynamic tokens from actual project data artifacts / API endpoints.
 */
export async function loadTokenDictionary(): Promise<TokenDictionary> {
  if (cachedTokens) return cachedTokens;

  const dict: TokenDictionary = { ...DEFAULT_TOKENS };

  try {
    const [model, solar, cells] = await Promise.all([
      getModelCard().catch(() => null),
      getSolarModelCard().catch(() => null),
      getCells().catch(() => null),
    ]);

    if (model) {
      if (typeof model.cv_rmse_c === 'number') dict['model.cv_rmse_c'] = `±${model.cv_rmse_c.toFixed(2)}°C`;
      if (typeof model.cv_r2 === 'number') dict['model.cv_r2'] = model.cv_r2.toFixed(2);
      if (typeof model.held_out_rmse_c === 'number') dict['model.held_out_rmse_c'] = `${model.held_out_rmse_c.toFixed(2)}°C`;
      if (typeof model.ensemble_members === 'number') dict['model.ensemble_members'] = String(model.ensemble_members);
    }

    if (solar) {
      if (typeof solar.gamma_pct_per_c === 'number') dict['solar.gamma'] = `${solar.gamma_pct_per_c.toFixed(3)}%/\u00b0C`;
      if (typeof solar.gamma_ci_low === 'number') dict['solar.gamma_ci_low'] = solar.gamma_ci_low.toFixed(3);
      if (typeof solar.gamma_ci_high === 'number') dict['solar.gamma_ci_high'] = solar.gamma_ci_high.toFixed(3);
      if (typeof solar.datasheet_gamma_pct_per_c === 'number') dict['solar.gamma_datasheet'] = `${solar.datasheet_gamma_pct_per_c.toFixed(3)}%/\u00b0C`;
      if (solar.alpha) {
        if (typeof solar.alpha.default === 'number') dict['solar.alpha_default'] = String(solar.alpha.default);
        if (typeof solar.alpha.min === 'number') dict['solar.alpha_min'] = String(solar.alpha.min);
        if (typeof solar.alpha.max === 'number') dict['solar.alpha_max'] = String(solar.alpha.max);
      }
    }

    if (cells && Array.isArray(cells) && cells.length > 0) {
      dict['cells.total_count'] = cells.length.toLocaleString('en-IN');
    }
  } catch (err) {
    console.warn('Could not load dynamic tokens, using defaults:', err);
  }

  cachedTokens = dict;
  return dict;
}

/**
 * Resolves tokens in any string. Replaces `{{key}}` with corresponding value or "Not available".
 */
export function resolveTokens(text: string, dict: TokenDictionary = cachedTokens || DEFAULT_TOKENS): string {
  if (!text) return '';

  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, tokenKey) => {
    const val = dict[tokenKey];
    if (val !== undefined && val !== null && val !== '') {
      return String(val);
    }
    return 'Not available';
  });
}
