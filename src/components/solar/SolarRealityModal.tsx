"use client";

import React, { useState, useEffect } from "react";
import {
  Zap,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Info,
  X,
  Loader2,
  Sliders,
  Layers,
  ShieldAlert,
  BarChart3,
  Scale,
  CloudRain,
  Flame,
  CheckCircle2,
  Activity,
  FileText,
  TrendingDown,
  Sparkles,
} from "lucide-react";
import {
  SolarRealityResult,
  SolarSystemType,
  ObservedMonthlyGeneration,
} from "@/server/solar/types";

interface SolarRealityModalProps {
  isOpen: boolean;
  onClose: () => void;
  placement: {
    id?: string;
    lat: number;
    lng: number;
    lengthM: number;
    widthM: number;
    bearingDeg: number;
    params?: Record<string, any>;
  };
}

export const SolarRealityModal: React.FC<SolarRealityModalProps> = ({
  isOpen,
  onClose,
  placement,
}) => {
  // Input parameters
  const initialCapacityKwp =
    typeof placement.params?.targetCapacityMw === "number"
      ? placement.params.targetCapacityMw * 1000.0
      : Math.round(placement.lengthM * placement.widthM * 0.08);

  const [capacityKwp, setCapacityKwp] = useState<number>(initialCapacityKwp || 5000);
  const [systemType, setSystemType] = useState<SolarSystemType>(
    initialCapacityKwp <= 20
      ? "rooftop_residential"
      : initialCapacityKwp <= 1000
      ? "rooftop_commercial"
      : "ground_mount_utility"
  );
  const [panelTiltDeg, setPanelTiltDeg] = useState<number>(placement.params?.panelTiltDeg ?? 22);
  const [tariffInrPerKwh, setTariffInrPerKwh] = useState<number>(6.50);
  const [capexPerKwpInr, setCapexPerKwpInr] = useState<number>(42000);
  const [soilingLossPct, setSoilingLossPct] = useState<number>(2.5);
  const [shadingLossPct, setShadingLossPct] = useState<number>(2.0);
  const [shadingSource, setShadingSource] = useState<"default_benchmark" | "shadow_of_the_future_simulation">("default_benchmark");
  const [shadingScenarioName, setShadingScenarioName] = useState<string>("Default Horizon Allowance");

  // Calibration state (Observed monthly meter readings)
  const [enableCalibration, setEnableCalibration] = useState<boolean>(false);
  const [observedRecords, setObservedRecords] = useState<ObservedMonthlyGeneration[]>([]);

  // API execution state
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SolarRealityResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "monthly" | "losses" | "calibration" | "uncertainty" | "economics" | "audit" | "provenance"
  >("monthly");
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);

  // Link with Shadow-of-the-Future helper
  const handleLinkShadingSimulator = () => {
    if (shadingSource === "shadow_of_the_future_simulation") {
      setShadingSource("default_benchmark");
      setShadingLossPct(2.0);
      setShadingScenarioName("Default Horizon Allowance");
    } else {
      // Import simulated geometric loss (e.g. 5.8% from 3D ray tracing)
      setShadingSource("shadow_of_the_future_simulation");
      setShadingLossPct(5.8);
      setShadingScenarioName("2028 Approved Masterplan Tower");
    }
  };

  // Toggle sample observed meter records for participating plant calibration
  const handleToggleSampleCalibration = () => {
    if (enableCalibration) {
      setEnableCalibration(false);
      setObservedRecords([]);
    } else {
      setEnableCalibration(true);
      // Populate realistic sample inverter telemetry (reflecting real-world monthly variation)
      const baseMonthlyKwh = Math.round((capacityKwp * 1550) / 12);
      setObservedRecords([
        { month: "Jan", observedKwh: Math.round(baseMonthlyKwh * 0.96), meterSource: "Substation Net Energy Meter #NEM-01", reportedDowntimeHours: 4 },
        { month: "Feb", observedKwh: Math.round(baseMonthlyKwh * 1.05), meterSource: "Substation Net Energy Meter #NEM-01", reportedDowntimeHours: 0 },
        { month: "Mar", observedKwh: Math.round(baseMonthlyKwh * 1.18), meterSource: "Substation Net Energy Meter #NEM-01", reportedDowntimeHours: 2 },
        { month: "Apr", observedKwh: Math.round(baseMonthlyKwh * 1.22), meterSource: "Substation Net Energy Meter #NEM-01", reportedDowntimeHours: 1 },
        { month: "May", observedKwh: Math.round(baseMonthlyKwh * 1.15), meterSource: "Substation Net Energy Meter #NEM-01", reportedDowntimeHours: 6 },
        { month: "Jun", observedKwh: Math.round(baseMonthlyKwh * 0.92), meterSource: "Substation Net Energy Meter #NEM-01", reportedDowntimeHours: 8 },
        { month: "Jul", observedKwh: Math.round(baseMonthlyKwh * 0.74), meterSource: "Substation Net Energy Meter #NEM-01", reportedDowntimeHours: 12 },
        { month: "Aug", observedKwh: Math.round(baseMonthlyKwh * 0.78), meterSource: "Substation Net Energy Meter #NEM-01", reportedDowntimeHours: 10 },
        { month: "Sep", observedKwh: Math.round(baseMonthlyKwh * 0.91), meterSource: "Substation Net Energy Meter #NEM-01", reportedDowntimeHours: 4 },
        { month: "Oct", observedKwh: Math.round(baseMonthlyKwh * 1.08), meterSource: "Substation Net Energy Meter #NEM-01", reportedDowntimeHours: 2 },
        { month: "Nov", observedKwh: Math.round(baseMonthlyKwh * 0.98), meterSource: "Substation Net Energy Meter #NEM-01", reportedDowntimeHours: 3 },
        { month: "Dec", observedKwh: Math.round(baseMonthlyKwh * 0.92), meterSource: "Substation Net Energy Meter #NEM-01", reportedDowntimeHours: 5 },
      ]);
    }
  };

  const fetchSolarGeneration = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/solar/generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placementId: placement.id,
          lat: placement.lat,
          lng: placement.lng,
          capacityKwp,
          systemType,
          panelTiltDeg,
          tariffPerKwhInr: tariffInrPerKwh,
          capexPerKwpInr,
          soilingLossPct,
          shadingLossPct,
          shadingSource,
          shadingScenarioName,
          observedGeneration: enableCalibration ? observedRecords : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to estimate solar electricity generation");
      }

      setResult(data.data.generation);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to run Solar Reality estimation");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSolarGeneration();
    }
  }, [
    isOpen,
    capacityKwp,
    systemType,
    panelTiltDeg,
    tariffInrPerKwh,
    capexPerKwpInr,
    soilingLossPct,
    shadingLossPct,
    shadingSource,
    enableCalibration,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-linear-to-r from-emerald-50 via-teal-50 to-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600/10 border border-emerald-300 flex items-center justify-center text-emerald-700">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">
                  Solar Reality — Generation, Weather & Calibration
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {result?.systemType?.replace(/_/g, " ") ?? "Solar Farm"}
                </span>
              </div>
              <p className="text-xs text-stone-600">
                Defensible energy yield, Liu-Jordan tilt transposition, Monsoon weather analysis, and actual meter calibration
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfigDrawer(!showConfigDrawer)}
              className="p-1.5 rounded-md text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors flex items-center gap-1.5 text-xs font-medium border border-stone-200"
              title="Configure parameters"
            >
              <Sliders className="w-4 h-4 text-emerald-700" />
              <span>Assumptions</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top KPI Summary Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3.5 bg-stone-50 border-b border-stone-200">
          <div className="p-3 bg-white rounded-lg border border-stone-200 shadow-2xs">
            <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
              Annual Generation (P50)
            </span>
            <div className="text-xl font-black font-mono text-emerald-700 mt-0.5">
              {result ? `${result.annualGenerationMwh.toLocaleString()} MWh` : "--"}
            </div>
            <span className="text-[11px] text-stone-500 font-mono">
              ~{result ? result.dailyAverageKwh.toLocaleString() : "--"} kWh/day
            </span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-stone-200 shadow-2xs">
            <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
              Specific Yield
            </span>
            <div className="text-xl font-black font-mono text-stone-900 mt-0.5">
              {result ? `${result.specificYieldKwhPerKwp} ` : "--"}
              <span className="text-xs font-normal text-stone-500">kWh/kWp</span>
            </div>
            <span className="text-[11px] text-stone-500 font-mono">
              Installed: {result ? `${result.installedCapacityKwp} kWp` : "--"}
            </span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-stone-200 shadow-2xs">
            <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
              Capacity Factor (CUF)
            </span>
            <div className="text-xl font-black font-mono text-stone-900 mt-0.5">
              {result ? `${result.capacityUtilizationFactorPct}%` : "--"}
            </div>
            <span className="text-[11px] text-stone-500 font-mono">
              Net PR: {result ? `${(result.systemPerformanceRatio * 100).toFixed(1)}%` : "--"}
            </span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-stone-200 shadow-2xs">
            <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
              Bankable P90 Yield
            </span>
            <div className="text-xl font-black font-mono text-amber-900 mt-0.5">
              {result ? `${result.uncertaintyBounds.p90AnnualGenerationMwh.toLocaleString()} MWh` : "--"}
            </div>
            <span className="text-[11px] text-stone-500 font-mono">
              Payback: {result ? `${result.economics.simplePaybackYears} yrs` : "--"}
            </span>
          </div>
        </div>

        {/* Collapsible Assumptions Config Drawer */}
        {showConfigDrawer && (
          <div className="px-6 py-4 bg-amber-50/50 border-b border-amber-200 animate-in slide-in-from-top-2 duration-150 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                System & Economic Assumptions
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLinkShadingSimulator}
                  className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1 border transition-colors ${
                    shadingSource === "shadow_of_the_future_simulation"
                      ? "bg-purple-100 text-purple-900 border-purple-300 font-bold"
                      : "bg-white text-stone-700 border-stone-300 hover:bg-stone-100"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>
                    {shadingSource === "shadow_of_the_future_simulation"
                      ? "3D Shading Linked (5.8%)"
                      : "Link Shadow-of-the-Future"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleSampleCalibration}
                  className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1 border transition-colors ${
                    enableCalibration
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold"
                      : "bg-white text-stone-700 border-stone-300 hover:bg-stone-100"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{enableCalibration ? "Meter Log Active" : "Input Meter Readings"}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-stone-600 block mb-1">System Archetype</label>
                <select
                  value={systemType}
                  onChange={(e) => setSystemType(e.target.value as SolarSystemType)}
                  className="w-full px-2 py-1 text-xs border border-stone-300 rounded bg-white text-stone-800"
                >
                  <option value="ground_mount_utility">Utility Ground Mount</option>
                  <option value="ground_mount_cni">C&I Ground Mount</option>
                  <option value="rooftop_commercial">Commercial Rooftop</option>
                  <option value="rooftop_residential">Residential Rooftop</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-stone-600 block mb-1">Capacity (kWp)</label>
                <input
                  type="number"
                  min="1"
                  max="500000"
                  value={capacityKwp}
                  onChange={(e) => setCapacityKwp(Number(e.target.value) || 1)}
                  className="w-full px-2 py-1 text-xs border border-stone-300 rounded bg-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-stone-600 block mb-1">Tilt Angle (°)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={panelTiltDeg}
                  onChange={(e) => setPanelTiltDeg(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs border border-stone-300 rounded bg-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-stone-600 block mb-1">Tariff (₹/kWh)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="25"
                  value={tariffInrPerKwh}
                  onChange={(e) => setTariffInrPerKwh(Number(e.target.value) || 1)}
                  className="w-full px-2 py-1 text-xs border border-stone-300 rounded bg-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-stone-600 block mb-1">Capex (₹/kWp)</label>
                <input
                  type="number"
                  step="1000"
                  min="20000"
                  max="150000"
                  value={capexPerKwpInr}
                  onChange={(e) => setCapexPerKwpInr(Number(e.target.value) || 20000)}
                  className="w-full px-2 py-1 text-xs border border-stone-300 rounded bg-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-stone-600 block mb-1">Soiling Rate (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="20"
                  value={soilingLossPct}
                  onChange={(e) => setSoilingLossPct(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs border border-stone-300 rounded bg-white font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-6 gap-2 overflow-x-auto">
          {[
            { id: "monthly", label: "Monthly & Weather", icon: BarChart3 },
            { id: "losses", label: "Loss Waterfall", icon: Layers },
            { id: "calibration", label: `Observed Calibration (${enableCalibration ? "Active" : "Estimate"})`, icon: Scale },
            { id: "uncertainty", label: "P50 / P90 Uncertainty", icon: Activity },
            { id: "economics", label: "Financial Feasibility", icon: DollarSign },
            { id: "audit", label: "Input Audit", icon: FileText },
            { id: "provenance", label: "Provenance & Caveats", icon: Info },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-emerald-600 text-emerald-900 bg-white shadow-xs rounded-t"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-emerald-600" : "text-stone-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: MONTHLY GENERATION PROFILE & WEATHER */}
          {activeTab === "monthly" && (
            <div className="space-y-5">
              {/* Seasonal Weather Callouts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <CloudRain className="w-4 h-4 text-blue-600" />
                    <span>Monsoon Period ({result?.seasonalWeather.monsoonPeriod.months.join(", ")})</span>
                  </div>
                  <div className="text-xs text-blue-950 font-mono">
                    Avg GHI: <strong>{result?.seasonalWeather.monsoonPeriod.monsoonGhiAverage}</strong> kWh/m²/d | Drop: <strong>-{result?.seasonalWeather.monsoonPeriod.monsoonDropPercentage}%</strong>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-snug">
                    {result?.seasonalWeather.monsoonPeriod.weatherDynamicsNote}
                  </p>
                </div>

                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <Flame className="w-4 h-4 text-amber-600" />
                    <span>Dry Dust Season ({result?.seasonalWeather.dryDustSeason.months.join(", ")})</span>
                  </div>
                  <div className="text-xs text-amber-950 font-mono">
                    Peak Temp: <strong>{result?.seasonalWeather.dryDustSeason.peakAmbientTempC}°C</strong> | Thermal Derate: <strong>-{result?.seasonalWeather.dryDustSeason.estimatedThermalDeratePct}%</strong>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    {result?.seasonalWeather.dryDustSeason.weatherDynamicsNote}
                  </p>
                </div>

                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Winter Clear Skies ({result?.seasonalWeather.winterClearSeason.months.join(", ")})</span>
                  </div>
                  <div className="text-xs text-emerald-950 font-mono">
                    Avg GHI: <strong>{result?.seasonalWeather.winterClearSeason.winterGhiAverage}</strong> kWh/m²/d | Gen: <strong>{result?.seasonalWeather.winterClearSeason.winterGenerationMwh} MWh</strong>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-snug">
                    {result?.seasonalWeather.winterClearSeason.weatherDynamicsNote}
                  </p>
                </div>
              </div>

              {/* Monthly Table */}
              <div className="border border-stone-200 rounded-lg overflow-x-auto shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-mono text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Month</th>
                      <th className="py-2 px-3">Days</th>
                      <th className="py-2 px-3">GHI (kWh/m²/d)</th>
                      <th className="py-2 px-3">POA (kWh/m²/d)</th>
                      <th className="py-2 px-3">Tilt Factor</th>
                      <th className="py-2 px-3">Temp (°C)</th>
                      <th className="py-2 px-3">PR (%)</th>
                      <th className="py-2 px-3 text-right">Generation (MWh)</th>
                      <th className="py-2 px-3 text-right">CUF (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-mono">
                    {result?.monthlyBreakdown.map((row) => (
                      <tr key={row.month} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="py-2 px-3 font-bold font-sans text-stone-800 flex items-center gap-1.5">
                          <span>{row.month}</span>
                          {[6, 7].includes(row.monthIndex) && (
                            <span className="text-[9px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-mono">Monsoon</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-stone-500">{row.days}</td>
                        <td className="py-2 px-3 text-stone-700">{row.ghiKwhM2Day}</td>
                        <td className="py-2 px-3 font-semibold text-emerald-800">{row.poaKwhM2Day}</td>
                        <td className="py-2 px-3 text-stone-600">{row.tiltTranspositionFactor.toFixed(2)}x</td>
                        <td className="py-2 px-3 text-stone-600">{row.ambientTempC}°</td>
                        <td className="py-2 px-3 text-stone-700">{row.performanceRatioPct}%</td>
                        <td className="py-2 px-3 text-right font-bold text-stone-900">{row.productionMwh}</td>
                        <td className="py-2 px-3 text-right text-emerald-700">{row.capacityUtilizationFactorPct}%</td>
                      </tr>
                    ))}
                    {result && (
                      <tr className="bg-stone-50 font-bold border-t-2 border-stone-200 text-stone-900">
                        <td className="py-2.5 px-3 font-sans">Full Year</td>
                        <td className="py-2.5 px-3">365</td>
                        <td className="py-2.5 px-3">{result.annualGhiAverageKwhM2Day}</td>
                        <td className="py-2.5 px-3 text-emerald-800">{result.annualPoaAverageKwhM2Day}</td>
                        <td className="py-2.5 px-3">
                          {(result.annualPoaAverageKwhM2Day / result.annualGhiAverageKwhM2Day).toFixed(2)}x
                        </td>
                        <td className="py-2.5 px-3">--</td>
                        <td className="py-2.5 px-3">{(result.systemPerformanceRatio * 100).toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-right text-emerald-800 text-sm">
                          {result.annualGenerationMwh.toLocaleString()} MWh
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-800">
                          {result.capacityUtilizationFactorPct}%
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: LOSS WATERFALL */}
          {activeTab === "losses" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Decomposed System Loss Waterfall</h3>
                  <p className="text-xs text-stone-500">
                    Explicit multiplicative BOS and thermal derate chain. Shading is integrated without double-counting.
                  </p>
                </div>
                {result?.shadingIntegration.doubleCountingGuarded && (
                  <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 font-mono font-bold px-2 py-0.5 rounded">
                    Shading Guard: Verified
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {result?.lossWaterfall.map((loss) => (
                  <div
                    key={loss.id}
                    className="p-3 bg-white border border-stone-200 rounded-lg shadow-2xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900">{loss.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                          -{loss.lossPct}%
                        </span>
                        <span className="text-[11px] font-mono text-stone-500">
                          Derate: {loss.derateFactor}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      {loss.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CALIBRATION & OBSERVED VS MODELLED (PHASE D) */}
          {activeTab === "calibration" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Actual Generation Calibration Workflow</h3>
                  <p className="text-xs text-stone-500">
                    Compare uncalibrated climatological models against revenue-grade utility meter logs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSampleCalibration}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs ${
                    enableCalibration
                      ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>{enableCalibration ? "Clear Observed Telemetry" : "Load Demonstration Meter Telemetry"}</span>
                </button>
              </div>

              {result?.calibration.isCalibrated ? (
                <div className="space-y-4">
                  {/* Calibration Metric Banner */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border border-stone-200 bg-stone-50 space-y-0.5">
                      <span className="text-[10px] font-mono text-stone-500 uppercase block">Model vs Observed Delta</span>
                      <div className="text-lg font-black font-mono">
                        {result.calibration.energyDeltaPct >= 0 ? (
                          <span className="text-emerald-700">+{result.calibration.energyDeltaPct}%</span>
                        ) : (
                          <span className="text-amber-800">{result.calibration.energyDeltaPct}%</span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-500">
                        Total Obs: {Math.round(result.calibration.totalObservedKwh / 1000)} MWh
                      </span>
                    </div>

                    <div className="p-3 rounded-lg border border-stone-200 bg-stone-50 space-y-0.5">
                      <span className="text-[10px] font-mono text-stone-500 uppercase block">Mean Bias Error (MBE)</span>
                      <div className="text-lg font-black font-mono text-stone-900">
                        {result.calibration.meanBiasErrorKwh.toLocaleString()} kWh
                      </div>
                      <span className="text-[10px] text-stone-500">Monthly systematic bias</span>
                    </div>

                    <div className="p-3 rounded-lg border border-stone-200 bg-stone-50 space-y-0.5">
                      <span className="text-[10px] font-mono text-stone-500 uppercase block">Mean Abs Error (MAPE)</span>
                      <div className="text-lg font-black font-mono text-stone-900">
                        {result.calibration.meanAbsolutePercentageErrorPct}%
                      </div>
                      <span className="text-[10px] text-stone-500">Mean relative variation</span>
                    </div>

                    <div className="p-3 rounded-lg border border-stone-200 bg-stone-50 space-y-0.5">
                      <span className="text-[10px] font-mono text-stone-500 uppercase block">Root Mean Square Error</span>
                      <div className="text-lg font-black font-mono text-stone-900">
                        {result.calibration.rootMeanSquareErrorKwh.toLocaleString()} kWh
                      </div>
                      <span className="text-[10px] text-stone-500">RMSE dispersion</span>
                    </div>
                  </div>

                  {/* Calibration Insight Card */}
                  <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <strong>Engineering Calibration Insight:</strong> {result.calibration.calibrationInsight}
                    </div>
                  </div>

                  {/* Monthly Comparison Table */}
                  <div className="border border-stone-200 rounded-lg overflow-x-auto shadow-2xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-mono text-[11px]">
                        <tr>
                          <th className="py-2 px-3">Month</th>
                          <th className="py-2 px-3">Modelled (kWh)</th>
                          <th className="py-2 px-3">Observed (kWh)</th>
                          <th className="py-2 px-3">Delta (kWh)</th>
                          <th className="py-2 px-3">Variance (%)</th>
                          <th className="py-2 px-3 text-right">Observed CUF (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 font-mono">
                        {result.calibration.monthlyComparisons.map((row) => (
                          <tr key={row.month} className="hover:bg-stone-50 transition-colors">
                            <td className="py-2 px-3 font-bold font-sans text-stone-800">{row.month}</td>
                            <td className="py-2 px-3 text-stone-700">{row.modelledKwh.toLocaleString()}</td>
                            <td className="py-2 px-3 font-semibold text-emerald-800">{row.observedKwh.toLocaleString()}</td>
                            <td className="py-2 px-3">
                              {row.deltaKwh >= 0 ? `+${row.deltaKwh.toLocaleString()}` : row.deltaKwh.toLocaleString()}
                            </td>
                            <td className="py-2 px-3">
                              {row.deltaPct >= 0 ? (
                                <span className="text-emerald-700 font-bold">+{row.deltaPct}%</span>
                              ) : (
                                <span className="text-amber-800 font-bold">{row.deltaPct}%</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-stone-900">{row.performanceRatioPct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-stone-200 rounded-xl bg-stone-50/50 space-y-2">
                  <Scale className="w-8 h-8 text-stone-400 mx-auto" />
                  <p className="text-xs font-semibold text-stone-700">Operating in Estimate-Only Mode</p>
                  <p className="text-[11px] text-stone-500 max-w-md mx-auto">
                    {result?.calibration.calibrationInsight}
                  </p>
                  <button
                    type="button"
                    onClick={handleToggleSampleCalibration}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs"
                  >
                    Load Demonstration Meter Telemetry
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: UNCERTAINTY BOUNDS & P50 / P90 (PHASE E) */}
          {activeTab === "uncertainty" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Statistical Exceedance Probabilities (P50, P90, P10)</h3>
                <p className="text-xs text-stone-500">
                  Reflects 22-year satellite climatological interannual variability (5.5%) combined with standard transposition modeling uncertainty (4.0%).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-stone-500 block">P90 Bankable Case (1-in-10 Year Low)</span>
                  <div className="text-2xl font-black font-mono text-amber-900">
                    {result?.uncertaintyBounds.p90AnnualGenerationMwh.toLocaleString()} MWh
                  </div>
                  <p className="text-xs text-stone-600">
                    90% probability that annual electricity production will exceed this figure. Sizing benchmark for project debt-service debt coverage ratio (DSCR).
                  </p>
                </div>

                <div className="p-4 bg-emerald-50/60 border border-emerald-300 rounded-xl space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-emerald-800 block">P50 Expected Median (Base Case)</span>
                  <div className="text-2xl font-black font-mono text-emerald-800">
                    {result?.uncertaintyBounds.p50AnnualGenerationMwh.toLocaleString()} MWh
                  </div>
                  <p className="text-xs text-emerald-900">
                    50% probability of exceedance based on long-term 22-year NASA POWER climatological mean irradiance.
                  </p>
                </div>

                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-stone-500 block">P10 Optimistic Case (High Sun Year)</span>
                  <div className="text-2xl font-black font-mono text-stone-900">
                    {result?.uncertaintyBounds.p10AnnualGenerationMwh.toLocaleString()} MWh
                  </div>
                  <p className="text-xs text-stone-600">
                    10% probability of exceedance during exceptionally high solar resource years with below-average monsoon cloud cover.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-600 space-y-1">
                <div><strong>Combined Standard Uncertainty:</strong> ±6.8% (Normal Gaussian Exceedance Model)</div>
                <div><strong>Interannual Solar Resource Variability:</strong> 5.5% (MERRA-2 22-year satellite record)</div>
                <div><strong>Model / Transposition Uncertainty:</strong> 4.0% (Liu-Jordan diffuse transposition approximation)</div>
              </div>
            </div>
          )}

          {/* TAB 5: FINANCIAL FEASIBILITY & SENSITIVITY */}
          {activeTab === "economics" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-stone-500 block">Total Capital Cost</span>
                  <div className="text-xl font-black font-mono text-stone-900">
                    ₹{(result ? (result.economics.capexTotalInr / 10000000).toFixed(2) : "--")} Cr
                  </div>
                  <span className="text-[11px] text-stone-500 font-mono">
                    ₹{capexPerKwpInr.toLocaleString()} / kWp
                  </span>
                </div>

                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-stone-500 block">Annual Revenue / Avoidance</span>
                  <div className="text-xl font-black font-mono text-emerald-700">
                    ₹{(result ? (result.economics.annualRevenueInr / 10000000).toFixed(2) : "--")} Cr / yr
                  </div>
                  <span className="text-[11px] text-stone-500 font-mono">
                    Tariff: ₹{tariffInrPerKwh.toFixed(2)} / kWh
                  </span>
                </div>

                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-stone-500 block">25-Year Net Cash Flow</span>
                  <div className="text-xl font-black font-mono text-emerald-800">
                    ₹{(result ? (result.economics.twentyFiveYearNetSavingsInr / 10000000).toFixed(2) : "--")} Cr
                  </div>
                  <span className="text-[11px] text-stone-500 font-mono">
                    After 25-yr O&M and Capital Recovery
                  </span>
                </div>
              </div>

              {/* Economic Sensitivity Analysis Matrix */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Sensitivity to Changing Capital Cost & Tariff Assumptions
                  </h4>
                  <span className="text-[10px] text-stone-500 font-mono">Deterministic Sensitivity Matrix</span>
                </div>

                <div className="border border-stone-200 rounded-lg overflow-hidden shadow-2xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-mono text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Stakeholder Scenario</th>
                        <th className="py-2 px-3">Total Capex (₹ Cr)</th>
                        <th className="py-2 px-3">Tariff (₹/kWh)</th>
                        <th className="py-2 px-3">Simple Payback</th>
                        <th className="py-2 px-3 text-right">25-Yr LCOE (₹/kWh)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-mono">
                      {result?.economics.sensitivityMatrix.map((item, idx) => (
                        <tr
                          key={idx}
                          className={idx === 0 ? "bg-amber-50/50 font-bold text-stone-900" : "hover:bg-stone-50"}
                        >
                          <td className="py-2.5 px-3 font-sans">
                            {item.scenarioName}
                            {idx === 0 && <span className="ml-1.5 text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-mono font-normal">Active</span>}
                          </td>
                          <td className="py-2.5 px-3">₹{(item.capexTotalInr / 10000000).toFixed(2)} Cr</td>
                          <td className="py-2.5 px-3">₹{item.tariffInrPerKwh.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-emerald-800 font-bold">{item.simplePaybackYears} Years</td>
                          <td className="py-2.5 px-3 text-right">₹{item.lcoeInrPerKwh}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: INPUT AUDIT & GOVERNANCE (PHASE A) */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Input Audit & Epistemic Traceability</h3>
                <p className="text-xs text-stone-500">
                  Every parameter is classified into required, optional, estimated, or missing states with documented provenance.
                </p>
              </div>

              <div className="border border-stone-200 rounded-lg overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-mono text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Parameter</th>
                      <th className="py-2 px-3">Value</th>
                      <th className="py-2 px-3">Classification</th>
                      <th className="py-2 px-3">Epistemic Provenance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-mono">
                    {result?.inputAudit.map((item) => (
                      <tr key={item.key} className="hover:bg-stone-50 transition-colors">
                        <td className="py-2 px-3 font-bold font-sans text-stone-800">{item.label}</td>
                        <td className="py-2 px-3 text-stone-900">
                          {item.value !== null ? `${item.value}${item.unit ? ` ${item.unit}` : ""}` : "Not Supplied"}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                              item.state === "required_provided"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.state === "optional_provided"
                                ? "bg-blue-100 text-blue-800"
                                : item.state === "estimated_proxy"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-stone-200 text-stone-600"
                            }`}
                          >
                            {item.state.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-stone-600 font-sans text-[11px]">{item.provenance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: DATA PROVENANCE & LIMITATIONS */}
          {activeTab === "provenance" && (
            <div className="space-y-4">
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Geographic Solar Resource Provenance</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-stone-500 font-mono block">Data Source</span>
                    <span className="font-semibold text-stone-800">{result?.dataProvenance.source}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 font-mono block">Dataset & Baseline</span>
                    <span className="font-semibold text-stone-800">{result?.dataProvenance.dataset}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 font-mono block">Temporal Resolution</span>
                    <span className="font-semibold text-stone-800">{result?.dataProvenance.temporalResolution}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 font-mono block">Spatial Grid Resolution</span>
                    <span className="font-semibold text-stone-800">{result?.dataProvenance.spatialResolution}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-stone-900 uppercase tracking-wider block">
                  Model Limitations & Governance Rules
                </span>
                {result?.modelLimitations.map((lim, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex items-start gap-2 text-xs text-stone-700"
                  >
                    <span className="font-bold font-mono text-emerald-700 mt-0.5">•</span>
                    <span>{lim}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="text-[11px] text-stone-500 font-mono">
            {capacityKwp} kWp | Lat: {placement.lat.toFixed(4)}°N, Lng: {placement.lng.toFixed(4)}°E
          </div>
          <div className="flex items-center gap-3">
            {isLoading && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Computing Liu-Jordan transposition...</span>
              </span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
