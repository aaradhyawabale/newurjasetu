/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GlossaryEntry {
  term: string;
  definition: string;
  provenanceChip?: 'Measured' | 'Modelled' | 'Assumed' | 'Input';
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  'surface temperature': {
    term: 'Surface Temperature (LST)',
    definition: 'Radiometric skin temperature of ground, rooftops, and pavement measured by satellite thermal sensors (Landsat 9 TIRS-2 Band 10). It is not ambient 2m air temperature.',
    provenanceChip: 'Measured',
  },
  'heat burden': {
    term: 'Heat Burden',
    definition: 'Relative exposure index computed as population density multiplied by daytime surface temperature excess above the regional baseline.',
    provenanceChip: 'Modelled',
  },
  'ensemble': {
    term: 'Model Ensemble',
    definition: 'A collection of 30 gradient boosted trees trained on randomized bootstrap partitions to quantify parameter uncertainty without overfitting.',
    provenanceChip: 'Modelled',
  },
  'robustness': {
    term: 'Plan Robustness',
    definition: 'The percentage of bootstrap model runs in which a priority zone remains selected under the specified budget constraints.',
    provenanceChip: 'Modelled',
  },
  'spatial-block validation': {
    term: 'Spatial-Block Cross-Validation',
    definition: 'A cross-validation protocol using contiguous 2 km geographical blocks to eliminate spatial autocorrelation leakage between training and test sets.',
    provenanceChip: 'Modelled',
  },
  'NDVI': {
    term: 'NDVI (Normalized Difference Vegetation Index)',
    definition: 'A spectral index derived from Sentinel-2 red and near-infrared reflectance measuring photosynthetic vigor. It is an index, not direct canopy cover.',
    provenanceChip: 'Measured',
  },
  'alpha': {
    term: 'Coupling Factor Alpha',
    definition: 'An assumed urban microclimate parameter scaling radiometric land surface temperature excess to rooftop PV module operating temperature.',
    provenanceChip: 'Assumed',
  },
  'gamma': {
    term: 'Temperature Penalty Gamma',
    definition: 'Empirical derating coefficient (-0.533%/°C) derived from utility SCADA operational data quantifying PV output loss per degree of temperature excess.',
    provenanceChip: 'Measured',
  },
};
