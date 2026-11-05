"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ProvenanceTag } from "@/components/ui/ProvenanceTag";
import { OptimizeResult, SelectedCellResult } from "@/server/priority/optimizer";
import {
  X,
  GitCompare,
  Sliders,
  TrendingDown,
  Users,
  Flame,
  Layers,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface TwoScenarioComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBudgetA?: number;
  initialTargetNdviA?: number;
  initialObjectiveA?: "cooling" | "population_weighted";
  initialWardA?: string;
}

export const TwoScenarioComparisonModal: React.FC<TwoScenarioComparisonModalProps> = ({
  isOpen,
  onClose,
  initialBudgetA = 10.0,
  initialTargetNdviA = 0.65,
  initialObjectiveA = "cooling",
  initialWardA = "All",
}) => {
  // Scenario A Controls
  const [budgetA, setBudgetA] = useState<number>(initialBudgetA);
  const [targetNdviA, setTargetNdviA] = useState<number>(initialTargetNdviA);
  const [objectiveA, setObjectiveA] = useState<"cooling" | "population_weighted">(initialObjectiveA);
  const [wardA, setWardA] = useState<string>(initialWardA);

  // Scenario B Controls
  const [budgetB, setBudgetB] = useState<number>(Math.min(30.0, initialBudgetA * 2));
  const [targetNdviB, setTargetNdviB] = useState<number>(0.75);
  const [objectiveB, setObjectiveB] = useState<"cooling" | "population_weighted">("population_weighted");
  const [wardB, setWardB] = useState<string>("All");

  // Results State
  const [resultA, setResultA] = useState<OptimizeResult | null>(null);
  const [resultB, setResultB] = useState<OptimizeResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Available PMC Wards
  const wards = [
    "All",
    "Kasba Peth - Somwar Peth",
    "Shivajinagar - Gokhale Nagar",
    "Kothrud - Bavdhan",
    "Hadapsar - Mundhwa",
    "Aundh - Baner",
    "Bibwewadi",
  ];

  // Run optimization for both scenarios
  const runComparison = useCallback(async () => {
    try {
      setIsLoading(true);
      const [resA, resB] = await Promise.all([
        fetch("/api/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            budget_ha: budgetA,
            target_ndvi: targetNdviA,
            objective: objectiveA,
            ward: wardA === "All" ? undefined : wardA,
          }),
        }),
        fetch("/api/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            budget_ha: budgetB,
            target_ndvi: targetNdviB,
            objective: objectiveB,
            ward: wardB === "All" ? undefined : wardB,
          }),
        }),
      ]);

      if (resA.ok) {
        const jsonA = await resA.json();
        setResultA(jsonA.data);
      }
      if (resB.ok) {
        const jsonB = await resB.json();
        setResultB(jsonB.data);
      }
    } catch (err) {
      console.error("Failed to run scenario comparison:", err);
    } finally {
      setIsLoading(false);
    }
  }, [budgetA, targetNdviA, objectiveA, wardA, budgetB, targetNdviB, objectiveB, wardB]);

  // Initial fetch and debounced re-fetch
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        runComparison();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, budgetA, targetNdviA, objectiveA, wardA, budgetB, targetNdviB, objectiveB, wardB, runComparison]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Compute portfolio metrics for A
  const cellsA = resultA?.selected_cells || [];
  const countA = cellsA.length;
  const allocA = resultA?.allocated_ha || 0;
  const meanCoolingA = countA > 0
    ? cellsA.reduce((acc, c) => acc + (c.cooling_mean || 0), 0) / countA
    : 0;
  const p10CoolingA = countA > 0
    ? cellsA.reduce((acc, c) => acc + (c.cooling_p10 || 0), 0) / countA
    : 0;
  const p90CoolingA = countA > 0
    ? cellsA.reduce((acc, c) => acc + (c.cooling_p90 || 0), 0) / countA
    : 0;
  const popA = cellsA.reduce((acc, c) => acc + (c.population || 0), 0);

  // Compute portfolio metrics for B
  const cellsB = resultB?.selected_cells || [];
  const countB = cellsB.length;
  const allocB = resultB?.allocated_ha || 0;
  const meanCoolingB = countB > 0
    ? cellsB.reduce((acc, c) => acc + (c.cooling_mean || 0), 0) / countB
    : 0;
  const p10CoolingB = countB > 0
    ? cellsB.reduce((acc, c) => acc + (c.cooling_p10 || 0), 0) / countB
    : 0;
  const p90CoolingB = countB > 0
    ? cellsB.reduce((acc, c) => acc + (c.cooling_p90 || 0), 0) / countB
    : 0;
  const popB = cellsB.reduce((acc, c) => acc + (c.population || 0), 0);

  // Overlap analysis
  const idsA = new Set(cellsA.map((c) => c.id));
  const idsB = new Set(cellsB.map((c) => c.id));
  const commonIds = new Set([...idsA].filter((id) => idsB.has(id)));
  const uniqueToA = [...idsA].filter((id) => !idsB.has(id));
  const uniqueToB = [...idsB].filter((id) => !idsA.has(id));

  // Deltas (B minus A)
  const deltaAlloc = allocB - allocA;
  const deltaCount = countB - countA;
  const deltaMeanCooling = meanCoolingB - meanCoolingA;
  const deltaPop = popB - popA;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-5xl max-h-[90vh] bg-stone-900 border border-stone-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-stone-100 font-sans">
        {/* Header */}
        <div className="p-4 border-b border-stone-800 bg-stone-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800">
              <GitCompare className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Two-Scenario Comparative Evaluation</span>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                  Heat Priority Engine
                </span>
              </h2>
              <p className="text-[11px] text-stone-400">
                Compare trade-offs in budget allocation, cooling relief, and population reach across alternative policy scenarios.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runComparison}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Simulating..." : "Recalculate Both"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Comparison Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Controls Side-by-Side Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scenario A Controls */}
            <div className="p-3.5 rounded-lg bg-stone-950/90 border border-emerald-900/60 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Scenario A (Baseline Option)</span>
                </span>
                <span className="text-[11px] font-mono text-stone-400">
                  {allocA.toFixed(1)} / {budgetA.toFixed(1)} ha allocated
                </span>
              </div>

              {/* Hectare Budget A */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-stone-300 font-semibold">Budget (ha)</span>
                  <span className="font-mono text-emerald-400 font-bold">{budgetA.toFixed(1)} ha</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="50.0"
                  step="0.5"
                  value={budgetA}
                  onChange={(e) => setBudgetA(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Greening Target A */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-stone-300 font-semibold">Target NDVI</span>
                  <span className="font-mono text-teal-400 font-bold">{targetNdviA.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="0.85"
                  step="0.05"
                  value={targetNdviA}
                  onChange={(e) => setTargetNdviA(parseFloat(e.target.value))}
                  className="w-full accent-teal-500 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Objective A */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setObjectiveA("cooling")}
                  className={`py-1.5 px-2 rounded font-medium border text-center transition-colors ${
                    objectiveA === "cooling"
                      ? "bg-emerald-950/80 border-emerald-600 text-emerald-300 font-bold"
                      : "bg-stone-900 border-stone-800 text-stone-400"
                  }`}
                >
                  Direct Cooling
                </button>
                <button
                  type="button"
                  onClick={() => setObjectiveA("population_weighted")}
                  className={`py-1.5 px-2 rounded font-medium border text-center transition-colors ${
                    objectiveA === "population_weighted"
                      ? "bg-emerald-950/80 border-emerald-600 text-emerald-300 font-bold"
                      : "bg-stone-900 border-stone-800 text-stone-400"
                  }`}
                >
                  Pop-Weighted Relief
                </button>
              </div>

              {/* Ward A */}
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-400">Ward Filter:</span>
                <select
                  value={wardA}
                  onChange={(e) => setWardA(e.target.value)}
                  className="bg-stone-900 border border-stone-800 text-stone-200 rounded px-2 py-1 text-xs"
                >
                  {wards.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scenario B Controls */}
            <div className="p-3.5 rounded-lg bg-stone-950/90 border border-sky-900/60 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <span className="text-xs font-extrabold text-sky-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <span>Scenario B (Alternative Policy)</span>
                </span>
                <span className="text-[11px] font-mono text-stone-400">
                  {allocB.toFixed(1)} / {budgetB.toFixed(1)} ha allocated
                </span>
              </div>

              {/* Hectare Budget B */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-stone-300 font-semibold">Budget (ha)</span>
                  <span className="font-mono text-sky-400 font-bold">{budgetB.toFixed(1)} ha</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="50.0"
                  step="0.5"
                  value={budgetB}
                  onChange={(e) => setBudgetB(parseFloat(e.target.value))}
                  className="w-full accent-sky-500 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Greening Target B */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-stone-300 font-semibold">Target NDVI</span>
                  <span className="font-mono text-teal-400 font-bold">{targetNdviB.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="0.85"
                  step="0.05"
                  value={targetNdviB}
                  onChange={(e) => setTargetNdviB(parseFloat(e.target.value))}
                  className="w-full accent-teal-500 h-1.5 bg-stone-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Objective B */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setObjectiveB("cooling")}
                  className={`py-1.5 px-2 rounded font-medium border text-center transition-colors ${
                    objectiveB === "cooling"
                      ? "bg-sky-950/80 border-sky-600 text-sky-300 font-bold"
                      : "bg-stone-900 border-stone-800 text-stone-400"
                  }`}
                >
                  Direct Cooling
                </button>
                <button
                  type="button"
                  onClick={() => setObjectiveB("population_weighted")}
                  className={`py-1.5 px-2 rounded font-medium border text-center transition-colors ${
                    objectiveB === "population_weighted"
                      ? "bg-sky-950/80 border-sky-600 text-sky-300 font-bold"
                      : "bg-stone-900 border-stone-800 text-stone-400"
                  }`}
                >
                  Pop-Weighted Relief
                </button>
              </div>

              {/* Ward B */}
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-400">Ward Filter:</span>
                <select
                  value={wardB}
                  onChange={(e) => setWardB(e.target.value)}
                  className="bg-stone-900 border border-stone-800 text-stone-200 rounded px-2 py-1 text-xs"
                >
                  {wards.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Comparative Metrics Summary Table with Deltas */}
          <div className="p-3.5 rounded-lg bg-stone-950 border border-stone-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-stone-200 uppercase tracking-wider font-mono">
                Comparative Portfolio Outcomes & Policy Deltas
              </span>
              <div className="flex items-center gap-1.5 text-[11px]">
                <ProvenanceTag type="Modelled" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-stone-800 text-[11px] text-stone-400 uppercase">
                    <th className="py-1.5">Indicator</th>
                    <th className="py-1.5 text-emerald-400">Scenario A</th>
                    <th className="py-1.5 text-sky-400">Scenario B</th>
                    <th className="py-1.5 text-stone-300">Delta (B − A)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-900">
                  <tr>
                    <td className="py-2 text-stone-300 font-sans font-medium">Allocated Footprint</td>
                    <td className="py-2 text-emerald-300 font-bold">{allocA.toFixed(1)} ha</td>
                    <td className="py-2 text-sky-300 font-bold">{allocB.toFixed(1)} ha</td>
                    <td className="py-2 font-bold text-stone-200">
                      {deltaAlloc >= 0 ? `+${deltaAlloc.toFixed(1)} ha` : `${deltaAlloc.toFixed(1)} ha`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-stone-300 font-sans font-medium">Selected Zones Count</td>
                    <td className="py-2 text-emerald-300 font-bold">{countA} cells ({countA * 6.25} ha)</td>
                    <td className="py-2 text-sky-300 font-bold">{countB} cells ({countB * 6.25} ha)</td>
                    <td className="py-2 font-bold text-stone-200">
                      {deltaCount >= 0 ? `+${deltaCount} cells` : `${deltaCount} cells`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-stone-300 font-sans font-medium">Expected Mean Cooling</td>
                    <td className="py-2 text-emerald-300 font-bold">+{meanCoolingA.toFixed(2)} °C</td>
                    <td className="py-2 text-sky-300 font-bold">+{meanCoolingB.toFixed(2)} °C</td>
                    <td className="py-2 font-bold text-stone-200">
                      {deltaMeanCooling >= 0 ? `+${deltaMeanCooling.toFixed(2)} °C` : `${deltaMeanCooling.toFixed(2)} °C`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-stone-300 font-sans font-medium">Cooling Range (P10 – P90)</td>
                    <td className="py-2 text-emerald-400/80">+{p10CoolingA.toFixed(2)} to +{p90CoolingA.toFixed(2)} °C</td>
                    <td className="py-2 text-sky-400/80">+{p10CoolingB.toFixed(2)} to +{p90CoolingB.toFixed(2)} °C</td>
                    <td className="py-2 text-stone-400">Uncertainty interval</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-stone-300 font-sans font-medium">Benefited Population</td>
                    <td className="py-2 text-emerald-300 font-bold">{popA.toLocaleString()} residents</td>
                    <td className="py-2 text-sky-300 font-bold">{popB.toLocaleString()} residents</td>
                    <td className="py-2 font-bold text-stone-200">
                      {deltaPop >= 0 ? `+${deltaPop.toLocaleString()}` : `${deltaPop.toLocaleString()}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Zone Overlap & Invariance Analysis */}
          <div className="p-3.5 rounded-lg bg-stone-950 border border-stone-800 space-y-2">
            <h3 className="font-bold text-xs text-stone-200 uppercase tracking-wider font-mono flex items-center justify-between">
              <span>Zone Selection Stability & Overlap Analysis</span>
              <span className="text-[11px] text-stone-400 normal-case">
                {commonIds.size} invariant zones selected in both
              </span>
            </h3>

            <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
              <div className="p-2.5 rounded bg-stone-900 border border-emerald-900/60">
                <div className="text-[11px] text-emerald-400 font-bold">Core Invariant Zones</div>
                <div className="text-base font-extrabold text-white mt-0.5">{commonIds.size} cells</div>
                <div className="text-[11px] text-stone-400 mt-0.5">High-confidence across both configurations</div>
              </div>

              <div className="p-2.5 rounded bg-stone-900 border border-stone-800">
                <div className="text-[11px] text-emerald-400 font-semibold">Unique to Scenario A</div>
                <div className="text-base font-extrabold text-stone-300 mt-0.5">{uniqueToA.length} cells</div>
                <div className="text-[11px] text-stone-400 mt-0.5">Excluded under Scenario B objective/budget</div>
              </div>

              <div className="p-2.5 rounded bg-stone-900 border border-stone-800">
                <div className="text-[11px] text-sky-400 font-semibold">Unique to Scenario B</div>
                <div className="text-base font-extrabold text-stone-300 mt-0.5">{uniqueToB.length} cells</div>
                <div className="text-[11px] text-stone-400 mt-0.5">Added under expanded Scenario B budget</div>
              </div>
            </div>
          </div>

          {/* Scientific Disclaimer */}
          <div className="p-3 rounded bg-stone-950/80 border border-stone-800/80 text-[11px] text-stone-400 leading-normal flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong>Methodological Principles:</strong> All scenario comparisons use physical units (hectares, degrees Celsius, population counts). No arbitrary weighted composite scores. Unknown values stay null. LST is radiometric surface skin temperature, not 2m ambient air temperature. Prioritization supports exploratory planning; structural and municipal approvals remain mandatory.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-stone-800 bg-stone-950/80 flex items-center justify-between text-xs text-stone-400">
          <span className="font-mono text-[11px]">
            Monte Carlo 30-member spatial block bootstrap ensemble comparison
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
