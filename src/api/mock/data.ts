/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Deterministic Synthetic Mock Data Generator for UrjaSetu (Pune, India)
 * SDG 13: Climate Action
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
} from '../contract';

// Seeded pseudorandom generator for deterministic reproducibility
function createSeededRandom(seed: number) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const PUNE_CENTER_LAT = 18.5204;
const PUNE_CENTER_LNG = 73.8567;
const RURAL_BASELINE_LST = 32.1;

export const PUNE_WARDS = [
  'Kasba Peth',
  'Shivajinagar',
  'Kothrud',
  'Aundh',
  'Hadapsar',
  'Bibwewadi',
  'Ghole Road',
  'Bhavani Peth',
  'Dhankawadi',
  'Yerawada',
  'Warje',
  'Sinhagad Road',
  'Nagar Road',
  'Wadgaon Sheri',
];

// Generate ~600 cells across a 25x24 spatial grid around Pune
export function generateMockCells(): Cell[] {
  const rng = createSeededRandom(42);
  const cells: Cell[] = [];
  const rows = 25;
  const cols = 24;

  let counter = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Coordinates in ~250m increments
      // 0.00226 deg lat ~= 250m, 0.00237 deg lng ~= 250m
      const lat = PUNE_CENTER_LAT + (r - rows / 2) * 0.00226;
      const lng = PUNE_CENTER_LNG + (c - cols / 2) * 0.00237;

      // Distance from historic urban core (Kasba Peth / Shivajinagar)
      const distFromCore = Math.sqrt(
        Math.pow((r - rows / 2) * 0.25, 2) + Math.pow((c - cols / 2) * 0.25, 2)
      );

      // Ward assignment based on quadrant/distance
      let wardIndex = 0;
      if (distFromCore < 1.2) {
        wardIndex = (r + c) % 2 === 0 ? 0 : 7; // Kasba Peth or Bhavani Peth
      } else if (c < cols / 2 && r > rows / 2) {
        wardIndex = 2; // Kothrud
      } else if (c < cols / 2 && r <= rows / 2) {
        wardIndex = (c % 2 === 0) ? 1 : 3; // Shivajinagar / Aundh
      } else if (c >= cols / 2 && r > rows / 2) {
        wardIndex = (r % 2 === 0) ? 4 : 5; // Hadapsar / Bibwewadi
      } else {
        wardIndex = (r + c) % (PUNE_WARDS.length - 6) + 6;
      }
      const ward = PUNE_WARDS[wardIndex % PUNE_WARDS.length];

      // Realistic spatial physics: core has higher built fraction, lower vegetation
      const coreDensityFactor = Math.max(0, 1 - distFromCore / 4.5);
      const built_frac = Math.min(
        0.95,
        Math.max(0.18, 0.35 + 0.45 * coreDensityFactor + (rng() - 0.5) * 0.12)
      );

      // NDVI inversely correlated with built fraction + spatial noise
      const ndvi = Math.max(
        0.06,
        Math.min(0.62, 0.52 - 0.42 * built_frac + (rng() - 0.5) * 0.08)
      );

      // Surface temperature (LST) inversely associated with NDVI and positively with built fraction
      // Hot spots reach 44-46°C surface temp, greener areas around 33-35°C
      const heatThermalEffect = (built_frac * 11.2) - (ndvi * 9.5);
      const lst_mean = Math.round((RURAL_BASELINE_LST + 2.5 + heatThermalEffect + (rng() - 0.5) * 1.2) * 10) / 10;
      const lst_std = Math.round((1.0 + rng() * 1.2) * 100) / 100;
      const n_obs = Math.floor(22 + rng() * 14);

      const heat_excess_celsius = Math.max(0.2, Math.round((lst_mean - RURAL_BASELINE_LST) * 10) / 10);

      // Population: dense in core (up to 16,000 / cell), lower in periphery
      const basePop = 1200 + coreDensityFactor * 9500 + rng() * 3200;
      const population = Math.round(basePop / 50) * 50;

      // Greenable land: unbuilt portion, capped at realistic civic/street reserve
      const maxPossibleHa = 6.25; // 250m x 250m = 6.25 ha
      const unbuiltHa = maxPossibleHa * (1 - built_frac);
      const greenable_ha = Math.round(Math.max(0.15, unbuiltHa * (0.35 + rng() * 0.45)) * 10) / 10;

      // Heat burden: population weighted excess
      const burden = Math.round((population * heat_excess_celsius) / 100);

      // Cooling potential: estimated reduction if greenable area is planted to target NDVI (modelled)
      const cooling_mean = Math.round((0.6 + greenable_ha * 0.42 + heat_excess_celsius * 0.12) * 10) / 10;
      const cooling_p10 = Math.max(0.2, Math.round((cooling_mean * 0.68) * 10) / 10);
      const cooling_p90 = Math.round((cooling_mean * 1.34) * 10) / 10;

      // Solar thermal penalty: PV degradation
      const solar_penalty_mid = Math.round((heat_excess_celsius * 0.42 * 0.5) * 10) / 10;
      const solar_penalty_low = Math.max(0.1, Math.round((solar_penalty_mid * 0.75) * 10) / 10);
      const solar_penalty_high = Math.round((solar_penalty_mid * 1.28) * 10) / 10;

      // Green loss: some cells have historical loss recorded, some do not (null values)
      const hasLossData = (r * cols + c) % 2 === 0;
      let loss_fraction: number | null = null;
      let loss_ha: number | null = null;
      let baseline_ndvi: number | null = null;
      let current_ndvi: number | null = null;
      let heat_penalty_mean: number | null = null;
      let heat_penalty_p10: number | null = null;
      let heat_penalty_p90: number | null = null;

      if (hasLossData && (r + c) % 3 !== 0) {
        loss_fraction = Math.round((0.08 + rng() * 0.32) * 100) / 100;
        loss_ha = Math.round((loss_fraction * 2.8) * 10) / 10;
        baseline_ndvi = Math.round((ndvi + 0.12 + rng() * 0.14) * 100) / 100;
        current_ndvi = Math.round(ndvi * 100) / 100;
        heat_penalty_mean = Math.round((loss_fraction * 3.4 + rng() * 0.6) * 10) / 10;
        heat_penalty_p10 = Math.max(0.2, Math.round((heat_penalty_mean * 0.7) * 10) / 10);
        heat_penalty_p90 = Math.round((heat_penalty_mean * 1.35) * 10) / 10;
      }

      const id = `PUN-Z${String(counter++).padStart(3, '0')}`;

      cells.push({
        id,
        centroid: [Number(lng.toFixed(5)), Number(lat.toFixed(5))],
        ward,
        population,
        lst_mean,
        lst_std,
        n_obs,
        ndvi: Number(ndvi.toFixed(3)),
        built_frac: Number(built_frac.toFixed(3)),
        greenable_ha,
        burden,
        heat_excess_celsius,
        cooling_mean,
        cooling_p10,
        cooling_p90,
        solar_penalty_low,
        solar_penalty_mid,
        solar_penalty_high,
        loss_fraction,
        loss_ha,
        baseline_ndvi,
        current_ndvi,
        heat_penalty_mean,
        heat_penalty_p10,
        heat_penalty_p90,
      });
    }
  }

  return cells;
}

export const MOCK_CELLS = generateMockCells();

export const MOCK_MODEL_CARD: ModelCard = {
  cv_rmse_c: 1.18,
  cv_r2: 0.82,
  held_out_rmse_c: 1.31,
  ensemble_members: 12,
  gate: {
    passed: true,
    text: 'Quality Gate PASSED: Cross-validation RMSE of 1.18°C is within the municipal decision threshold (<= 1.25°C). Safe for budget prioritization.',
  },
  scenes: [
    { sensor: 'Landsat-9 TIRS-2', date: '2024-04-18' },
    { sensor: 'Landsat-8 TIRS-1', date: '2024-05-04' },
    { sensor: 'Sentinel-2B MSI', date: '2024-04-20' },
    { sensor: 'Sentinel-2A MSI', date: '2024-05-10' },
    { sensor: 'Landsat-9 TIRS-2', date: '2023-04-15' },
    { sensor: 'Sentinel-2B MSI', date: '2023-05-01' },
  ],
  assumptions: [
    'Atmospheric water vapor column density is estimated via MODIS MOD05_L2 daily product',
    'Rural baseline surface temperature is anchored to the Talegaon grassland reference station (32.1°C)',
    'Greening intervention survival rate is assumed >= 85% with native drought-tolerant species (Neem, Karanj, Peepal)',
    'Surface temperature is derived from top-of-atmosphere radiance using split-window emissivity calibration',
  ],
  limitations: [
    'Surface temperature represents radiant skin temperature (LST), not 2-meter ambient air temperature',
    'Monsoon months (July-September) are obscured by cloud cover and omitted from this pre-monsoon heat model',
    'Pixel resolution of 250m aggregates fine-grain microclimate shadows from individual building awnings',
    'Modelled cooling ranges reflect 30-seed ensemble variance and should be interpreted as planning estimates, not guarantees',
  ],
};

export const MOCK_SOLAR_MODEL_CARD: SolarModelCard = {
  gamma_pct_per_c: -0.42,
  gamma_ci_low: -0.48,
  gamma_ci_high: -0.37,
  datasheet_gamma_pct_per_c: -0.38,
  alpha: {
    default: 0.50,
    min: 0.20,
    max: 0.80,
    status: 'Assumed',
  },
  limitations: [
    'Module operating temperature excess is estimated using transfer factor alpha; actual roof mounting tilt and underside ventilation affect airflow',
    'Does not include dust accumulation (soiling) or inverter clipping limits',
    'Applies to crystalline silicon PV modules; thin-film technologies possess different thermal coefficients',
  ],
};

export const MOCK_WARD_SUMMARIES: WardSummary[] = PUNE_WARDS.map((ward, i) => {
  const wardCells = MOCK_CELLS.filter((c) => c.ward === ward);
  const totalPop = wardCells.reduce((acc, c) => acc + c.population, 0);
  const lossCells = wardCells.filter((c) => c.loss_ha !== null);
  const lossHa = Math.round(lossCells.reduce((acc, c) => acc + (c.loss_ha || 0), 0) * 10) / 10;
  const avgBaselineNdvi = lossCells.length > 0
    ? lossCells.reduce((acc, c) => acc + (c.baseline_ndvi || 0.4), 0) / lossCells.length
    : 0.38;
  const lossPct = Math.round((lossHa / Math.max(12, wardCells.length * 2.2)) * 100);

  return {
    ward,
    loss_ha: lossHa,
    loss_pct_of_baseline_green: Math.min(38, Math.max(4, lossPct + (i % 3) * 2)),
    people_in_loss_cells: lossCells.length > 0 ? Math.round(totalPop * 0.65) : null,
  };
}).sort((a, b) => b.loss_ha - a.loss_ha);

export const MOCK_SITES: Site[] = [
  {
    id: 'SITE-01',
    name: 'Sassoon General Hospital & Medical Campus',
    kind: 'hospital',
    ward: 'Kasba Peth',
    lat: 18.5262,
    lng: 73.8741,
    area_ha: 8.4,
    lst_mean: 44.8,
    population: 18500,
    notes: 'Critical high-vulnerability public healthcare facility. High asphalt fraction in parking and ambulance bays.',
    current_shade_pct: 14,
    heat_burden_rank: 1,
  },
  {
    id: 'SITE-02',
    name: 'Kamala Nehru General Hospital (Mangalwar Peth)',
    kind: 'hospital',
    ward: 'Kasba Peth',
    lat: 18.5218,
    lng: 73.8647,
    area_ha: 3.2,
    lst_mean: 45.2,
    population: 14200,
    notes: 'Surrounded by historic dense stone fabric. High patient transit and minimal canopy buffer.',
    current_shade_pct: 11,
    heat_burden_rank: 2,
  },
  {
    id: 'SITE-03',
    name: 'Aundh District Hospital Complex',
    kind: 'hospital',
    ward: 'Aundh',
    lat: 18.5612,
    lng: 73.8078,
    area_ha: 6.8,
    lst_mean: 42.1,
    population: 9800,
    notes: 'Large open compound with potential for perimeter mini-forest barrier and rooftop cool paint.',
    current_shade_pct: 22,
    heat_burden_rank: 6,
  },
  {
    id: 'SITE-04',
    name: 'Sarasbaug Civic Gardens & Peshwe Lake',
    kind: 'garden',
    ward: 'Bhavani Peth',
    lat: 18.5015,
    lng: 73.8542,
    area_ha: 11.2,
    lst_mean: 37.4,
    population: 11200,
    notes: 'Existing water body provides localized cooling; northern edge exposed to severe traffic radiation.',
    current_shade_pct: 42,
    heat_burden_rank: 9,
  },
  {
    id: 'SITE-05',
    name: 'Chittaranjan Vatika Urban Park (Model Colony)',
    kind: 'garden',
    ward: 'Shivajinagar',
    lat: 18.5356,
    lng: 73.8329,
    area_ha: 7.5,
    lst_mean: 38.2,
    population: 8600,
    notes: 'Well-maintained community park; outer walking trail lacks contiguous canopy shade.',
    current_shade_pct: 48,
    heat_burden_rank: 8,
  },
  {
    id: 'SITE-06',
    name: 'Sambhaji Park & JM Road Riverside Buffer',
    kind: 'garden',
    ward: 'Shivajinagar',
    lat: 18.5192,
    lng: 73.8488,
    area_ha: 9.1,
    lst_mean: 39.1,
    population: 12400,
    notes: 'Crucial thermal relief corridor adjacent to high-traffic arterial road.',
    current_shade_pct: 38,
    heat_burden_rank: 7,
  },
  {
    id: 'SITE-07',
    name: 'PCCOE Akurdi Knowledge Corridor',
    kind: 'corridor',
    ward: 'Aundh',
    lat: 18.6515,
    lng: 73.7618,
    area_ha: 14.5,
    lst_mean: 43.6,
    population: 16800,
    notes: 'Student commuting axis and high pedestrian movement. Broad paved surfaces with extreme midday insolation.',
    current_shade_pct: 16,
    heat_burden_rank: 3,
  },
  {
    id: 'SITE-08',
    name: 'Swargate Multimodal Transit Exchange',
    kind: 'corridor',
    ward: 'Bhavani Peth',
    lat: 18.5018,
    lng: 73.8585,
    area_ha: 12.0,
    lst_mean: 45.6,
    population: 26400,
    notes: 'Major bus terminal and metro junction. Severe thermal trap with concrete bus bays and metal roofing.',
    current_shade_pct: 8,
    heat_burden_rank: 4,
  },
  {
    id: 'SITE-09',
    name: 'Pune Railway Station Pedestrian Spine',
    kind: 'corridor',
    ward: 'Kasba Peth',
    lat: 18.5289,
    lng: 73.8744,
    area_ha: 10.8,
    lst_mean: 45.1,
    population: 23100,
    notes: 'Over 120,000 daily commuters navigate unshaded platform approaches and auto-rickshaw bays.',
    current_shade_pct: 12,
    heat_burden_rank: 5,
  },
];

export function getMockInterventionsForSite(siteId: string): InterventionOption[] {
  return [
    {
      id: `${siteId}-INT-1`,
      name: 'Miyawaki Native Canopy Greening',
      type: 'greening',
      cost_inr_lakh: 34.5,
      cost_status: 'Assumed',
      cooling_mean: 2.4,
      cooling_p10: 1.6,
      cooling_p90: 3.1,
      feasibility_note: 'Requires 450 m² unpaved or de-paved ground with drip irrigation link. High evapotranspiration rate in summer.',
      is_recommended: true,
      recommendation_reason: 'Maximum permanent surface temperature reduction and stormwater absorption for this site profile.',
    },
    {
      id: `${siteId}-INT-2`,
      name: 'High-Albedo Solar-Reflective Cool Roof Coating',
      type: 'cool_roof',
      cost_inr_lakh: 12.8,
      cost_status: 'Assumed',
      cooling_mean: 1.7,
      cooling_p10: 1.1,
      cooling_p90: 2.2,
      feasibility_note: 'Fast 10-day application on existing concrete roofs with Solar Reflectance Index (SRI) >= 104.',
      is_recommended: false,
      recommendation_reason: 'Lowest cost per m²; ideal companion intervention for interior ward comfort but does not provide ground shade.',
    },
    {
      id: `${siteId}-INT-3`,
      name: 'Solar-PV Integrated Shading Canopy',
      type: 'shade',
      cost_inr_lakh: 52.0,
      cost_status: 'Assumed',
      cooling_mean: 1.9,
      cooling_p10: 1.3,
      cooling_p90: 2.5,
      feasibility_note: 'Dual-benefit structural framework over parking/walkways generating clean power while dropping ground insolation by 82%.',
      is_recommended: false,
      recommendation_reason: 'Higher upfront capital expense, but generates payback over 4.8 years via renewable electricity generation.',
    },
  ];
}

/**
 * Greedily optimizes interventions under a given budget in hectares,
 * computing a 30-seed ensemble to determine selection frequency and robustness.
 */
export function runMockOptimizer(req: OptimizeRequest): OptimizeResult {
  const { budget_ha, ward, target_ndvi } = req;
  const filteredCells = ward
    ? MOCK_CELLS.filter((c) => c.ward === ward)
    : [...MOCK_CELLS];

  // 30 ensemble seeds to simulate bootstrap model uncertainty
  const ensembleRuns: string[][] = [];
  const runCount = 30;

  for (let run = 0; run < runCount; run++) {
    const rng = createSeededRandom(run * 1337 + Math.floor(budget_ha * 10));
    // Sort with slight noise on benefit per hectare to simulate model variance
    const candidates = [...filteredCells].sort((a, b) => {
      const noiseA = 0.9 + rng() * 0.2;
      const noiseB = 0.9 + rng() * 0.2;
      const benefitRateA = ((a.cooling_mean || 1.2) * a.population * noiseA) / Math.max(0.2, a.greenable_ha);
      const benefitRateB = ((b.cooling_mean || 1.2) * b.population * noiseB) / Math.max(0.2, b.greenable_ha);
      return benefitRateB - benefitRateA;
    });

    let currentAllocatedHa = 0;
    const selectedIds: string[] = [];

    for (const cell of candidates) {
      if (currentAllocatedHa + cell.greenable_ha <= budget_ha * 1.05) {
        selectedIds.push(cell.id);
        currentAllocatedHa += cell.greenable_ha;
      }
      if (currentAllocatedHa >= budget_ha) break;
    }
    ensembleRuns.push(selectedIds);
  }

  // Count selection frequency across the 30 runs
  const frequencyMap = new Map<string, number>();
  for (const run of ensembleRuns) {
    for (const id of run) {
      frequencyMap.set(id, (frequencyMap.get(id) || 0) + 1);
    }
  }

  // Baseline deterministic sort based on true mean benefit per hectare
  const sortedCells = [...filteredCells].sort((a, b) => {
    const benefitRateA = ((a.cooling_mean || 1.2) * a.population) / Math.max(0.2, a.greenable_ha);
    const benefitRateB = ((b.cooling_mean || 1.2) * b.population) / Math.max(0.2, b.greenable_ha);
    return benefitRateB - benefitRateA;
  });

  const selectedZones: OptimizeResult['selected'] = [];
  let allocatedHa = 0;
  let totalPeople = 0;
  let weightedCoolingSum = 0;
  let weightedLowSum = 0;
  let weightedHighSum = 0;

  let rank = 1;
  for (const cell of sortedCells) {
    if (allocatedHa + cell.greenable_ha <= budget_ha * 1.05 || selectedZones.length === 0) {
      const freq = (frequencyMap.get(cell.id) || 0) / runCount;
      const benefitMean = cell.cooling_mean || 1.2;

      selectedZones.push({
        id: cell.id,
        rank: rank++,
        area_ha: cell.greenable_ha,
        benefit_mean: benefitMean,
        selection_frequency: Math.round(freq * 100) / 100,
      });

      allocatedHa += cell.greenable_ha;
      totalPeople += cell.population;
      weightedCoolingSum += benefitMean * cell.population;
      weightedLowSum += (cell.cooling_p10 || benefitMean * 0.7) * cell.population;
      weightedHighSum += (cell.cooling_p90 || benefitMean * 1.3) * cell.population;
    }
    if (allocatedHa >= budget_ha) break;
  }

  const peopleWeight = Math.max(1, totalPeople);
  const coolingMid = Math.round((weightedCoolingSum / peopleWeight) * 10) / 10;
  const coolingLow = Math.round((weightedLowSum / peopleWeight) * 10) / 10;
  const coolingHigh = Math.round((weightedHighSum / peopleWeight) * 10) / 10;

  // Robustness = percentage of chosen zones that appeared in >= 70% of ensemble runs
  const robustCount = selectedZones.filter((z) => z.selection_frequency >= 0.7).length;
  const robustness = selectedZones.length > 0
    ? Math.round((robustCount / selectedZones.length) * 100)
    : 100;

  return {
    selected: selectedZones,
    totals: {
      zones: selectedZones.length,
      area_ha: Math.round(allocatedHa * 10) / 10,
      people_covered: totalPeople,
      cooling_low: coolingLow,
      cooling_mid: coolingMid,
      cooling_high: coolingHigh,
      robustness,
    },
  };
}
