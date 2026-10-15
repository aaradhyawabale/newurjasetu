import { SolarResult } from "../providers/types";
import {
  SolarRealityInput,
  SolarRealityResult,
  SolarSystemType,
  MonthlyProductionBreakdown,
  LossWaterfallItem,
  EconomicFeasibilityResult,
  EconomicSensitivityItem,
  InputAuditItem,
  SeasonalWeatherSummary,
  ObservedMonthlyGeneration,
  CalibrationComparisonResult,
  GenerationUncertaintyBounds,
  ShadingIntegrationMeta,
} from "./types";

const DEG2RAD = Math.PI / 180.0;

// Mid-month day of year (n) for non-leap year (Jan 17, Feb 16, Mar 16, ...)
const MONTH_MID_DAYS = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

/**
 * Calculates monthly solar declination (degrees) via Cooper's equation.
 */
function getMonthlyDeclinationDeg(dayOfYear: number): number {
  return 23.45 * Math.sin(((360.0 / 365.0) * (284 + dayOfYear)) * DEG2RAD);
}

/**
 * Calculates Liu-Jordan isotropic tilt transposition factor R = POA / GHI.
 * Transposes horizontal irradiance onto a fixed tilt surface oriented toward the equator.
 */
export function calculateTiltTranspositionFactor(
  latDeg: number,
  tiltDeg: number,
  monthIndex: number
): number {
  if (tiltDeg <= 0.5) {
    return 1.0; // Flat horizontal plane
  }

  const phi = latDeg * DEG2RAD;
  const beta = tiltDeg * DEG2RAD;
  const n = MONTH_MID_DAYS[monthIndex];
  const delta = getMonthlyDeclinationDeg(n) * DEG2RAD;

  // Sunset hour angle on horizontal surface (radians)
  const cosWs = -Math.tan(phi) * Math.tan(delta);
  const ws = Math.acos(Math.max(-1.0, Math.min(1.0, cosWs)));

  // Orientation: In Northern Hemisphere, panels face South (phi - beta); in Southern, North (phi + beta)
  const effectivePhiMinusBeta = latDeg >= 0 ? phi - beta : phi + beta;
  const cosWsp = -Math.tan(effectivePhiMinusBeta) * Math.tan(delta);
  const wsp = Math.min(ws, Math.acos(Math.max(-1.0, Math.min(1.0, cosWsp))));

  // Beam transposition factor Rb
  const numerator =
    Math.cos(effectivePhiMinusBeta) * Math.cos(delta) * Math.sin(wsp) +
    wsp * Math.sin(effectivePhiMinusBeta) * Math.sin(delta);
  const denominator =
    Math.cos(phi) * Math.cos(delta) * Math.sin(ws) +
    ws * Math.sin(phi) * Math.sin(delta);

  const rb = Math.abs(denominator) > 1e-4 ? Math.max(0.0, numerator / denominator) : 1.0;

  // Typical diffuse fraction Kd = DHI / GHI (approx 0.35 for all-sky conditions)
  const kd = 0.35;
  const albedo = 0.20; // Standard ground reflectance

  const factor =
    (1.0 - kd) * rb +
    kd * ((1.0 + Math.cos(beta)) / 2.0) +
    albedo * ((1.0 - Math.cos(beta)) / 2.0);

  // Return physical bound [0.65, 1.45]
  return Math.max(0.65, Math.min(1.45, Math.round(factor * 1000) / 1000));
}

/**
 * Calculates operating cell temperature and temperature derate factor.
 * Based on IEC 61215 standard: NOCT = 45°C, gamma = -0.38%/°C for crystalline silicon.
 */
export function calculateTemperatureDerate(ambientTempC: number): {
  cellTempC: number;
  tempDerateFactor: number;
  lossPct: number;
} {
  // Effective average daytime operating irradiance: 750 W/m2
  const effectiveIrradiance = 750.0;
  const noct = 45.0; // Nominal Operating Cell Temperature
  const cellTempC = Math.round((ambientTempC + ((noct - 20.0) / 800.0) * effectiveIrradiance) * 10) / 10;

  // Standard crystalline silicon temperature power coefficient: -0.38% per °C above 25°C
  const gamma = -0.0038;
  const rawFactor = 1.0 + gamma * (cellTempC - 25.0);
  const tempDerateFactor = Math.max(0.75, Math.min(1.05, Math.round(rawFactor * 1000) / 1000));
  const lossPct = Math.round((1.0 - tempDerateFactor) * 1000) / 10;

  return { cellTempC, tempDerateFactor, lossPct };
}

/**
 * Calculates 25-year Levelized Cost of Electricity (LCOE in INR/kWh).
 * Accounts for 7.5% discount rate and 0.6%/year module degradation.
 */
function calculateLcoeInrPerKwh(
  totalCapexInr: number,
  annualOpexInr: number,
  firstYearGenerationKwh: number
): number {
  const discountRate = 0.075;
  const degradationRate = 0.006;
  const projectYears = 25;

  let npvCosts = totalCapexInr;
  let npvEnergy = 0;

  for (let year = 1; year <= projectYears; year++) {
    const discountFactor = Math.pow(1.0 + discountRate, year);
    npvCosts += annualOpexInr / discountFactor;

    const yearlyGeneration = firstYearGenerationKwh * Math.pow(1.0 - degradationRate, year - 1);
    npvEnergy += yearlyGeneration / discountFactor;
  }

  if (npvEnergy <= 0) return 0;
  return Math.round((npvCosts / npvEnergy) * 100) / 100;
}

/**
 * Audits input parameters and classifies their epistemic state.
 * Never silently assigns or hides missing data.
 */
export function auditInputs(input: SolarRealityInput): InputAuditItem[] {
  const items: InputAuditItem[] = [];

  // Geographic coordinates
  items.push({
    key: "coordinates",
    label: "Geographic Coordinates",
    value: `${input.lat.toFixed(4)}°N, ${input.lng.toFixed(4)}°E`,
    state: "required_provided",
    provenance: "User placement anchor",
  });

  // Capacity
  items.push({
    key: "capacityKwp",
    label: "Installed DC Capacity",
    value: input.capacityKwp,
    unit: "kWp",
    state: "required_provided",
    provenance: "System design input",
  });

  // System type
  items.push({
    key: "systemType",
    label: "Installation Archetype",
    value: input.systemType ?? "ground_mount_utility",
    state: input.systemType ? "optional_provided" : "estimated_proxy",
    provenance: input.systemType ? "User specified archetype" : "Defaulted to utility-scale ground mount",
  });

  // Tilt angle
  const defaultTilt = Math.min(45, Math.max(5, Math.round(Math.abs(input.lat))));
  items.push({
    key: "panelTiltDeg",
    label: "Fixed Tilt Angle",
    value: input.panelTiltDeg ?? defaultTilt,
    unit: "°",
    state: typeof input.panelTiltDeg === "number" ? "optional_provided" : "estimated_proxy",
    provenance: typeof input.panelTiltDeg === "number"
      ? "User specified tilt angle"
      : `Estimated latitude-matched proxy (~${defaultTilt}°)`,
  });

  // Orientation / Azimuth
  items.push({
    key: "panelAzimuthDeg",
    label: "True Azimuth Orientation",
    value: input.panelAzimuthDeg ?? (input.lat >= 0 ? 180 : 0),
    unit: "°",
    state: typeof input.panelAzimuthDeg === "number" ? "optional_provided" : "estimated_proxy",
    provenance: typeof input.panelAzimuthDeg === "number"
      ? "User specified azimuth"
      : (input.lat >= 0 ? "True South (180°) default" : "True North (0°) default"),
  });

  // Shading source & loss
  items.push({
    key: "shadingLossPct",
    label: "External Shading Allowance",
    value: input.shadingLossPct ?? 2.0,
    unit: "%",
    state: input.shadingSource === "shadow_of_the_future_simulation" ? "optional_provided" : "estimated_proxy",
    provenance: input.shadingSource === "shadow_of_the_future_simulation"
      ? `Shadow-of-the-Future 3D ray-tracing simulation (${input.shadingScenarioName || "Simulated Scenario"})`
      : "Standard pre-feasibility 2.0% horizon allowance",
  });

  // Soiling loss
  items.push({
    key: "soilingLossPct",
    label: "Soiling & Particulate Derate",
    value: input.soilingLossPct ?? 2.5,
    unit: "%",
    state: typeof input.soilingLossPct === "number" ? "optional_provided" : "estimated_proxy",
    provenance: typeof input.soilingLossPct === "number" ? "User specified soiling rate" : "Typical dry-climate benchmark (2.5%)",
  });

  // Inverter efficiency
  items.push({
    key: "inverterEfficiencyPct",
    label: "Inverter Weighted Efficiency",
    value: input.inverterEfficiencyPct ?? 97.5,
    unit: "%",
    state: typeof input.inverterEfficiencyPct === "number" ? "optional_provided" : "estimated_proxy",
    provenance: typeof input.inverterEfficiencyPct === "number" ? "User specified inverter rating" : "CEC 97.5% Tier-1 string/central inverter benchmark",
  });

  // Observed meter calibration data
  const hasObserved = Array.isArray(input.observedGeneration) && input.observedGeneration.length > 0;
  items.push({
    key: "observedGeneration",
    label: "Actual Meter / Inverter Records",
    value: hasObserved ? `${input.observedGeneration!.length} months logged` : null,
    state: hasObserved ? "optional_provided" : "missing_unprovided",
    provenance: hasObserved ? "Uploaded utility / meter observation records" : "No meter records supplied (Operates in uncalibrated estimate mode)",
  });

  return items;
}

/**
 * Evaluates seasonal weather, monsoon dynamics, and thermal patterns.
 */
export function analyzeSeasonalWeather(monthly: MonthlyProductionBreakdown[]): SeasonalWeatherSummary {
  // Monsoon months in South Asia: June, July, August, September
  const monsoonMonths = [5, 6, 7, 8];
  const monsoonData = monthly.filter((m) => monsoonMonths.includes(m.monthIndex));
  const preMonsoonData = monthly.filter((m) => [2, 3, 4].includes(m.monthIndex)); // March, April, May
  const winterData = monthly.filter((m) => [9, 10, 11, 0, 1].includes(m.monthIndex)); // Oct to Feb

  const monsoonGhiAvg = monsoonData.reduce((acc, m) => acc + m.ghiKwhM2Day, 0) / Math.max(1, monsoonData.length);
  const monsoonGenMwh = monsoonData.reduce((acc, m) => acc + m.productionMwh, 0);
  const monsoonCufAvg = monsoonData.reduce((acc, m) => acc + m.capacityUtilizationFactorPct, 0) / Math.max(1, monsoonData.length);

  const preMonsoonPeakGhi = Math.max(...preMonsoonData.map((m) => m.ghiKwhM2Day), 5.5);
  const monsoonDropPct = Math.max(0, Math.round(((preMonsoonPeakGhi - monsoonGhiAvg) / preMonsoonPeakGhi) * 1000) / 10);

  const peakAmbientTempC = Math.max(...preMonsoonData.map((m) => m.ambientTempC), 38.0);
  const maxThermalLossPct = Math.max(...preMonsoonData.map((m) => Math.round((1.0 - m.tempDerateFactor) * 1000) / 10), 10.0);

  const winterGhiAvg = winterData.reduce((acc, m) => acc + m.ghiKwhM2Day, 0) / Math.max(1, winterData.length);
  const winterGenMwh = winterData.reduce((acc, m) => acc + m.productionMwh, 0);

  return {
    monsoonPeriod: {
      months: ["Jun", "Jul", "Aug", "Sep"],
      monsoonGhiAverage: Math.round(monsoonGhiAvg * 100) / 100,
      monsoonGenerationMwh: Math.round(monsoonGenMwh * 10) / 10,
      monsoonCufPct: Math.round(monsoonCufAvg * 10) / 10,
      monsoonDropPercentage: monsoonDropPct,
      weatherDynamicsNote:
        "Monsoon cloud attenuation causes significant seasonal generation decline (July–August trough). Module temperatures stay lower due to rain and cloud cover, partially offsetting optical losses.",
    },
    dryDustSeason: {
      months: ["Mar", "Apr", "May"],
      peakAmbientTempC,
      estimatedThermalDeratePct: maxThermalLossPct,
      elevatedSoilingRisk: true,
      weatherDynamicsNote:
        "High solar irradiation accompanied by severe ambient heat (>38°C) causing peak thermal derate losses (-10% to -14%). Dry dusty conditions elevate soiling risks prior to monsoon rains.",
    },
    winterClearSeason: {
      months: ["Oct", "Nov", "Dec", "Jan", "Feb"],
      winterGhiAverage: Math.round(winterGhiAvg * 100) / 100,
      winterGenerationMwh: Math.round(winterGenMwh * 10) / 10,
      weatherDynamicsNote:
        "Clear skies with lower solar elevation angles. Cooler ambient temperatures deliver superior cell operating efficiencies (thermal derate < 5%), partially counterbalancing shorter daylight hours.",
    },
  };
}

/**
 * Compares modelled output against actual observed meter data (Phase D Calibration).
 * Never fabricates fake meter readings.
 */
export function calculateCalibration(
  monthlyBreakdown: MonthlyProductionBreakdown[],
  observed?: ObservedMonthlyGeneration[],
  capacityKwp = 5000
): CalibrationComparisonResult {
  if (!Array.isArray(observed) || observed.length === 0) {
    return {
      isCalibrated: false,
      totalObservedKwh: 0,
      totalModelledKwh: monthlyBreakdown.reduce((acc, m) => acc + m.productionKwh, 0),
      energyDeltaKwh: 0,
      energyDeltaPct: 0,
      meanBiasErrorKwh: 0,
      meanAbsolutePercentageErrorPct: 0,
      rootMeanSquareErrorKwh: 0,
      observedSpecificYieldKwhPerKwp: 0,
      observedCapacityUtilizationFactorPct: 0,
      monthlyComparisons: [],
      calibrationInsight:
        "Operates in uncalibrated climatological estimate mode. No observed generation records were provided. UrjaSetu does not synthesize fake meter readings.",
    };
  }

  let totalObsKwh = 0;
  let totalModKwh = 0;
  let sumBias = 0;
  let sumAbsPctErr = 0;
  let sumSqErr = 0;
  let validMonths = 0;

  const monthlyComparisons = observed.map((obs) => {
    const monthKey = obs.month.substring(0, 3).toLowerCase();
    const modelMatch = monthlyBreakdown.find(
      (m) => m.month.toLowerCase().startsWith(monthKey)
    );

    const modelledKwh = modelMatch?.productionKwh ?? 0;
    const observedKwh = obs.observedKwh;
    const deltaKwh = observedKwh - modelledKwh;
    const deltaPct = modelledKwh > 0 ? Math.round((deltaKwh / modelledKwh) * 1000) / 10 : 0;

    totalObsKwh += observedKwh;
    totalModKwh += modelledKwh;

    if (modelledKwh > 0 && observedKwh > 0) {
      sumBias += (modelledKwh - observedKwh);
      sumAbsPctErr += Math.abs((observedKwh - modelledKwh) / observedKwh);
      sumSqErr += Math.pow(modelledKwh - observedKwh, 2);
      validMonths++;
    }

    // Normalized performance ratio estimate
    const daysInMonth = modelMatch?.days ?? 30;
    const cuf = capacityKwp > 0 ? Math.round((observedKwh / (capacityKwp * daysInMonth * 24.0)) * 1000) / 10 : 0;

    return {
      month: obs.month,
      modelledKwh,
      observedKwh,
      deltaKwh,
      deltaPct,
      performanceRatioPct: cuf,
      downtimeNormalizedKwh: obs.reportedDowntimeHours && obs.reportedDowntimeHours > 0
        ? Math.round(observedKwh * (1 + obs.reportedDowntimeHours / (daysInMonth * 24)))
        : observedKwh,
    };
  });

  const mbe = validMonths > 0 ? Math.round(sumBias / validMonths) : 0;
  const mape = validMonths > 0 ? Math.round((sumAbsPctErr / validMonths) * 1000) / 10 : 0;
  const rmse = validMonths > 0 ? Math.round(Math.sqrt(sumSqErr / validMonths)) : 0;
  const overallDeltaPct = totalModKwh > 0 ? Math.round(((totalObsKwh - totalModKwh) / totalModKwh) * 1000) / 10 : 0;

  const observedSpecificYield = capacityKwp > 0 ? Math.round(totalObsKwh / capacityKwp) : 0;
  const observedCuf = capacityKwp > 0 ? Math.round((totalObsKwh / (capacityKwp * 8760)) * 1000) / 10 : 0;

  let calibrationInsight = "";
  let recommendedAdjustmentPct: number | undefined = undefined;

  if (Math.abs(overallDeltaPct) <= 3.5) {
    calibrationInsight = `High calibration alignment: Modelled output matches observed meter readings within ±${Math.abs(overallDeltaPct)}% (MBE: ${mbe > 0 ? `+${mbe}` : mbe} kWh, RMSE: ${rmse} kWh). Baseline assumptions are highly representative.`;
  } else if (overallDeltaPct < -3.5) {
    const underPerformance = Math.abs(overallDeltaPct);
    recommendedAdjustmentPct = underPerformance;
    calibrationInsight = `Model overpredicts actual production by +${underPerformance}% (MBE: +${mbe} kWh, RMSE: ${rmse} kWh). Investigate local soiling deposition, grid curtailment, or higher than assumed transformer losses. Suggested soiling derate increase: +${Math.min(5, Math.round(underPerformance * 0.5 * 10) / 10)}%.`;
  } else {
    calibrationInsight = `Observed generation exceeds model by +${overallDeltaPct}% (MBE: ${mbe} kWh, RMSE: ${rmse} kWh). Installation benefits from superior solar irradiance, lower module temperature coefficient, or higher bifacial/inverter efficiency than conservative defaults.`;
  }

  return {
    isCalibrated: true,
    totalObservedKwh: totalObsKwh,
    totalModelledKwh: totalModKwh,
    energyDeltaKwh: totalObsKwh - totalModKwh,
    energyDeltaPct: overallDeltaPct,
    meanBiasErrorKwh: mbe,
    meanAbsolutePercentageErrorPct: mape,
    rootMeanSquareErrorKwh: rmse,
    observedSpecificYieldKwhPerKwp: observedSpecificYield,
    observedCapacityUtilizationFactorPct: observedCuf,
    monthlyComparisons,
    calibrationInsight,
    recommendedAdjustmentPct,
  };
}

/**
 * Calculates statistical P50, P90, and P10 uncertainty bounds.
 */
export function calculateUncertaintyBounds(annualGenerationMwh: number): GenerationUncertaintyBounds {
  // Typical South Asia solar agroclimatology uncertainty parameters:
  // Interannual variability: ~5.5% (MERRA-2 22-year satellite baseline standard deviation)
  // Model/transposition uncertainty: ~4.0%
  const interannualVariabilityPct = 5.5;
  const modelUncertaintyPct = 4.0;

  const sigmaCombined = Math.sqrt(
    Math.pow(interannualVariabilityPct / 100.0, 2) +
    Math.pow(modelUncertaintyPct / 100.0, 2)
  ); // ~0.068 (6.8%)

  // P90 = P50 * (1 - 1.282 * sigma) for normal distribution
  // P10 = P50 * (1 + 1.282 * sigma)
  const zScore = 1.282; // 90% single-tailed probability
  const p90Factor = 1.0 - zScore * sigmaCombined;
  const p10Factor = 1.0 + zScore * sigmaCombined;

  return {
    p50AnnualGenerationMwh: annualGenerationMwh,
    p90AnnualGenerationMwh: Math.round(annualGenerationMwh * p90Factor * 10) / 10,
    p10AnnualGenerationMwh: Math.round(annualGenerationMwh * p10Factor * 10) / 10,
    interannualVariabilityPct,
    modelUncertaintyPct,
  };
}

/**
 * Runs the complete "Solar Reality" generation and economic feasibility estimation.
 */
export function estimateSolarGeneration(
  input: SolarRealityInput,
  solarResource: SolarResult
): SolarRealityResult {
  if (input.capacityKwp <= 0 || !Number.isFinite(input.capacityKwp)) {
    throw new Error(`Invalid installed capacity: ${input.capacityKwp} kWp. Must be greater than 0.`);
  }

  const capacityKwp = Math.round(input.capacityKwp * 100) / 100;
  const capacityMwp = Math.round((capacityKwp / 1000.0) * 1000) / 1000;
  const systemType: SolarSystemType = input.systemType ?? (capacityKwp <= 20 ? "rooftop_residential" : capacityKwp <= 1000 ? "rooftop_commercial" : "ground_mount_utility");

  // Optimal tilt default: close to latitude, clamped between 5° and 45°
  const defaultTilt = Math.min(45, Math.max(5, Math.round(Math.abs(input.lat))));
  const panelTiltDeg = input.panelTiltDeg ?? defaultTilt;

  // 1. Shading Integration & Guard Against Double-Counting
  const isSimulatedShading = input.shadingSource === "shadow_of_the_future_simulation";
  const shadingLossPct = typeof input.shadingLossPct === "number" ? input.shadingLossPct : 2.0;

  const shadingIntegration: ShadingIntegrationMeta = {
    source: isSimulatedShading ? "shadow_of_the_future_simulation" : "default_benchmark",
    shadingLossPct,
    simulatedScenarioName: input.shadingScenarioName,
    doubleCountingGuarded: true,
    notes: isSimulatedShading
      ? `Geometric beam shading loss of ${shadingLossPct}% sourced directly from Shadow-of-the-Future 3D simulation (${input.shadingScenarioName || "Simulated Scenario"}). Generic benchmark shading has been superseded to eliminate double-counting.`
      : "Standard 2.0% diffuse and horizon pre-feasibility benchmark assumption applied.",
  };

  // 2. Loss Waterfall Setup (Decomposed & Non-overlapping)
  const inverterLossPct = 100.0 - (input.inverterEfficiencyPct ?? 97.5); // Default 2.5%
  const dcWiringLossPct = systemType === "rooftop_residential" ? 1.5 : 2.0; // Ohmic DC/AC cable resistance
  const mismatchLossPct = 1.5; // Module manufacturing tolerance
  const soilingLossPct = input.soilingLossPct ?? 2.5; // Dust / soiling deposition
  const lidLossPct = 1.0; // Light-Induced Degradation & initial stabilization
  const availabilityLossPct = 0.5; // Grid curtailment / maintenance downtime

  // Multiplicative BOS derate factor (excluding temperature which varies monthly)
  const fInverter = (100.0 - inverterLossPct) / 100.0;
  const fWiring = (100.0 - dcWiringLossPct) / 100.0;
  const fMismatch = (100.0 - mismatchLossPct) / 100.0;
  const fSoiling = (100.0 - soilingLossPct) / 100.0;
  const fLid = (100.0 - lidLossPct) / 100.0;
  const fAvailability = (100.0 - availabilityLossPct) / 100.0;
  const fShading = (100.0 - shadingLossPct) / 100.0;

  const bosDerateFactor =
    fInverter * fWiring * fMismatch * fSoiling * fLid * fAvailability * fShading;

  // 3. Monthly Irradiance & Generation Loop
  const monthlyBreakdown: MonthlyProductionBreakdown[] = [];
  let totalAnnualKwh = 0;
  let totalAnnualGhiKwhM2 = 0;
  let totalAnnualPoaKwhM2 = 0;
  let weightedTempDerateSum = 0;

  // Baseline GHI fallback if monthly NASA array missing
  const fallbackAnnualGhi = solarResource.annualAverageGhiKwhM2Day ?? 5.0;
  const fallbackAnnualTemp = solarResource.annualMeanTempC ?? 24.0;

  for (let m = 0; m < 12; m++) {
    const monthKey = MONTH_KEYS[m];
    const daysInMonth = MONTH_DAYS[m];

    // Monthly GHI from NASA POWER or physical seasonal approximation
    let monthlyGhiKwhM2Day = solarResource.monthlyGhiKwhM2Day?.[monthKey];
    if (typeof monthlyGhiKwhM2Day !== "number" || monthlyGhiKwhM2Day <= 0) {
      const decl = getMonthlyDeclinationDeg(MONTH_MID_DAYS[m]);
      const seasonalModifier = 1.0 + 0.15 * Math.sin((decl * Math.PI) / 180.0) * (input.lat >= 0 ? 1 : -1);
      monthlyGhiKwhM2Day = Math.round(fallbackAnnualGhi * seasonalModifier * 100) / 100;
    }

    // Monthly Ambient Temperature
    let ambientTempC = solarResource.monthlyMeanTempC?.[monthKey];
    if (typeof ambientTempC !== "number") {
      const decl = getMonthlyDeclinationDeg(MONTH_MID_DAYS[m]);
      const tempMod = 6.0 * Math.sin((decl * Math.PI) / 180.0) * (input.lat >= 0 ? 1 : -1);
      ambientTempC = Math.round((fallbackAnnualTemp + tempMod) * 10) / 10;
    }

    // Plane-of-Array Irradiance via Liu-Jordan transposition
    const tiltTranspositionFactor = calculateTiltTranspositionFactor(input.lat, panelTiltDeg, m);
    const poaKwhM2Day = Math.round(monthlyGhiKwhM2Day * tiltTranspositionFactor * 100) / 100;

    // Temperature Derate via IEC 61215 NOCT model
    const tempDerate = calculateTemperatureDerate(ambientTempC);

    // Net monthly performance ratio
    const monthlyPr = Math.round(bosDerateFactor * tempDerate.tempDerateFactor * 1000) / 1000;

    // Monthly Generation = Capacity (kWp) * POA (kWh/m2/day) * Days * PR
    const monthKwh = Math.round(capacityKwp * poaKwhM2Day * daysInMonth * monthlyPr);
    const monthMwh = Math.round((monthKwh / 1000.0) * 100) / 100;

    // Capacity Utilization Factor for the month
    const monthCuf = Math.round((monthKwh / (capacityKwp * daysInMonth * 24.0)) * 1000) / 10;

    monthlyBreakdown.push({
      month: MONTH_NAMES[m],
      monthIndex: m,
      days: daysInMonth,
      ghiKwhM2Day: monthlyGhiKwhM2Day,
      poaKwhM2Day,
      tiltTranspositionFactor,
      ambientTempC,
      cellTempC: tempDerate.cellTempC,
      tempDerateFactor: tempDerate.tempDerateFactor,
      performanceRatioPct: Math.round(monthlyPr * 1000) / 10,
      productionKwh: monthKwh,
      productionMwh: monthMwh,
      capacityUtilizationFactorPct: monthCuf,
    });

    totalAnnualKwh += monthKwh;
    totalAnnualGhiKwhM2 += monthlyGhiKwhM2Day * daysInMonth;
    totalAnnualPoaKwhM2 += poaKwhM2Day * daysInMonth;
    weightedTempDerateSum += tempDerate.tempDerateFactor * monthKwh;
  }

  const annualGenerationMwh = Math.round((totalAnnualKwh / 1000.0) * 10) / 10;
  const dailyAverageKwh = Math.round(totalAnnualKwh / 365.0);
  const specificYieldKwhPerKwp = Math.round(totalAnnualKwh / capacityKwp);
  const capacityUtilizationFactorPct =
    Math.round((totalAnnualKwh / (capacityKwp * 8760.0)) * 1000) / 10;

  const annualGhiAverageKwhM2Day = Math.round((totalAnnualGhiKwhM2 / 365.0) * 100) / 100;
  const annualPoaAverageKwhM2Day = Math.round((totalAnnualPoaKwhM2 / 365.0) * 100) / 100;

  // Overall system PR
  const averageTempDerate = totalAnnualKwh > 0 ? weightedTempDerateSum / totalAnnualKwh : 0.90;
  const systemPerformanceRatio = Math.round(bosDerateFactor * averageTempDerate * 1000) / 1000;

  // 4. Input Audit
  const inputAudit = auditInputs(input);

  // 5. Seasonal Weather Analysis
  const seasonalWeather = analyzeSeasonalWeather(monthlyBreakdown);

  // 6. Model vs Observed Calibration Workflow
  const calibration = calculateCalibration(monthlyBreakdown, input.observedGeneration, capacityKwp);

  // 7. Uncertainty Bounds (P50, P90, P10)
  const uncertaintyBounds = calculateUncertaintyBounds(annualGenerationMwh);

  // 8. Loss Waterfall Documentation
  const lossWaterfall: LossWaterfallItem[] = [
    {
      id: "temperature_loss",
      name: "PV Cell Operating Temperature Derate",
      lossPct: Math.round((1.0 - averageTempDerate) * 1000) / 10,
      derateFactor: Math.round(averageTempDerate * 1000) / 1000,
      explanation: "Efficiency drop when operating cell temperature exceeds standard test conditions (25°C) based on -0.38%/°C silicon temperature coefficient.",
    },
    {
      id: "inverter_loss",
      name: "Inverter DC-to-AC Conversion Efficiency",
      lossPct: inverterLossPct,
      derateFactor: fInverter,
      explanation: "Thermal, switching, and magnetic losses in the solar central/string inverters (rated 97.5% CEC efficiency).",
    },
    {
      id: "dc_ac_wiring_loss",
      name: "DC String & AC Feeder Ohmic Losses",
      lossPct: dcWiringLossPct,
      derateFactor: fWiring,
      explanation: "I²R resistive voltage drop across solar array string cables and transformer connection feeders.",
    },
    {
      id: "soiling_dust_loss",
      name: "Module Surface Soiling & Particulate Deposition",
      lossPct: soilingLossPct,
      derateFactor: fSoiling,
      explanation: "Reduction in optical transmittance caused by dust accumulation, particulate smog, and dry-season intervals between array cleanings.",
    },
    {
      id: "mismatch_tolerance_loss",
      name: "Module Manufacturing Tolerance & Mismatch",
      lossPct: mismatchLossPct,
      derateFactor: fMismatch,
      explanation: "Slight electrical parameter differences (Vmp, Imp) among interconnected modules in strings.",
    },
    {
      id: "shading_obstruction_loss",
      name: isSimulatedShading ? "Simulated 3D Shading (Shadow-of-the-Future)" : "Surrounding Horizon & Shading Allowance",
      lossPct: shadingLossPct,
      derateFactor: fShading,
      explanation: isSimulatedShading
        ? `Direct beam obstruction simulated by 3D ray-tracing engine (${input.shadingScenarioName || "Simulated Scenario"}).`
        : "Standard pre-feasibility benchmark assumption for horizon and terrain obstacles.",
    },
    {
      id: "lid_aging_loss",
      name: "Light-Induced Degradation (LID) & Stabilization",
      lossPct: lidLossPct,
      derateFactor: fLid,
      explanation: "Initial boron-oxygen defect formation and stabilization during first months of solar exposure.",
    },
    {
      id: "grid_availability_loss",
      name: "Substation Availability & Planned Maintenance",
      lossPct: availabilityLossPct,
      derateFactor: fAvailability,
      explanation: "Occasional grid outages, transformer maintenance, and utility dispatch curtailment.",
    },
  ];

  // 9. Financial & Feasibility Model
  const capexPerKwpInr = input.capexPerKwpInr ?? (systemType === "rooftop_residential" ? 52000.0 : 42000.0);
  const capexTotalInr = Math.round(capacityKwp * capexPerKwpInr);
  const opexAnnualPct = input.opexAnnualPct ?? 1.2;
  const opexAnnualInr = Math.round((capexTotalInr * opexAnnualPct) / 100.0);
  const tariffInrPerKwh = input.tariffPerKwhInr ?? 6.50;

  const annualRevenueInr = Math.round(totalAnnualKwh * tariffInrPerKwh);
  const netAnnualCashFlowInr = Math.max(1, annualRevenueInr - opexAnnualInr);
  const simplePaybackYears = Math.round((capexTotalInr / netAnnualCashFlowInr) * 10) / 10;

  const lcoeInrPerKwh = calculateLcoeInrPerKwh(capexTotalInr, opexAnnualInr, totalAnnualKwh);
  const twentyFiveYearNetSavingsInr = Math.round(netAnnualCashFlowInr * 25 - capexTotalInr);

  const sensitivityMatrix: EconomicSensitivityItem[] = [
    {
      scenarioName: "Baseline Planning Model",
      capexTotalInr,
      tariffInrPerKwh,
      simplePaybackYears,
      lcoeInrPerKwh,
    },
    {
      scenarioName: "Capex Savings (-15% EPC / Bulk Procurement)",
      capexTotalInr: Math.round(capexTotalInr * 0.85),
      tariffInrPerKwh,
      simplePaybackYears: Math.round(((capexTotalInr * 0.85) / (annualRevenueInr - opexAnnualInr * 0.85)) * 10) / 10,
      lcoeInrPerKwh: calculateLcoeInrPerKwh(capexTotalInr * 0.85, opexAnnualInr * 0.85, totalAnnualKwh),
    },
    {
      scenarioName: "Capex Escalation (+15% Interconnection / Civil Grading)",
      capexTotalInr: Math.round(capexTotalInr * 1.15),
      tariffInrPerKwh,
      simplePaybackYears: Math.round(((capexTotalInr * 1.15) / (annualRevenueInr - opexAnnualInr * 1.15)) * 10) / 10,
      lcoeInrPerKwh: calculateLcoeInrPerKwh(capexTotalInr * 1.15, opexAnnualInr * 1.15, totalAnnualKwh),
    },
    {
      scenarioName: "Conservative Tariff (-20% / Utility PPA Rate ₹5.20)",
      capexTotalInr,
      tariffInrPerKwh: Math.round(tariffInrPerKwh * 0.8 * 100) / 100,
      simplePaybackYears: Math.round((capexTotalInr / Math.max(1, totalAnnualKwh * tariffInrPerKwh * 0.8 - opexAnnualInr)) * 10) / 10,
      lcoeInrPerKwh,
    },
    {
      scenarioName: "Peak Industrial Tariff (+20% / Commercial Grid ₹7.80)",
      capexTotalInr,
      tariffInrPerKwh: Math.round(tariffInrPerKwh * 1.2 * 100) / 100,
      simplePaybackYears: Math.round((capexTotalInr / (totalAnnualKwh * tariffInrPerKwh * 1.2 - opexAnnualInr)) * 10) / 10,
      lcoeInrPerKwh,
    },
  ];

  const economics: EconomicFeasibilityResult = {
    capexTotalInr,
    capexPerKwpInr,
    opexAnnualInr,
    tariffInrPerKwh,
    annualRevenueInr,
    simplePaybackYears,
    lcoeInrPerKwh,
    twentyFiveYearNetSavingsInr,
    sensitivityMatrix,
    economicDisclaimer:
      "Financial figures are pre-feasibility planning estimates based on benchmark capital costs and commercial utility tariffs. They do NOT constitute an underwriting financial guarantee.",
  };

  const dataProvenance = {
    dataset: solarResource.datasetTimestamp || "NASA POWER CERES / MERRA-2 Multi-Year Agroclimatology",
    source: solarResource.source || "NASA Langley Research Center POWER Project",
    temporalResolution: "Multi-year monthly climatology (22-year satellite baseline)",
    spatialResolution: "0.5° × 0.5° latitude/longitude global grid",
    isClimatological: true,
    retrievedAt: solarResource.retrievedAt || new Date().toISOString(),
    license: solarResource.license || "Public Domain — NASA POWER Project",
  };

  const modelLimitations = [
    "Climatological screening model: Uses 22-year multi-year satellite averages; actual annual weather patterns will vary around this baseline.",
    "Isotropic transposition: Uses the Liu-Jordan isotropic diffuse sky model for plane-of-array transposition rather than an anisotropic Perez model with on-site pyranometer feeds.",
    "Pre-feasibility status: Intended for capacity sizing, feasibility screening, and spatial comparison; not a substitute for revenue-grade bankable PVSyst engineering simulations.",
    "Tariff & escalation: Assumes constant grid electricity tariffs without modeling future utility tariff escalation or inflation.",
    "Degradation rate: Standard 0.6%/year linear degradation is assumed for the 25-year LCOE cash flow.",
  ];

  return {
    systemType,
    installedCapacityKwp: capacityKwp,
    installedCapacityMwp: capacityMwp,
    systemPerformanceRatio,
    annualGenerationKwh: totalAnnualKwh,
    annualGenerationMwh,
    dailyAverageKwh,
    specificYieldKwhPerKwp,
    capacityUtilizationFactorPct,
    annualGhiAverageKwhM2Day,
    annualPoaAverageKwhM2Day,
    monthlyBreakdown,
    lossWaterfall,
    seasonalWeather,
    calibration,
    uncertaintyBounds,
    shadingIntegration,
    inputAudit,
    economics,
    dataProvenance,
    modelLimitations,
  };
}
