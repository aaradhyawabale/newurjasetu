export interface MetricScore {
  score: number; // 0 to 100
  status: "optimal" | "acceptable" | "suboptimal" | "constrained";
  formattedValue: string;
}

export function scoreDistanceToRoad(distMeters: number): MetricScore {
  if (distMeters <= 60) return { score: 100, status: "optimal", formattedValue: `${Math.round(distMeters)} m` };
  if (distMeters <= 150) return { score: 88, status: "optimal", formattedValue: `${Math.round(distMeters)} m` };
  if (distMeters <= 350) return { score: 72, status: "acceptable", formattedValue: `${Math.round(distMeters)} m` };
  if (distMeters <= 700) return { score: 50, status: "suboptimal", formattedValue: `${Math.round(distMeters)} m` };
  if (distMeters <= 1500) return { score: 30, status: "constrained", formattedValue: `${Math.round(distMeters)} m` };
  return { score: 12, status: "constrained", formattedValue: `${Math.round(distMeters)} m` };
}

export function scoreSlopePercent(slopePct: number, idealMax = 5): MetricScore {
  if (slopePct <= idealMax * 0.6) return { score: 98, status: "optimal", formattedValue: `${slopePct.toFixed(1)}%` };
  if (slopePct <= idealMax) return { score: 85, status: "optimal", formattedValue: `${slopePct.toFixed(1)}%` };
  if (slopePct <= idealMax * 1.5) return { score: 68, status: "acceptable", formattedValue: `${slopePct.toFixed(1)}%` };
  if (slopePct <= idealMax * 2.2) return { score: 45, status: "suboptimal", formattedValue: `${slopePct.toFixed(1)}%` };
  return { score: 20, status: "constrained", formattedValue: `${slopePct.toFixed(1)}%` };
}

export function scoreDemandDensity(residentialCount: number): MetricScore {
  if (residentialCount >= 180) return { score: 96, status: "optimal", formattedValue: `${residentialCount} bldgs` };
  if (residentialCount >= 90) return { score: 84, status: "optimal", formattedValue: `${residentialCount} bldgs` };
  if (residentialCount >= 35) return { score: 68, status: "acceptable", formattedValue: `${residentialCount} bldgs` };
  if (residentialCount >= 10) return { score: 48, status: "suboptimal", formattedValue: `${residentialCount} bldgs` };
  return { score: 25, status: "constrained", formattedValue: `${residentialCount} bldgs` };
}

export function scoreGapNeed(existingCountWithinRadius: number): MetricScore {
  if (existingCountWithinRadius === 0) return { score: 98, status: "optimal", formattedValue: `0 nearby (critical gap)` };
  if (existingCountWithinRadius === 1) return { score: 85, status: "optimal", formattedValue: `1 nearby (moderate gap)` };
  if (existingCountWithinRadius === 2) return { score: 65, status: "acceptable", formattedValue: `2 nearby` };
  if (existingCountWithinRadius <= 4) return { score: 45, status: "suboptimal", formattedValue: `${existingCountWithinRadius} nearby` };
  return { score: 25, status: "constrained", formattedValue: `${existingCountWithinRadius} nearby (saturated)` };
}

export function scoreEvStationSeparation(distMeters: number): MetricScore {
  if (distMeters >= 1200) return { score: 96, status: "optimal", formattedValue: `${Math.round(distMeters)} m (critical gap opportunity)` };
  if (distMeters >= 600) return { score: 85, status: "optimal", formattedValue: `${Math.round(distMeters)} m (favorable spacing)` };
  if (distMeters >= 300) return { score: 65, status: "acceptable", formattedValue: `${Math.round(distMeters)} m (moderate spacing)` };
  if (distMeters >= 150) return { score: 40, status: "suboptimal", formattedValue: `${Math.round(distMeters)} m (dense clustering)` };
  return { score: 20, status: "constrained", formattedValue: `${Math.round(distMeters)} m (cannibalization risk)` };
}

export function scoreHostParkingDistance(distMeters: number): MetricScore {
  if (distMeters <= 50) return { score: 100, status: "optimal", formattedValue: `${Math.round(distMeters)} m (co-located with parking/host)` };
  if (distMeters <= 120) return { score: 88, status: "optimal", formattedValue: `${Math.round(distMeters)} m (immediate pedestrian reach)` };
  if (distMeters <= 250) return { score: 70, status: "acceptable", formattedValue: `${Math.round(distMeters)} m (short walking distance)` };
  if (distMeters <= 500) return { score: 45, status: "suboptimal", formattedValue: `${Math.round(distMeters)} m (moderate walk)` };
  return { score: 20, status: "constrained", formattedValue: `${Math.round(distMeters)} m (isolated roadside)` };
}

export function scoreSolarGhi(ghiKwhM2Day: number): MetricScore {
  if (ghiKwhM2Day >= 5.4) return { score: 100, status: "optimal", formattedValue: `${ghiKwhM2Day} kWh/m²/day` };
  if (ghiKwhM2Day >= 4.8) return { score: 86, status: "optimal", formattedValue: `${ghiKwhM2Day} kWh/m²/day` };
  if (ghiKwhM2Day >= 4.2) return { score: 70, status: "acceptable", formattedValue: `${ghiKwhM2Day} kWh/m²/day` };
  if (ghiKwhM2Day >= 3.5) return { score: 48, status: "suboptimal", formattedValue: `${ghiKwhM2Day} kWh/m²/day` };
  return { score: 25, status: "constrained", formattedValue: `${ghiKwhM2Day} kWh/m²/day` };
}

export function scoreOsmDataCoverage(featureDensityKm2: number): MetricScore {
  if (featureDensityKm2 >= 25) return { score: 98, status: "optimal", formattedValue: `${Math.round(featureDensityKm2)}/km²` };
  if (featureDensityKm2 >= 12) return { score: 85, status: "optimal", formattedValue: `${Math.round(featureDensityKm2)}/km²` };
  if (featureDensityKm2 >= 5) return { score: 65, status: "acceptable", formattedValue: `${Math.round(featureDensityKm2)}/km²` };
  if (featureDensityKm2 >= 2) return { score: 40, status: "suboptimal", formattedValue: `${Math.round(featureDensityKm2)}/km²` };
  return { score: 20, status: "constrained", formattedValue: `${Math.round(featureDensityKm2)}/km² (low coverage)` };
}

export function scoreManningHydraulicCapacity(
  designFlowLps: number,
  channelWidthM: number,
  channelDepthM: number,
  slopePct: number
): MetricScore {
  // Manning equation: Q = (1 / n) * A * (R_h)^(2/3) * S^(1/2)
  // For standard concrete lined trapezoidal/rectangular channel: n = 0.015
  const n = 0.015;
  const slopeFraction = Math.max(slopePct / 100, 0.001); // min 0.1% hydraulic gradient
  const waterDepth = channelDepthM * 0.75; // 75% flow depth allowing 25% freeboard
  const area = channelWidthM * waterDepth;
  const wettedPerimeter = channelWidthM + 2 * waterDepth;
  const hydraulicRadius = area / wettedPerimeter;

  // Q in m3/s
  const capacityM3s = (1 / n) * area * Math.pow(hydraulicRadius, 2 / 3) * Math.sqrt(slopeFraction);
  const capacityLps = capacityM3s * 1000;

  const ratio = capacityLps / Math.max(designFlowLps, 1);
  const formatted = `${Math.round(capacityLps).toLocaleString()} L/s (${(ratio * 100).toFixed(0)}% req)`;

  if (ratio >= 1.25) return { score: 100, status: "optimal", formattedValue: formatted };
  if (ratio >= 1.0) return { score: 85, status: "optimal", formattedValue: formatted };
  if (ratio >= 0.8) return { score: 60, status: "acceptable", formattedValue: formatted };
  if (ratio >= 0.5) return { score: 35, status: "suboptimal", formattedValue: formatted };
  return { score: 15, status: "constrained", formattedValue: formatted };
}

export function determineSuitabilityBand(score: number): {
  band: string;
  tone: "positive" | "moderate" | "cautious" | "negative";
  summary: string;
} {
  if (score >= 78) {
    return {
      band: "High Suitability",
      tone: "positive",
      summary: "Indicative geospatial metrics strongly support siting at this location under standard heuristic criteria.",
    };
  }
  if (score >= 58) {
    return {
      band: "Moderate Suitability",
      tone: "moderate",
      summary: "Geospatial metrics show viable baseline conditions with manageable localized constraints requiring engineering mitigation.",
    };
  }
  if (score >= 40) {
    return {
      band: "Low Suitability",
      tone: "cautious",
      summary: "Multiple siting constraints observed. Siting may demand substantial civil intervention or land clearance.",
    };
  }
  if (score >= 25) {
    return {
      band: "Highly Constrained",
      tone: "cautious",
      summary: "Severe spatial, accessibility, or terrain barriers identified. Siting is not recommended without major redesign.",
    };
  }
  return {
    band: "Unsuitable",
    tone: "negative",
    summary: "Critical conflicting land uses, physical hazards, or prohibitive deficits prevent viable siting at this location.",
  };
}
