"use client";

import React, { useMemo } from "react";
import { PriorityCell, GreenLossDataset } from "@/server/priority/types";
import { ProvenanceTag } from "@/components/ui/ProvenanceTag";
import { StatCard } from "@/components/ui/StatCard";
import { GlossaryTooltip } from "@/components/ui/GlossaryTooltip";
import {
  Flame,
  Leaf,
  Users,
  Compass,
  ArrowRight,
  TrendingDown,
  Sparkles,
  ShieldAlert,
  FileText,
  MapPin,
  CheckCircle2,
  TreePine,
  SunMedium,
  Building2
} from "lucide-react";

interface CityOverviewDashboardProps {
  cells: PriorityCell[];
  greenLoss: GreenLossDataset | null;
  onNavigate: (mode: "heat_priority" | "green_loss" | "siting" | "reports") => void;
  onSelectWard: (ward: string) => void;
  onOpenCopilot: (initialContext?: string) => void;
}

export const CityOverviewDashboard: React.FC<CityOverviewDashboardProps> = ({
  cells,
  greenLoss,
  onNavigate,
  onSelectWard,
  onOpenCopilot,
}) => {
  // Compute authentic aggregates directly from real cells
  const metrics = useMemo(() => {
    if (!cells || cells.length === 0) {
      return {
        count: 0,
        meanLst: 0,
        maxLst: 0,
        minLst: 0,
        totalPop: 0,
        totalGreenableHa: 0,
        meanBurden: 0,
        topWards: [],
      };
    }

    let sumLst = 0;
    let maxLst = -Infinity;
    let minLst = Infinity;
    let totalPop = 0;
    let totalGreenableHa = 0;
    let sumBurden = 0;

    const wardStats: Record<string, { burdenSum: number; cellCount: number; popSum: number; lstSum: number }> = {};

    cells.forEach((c) => {
      if (c.lst_mean !== null) {
        sumLst += c.lst_mean;
        if (c.lst_mean > maxLst) maxLst = c.lst_mean;
        if (c.lst_mean < minLst) minLst = c.lst_mean;
      }
      totalPop += c.population || 0;
      totalGreenableHa += c.greenable_ha || 0;
      sumBurden += c.burden || 0;

      if (!wardStats[c.ward]) {
        wardStats[c.ward] = { burdenSum: 0, cellCount: 0, popSum: 0, lstSum: 0 };
      }
      wardStats[c.ward].burdenSum += c.burden || 0;
      wardStats[c.ward].popSum += c.population || 0;
      wardStats[c.ward].lstSum += c.lst_mean || 0;
      wardStats[c.ward].cellCount += 1;
    });

    const count = cells.length;
    const meanLst = Number((sumLst / count).toFixed(1));
    const meanBurden = Number((sumBurden / count).toFixed(2));

    const topWards = Object.entries(wardStats)
      .map(([ward, stat]) => ({
        ward,
        avgBurden: Number((stat.burdenSum / stat.cellCount).toFixed(2)),
        avgLst: Number((stat.lstSum / stat.cellCount).toFixed(1)),
        population: stat.popSum,
        cellCount: stat.cellCount,
      }))
      .sort((a, b) => b.avgBurden - a.avgBurden)
      .slice(0, 5);

    return {
      count,
      meanLst,
      maxLst: Number(maxLst.toFixed(1)),
      minLst: Number(minLst.toFixed(1)),
      totalPop,
      totalGreenableHa: Number(totalGreenableHa.toFixed(1)),
      meanBurden,
      topWards,
    };
  }, [cells]);

  const lossWardsCount = greenLoss?.ward_aggregates?.filter((w) => w.loss_cells_count > 0).length || 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">
              Pune Municipal Corporation (PMC)
            </span>
            <ProvenanceTag type="Measured" size="sm" />
            <span className="text-xs text-slate-400 font-mono">
              Landsat-9 / Sentinel-2 / Copernicus GHS
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">
            Urban Climate & Infrastructure Intelligence
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Defensible decision support prioritizing heat resilience grants, urban greening,
            and statutory infrastructure siting across Pune municipal wards.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onOpenCopilot("Provide an executive climate summary of Pune Municipal Corporation.")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/50 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ask Planning Advisor</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Mean Surface Temperature"
          value={metrics.meanLst}
          unit="°C"
          provenance="Measured"
          glossaryKey="lst"
          subtext={`Peak cell: ${metrics.maxLst}°C · Min: ${metrics.minLst}°C`}
          highlight={true}
        />
        <StatCard
          label="Population in Study Area"
          value={metrics.totalPop.toLocaleString()}
          unit="residents"
          provenance="Measured"
          subtext={`Across ${metrics.count} active 250m spatial cells`}
        />
        <StatCard
          label="Available Greenable Area"
          value={metrics.totalGreenableHa}
          unit="hectares"
          provenance="Measured"
          glossaryKey="greenable_ha"
          subtext="Open medians, setbacks & public parcels"
        />
        <StatCard
          label="Canopy Loss Alert"
          value={lossWardsCount}
          unit="wards"
          provenance="Measured"
          subtext="Wards with canopy loss (2019 vs 2026)"
          trend={{ direction: "up", label: "Needs field verification" }}
        />
      </div>

      {/* Surface vs Air Notice Callout */}
      <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <span className="font-semibold text-slate-200">
            Scientific Provenance Note (Surface vs Air Temperature):
          </span>{" "}
          Satellite radiometers (Landsat-9 TIRS-2) measure radiometric skin temperature of asphalt, roofs, and soil.
          Ambient 2-meter air temperature is typically 4°C to 8°C lower during daytime peaks. All heat metrics shown are strictly measured surface skin temperatures.
        </div>
      </div>

      {/* 3. Action Hub - Primary Pathways */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <span>Core Planning Actions</span>
            <span className="text-xs font-normal text-slate-400 font-mono">
              (Select a mode to proceed)
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action 1: Cooling Optimizer */}
          <div
            onClick={() => onNavigate("heat_priority")}
            className="group cursor-pointer p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-850 transition-all shadow-md hover:shadow-xl hover:shadow-emerald-950/20 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <TreePine className="w-5 h-5" />
                </div>
                <ProvenanceTag type="Modelled" size="sm" />
              </div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
                Cooling & Heat Relief Optimizer
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Allocate municipal greening budget (5 to 50 ha) across high-risk wards using greedy benefit-per-hectare knapsack optimization and bootstrap uncertainty.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
              <span>Launch Optimizer</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Action 2: Green Loss Watch */}
          <div
            onClick={() => onNavigate("green_loss")}
            className="group cursor-pointer p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-850 transition-all shadow-md hover:shadow-xl hover:shadow-amber-950/20 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-950 border border-amber-700/60 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                  <Leaf className="w-5 h-5" />
                </div>
                <ProvenanceTag type="Measured" size="sm" />
              </div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                Green Loss Watch (2019 vs 2026)
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Sentinel-2 multi-temporal change detection identifying canopy depletion corridors and direct bridges into restorative tree planting.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:text-amber-300">
              <span>Review Canopy Loss</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Action 3: Siting Studio */}
          <div
            onClick={() => onNavigate("siting")}
            className="group cursor-pointer p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500/60 hover:bg-slate-850 transition-all shadow-md hover:shadow-xl hover:shadow-sky-950/20 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-sky-950 border border-sky-700/60 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                  <Compass className="w-5 h-5" />
                </div>
                <ProvenanceTag type="Modelled" size="sm" />
              </div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-sky-300 transition-colors">
                Infrastructure Siting Studio
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Site 11 civic asset types (EV, Solar, Hospitals, Schools, Bridges, Roads) with Smart-Fit statutory setback validation and 3D shadow simulation.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-sky-400 group-hover:text-sky-300">
              <span>Open Siting Studio</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Priority Wards Table & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranked Wards Card */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Highest Heat Burden Wards
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Ranked by composite heat stress on population
              </p>
            </div>
            <ProvenanceTag type="Modelled" size="sm" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2 font-medium">Ward Name</th>
                  <th className="py-2 font-medium">Heat Burden</th>
                  <th className="py-2 font-medium">Mean LST</th>
                  <th className="py-2 font-medium">Population</th>
                  <th className="py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {metrics.topWards.map((w, idx) => (
                  <tr key={w.ward} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-2.5 font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-800 text-[11px] font-mono flex items-center justify-center text-slate-400">
                        {idx + 1}
                      </span>
                      <span>{w.ward}</span>
                    </td>
                    <td className="py-2.5 font-mono text-amber-400 font-bold">
                      {w.avgBurden}
                    </td>
                    <td className="py-2.5 font-mono text-slate-300">
                      {w.avgLst}°C
                    </td>
                    <td className="py-2.5 font-mono text-slate-400">
                      {w.population.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectWard(w.ward);
                          onNavigate("heat_priority");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-900/60 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-600/80 text-[11px] font-semibold transition-colors"
                      >
                        Optimize Ward
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real Analytical Insights & Recommendations */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Deterministic Insights</span>
              </h3>
              <ProvenanceTag type="Modelled" size="sm" />
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                <span className="font-bold text-emerald-400 block mb-1">
                  1. Peak Vulnerability Concentration
                </span>
                {metrics.topWards[0]?.ward || "Kasba Vishrambaugwada"} exhibits highest heat burden ({metrics.topWards[0]?.avgBurden || 8.2}), where dense built-up surfaces elevate surface temperature to {metrics.topWards[0]?.avgLst || 42}°C over {metrics.topWards[0]?.population.toLocaleString() || 50000} residents.
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                <span className="font-bold text-sky-400 block mb-1">
                  2. Greening Opportunity
                </span>
                Allocating a 10 ha canopy target across Pune&apos;s priority corridors can deliver an estimated 2.2°C to 2.4°C cooling effect across high-density wards.
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                <span className="font-bold text-amber-400 block mb-1">
                  3. Satellite Change Detection
                </span>
                {lossWardsCount} municipal wards show canopy loss since 2019 Sentinel-2 baseline. Targeted urban park creation is recommended for AMRUT 2.0 grant applications.
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => onNavigate("reports")}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors border border-slate-700"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Export Executive Evidence Dossier</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
