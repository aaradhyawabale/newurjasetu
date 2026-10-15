import type { Feature, Polygon, MultiPolygon } from "geojson";
import { StandardizedGeoFeature } from "../providers/types";

export type HeightProvenance =
  | "measured" // Explicitly sourced from OSM tags.height (e.g. height=18.5)
  | "inferred_from_levels" // Inferred from tags["building:levels"] * floorHeight (e.g. 4 levels * 3.2m = 12.8m)
  | "hypothetical_user" // User-proposed in a what-if scenario (e.g. proposed 30m tower)
  | "default_assumption" // When neither height nor levels exists; evaluated using an explicitly recorded default assumption
  | "unavailable"; // No height data and excluded from 3D shadow projection

export interface SolarPosition {
  azimuthDeg: number; // Measured clockwise from True North (0° = N, 90° = E, 180° = S, 270° = W)
  elevationDeg: number; // Altitude above horizon (-90° to +90°)
  zenithDeg: number; // 90° - elevationDeg
  isDaylight: boolean; // elevationDeg > 0°
  declinationDeg: number; // Solar declination angle (-23.45° to +23.45°)
  equationOfTimeMinutes: number; // Difference between apparent solar time and mean time
  hourAngleDeg: number; // Solar hour angle
  apparentSolarTime: string; // HH:MM true solar time
}

export type DevelopmentStatus =
  | "existing_observed" // Verified observed building in OSM
  | "approved_development" // Documented approved planning permit
  | "proposed_development" // Publicly documented masterplan proposal
  | "hypothetical_scenario"; // User-created what-if test scenario

export interface BuildingObstructionFeature {
  id: string;
  name: string;
  source: "osm_overpass" | "user_hypothetical";
  category: string;
  developmentStatus?: DevelopmentStatus;
  footprint: Feature<Polygon | MultiPolygon>;
  heightM: number;
  heightProvenance: HeightProvenance;
  levels?: number;
  distanceToSolarM: number;
  shadowPolygon?: Feature<Polygon>;
  castsShadowOnSolar: boolean;
  overlapAreaM2: number;
  obstructionNotes: string;
}

export interface HypotheticalBuilding {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lengthM: number;
  widthM: number;
  bearingDeg?: number;
  heightM: number;
  status: "hypothetical_proposal" | "hypothetical_height_variant";
  developmentStatus?: DevelopmentStatus;
  targetYear?: number;
  confidence?: "high" | "medium" | "speculative";
  sourceDescription?: string;
  notes?: string;
}

export interface SolarPlacementInput {
  lat: number;
  lng: number;
  lengthM: number;
  widthM: number;
  bearingDeg: number;
  panelTiltDeg?: number;
  panelAzimuthDeg?: number;
  receiverElevationAboveGroundM?: number; // 0m = ground mount, >0m = rooftop mount (e.g. 15m)
  rooftopHeightM?: number; // alias
}

export interface SimulationTimeInput {
  isoDate: string; // e.g. "2026-06-21T12:00:00.000Z"
  timezoneOffsetMinutes?: number; // e.g. +330 for IST (+5:30)
}

export interface ShadingScenarioConfig {
  includeExistingBuildings: boolean;
  defaultUnknownBuildingHeightM?: number; // Configurable proxy for buildings lacking height tags (e.g. 6m)
  hypotheticalBuildings: HypotheticalBuilding[];
  modifiedExistingBuildingHeights?: Record<string, number>; // buildingId -> alternative height in meters
}

export interface ShadingMetrics {
  totalSolarAreaM2: number;
  shadedAreaM2: number;
  shadedPercentage: number;
  unshadedAreaM2: number;
  unshadedPercentage: number;
  obstructingBuildingsCount: number;
  totalCastShadowsAreaM2: number;
}

export interface ProvenanceSummary {
  totalSurroundingBuildings: number;
  measuredCount: number;
  inferredCount: number;
  defaultAssumedCount: number;
  unavailableCount: number;
  hypotheticalCount: number;
}

export interface DiurnalSamplePoint {
  hour: number; // 6 to 18
  timeDisplay: string; // e.g. "09:00"
  isoDate: string;
  solarPosition: SolarPosition;
  baselineShadedPercentage: number;
  baselineUnshadedPercentage: number;
  scenarioShadedPercentage: number;
  scenarioUnshadedPercentage: number;
  deltaShadedPercentage: number;
  clearskyGhiWm2: number; // Theoretical clear-sky flux (W/m²)
}

export interface DiurnalSolarAccessSummary {
  presetDateLabel: string; // "Summer Solstice (Jun 21)", "Equinox (Mar 21)", "Winter Solstice (Dec 21)"
  simulatedDateIso: string;
  baselineSunlightHours: number; // Hours with >= 50% unshaded array
  scenarioSunlightHours: number;
  deltaSunlightHours: number;
  diurnalSamples: DiurnalSamplePoint[];
  solarAccessRatioBaseline: number; // 0 to 1 weighted by insolation
  solarAccessRatioScenario: number;
  annualGenerationImpact?: {
    baselineAnnualMwh: number;
    scenarioAnnualMwh: number;
    deltaAnnualMwh: number;
    percentageLoss: number;
    screeningMethodology: string;
  };
}

export interface FutureScenarioDefinition {
  scenarioId: string;
  name: string;
  targetYear: number;
  status: DevelopmentStatus;
  confidence: "high" | "medium" | "speculative";
  sourceDescription: string;
  includeExistingBuildings: boolean;
  defaultUnknownBuildingHeightM?: number;
  buildings: HypotheticalBuilding[];
}

export interface SolarShadingResult {
  simulationTime: {
    isoDate: string;
    localTimeDisplay: string;
    timezoneOffsetMinutes: number;
  };
  solarPosition: SolarPosition;
  solarInstallationFootprint: Feature<Polygon>;
  baseline: ShadingMetrics;
  scenario: ShadingMetrics;
  delta: {
    deltaShadedAreaM2: number;
    deltaShadedPercentage: number;
    exposureImpact: "no_change" | "increased_shading" | "decreased_shading";
    summaryText: string;
  };
  obstructingBuildings: BuildingObstructionFeature[];
  allShadowPolygons: Feature<Polygon>[];
  shadedFootprintOverlap?: Feature<Polygon | MultiPolygon> | null;
  diurnalProfile?: DiurnalSolarAccessSummary;
  futureScenarioMeta?: FutureScenarioDefinition;
  provenanceSummary: ProvenanceSummary;
  limitations: string[];
}

export type SolarSystemType =
  | "rooftop_commercial" // Grid-tied commercial/industrial rooftop
  | "rooftop_residential" // Residential grid-tied rooftop
  | "ground_mount_utility" // Central station utility scale solar farm
  | "ground_mount_cni"; // Ground mounted behind-the-meter captive plant

export type InputEpistemicState =
  | "required_provided"
  | "optional_provided"
  | "estimated_proxy"
  | "missing_unprovided";

export interface InputAuditItem {
  key: string;
  label: string;
  value: string | number | boolean | null;
  unit?: string;
  state: InputEpistemicState;
  provenance: string;
}

export interface SeasonalWeatherSummary {
  monsoonPeriod: {
    months: string[]; // e.g. ["Jun", "Jul", "Aug", "Sep"]
    monsoonGhiAverage: number;
    monsoonGenerationMwh: number;
    monsoonCufPct: number;
    monsoonDropPercentage: number; // vs pre-monsoon peak
    weatherDynamicsNote: string;
  };
  dryDustSeason: {
    months: string[]; // e.g. ["Mar", "Apr", "May"]
    peakAmbientTempC: number;
    estimatedThermalDeratePct: number;
    elevatedSoilingRisk: boolean;
    weatherDynamicsNote: string;
  };
  winterClearSeason: {
    months: string[]; // e.g. ["Oct", "Nov", "Dec", "Jan", "Feb"]
    winterGhiAverage: number;
    winterGenerationMwh: number;
    weatherDynamicsNote: string;
  };
}

export interface ObservedMonthlyGeneration {
  month: string; // "Jan", "Feb", ...
  observedKwh: number;
  meterSource?: string;
  reportedDowntimeHours?: number;
  notes?: string;
}

export interface CalibrationComparisonResult {
  isCalibrated: boolean;
  totalObservedKwh: number;
  totalModelledKwh: number;
  energyDeltaKwh: number; // observed - modelled
  energyDeltaPct: number; // (observed - modelled) / modelled * 100
  meanBiasErrorKwh: number; // MBE = 1/N * sum(modelled - observed)
  meanAbsolutePercentageErrorPct: number; // MAPE
  rootMeanSquareErrorKwh: number; // RMSE
  observedSpecificYieldKwhPerKwp: number;
  observedCapacityUtilizationFactorPct: number;
  monthlyComparisons: {
    month: string;
    modelledKwh: number;
    observedKwh: number;
    deltaKwh: number;
    deltaPct: number;
    performanceRatioPct: number;
    downtimeNormalizedKwh?: number;
  }[];
  calibrationInsight: string;
  recommendedAdjustmentPct?: number; // suggested tuning factor
}

export interface GenerationUncertaintyBounds {
  p50AnnualGenerationMwh: number; // Median expected (standard model output)
  p90AnnualGenerationMwh: number; // Conservative 90% exceedance probability (~ -8% interannual weather & pyranometer variance)
  p10AnnualGenerationMwh: number; // Optimistic 10% exceedance probability (~ +8% high solar resource year)
  interannualVariabilityPct: number; // typically 4.5% - 6.0% in India
  modelUncertaintyPct: number; // +/- 5.0%
}

export interface ShadingIntegrationMeta {
  source: "default_benchmark" | "shadow_of_the_future_simulation";
  shadingLossPct: number;
  simulatedScenarioName?: string;
  annualGenerationDropMwh?: number;
  doubleCountingGuarded: boolean;
  notes: string;
}

export interface SolarRealityInput {
  lat: number;
  lng: number;
  capacityKwp: number; // Direct DC peak capacity in kWp
  systemType?: SolarSystemType;
  availableAreaM2?: number; // Rooftop or parcel area
  groundCoverageRatio?: number; // e.g. 0.45 for ground mount
  panelTiltDeg?: number; // Tilt angle in degrees (default to lat or 22°)
  panelAzimuthDeg?: number; // True azimuth (default 180° for North hemisphere, 0° for South)
  soilingLossPct?: number; // Custom soiling percentage (default 2.5%)
  shadingLossPct?: number; // Shading loss percentage (e.g. from Shadow-of-the-Future or default 2.0%)
  shadingSource?: "default_benchmark" | "shadow_of_the_future_simulation";
  shadingScenarioName?: string;
  inverterEfficiencyPct?: number; // Inverter efficiency (default 97.5%)
  capexPerKwpInr?: number; // Benchmark capital expenditure per kWp (default ₹42,000)
  tariffPerKwhInr?: number; // Commercial or PPA electricity tariff per kWh (default ₹6.50)
  opexAnnualPct?: number; // Annual O&M cost as % of Capex (default 1.2%)
  observedGeneration?: ObservedMonthlyGeneration[];
}

export interface MonthlyProductionBreakdown {
  month: string; // "Jan", "Feb", ...
  monthIndex: number; // 0 to 11
  days: number;
  ghiKwhM2Day: number; // Global Horizontal Irradiance (kWh/m2/day)
  poaKwhM2Day: number; // Plane-of-Array Irradiance on tilted surface (kWh/m2/day)
  tiltTranspositionFactor: number; // POA / GHI ratio
  ambientTempC: number; // Ambient 2m air temperature (°C)
  cellTempC: number; // Nominal operating cell temperature (°C)
  tempDerateFactor: number; // e.g. 0.90 (-10% loss)
  performanceRatioPct: number; // Net PR for this month (%)
  productionKwh: number; // Kilowatt-hours generated in this month
  productionMwh: number; // Megawatt-hours generated in this month
  capacityUtilizationFactorPct: number; // Monthly CUF (%)
}

export interface LossWaterfallItem {
  id: string;
  name: string;
  lossPct: number; // Percentage lost (e.g. 2.5)
  derateFactor: number; // Multiplicative factor (e.g. 0.975)
  explanation: string;
}

export interface EconomicSensitivityItem {
  scenarioName: string;
  capexTotalInr: number;
  tariffInrPerKwh: number;
  simplePaybackYears: number;
  lcoeInrPerKwh: number;
}

export interface EconomicFeasibilityResult {
  capexTotalInr: number;
  capexPerKwpInr: number;
  opexAnnualInr: number;
  tariffInrPerKwh: number;
  annualRevenueInr: number;
  simplePaybackYears: number;
  lcoeInrPerKwh: number; // 25-year Levelized Cost of Electricity (LCOE)
  twentyFiveYearNetSavingsInr: number;
  sensitivityMatrix: EconomicSensitivityItem[];
  economicDisclaimer: string;
}

export interface SolarRealityResult {
  systemType: SolarSystemType;
  installedCapacityKwp: number;
  installedCapacityMwp: number;
  systemPerformanceRatio: number; // Overall weighted PR (0.0 to 1.0)
  annualGenerationKwh: number;
  annualGenerationMwh: number;
  dailyAverageKwh: number;
  specificYieldKwhPerKwp: number; // kWh / kWp / year
  capacityUtilizationFactorPct: number; // CUF %
  annualGhiAverageKwhM2Day: number;
  annualPoaAverageKwhM2Day: number;
  monthlyBreakdown: MonthlyProductionBreakdown[];
  lossWaterfall: LossWaterfallItem[];
  seasonalWeather: SeasonalWeatherSummary;
  calibration: CalibrationComparisonResult;
  uncertaintyBounds: GenerationUncertaintyBounds;
  shadingIntegration: ShadingIntegrationMeta;
  inputAudit: InputAuditItem[];
  economics: EconomicFeasibilityResult;
  dataProvenance: {
    dataset: string;
    source: string;
    temporalResolution: string;
    spatialResolution: string;
    isClimatological: boolean;
    retrievedAt: string;
    license: string;
  };
  modelLimitations: string[];
}

