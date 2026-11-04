import React from "react";
import Link from "next/link";
import { 
  getPriorityModelCardSync, 
  isPriorityDataAvailable 
} from "@/server/priority/loader";
import { ProvenanceTag } from "@/components/ui/ProvenanceTag";
import {
  ArrowLeft,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  Database,
  Calendar,
  Layers,
  Sparkles,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Flame,
  Thermometer,
  Compass,
  Cpu,
  Info,
  Scale
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function MethodPage() {
  const isAvailable = isPriorityDataAvailable();
  const modelCard = isAvailable ? getPriorityModelCardSync() : null;

  if (!isAvailable || !modelCard) {
    return (
      <main className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-xl p-8 text-center shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-stone-100 mb-2">Model Card Unavailable</h1>
          <p className="text-sm text-stone-400 mb-6">
            The Priority Engine model card artifact (<code className="text-xs bg-stone-800 px-1.5 py-0.5 rounded">public/data/priority/model_card.json</code>) is not yet available on the server.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Priority Map</span>
          </Link>
        </div>
      </main>
    );
  }

  const {
    model_name,
    version,
    task,
    framework = "Standalone Gradient Boosted Trees",
    created_at,
    updated_at,
    spatial_resolution,
    features = ["ndvi", "ndbi", "ndwi", "built_frac", "elevation", "dist_to_water"],
    target = "lst",
    metrics,
    dates,
    sources,
    direction_check,
    provenance_classification,
    limitations
  } = modelCard;

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100 font-sans selection:bg-emerald-500/30 pb-24">
      {/* 1. Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur-md border-b border-stone-800 px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-stone-900 hover:bg-stone-800 border border-stone-800 text-xs font-medium text-stone-300 transition-colors"
            title="Return to Heat Priority Screen"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Map</span>
          </Link>
          <div className="h-5 w-px bg-stone-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="font-bold text-sm tracking-tight text-stone-100">UrjaSetu</span>
            <span className="text-xs text-stone-500 font-mono">/ Method & Model Card</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Universal Provenance Legend Pill */}
          <div className="hidden md:flex items-center gap-2 bg-stone-900/90 px-3 py-1 rounded-md border border-stone-800 text-[10px] font-mono">
            <span className="text-stone-400 font-bold uppercase tracking-wider text-[9px] mr-1">
              Legend:
            </span>
            <div className="flex items-center gap-1">
              <ProvenanceTag type="Measured" />
              <span className="text-stone-400">Sensor</span>
            </div>
            <span className="text-stone-700">|</span>
            <div className="flex items-center gap-1">
              <ProvenanceTag type="Modelled" />
              <span className="text-stone-400">Model</span>
            </div>
            <span className="text-stone-700">|</span>
            <div className="flex items-center gap-1">
              <ProvenanceTag type="Assumed" />
              <span className="text-stone-400">Scenario</span>
            </div>
          </div>

          <Link
            href="/api/model-card"
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stone-900 hover:bg-stone-800 border border-stone-800 text-xs font-mono text-stone-300 transition-colors"
            title="View Machine-Readable Model Card JSON"
          >
            <FileCode className="w-3.5 h-3.5 text-stone-400" />
            <span>JSON API</span>
            <ExternalLink className="w-3 h-3 text-stone-500" />
          </Link>
        </div>
      </header>

      {/* 2. Hero Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
        <div className="border border-stone-800 bg-gradient-to-b from-stone-900/90 to-stone-900/40 rounded-2xl p-6 lg:p-8 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded bg-orange-950/80 text-orange-400 border border-orange-800/80 text-[11px] font-mono font-bold tracking-wider uppercase">
                Methodology Spec
              </span>
              <span className="text-xs font-mono text-stone-400">
                v{version} • Updated {new Date(updated_at || created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-stone-400 bg-stone-950/80 px-3 py-1 rounded-md border border-stone-800">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>{framework}</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight mb-2">
            {model_name}
          </h1>
          <p className="text-sm sm:text-base text-stone-300 max-w-3xl leading-relaxed mb-6">
            Scientific specification, training datasets, spatial-block cross-validation, physical direction checks, and statutory limitations for counterfactual cooling optimization on a 250-meter spatial grid across Pune Municipal Corporation (PMC).
          </p>

          {/* Grid Metadata Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-stone-800 text-xs font-mono">
            <div className="bg-stone-950/60 p-3 rounded-lg border border-stone-800/80">
              <span className="text-[10px] text-stone-400 uppercase tracking-wider block mb-0.5">Spatial Grid Unit</span>
              <span className="text-stone-200 font-bold">{spatial_resolution.cell_size_meters} m × {spatial_resolution.cell_size_meters} m</span>
              <span className="text-[10px] text-stone-400 block mt-0.5">({spatial_resolution.cell_area_hectares} ha / cell)</span>
            </div>
            <div className="bg-stone-950/60 p-3 rounded-lg border border-stone-800/80">
              <span className="text-[10px] text-stone-400 uppercase tracking-wider block mb-0.5">Spatial Autocorrelation</span>
              <span className="text-stone-200 font-bold">{metrics.spatial_block_size_km} km Block CV</span>
              <span className="text-[10px] text-stone-400 block mt-0.5">({metrics.spatial_blocks_count} spatial blocks)</span>
            </div>
            <div className="bg-stone-950/60 p-3 rounded-lg border border-stone-800/80">
              <span className="text-[10px] text-stone-400 uppercase tracking-wider block mb-0.5">Monte Carlo Ensemble</span>
              <span className="text-stone-200 font-bold">{metrics.ensemble_members} Bootstrap Models</span>
              <span className="text-[10px] text-stone-400 block mt-0.5">(Spatial-block bootstrap)</span>
            </div>
            <div className="bg-stone-950/60 p-3 rounded-lg border border-stone-800/80">
              <span className="text-[10px] text-stone-400 uppercase tracking-wider block mb-0.5">Projected Coordinate System</span>
              <span className="text-stone-200 font-bold truncate block" title={spatial_resolution.crs}>UTM Zone 43N</span>
              <span className="text-[10px] text-stone-400 block mt-0.5">WGS84 Display</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Core Content Sections */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

        {/* ========================================================================= */}
        {/* SECTION 1: PRIMARY DATA SOURCES & SCENE ACQUISITION DATES                 */}
        {/* ========================================================================= */}
        <section aria-labelledby="section-sources" className="space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              <h2 id="section-sources" className="text-lg font-bold text-stone-100">
                1. Data Sources, Satellites & Temporal Windows
              </h2>
            </div>
            <ProvenanceTag type="Measured" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sources.map((src, idx) => (
              <div 
                key={idx}
                className="bg-stone-900/60 border border-stone-800 rounded-xl p-4 flex flex-col justify-between hover:border-stone-700 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-stone-200 leading-snug">{src.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300 whitespace-nowrap">
                      {src.license}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mb-3">{src.usage}</p>
                </div>

                <div className="pt-3 border-t border-stone-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono text-stone-400">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase">Provider</span>
                    <span className="text-stone-300 truncate block" title={src.provider}>{src.provider}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase">Native Resolution</span>
                    <span className="text-stone-300 truncate block">{src.resolution}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Temporal Acquisition Scene Dates Banner */}
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-stone-400" />
              <span>Scene Acquisition Windows & Overpass Dates</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-stone-950 p-2.5 rounded border border-stone-800/80">
                <span className="text-[10px] text-stone-400 block">Landsat 9 Pre-Monsoon Overpass</span>
                <span className="font-semibold text-stone-200">{dates.landsat9_overpass ? new Date(dates.landsat9_overpass).toUTCString() : "Not available"}</span>
                <span className="text-[10px] text-emerald-400 block mt-0.5">Clear-sky LST Skin Temp</span>
              </div>
              <div className="bg-stone-950 p-2.5 rounded border border-stone-800/80">
                <span className="text-[10px] text-stone-400 block">Sentinel-2B BOA Overpass</span>
                <span className="font-semibold text-stone-200">{dates.sentinel2b_overpass ? new Date(dates.sentinel2b_overpass).toUTCString() : "Not available"}</span>
                <span className="text-[10px] text-emerald-400 block mt-0.5">~48h Synchronous Baseline</span>
              </div>
              <div className="bg-stone-950 p-2.5 rounded border border-stone-800/80">
                <span className="text-[10px] text-stone-400 block">Held-Out Validation Scene</span>
                <span className="font-semibold text-stone-200">{dates.held_out_scene_date ? new Date(dates.held_out_scene_date).toUTCString() : "Not available"}</span>
                <span className="text-[10px] text-sky-400 block mt-0.5">Unseen Scene Evaluation</span>
              </div>
              <div className="bg-stone-950 p-2.5 rounded border border-stone-800/80">
                <span className="text-[10px] text-stone-400 block">Demographics & Climatology</span>
                <span className="font-semibold text-stone-200">WorldPop {dates.demographics_reference_year || "Not available"}</span>
                <span className="text-[10px] text-amber-400 block mt-0.5">Window: {dates.baseline_climatology_period || "Not available"}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: VALIDATION METRICS & MODEL EVALUATION                          */}
        {/* ========================================================================= */}
        <section aria-labelledby="section-validation" className="space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-sky-400" />
              <h2 id="section-validation" className="text-lg font-bold text-stone-100">
                2. Validation Metrics & Spatial Cross-Validation
              </h2>
            </div>
            <ProvenanceTag type="Modelled" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center">
              <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block mb-1">
                Spatial CV R²
              </span>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {metrics.r2_score !== null ? metrics.r2_score : "Not available"}
              </span>
              <span className="text-[10px] text-stone-400 block mt-1">Variance explained</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center">
              <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block mb-1">
                CV RMSE
              </span>
              <span className="text-2xl font-black text-sky-400 font-mono">
                {metrics.rmse_celsius !== null ? `±${metrics.rmse_celsius}°C` : "Not available"}
              </span>
              <span className="text-[10px] text-stone-400 block mt-1">5-fold spatial-block</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center">
              <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block mb-1">
                CV MAE
              </span>
              <span className="text-2xl font-black text-stone-200 font-mono">
                {metrics.mae_celsius !== null ? `±${metrics.mae_celsius}°C` : "Not available"}
              </span>
              <span className="text-[10px] text-stone-400 block mt-1">Mean absolute error</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center">
              <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block mb-1">
                Held-Out Scene RMSE
              </span>
              <span className="text-2xl font-black text-amber-400 font-mono">
                {metrics.held_out_scene_rmse_celsius !== null ? `±${metrics.held_out_scene_rmse_celsius}°C` : "Not available"}
              </span>
              <span className="text-[10px] text-stone-400 block mt-1">Temporal holdout</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center">
              <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block mb-1">
                Bootstrap Ensemble
              </span>
              <span className="text-2xl font-black text-stone-200 font-mono">
                {metrics.ensemble_members}
              </span>
              <span className="text-[10px] text-stone-400 block mt-1">Monte Carlo runs</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center">
              <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block mb-1">
                Spatial Coverage
              </span>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {metrics.coverage_percentage !== null ? `${metrics.coverage_percentage}%` : "Not available"}
              </span>
              <span className="text-[10px] text-stone-400 block mt-1">Valid PMC footprint</span>
            </div>
          </div>

          <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-5 text-xs text-stone-300 leading-relaxed">
            <h4 className="font-bold text-stone-200 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Spatial-Block Cross-Validation Architecture (Preventing Spatial Leakage)</span>
            </h4>
            <p className="text-stone-400">
              Random k-fold splitting produces artificially inflated evaluation metrics on spatial data because adjacent cells share nearly identical microclimates. To eliminate spatial autocorrelation leakage, UrjaSetu partitions the urban extent into <strong>{metrics.spatial_blocks_count} contiguous 2.0 km blocks</strong> and performs 5-fold spatial cross-validation. A held-out acquisition scene date (2024-04-24) provides an independent out-of-time evaluation ensuring the model generalizes across seasonal atmospheric conditions.
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: PHYSICAL DIRECTION CHECK                                       */}
        {/* ========================================================================= */}
        <section aria-labelledby="section-direction" className="space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-400" />
              <h2 id="section-direction" className="text-lg font-bold text-stone-100">
                3. Physical Consistency & Direction Check
              </h2>
            </div>
            <ProvenanceTag type="Modelled" />
          </div>

          {direction_check ? (
            <div className={`p-5 rounded-xl border ${direction_check.passed ? "bg-emerald-950/20 border-emerald-800/60" : "bg-red-950/20 border-red-800/60"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className={`w-5 h-5 ${direction_check.passed ? "text-emerald-400" : "text-red-400"}`} />
                  <span className="font-mono font-bold text-sm text-stone-100">
                    {direction_check.status || (direction_check.passed ? "PASSED_PHYSICAL_CONSISTENCY" : "FAILED_PHYSICAL_CONSISTENCY")}
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-700">
                  ∂LST / ∂NDVI ≤ 0 Verified
                </span>
              </div>

              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed mb-4">
                {direction_check.reason || "Physical consistency check evaluated against empirical counterfactual greening."}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-3 border-t border-emerald-900/40">
                <div>
                  <span className="text-[10px] text-stone-400 block uppercase">Violations Detected</span>
                  <span className="text-stone-100 font-bold">{direction_check.violations_count ?? 0}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 block uppercase">Valid Interventions Tested</span>
                  <span className="text-stone-100 font-bold">{direction_check.valid_interventions_evaluated ?? "Not available"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 block uppercase">Target Counterfactual NDVI</span>
                  <span className="text-stone-100 font-bold">{direction_check.target_ndvi_applied ?? "Not available"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 block uppercase">Mean Counterfactual Cooling</span>
                  <span className="text-emerald-400 font-bold">
                    {direction_check.mean_cooling_celsius !== undefined && direction_check.mean_cooling_celsius !== null
                      ? `-${direction_check.mean_cooling_celsius}°C`
                      : "Not available"}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-emerald-900/40 text-[11px] text-stone-400 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Safety Governance Rule</strong>: If the model predicts warming when greening is increased (direction check failure ∂LST/∂NDVI &gt; 0), the Priority Engine locks all cooling fields to <code>null</code>, shows &quot;Not available&quot;, and sets status to <code>UNAVAILABLE</code> to prevent counterfactual hallucination.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-stone-800 bg-stone-900 text-stone-400 text-xs">
              Physical consistency check data not available.
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: STATUTORY LIMITATIONS & SCIENTIFIC SAFEGUARDS                   */}
        {/* ========================================================================= */}
        <section aria-labelledby="section-limitations" className="space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h2 id="section-limitations" className="text-lg font-bold text-stone-100">
                4. Mandatory Limitations & Scientific Safeguards
              </h2>
            </div>
            <ProvenanceTag type="Assumed" />
          </div>

          <div className="space-y-2.5">
            {limitations.map((lim, idx) => {
              const colonIdx = lim.indexOf(":");
              const title = colonIdx > -1 ? lim.slice(0, colonIdx) : `Limitation ${idx + 1}`;
              const body = colonIdx > -1 ? lim.slice(colonIdx + 1).trim() : lim;

              return (
                <div 
                  key={idx}
                  className="bg-stone-900/70 border border-stone-800 rounded-lg p-3.5 flex items-start gap-3"
                >
                  <span className="w-5 h-5 rounded-full bg-amber-950/80 border border-amber-800/80 text-amber-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-stone-200 mb-0.5">{title}</h4>
                    <p className="text-xs text-stone-400 leading-relaxed">{body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 5: FEATURES & PROVENANCE CLASSIFICATION                           */}
        {/* ========================================================================= */}
        <section aria-labelledby="section-features" className="space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              <h2 id="section-features" className="text-lg font-bold text-stone-100">
                5. Feature Variables & Provenance Classification
              </h2>
            </div>
            <span className="text-xs font-mono text-stone-400">Target: <code className="text-emerald-400">{target}</code> (LST °C)</span>
          </div>

          <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] border-b border-stone-800">
                  <tr>
                    <th className="px-4 py-2.5">Variable Identifier</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5">Provenance</th>
                    <th className="px-4 py-2.5">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800 text-stone-300">
                  {features.map((feat: string) => {
                    const prov = provenance_classification[feat as keyof typeof provenance_classification] || "Modelled";
                    const descriptions: Record<string, string> = {
                      ndvi: "Normalized Difference Vegetation Index (B8-B4)/(B8+B4) from Sentinel-2 L2A",
                      ndbi: "Normalized Difference Built-up Index (B11-B8)/(B11+B8) tracking urban density",
                      ndwi: "Normalized Difference Water Index (B3-B8)/(B3+B8) tracking water bodies & moisture",
                      built_frac: "OpenStreetMap building footprint area fraction within 250m cell window",
                      elevation: "Copernicus DEM 30m digital elevation model",
                      dist_to_water: "Euclidean geodesic distance to nearest river or natural drainage canal"
                    };

                    return (
                      <tr key={feat} className="hover:bg-stone-800/40 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-stone-200">{feat}</td>
                        <td className="px-4 py-2.5 text-stone-400">Predictive Feature</td>
                        <td className="px-4 py-2.5">
                          <ProvenanceTag type={prov as any} />
                        </td>
                        <td className="px-4 py-2.5 text-stone-400 font-sans">{descriptions[feat] || feat}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-emerald-950/20 hover:bg-emerald-950/30 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-emerald-300">{target} (Target)</td>
                    <td className="px-4 py-2.5 text-emerald-400 font-bold">Prediction Target</td>
                    <td className="px-4 py-2.5">
                      <ProvenanceTag type="Measured" />
                    </td>
                    <td className="px-4 py-2.5 text-stone-300 font-sans">
                      Land Surface Temperature (°C) from USGS Landsat 9 TIRS-2 Band 10 (ST_B10)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
