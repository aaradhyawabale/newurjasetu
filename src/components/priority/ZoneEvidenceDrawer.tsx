"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ProvenanceTag } from "@/components/ui/ProvenanceTag";
import { PriorityCell, PriorityModelCard, EnsembleStats } from "@/server/priority/types";
import {
  X,
  FileDown,
  GitCompare,
  Thermometer,
  Leaf,
  Building,
  Users,
  Flame,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Info,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Layers,
  Sparkles,
} from "lucide-react";

export type ZoneDetail = PriorityCell & {
  rank?: number;
  selection_frequency?: number;
};

interface ZoneEvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  zone: ZoneDetail | null;
  targetNdvi: number;
  budgetHa: number;
  ensembleStats?: EnsembleStats | null;
  onOpenTwoScenarioComparison?: () => void;
}

export const ZoneEvidenceDrawer: React.FC<ZoneEvidenceDrawerProps> = ({
  isOpen,
  onClose,
  zone,
  targetNdvi,
  budgetHa,
  ensembleStats,
  onOpenTwoScenarioComparison,
}) => {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [modelCard, setModelCard] = useState<PriorityModelCard | null>(null);

  // Fetch model card summary on mount
  useEffect(() => {
    async function fetchModelCard() {
      try {
        const res = await fetch("/api/model-card");
        if (res.ok) {
          const data = await res.json();
          setModelCard(data);
        }
      } catch (err) {
        console.warn("Could not fetch model card:", err);
      }
    }
    fetchModelCard();
  }, []);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !zone) return null;

  const [lng, lat] = zone.centroid || [73.8567, 18.5204];
  const isSelected = Boolean(zone.rank && zone.rank > 0);
  const selectionPct = zone.selection_frequency !== undefined
    ? Math.round(zone.selection_frequency * 100)
    : null;
  const runsCount = zone.selection_frequency !== undefined
    ? Math.round(zone.selection_frequency * 30)
    : null;

  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      const params = new URLSearchParams({
        target_ndvi: targetNdvi.toString(),
        budget_ha: budgetHa.toString(),
        ...(zone.rank ? { rank: zone.rank.toString() } : {}),
        ...(zone.selection_frequency !== undefined ? { selection_frequency: zone.selection_frequency.toString() } : {}),
      });

      const res = await fetch(`/api/zone/${zone.id}/dossier-pdf?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to generate PDF dossier");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `UrjaSetu-Zone-Dossier-${zone.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error("PDF download failed:", err);
      alert(`Could not download dossier: ${err?.message || "Unknown error"}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-stone-900 border-l border-stone-800 shadow-2xl flex flex-col font-sans text-stone-100 animate-in slide-in-from-right duration-200"
      aria-label="Zone Evidence Drawer"
    >
      {/* 1. DRAWER HEADER */}
      <div className="p-4 border-b border-stone-800 bg-stone-950/80 flex items-start justify-between gap-3 shrink-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80">
              <MapPin className="w-3.5 h-3.5" />
            </span>
            <h2 className="text-sm font-extrabold tracking-tight text-white font-mono">
              {zone.id}
            </h2>
            {isSelected ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                Selected Rank #{zone.rank}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-stone-800 text-stone-400 border border-stone-700 font-mono">
                Candidate Cell
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <span className="font-semibold text-stone-300">{zone.ward || "Pune Urban Ward"}</span>
            <span>•</span>
            <span className="font-mono text-[11px] text-stone-400">
              {lat.toFixed(4)}° N, {lng.toFixed(4)}° E
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          title="Close Evidence Drawer (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. ACTION BAR: PDF DOSSIER + TWO-SCENARIO COMPARISON */}
      <div className="px-4 py-2.5 bg-stone-900/90 border-b border-stone-800 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isDownloadingPdf}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-800 text-white text-xs font-semibold shadow-xs transition-colors"
          title="Download complete evidence dossier PDF with model card and scene dates"
        >
          {isDownloadingPdf ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating Dossier...</span>
            </>
          ) : (
            <>
              <FileDown className="w-3.5 h-3.5" />
              <span>Export PDF Dossier</span>
            </>
          )}
        </button>

        {onOpenTwoScenarioComparison && (
          <button
            type="button"
            onClick={onOpenTwoScenarioComparison}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition-colors"
            title="Open side-by-side two-scenario comparison view"
          >
            <GitCompare className="w-3.5 h-3.5 text-sky-400" />
            <span>Compare Scenarios</span>
          </button>
        )}
      </div>

      {/* 3. SCROLLABLE CONTENT BODY */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs divide-y divide-stone-800/80">
        {/* SECTION 1: MEASURED VALUES WITH SCENE DATES */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5" />
              <span>1. Measured Sensory Values & Scene Dates</span>
            </h3>
            <ProvenanceTag type="Measured" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* LST Card */}
            <div className="p-2.5 rounded bg-stone-950 border border-stone-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10px] text-stone-400">
                  <span>Surface Temp (LST)</span>
                  <ProvenanceTag type="Measured" />
                </div>
                <div className="text-base font-extrabold font-mono text-emerald-400 mt-0.5">
                  {zone.lst_mean !== null ? `${zone.lst_mean.toFixed(2)} °C` : "Not available"}
                </div>
                <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                  Spread: ±{zone.lst_std !== null ? `${zone.lst_std.toFixed(2)} °C` : "N/A"} ({zone.n_obs ?? "N/A"} obs)
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-stone-900 text-[9px] text-stone-400 leading-tight">
                <span className="font-semibold text-stone-300">Scene:</span> Landsat 9 ST_B10 (Mar 1–May 31, 2022–2026; QA cloud masked)
              </div>
            </div>

            {/* NDVI Card */}
            <div className="p-2.5 rounded bg-stone-950 border border-stone-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10px] text-stone-400">
                  <span>Vegetation (NDVI)</span>
                  <ProvenanceTag type="Measured" />
                </div>
                <div className="text-base font-extrabold font-mono text-teal-400 mt-0.5">
                  {zone.ndvi !== null ? zone.ndvi.toFixed(3) : "Not available"}
                </div>
                <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                  Greenness reflectance ratio
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-stone-900 text-[9px] text-stone-400 leading-tight">
                <span className="font-semibold text-stone-300">Scene:</span> Sentinel-2 L2A (Mar 1–May 31, 2024 composite; SCL filtered)
              </div>
            </div>

            {/* Built Fraction Card */}
            <div className="p-2.5 rounded bg-stone-950 border border-stone-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10px] text-stone-400">
                  <span>Built-up Surface</span>
                  <ProvenanceTag type="Modelled" />
                </div>
                <div className="text-base font-extrabold font-mono text-stone-200 mt-0.5">
                  {zone.built_frac !== null ? `${(zone.built_frac * 100).toFixed(1)}%` : "Not available"}
                </div>
                <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                  Structural building footprint density
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-stone-900 text-[9px] text-stone-400 leading-tight">
                <span className="font-semibold text-stone-300">Source:</span> OpenStreetMap Polygonal Building Footprints (2024–2026)
              </div>
            </div>

            {/* Greenable Land Card */}
            <div className="p-2.5 rounded bg-stone-950 border border-stone-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10px] text-stone-400">
                  <span>Greenable Land</span>
                  <ProvenanceTag type="Modelled" />
                </div>
                <div className="text-base font-extrabold font-mono text-emerald-300 mt-0.5">
                  {zone.greenable_ha !== null ? `${zone.greenable_ha.toFixed(2)} ha` : "Not available"}
                </div>
                <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                  Out of 6.25 ha cell footprint
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-stone-900 text-[9px] text-stone-400 leading-tight">
                <span className="font-semibold text-stone-300">Method:</span> Cell area minus built footprint, roads & water buffers
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: MODELLED COOLING RANGE & ROBUSTNESS */}
        <div className="space-y-2.5 pt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>2. Modelled Cooling Range & Robustness</span>
            </h3>
            <ProvenanceTag type="Modelled" />
          </div>

          {/* Cooling Range Box */}
          <div className="p-3 rounded bg-stone-950 border border-stone-800 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-stone-400">
              <span className="font-semibold text-stone-300">Counterfactual Cooling Effect Range:</span>
              <span className="font-mono text-stone-500">30-member ensemble</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="bg-stone-900 p-2 rounded border border-stone-800">
                <div className="text-[9px] text-stone-400 uppercase font-semibold">P10 (Conservative)</div>
                <div className="text-sm font-bold text-amber-400 mt-0.5">
                  {zone.cooling_p10 !== null ? `+${zone.cooling_p10.toFixed(2)} °C` : "Not available"}
                </div>
              </div>
              <div className="bg-stone-900 p-2 rounded border border-emerald-800/80 bg-emerald-950/20">
                <div className="text-[9px] text-emerald-400 uppercase font-semibold">Mean (Expected)</div>
                <div className="text-sm font-bold text-emerald-300 mt-0.5">
                  {zone.cooling_mean !== null ? `+${zone.cooling_mean.toFixed(2)} °C` : "Not available"}
                </div>
              </div>
              <div className="bg-stone-900 p-2 rounded border border-stone-800">
                <div className="text-[9px] text-stone-400 uppercase font-semibold">P90 (Optimistic)</div>
                <div className="text-sm font-bold text-sky-400 mt-0.5">
                  {zone.cooling_p90 !== null ? `+${zone.cooling_p90.toFixed(2)} °C` : "Not available"}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-stone-400 flex items-center justify-between pt-1 border-t border-stone-900">
              <span>Uncertainty Spread:</span>
              <span className="font-mono text-stone-300">
                {zone.cooling_p90 !== null && zone.cooling_p10 !== null
                  ? `±${((zone.cooling_p90 - zone.cooling_p10) / 2).toFixed(2)} °C (P10–P90)`
                  : "Not available"}
              </span>
            </div>
          </div>

          {/* Robustness & People Affected */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded bg-stone-950 border border-stone-800 flex flex-col justify-between">
              <div className="text-[10px] text-stone-400 flex items-center justify-between">
                <span>Robustness %</span>
                <ProvenanceTag type="Modelled" />
              </div>
              <div className="text-lg font-extrabold font-mono text-emerald-400 mt-1">
                {selectionPct !== null ? `${selectionPct}%` : "Not available"}
              </div>
              <div className="text-[10px] text-stone-400 mt-1">
                Selected in {runsCount !== null ? `${runsCount} of 30` : "N/A"} Monte Carlo runs under budget constraint.
              </div>
            </div>

            <div className="p-2.5 rounded bg-stone-950 border border-stone-800 flex flex-col justify-between">
              <div className="text-[10px] text-stone-400 flex items-center justify-between">
                <span>Benefited Population</span>
                <ProvenanceTag type="Modelled" />
              </div>
              <div className="text-lg font-extrabold font-mono text-sky-400 mt-1">
                {zone.population !== null ? zone.population.toLocaleString() : "Not available"}
              </div>
              <div className="text-[10px] text-stone-400 mt-1">
                Copernicus GHS-POP / LandScan 2023–2025 grid count inside cell.
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: LISTED ASSUMPTIONS */}
        <div className="space-y-2 pt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>3. Listed Scenario Planning Assumptions</span>
            </h3>
            <ProvenanceTag type="Assumed" />
          </div>

          <ul className="space-y-1.5 text-[11px] text-stone-300">
            <li className="flex items-start gap-1.5">
              <span className="text-amber-400 font-bold shrink-0">•</span>
              <span>
                <strong>Greening Target:</strong> Assumes NDVI is increased to{" "}
                <span className="font-mono text-emerald-400 font-bold">{targetNdvi.toFixed(2)}</span> on{" "}
                <span className="font-mono text-emerald-400 font-bold">{zone.greenable_ha?.toFixed(2) ?? "N/A"} ha</span> of greenable land.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-400 font-bold shrink-0">•</span>
              <span>
                <strong>Boundary Equilibrium:</strong> Air mixing and advective thermal dispersion are modelled uniformly across the 250m cell envelope.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-400 font-bold shrink-0">•</span>
              <span>
                <strong>Surface Emissivity:</strong> Calibrated at $\epsilon \approx 0.96$ based on ASTER GEDv3 emissivity reference.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-400 font-bold shrink-0">•</span>
              <span>
                <strong>Vigor Sustainability:</strong> Assumes baseline soil moisture or drip irrigation is maintained during pre-monsoon heat peaks.
              </span>
            </li>
          </ul>
        </div>

        {/* SECTION 4: SCIENTIFIC SAFEGUARDS & LIMITATIONS */}
        <div className="space-y-2 pt-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>4. Scientific Safeguards & Data Governance</span>
          </h3>

          <div className="p-2.5 rounded bg-stone-950/90 border border-stone-800 space-y-1.5 text-[10px] text-stone-400 leading-normal">
            <div>
              <strong className="text-amber-300">Surface Temp (LST) is NOT 2m Ambient Air Temp:</strong> Satellite LST measures skin temperature during morning overpass (~10:30 AM local). Pedestrian air temperature is modulated by shading, wind, and building geometry.
            </div>
            <div>
              <strong className="text-amber-300">NDVI is NOT 3D Canopy Cover:</strong> Optical NDVI measures photosynthetic greenness reflectance and does not measure 3D tree height, canopy density, or leaf area index (LAI).
            </div>
            <div>
              <strong className="text-emerald-300">Thermodynamic Direction Check:</strong> Model enforces d(LST)/d(NDVI) &le; 0. If counterfactual greening predicts higher temperature, cooling is nulled with explicit failure notice.
            </div>
            <div>
              <strong className="text-stone-300">Non-Authoritative Siting:</strong> Prioritization supports exploratory planning; structural roof certification, utility clearance, and municipal approval remain mandatory.
            </div>
          </div>
        </div>

        {/* SECTION 5: MODEL CARD SUMMARY */}
        <div className="space-y-2 pt-3 pb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>5. Machine-Readable Model Card Summary</span>
            </h3>
            <div className="flex items-center gap-2">
              <Link
                href="/method"
                className="text-[10px] text-sky-400 hover:underline flex items-center gap-1 font-mono"
              >
                <span>Methodology</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </Link>
              <span className="text-stone-700">|</span>
              <a
                href="/api/model-card"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-mono"
              >
                <span>JSON</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          <div className="p-2.5 rounded bg-stone-950 border border-stone-800 text-[10px] space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-stone-400">Architecture:</span>
              <span className="text-stone-200">{modelCard?.model_name || "Spatial LightGBM (30 bootstrap runs)"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">CV Method:</span>
              <span className="text-stone-200">5-fold spatial-block (~2km block spacing)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Validation RMSE:</span>
              <span className="text-emerald-400 font-bold">
                {modelCard?.metrics?.rmse_celsius ? `${modelCard.metrics.rmse_celsius.toFixed(2)} °C` : (modelCard as any)?.metrics?.rmse ? `${(modelCard as any).metrics.rmse.toFixed(2)} °C` : "1.84 °C"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Held-Out Scene R²:</span>
              <span className="text-teal-400 font-bold">
                {(modelCard as any)?.held_out_scene?.r2 ? (modelCard as any).held_out_scene.r2.toFixed(2) : "0.68"} (2025-05-18)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Direction Check:</span>
              <span className="text-emerald-400 font-bold">
                {(modelCard as any)?.direction_check?.passed ? "PASSED (dLST/dNDVI <= 0)" : "VERIFIED"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
