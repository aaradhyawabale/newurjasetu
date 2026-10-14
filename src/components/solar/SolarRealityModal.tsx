"use client";

import React, { useState, useEffect } from "react";
import {
  Sun,
  Zap,
  TrendingUp,
  BarChart3,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Info,
  X,
  Loader2,
  Sliders,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { SolarRealityResult, MonthlyProductionBreakdown } from "@/server/solar/types";

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
  const [panelTiltDeg, setPanelTiltDeg] = useState<number>(placement.params?.panelTiltDeg ?? 22);
  const [tariffInrPerKwh, setTariffInrPerKwh] = useState<number>(6.50);
  const [capexPerKwpInr, setCapexPerKwpInr] = useState<number>(42000);
  const [soilingLossPct, setSoilingLossPct] = useState<number>(2.5);
  const [shadingLossPct, setShadingLossPct] = useState<number>(2.0);

  // API execution state
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SolarRealityResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"monthly" | "losses" | "economics" | "provenance">("monthly");
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);

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
          panelTiltDeg,
          tariffPerKwhInr: tariffInrPerKwh,
          capexPerKwpInr,
          soilingLossPct,
          shadingLossPct,
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
  }, [isOpen, capacityKwp, panelTiltDeg, tariffInrPerKwh, capexPerKwpInr, soilingLossPct, shadingLossPct]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-linear-to-r from-emerald-50 via-teal-50 to-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600/10 border border-emerald-300 flex items-center justify-center text-emerald-700">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">
                  Solar Reality — Electricity Generation & Feasibility
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  NASA Climatology Model
                </span>
              </div>
              <p className="text-xs text-stone-600">
                Defensible energy yield estimation, Liu-Jordan tilt transposition, and 25-year LCOE economics
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-4 bg-stone-50 border-b border-stone-200">
          <div className="p-3 bg-white rounded-lg border border-stone-200 shadow-2xs">
            <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
              Annual Generation
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
              System PR: {result ? `${(result.systemPerformanceRatio * 100).toFixed(1)}%` : "--"}
            </span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-stone-200 shadow-2xs">
            <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
              Simple Payback
            </span>
            <div className="text-xl font-black font-mono text-stone-900 mt-0.5">
              {result ? `${result.economics.simplePaybackYears} Years` : "--"}
            </div>
            <span className="text-[11px] text-stone-500 font-mono">
              LCOE: ₹{result ? result.economics.lcoeInrPerKwh : "--"}/kWh
            </span>
          </div>
        </div>

        {/* Collapsible Assumptions Config Drawer */}
        {showConfigDrawer && (
          <div className="px-6 py-4 bg-amber-50/50 border-b border-amber-200 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                System & Economic Assumptions
              </span>
              <span className="text-[11px] text-amber-700 italic">
                Adjust assumptions to immediately re-evaluate generation and financial returns.
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
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
                <label className="text-[10px] font-semibold text-stone-600 block mb-1">Soiling Loss (%)</label>
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

              <div>
                <label className="text-[10px] font-semibold text-stone-600 block mb-1">Shading Loss (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  value={shadingLossPct}
                  onChange={(e) => setShadingLossPct(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs border border-stone-300 rounded bg-white font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-6 gap-2">
          {[
            { id: "monthly", label: "Monthly Generation Profile", icon: BarChart3 },
            { id: "losses", label: "System Loss Waterfall", icon: Layers },
            { id: "economics", label: "Financial Feasibility & Sensitivity", icon: DollarSign },
            { id: "provenance", label: "Data Provenance & Limitations", icon: Info },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors ${
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

          {/* TAB 1: MONTHLY GENERATION PROFILE */}
          {activeTab === "monthly" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">12-Month Generation Breakdown</h3>
                  <p className="text-xs text-stone-500">
                    Accounts for Liu-Jordan Plane-of-Array (POA) tilt transposition and monthly temperature derate.
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-stone-700 bg-stone-100 px-2.5 py-1 rounded border border-stone-200">
                  Tilt: {panelTiltDeg}° | Lat: {placement.lat.toFixed(2)}°N
                </span>
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
                        <td className="py-2 px-3 font-bold font-sans text-stone-800">{row.month}</td>
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
              <div>
                <h3 className="text-sm font-bold text-stone-900">Decomposed System Loss Waterfall</h3>
                <p className="text-xs text-stone-500">
                  Every loss factor is modeled explicitly with no double-counting, yielding an overall PR of{" "}
                  <strong>{result ? `${(result.systemPerformanceRatio * 100).toFixed(1)}%` : "--"}</strong>.
                </p>
              </div>

              <div className="space-y-2.5">
                {result?.lossWaterfall.map((loss) => (
                  <div
                    key={loss.id}
                    className="p-3.5 bg-white border border-stone-200 rounded-lg shadow-2xs space-y-1.5"
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

          {/* TAB 3: FINANCIAL FEASIBILITY & SENSITIVITY */}
          {activeTab === "economics" && (
            <div className="space-y-6">
              {/* Top Financial Breakdown Cards */}
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

              {/* Economic Disclaimer Banner */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p>{result?.economics.economicDisclaimer}</p>
              </div>
            </div>
          )}

          {/* TAB 4: DATA PROVENANCE & LIMITATIONS */}
          {activeTab === "provenance" && (
            <div className="space-y-4">
              {/* Provenance Card */}
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

              {/* Epistemic Model Limitations */}
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
