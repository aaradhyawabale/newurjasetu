"use client";

import React, { useState, useEffect } from "react";
import {
  Flame,
  Trees,
  Info,
  AlertTriangle,
  Layers,
  Calendar,
  Satellite,
  Database,
  BarChart3,
  ShieldCheck,
  X,
  Compass,
  CheckCircle2,
  FileText,
  Activity,
  Droplets,
  Sun,
  Building2,
  ArrowRight,
  BookOpen
} from "lucide-react";
import { ProvenanceTag } from "../ui/ProvenanceTag";

interface HeatIntelligenceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HeatIntelligenceDashboard: React.FC<HeatIntelligenceDashboardProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "lst" | "ndvi" | "quality" | "mitigation">("overview");
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    fetch("/api/heat")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json.status === "OK") {
          setData(json);
        } else {
          setError(json.error || "Failed to load heat intelligence data");
        }
      })
      .catch((err) => {
        console.error("Heat dashboard load error:", err);
        setError("Could not retrieve satellite heat products. Please ensure Phase 3 preprocessed files exist.");
      })
      .finally(() => setIsLoading(false));
  }, [isOpen]);

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

  const diag = data?.diagnostics;
  const landsat = diag?.landsat9;
  const sentinel = diag?.sentinel2b;
  const metadata = diag?.metadata;
  const manifest = data?.manifest;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs select-none">
      <div className="bg-white border border-stone-200 rounded-panel shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-rose-700 flex items-center justify-center text-white shadow-xs">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">Pune Urban Heat & Vegetation Intelligence</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 font-semibold">
                  Landsat 9 + Sentinel-2
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Empirical satellite-derived land surface temperature and multi-spectral vegetation appraisal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-200 text-stone-500 transition-colors"
            title="Close Dashboard (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-stone-200 px-6 bg-white shrink-0 text-xs font-mono overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "overview"
                ? "border-rose-600 text-rose-800"
                : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Observation Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("lst")}
            className={`py-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "lst"
                ? "border-rose-600 text-rose-800"
                : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Thermal Distribution (LST)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ndvi")}
            className={`py-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "ndvi"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
          >
            <Trees className="w-3.5 h-3.5" />
            <span>Vegetation Index & QA Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("quality")}
            className={`py-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "quality"
                ? "border-amber-600 text-amber-800"
                : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Evidence & Provenance Contract</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("mitigation")}
            className={`py-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "mitigation"
                ? "border-indigo-600 text-indigo-800"
                : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Microclimate & Cool Roofs</span>
          </button>
        </div>

        {/* Project Scientific Rules & Disclaimers Banner */}
        <div className="px-6 py-2.5 bg-stone-100 border-b border-stone-200 flex items-center justify-between flex-wrap gap-2 text-[10.5px] text-stone-700 font-mono shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-stone-900 uppercase">Scientific Disclaimers:</span>
            <span>• Surface temperature (LST) is radiometric skin temperature, NOT 2m ambient air temperature</span>
            <span>• NDVI is a spectral reflectance index, NOT 3D tree canopy cover</span>
            <span>• No arbitrary weighted composite scores</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-stone-500 text-[11px]">Data Provenance:</span>
            <ProvenanceTag type="Measured" />
            <ProvenanceTag type="Modelled" />
            <ProvenanceTag type="Assumed" />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-stone-500 text-xs">
              <Activity className="w-6 h-6 animate-spin text-emerald-700" />
              <span>Loading scientific raster metadata and diagnostics...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-panel bg-red-50 border border-red-200 text-xs text-red-800 space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Heat Intelligence Data Unavailable</span>
              </div>
              <p>{error}</p>
            </div>
          ) : diag ? (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-5 text-xs text-stone-700">
                  {/* Top Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-panel bg-rose-50/70 border border-rose-200 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-rose-700 font-semibold uppercase">Mean LST (°C)</span>
                        <ProvenanceTag type="Measured" />
                      </div>
                      <span className="text-2xl font-bold font-mono text-rose-950">
                        {landsat?.calibratedLSTCelsius?.mean !== null && landsat?.calibratedLSTCelsius?.mean !== undefined
                          ? `${landsat.calibratedLSTCelsius.mean.toFixed(1)}°C`
                          : "Not available"}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        Range: {landsat?.calibratedLSTCelsius?.min !== null && landsat?.calibratedLSTCelsius?.min !== undefined ? `${landsat.calibratedLSTCelsius.min.toFixed(1)}°C` : "Not available"} – {landsat?.calibratedLSTCelsius?.max !== null && landsat?.calibratedLSTCelsius?.max !== undefined ? `${landsat.calibratedLSTCelsius.max.toFixed(1)}°C` : "Not available"}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-panel bg-emerald-50/70 border border-emerald-200 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-emerald-700 font-semibold uppercase">Mean NDVI (30m)</span>
                        <ProvenanceTag type="Measured" />
                      </div>
                      <span className="text-2xl font-bold font-mono text-emerald-950">
                        {sentinel?.ndvi30mDistribution?.mean !== null && sentinel?.ndvi30mDistribution?.mean !== undefined
                          ? sentinel.ndvi30mDistribution.mean.toFixed(3)
                          : "Not available"}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        Median: {sentinel?.ndvi30mDistribution?.median !== null && sentinel?.ndvi30mDistribution?.median !== undefined ? sentinel.ndvi30mDistribution.median.toFixed(3) : "Not available"} (±{sentinel?.ndvi30mDistribution?.std !== null && sentinel?.ndvi30mDistribution?.std !== undefined ? sentinel.ndvi30mDistribution.std.toFixed(3) : "Not available"})
                      </span>
                    </div>

                    <div className="p-3.5 rounded-panel bg-blue-50/70 border border-blue-200 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-blue-700 font-semibold uppercase">Study Area Extent</span>
                        <ProvenanceTag type="Modelled" />
                      </div>
                      <span className="text-2xl font-bold font-mono text-blue-950">
                        {metadata?.candidateBoundaryAreaKm2 !== null && metadata?.candidateBoundaryAreaKm2 !== undefined
                          ? `${metadata.candidateBoundaryAreaKm2.toFixed(1)} km²`
                          : "Not available"}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        577,304 boundary cells (30m)
                      </span>
                    </div>

                    <div className="p-3.5 rounded-panel bg-purple-50/70 border border-purple-200 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-purple-700 font-semibold uppercase">Clear-Sky Validity</span>
                        <ProvenanceTag type="Measured" />
                      </div>
                      <span className="text-2xl font-bold font-mono text-purple-950">
                        {landsat?.qaPixelBreakdown?.clearPercentage !== null && landsat?.qaPixelBreakdown?.clearPercentage !== undefined
                          ? `${landsat.qaPixelBreakdown.clearPercentage.toFixed(2)}%`
                          : "Not available"}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        Uncertainty: ±{landsat?.surfaceTemperatureQA?.meanUncertaintyK !== null && landsat?.surfaceTemperatureQA?.meanUncertaintyK !== undefined ? `${landsat.surfaceTemperatureQA.meanUncertaintyK.toFixed(2)} K` : "Not available"}
                      </span>
                    </div>
                  </div>

                  {/* Satellite Instruments Comparison Card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-panel bg-white border border-stone-200 space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                        <div className="flex items-center gap-1.5 font-bold text-stone-900">
                          <Flame className="w-4 h-4 text-rose-600" />
                          <span>Thermal Infrared Instrument</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 text-[11px] font-mono font-semibold">
                          Landsat 9 TIRS-2
                        </span>
                      </div>

                      <div className="space-y-1 font-mono text-[11px] text-stone-600">
                        <div className="flex justify-between">
                          <span className="text-stone-400">Scene ID:</span>
                          <span className="text-stone-800 text-right truncate max-w-[220px]">
                            {landsat.sceneId}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Acquisition Time:</span>
                          <span className="text-stone-800">2023-04-22 05:27:39 UTC</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Sensor Native Res:</span>
                          <span className="text-rose-700 font-bold">100m native thermal</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Delivered Res:</span>
                          <span className="text-stone-800">30m USGS delivery grid</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Calibration Eq:</span>
                          <span className="text-stone-800">DN × 0.00341802 - 124.15</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-panel bg-white border border-stone-200 space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                        <div className="flex items-center gap-1.5 font-bold text-stone-900">
                          <Trees className="w-4 h-4 text-emerald-600" />
                          <span>Multispectral Optical Instrument</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-mono font-semibold">
                          Sentinel-2B MSI
                        </span>
                      </div>

                      <div className="space-y-1 font-mono text-[11px] text-stone-600">
                        <div className="flex justify-between">
                          <span className="text-stone-400">Granule ID:</span>
                          <span className="text-stone-800 text-right truncate max-w-[220px]">
                            {sentinel.sceneId}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Acquisition Time:</span>
                          <span className="text-stone-800">2023-04-24 05:26:49 UTC</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Sensor Native Res:</span>
                          <span className="text-emerald-700 font-bold">10m native (B04 & B08)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Aggregation:</span>
                          <span className="text-stone-800">4×4 area-weighted matrix to 30m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Temporal Difference:</span>
                          <span className="text-stone-800">~48 hours (near-coincident pre-monsoon)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mandatory Disclaimers */}
                  <div className="p-3.5 rounded-panel bg-amber-50/70 border border-amber-200 space-y-1.5 text-[11px] text-amber-900">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Scientific & Spatial Governance Disclaimers</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-amber-800">
                      <li>
                        <strong>LST vs Air Temperature:</strong> Land Surface Temperature measures radiometric skin temperature from Landsat Band 10. It does NOT measure 2-meter ambient air temperature or human physiological thermal stress (such as UTCI or heat index).
                      </li>
                      <li>
                        <strong>NDVI Definition:</strong> NDVI is a unitless mathematical index of spectral reflectance [-1.0, 1.0]. It does NOT equate to tree canopy percentage or total vegetation cover.
                      </li>
                      <li>
                        <strong>Candidate Boundary vs Raster Transparency:</strong> The boundary is derived from PMC Prabhag ward boundaries for research demonstration; it is NOT an official municipal demarcation. The delivered raster grid covers the Pune regional window (1012×871 cells); transparency (alpha = 0) represents NoData / fill values, not geometric boundary clipping.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB 2: LAND SURFACE TEMPERATURE */}
              {activeTab === "lst" && (
                <div className="space-y-5 text-xs text-stone-700">
                  <div className="p-4 rounded-panel bg-rose-50/50 border border-rose-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-rose-950 text-sm flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-rose-600" />
                        <span>Landsat 9 Calibrated Land Surface Temperature Distribution</span>
                      </h3>
                      <span className="font-mono text-[11px] text-rose-800 font-semibold bg-rose-100 px-2 py-0.5 rounded">
                        Unit: °C (Celsius)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-[11px]">
                      <div className="p-2.5 rounded bg-white border border-rose-200 flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-stone-400">Mean Temperature</span>
                          <ProvenanceTag type="Measured" />
                        </div>
                        <span className="text-base font-bold text-rose-900">
                          {landsat?.calibratedLSTCelsius?.mean !== null && landsat?.calibratedLSTCelsius?.mean !== undefined
                            ? `${landsat.calibratedLSTCelsius.mean.toFixed(2)}°C`
                            : "Not available"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-white border border-rose-200 flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-stone-400">Median (P50)</span>
                          <ProvenanceTag type="Measured" />
                        </div>
                        <span className="text-base font-bold text-rose-900">
                          {landsat?.calibratedLSTCelsius?.median !== null && landsat?.calibratedLSTCelsius?.median !== undefined
                            ? `${landsat.calibratedLSTCelsius.median.toFixed(2)}°C`
                            : "Not available"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-white border border-rose-200 flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-stone-400">Std Deviation</span>
                          <ProvenanceTag type="Measured" />
                        </div>
                        <span className="text-base font-bold text-stone-700">
                          {landsat?.calibratedLSTCelsius?.std !== null && landsat?.calibratedLSTCelsius?.std !== undefined
                            ? `±${landsat.calibratedLSTCelsius.std.toFixed(2)}°C`
                            : "Not available"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-white border border-rose-200 flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-stone-400">Range (Min–Max)</span>
                          <ProvenanceTag type="Measured" />
                        </div>
                        <span className="text-base font-bold text-stone-700">
                          {landsat?.calibratedLSTCelsius?.min !== null && landsat?.calibratedLSTCelsius?.min !== undefined
                            ? `${landsat.calibratedLSTCelsius.min.toFixed(1)}° – ${landsat.calibratedLSTCelsius.max.toFixed(1)}°C`
                            : "Not available"}
                        </span>
                      </div>
                    </div>

                    {/* Quantile Breakdown Bar */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-[11px] font-mono text-stone-500">
                        <span>P10: {landsat?.calibratedLSTCelsius?.p10 !== null && landsat?.calibratedLSTCelsius?.p10 !== undefined ? `${landsat.calibratedLSTCelsius.p10.toFixed(1)}°C` : "Not available"}</span>
                        <span>Median: {landsat?.calibratedLSTCelsius?.median !== null && landsat?.calibratedLSTCelsius?.median !== undefined ? `${landsat.calibratedLSTCelsius.median.toFixed(1)}°C` : "Not available"}</span>
                        <span>P90: {landsat?.calibratedLSTCelsius?.p90 !== null && landsat?.calibratedLSTCelsius?.p90 !== undefined ? `${landsat.calibratedLSTCelsius.p90.toFixed(1)}°C` : "Not available"}</span>
                      </div>
                      <div className="h-3 w-full rounded-xs bg-gradient-to-r from-[#2378e1] via-[#f5eb5a] via-[#f58723] to-[#e12323] shadow-inner" />
                      <div className="flex items-center justify-center gap-1.5 text-[9.5px] text-stone-500 text-center font-mono">
                        <ProvenanceTag type="Assumed" />
                        <span>Visualization Stretch: 25.0°C to 60.0°C (Continuous colormap; not a regulatory thermal hazard classification)</span>
                      </div>
                    </div>
                  </div>

                  {/* Pixel Diagnostics Audit Table */}
                  <div className="p-4 rounded-panel bg-white border border-stone-200 space-y-3">
                    <h4 className="font-bold text-stone-900 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-stone-500" />
                      <span>Digital Number & QA Pixel Breakdown</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px]">
                      <div className="p-3 rounded bg-stone-50 border border-stone-200 space-y-1">
                        <span className="text-[11px] text-stone-500 font-bold uppercase">Raw Digital Numbers (DN)</span>
                        <div className="flex justify-between">
                          <span>DN 0 (Fill):</span>
                          <span className="font-bold">{landsat.rawDigitalNumbers.dnZeroFillCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>DN 1–292 (Anomalies):</span>
                          <span className="font-bold text-emerald-700">0 (clean)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Nominal Valid DN:</span>
                          <span className="font-bold">{landsat.rawDigitalNumbers.dnNominalValidCount.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="p-3 rounded bg-stone-50 border border-stone-200 space-y-1">
                        <span className="text-[11px] text-stone-500 font-bold uppercase">QA_PIXEL Classification</span>
                        <div className="flex justify-between">
                          <span>Clear-Sky Pixels:</span>
                          <span className="font-bold text-emerald-700">
                            {landsat.qaPixelBreakdown.clearPixels.toLocaleString()} ({landsat.qaPixelBreakdown.clearPercentage.toFixed(2)}%)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cloud / Shadow:</span>
                          <span className="font-bold text-stone-600">
                            {landsat.qaPixelBreakdown.cloudPixels} ({landsat.qaPixelBreakdown.cloudPercentage.toFixed(3)}%)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Terrain Occlusion:</span>
                          <span className="font-bold text-emerald-700">0 flagged</span>
                        </div>
                      </div>

                      <div className="p-3 rounded bg-stone-50 border border-stone-200 space-y-1">
                        <span className="text-[11px] text-stone-500 font-bold uppercase">ST_QA Uncertainty</span>
                        <div className="flex justify-between">
                          <span>Mean Uncertainty:</span>
                          <span className="font-bold">±{landsat.surfaceTemperatureQA.meanUncertaintyK.toFixed(2)} K</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Median Uncertainty:</span>
                          <span className="font-bold">±{landsat.surfaceTemperatureQA.medianUncertaintyK.toFixed(2)} K</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Max Uncertainty:</span>
                          <span className="font-bold">±{landsat.surfaceTemperatureQA.maxUncertaintyK.toFixed(2)} K</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: VEGETATION INDEX & QA AUDIT */}
              {activeTab === "ndvi" && (
                <div className="space-y-5 text-xs text-stone-700">
                  <div className="p-4 rounded-panel bg-emerald-50/50 border border-emerald-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-emerald-950 text-sm flex items-center gap-1.5">
                        <Trees className="w-4 h-4 text-emerald-600" />
                        <span>Sentinel-2B Surface Vegetation Index (NDVI 30m)</span>
                      </h3>
                      <span className="font-mono text-[11px] text-emerald-800 font-semibold bg-emerald-100 px-2 py-0.5 rounded">
                        Unit: Unitless [-1.0, 1.0]
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-[11px]">
                      <div className="p-2.5 rounded bg-white border border-emerald-200 flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-stone-400">Mean NDVI</span>
                          <ProvenanceTag type="Measured" />
                        </div>
                        <span className="text-base font-bold text-emerald-900">
                          {sentinel?.ndvi30mDistribution?.mean !== null && sentinel?.ndvi30mDistribution?.mean !== undefined
                            ? sentinel.ndvi30mDistribution.mean.toFixed(3)
                            : "Not available"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-white border border-emerald-200 flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-stone-400">Median (P50)</span>
                          <ProvenanceTag type="Measured" />
                        </div>
                        <span className="text-base font-bold text-emerald-900">
                          {sentinel?.ndvi30mDistribution?.median !== null && sentinel?.ndvi30mDistribution?.median !== undefined
                            ? sentinel.ndvi30mDistribution.median.toFixed(3)
                            : "Not available"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-white border border-emerald-200 flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-stone-400">Std Deviation</span>
                          <ProvenanceTag type="Measured" />
                        </div>
                        <span className="text-base font-bold text-stone-700">
                          {sentinel?.ndvi30mDistribution?.std !== null && sentinel?.ndvi30mDistribution?.std !== undefined
                            ? `±${sentinel.ndvi30mDistribution.std.toFixed(3)}`
                            : "Not available"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-white border border-emerald-200 flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-stone-400">Valid Pixel Count</span>
                          <ProvenanceTag type="Measured" />
                        </div>
                        <span className="text-base font-bold text-stone-700">
                          {sentinel?.ndvi30mDistribution?.validPixelCount !== null && sentinel?.ndvi30mDistribution?.validPixelCount !== undefined
                            ? sentinel.ndvi30mDistribution.validPixelCount.toLocaleString()
                            : "Not available"}
                        </span>
                      </div>
                    </div>

                    {/* Gradient Bar */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-[11px] font-mono text-stone-500">
                        <span>Min: {sentinel?.ndvi30mDistribution?.min !== null && sentinel?.ndvi30mDistribution?.min !== undefined ? sentinel.ndvi30mDistribution.min.toFixed(3) : "Not available"}</span>
                        <span>Median: {sentinel?.ndvi30mDistribution?.median !== null && sentinel?.ndvi30mDistribution?.median !== undefined ? sentinel.ndvi30mDistribution.median.toFixed(3) : "Not available"}</span>
                        <span>Max: {sentinel?.ndvi30mDistribution?.max !== null && sentinel?.ndvi30mDistribution?.max !== undefined ? sentinel.ndvi30mDistribution.max.toFixed(3) : "Not available"}</span>
                      </div>
                      <div className="h-3 w-full rounded-xs bg-gradient-to-r from-[#87735f] via-[#d7c391] via-[#d2e15f] via-[#37a02d] to-[#0f5519] shadow-inner" />
                      <div className="flex items-center justify-center gap-1.5 text-[9.5px] text-stone-500 text-center font-mono">
                        <ProvenanceTag type="Assumed" />
                        <span>Visualization Stretch: -0.20 to +0.85 (Spectral reflectance index; not canopy percentage)</span>
                      </div>
                    </div>
                  </div>

                  {/* Scientific Data Quality Statistics Reconciliation Card */}
                  <div className="p-4 rounded-panel bg-white border border-stone-200 space-y-3">
                    <h4 className="font-bold text-stone-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>Data Quality Statistics Reconciliation & Denominator Audit</span>
                    </h4>
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      Satellite observation quality metrics are evaluated at different spatial scales and have distinct physical meanings:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[10.5px]">
                      <div className="p-3 rounded bg-purple-50/80 border border-purple-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-purple-950">99.98% Clear-Sky Ratio</span>
                          <ProvenanceTag type="Measured" />
                        </div>
                        <div className="text-stone-600 text-[11px]">
                          <strong>Scale:</strong> Landsat 9 30m grid<br />
                          <strong>Numerator:</strong> 577,208 clear cells<br />
                          <strong>Denominator:</strong> 577,304 boundary cells<br />
                          <strong>Meaning:</strong> Fraction of candidate area thermal cells free of clouds and shadow under QA_PIXEL bitmask.
                        </div>
                      </div>

                      <div className="p-3 rounded bg-emerald-50/80 border border-emerald-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-950">89.84% Valid Target Cells</span>
                          <ProvenanceTag type="Modelled" />
                        </div>
                        <div className="text-stone-600 text-[11px]">
                          <strong>Scale:</strong> Aggregated 30m target cells<br />
                          <strong>Numerator:</strong> 518,651 valid cells<br />
                          <strong>Denominator:</strong> 577,304 boundary cells<br />
                          <strong>Meaning:</strong> Fraction of 30m cells with at least one valid terrestrial 10m sub-pixel (excludes river water, clouds, & negative reflectance).
                        </div>
                      </div>

                      <div className="p-3 rounded bg-blue-50/80 border border-blue-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-950">70.20% Mean Valid Footprint</span>
                          <ProvenanceTag type="Modelled" />
                        </div>
                        <div className="text-stone-600 text-[11px]">
                          <strong>Scale:</strong> Sub-pixel 10m area density<br />
                          <strong>Numerator:</strong> Sum of valid 10m sub-pixel areas<br />
                          <strong>Denominator:</strong> 900 m² (total cell footprint)<br />
                          <strong>Meaning:</strong> Average area-weighted fraction of valid terrestrial sub-pixels within each 30m cell footprint across candidate boundary.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scene Classification (SCL) Categorical Breakdown */}
                  <div className="p-4 rounded-panel bg-white border border-stone-200 space-y-3">
                    <h4 className="font-bold text-stone-900 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-stone-500" />
                      <span>Sentinel-2 Scene Classification Layer (SCL) Categorical Distribution</span>
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                      {Object.entries(sentinel.sclCategoricalDistribution || {}).map(([key, val]) => (
                        <div key={key} className="p-2 rounded bg-stone-50 border border-stone-200 flex justify-between items-center">
                          <span className="text-stone-600 truncate">{key}:</span>
                          <span className="font-bold text-stone-800">{(val as number).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 bg-stone-50 rounded border border-stone-200 text-[11px] text-stone-600 space-y-1">
                      <div className="font-semibold text-stone-800">Negative Reflectance Preservation:</div>
                      <p>
                        Preserved <strong>{sentinel.reflectanceDiagnostics.b04NegativeReflectancePixels.toLocaleString()}</strong> negative B04 pixels in diagnostic records without synthetic zero-clipping or artificial epsilon flooring.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: QUALITY & PROVENANCE AUDIT */}
              {activeTab === "quality" && (
                <div className="space-y-4 text-xs text-stone-700">
                  <div className="p-4 rounded-panel bg-white border border-stone-200 space-y-3">
                    <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Data Provenance & Scientific Integrity Contract</span>
                    </h3>

                    <div className="space-y-2 font-mono text-[11px]">
                      <div className="p-3 rounded bg-emerald-50/70 border border-emerald-200 space-y-1">
                        <span className="font-bold text-emerald-900">1. SATELLITE OBSERVATIONS (Earth Observation Radiometry)</span>
                        <ul className="list-disc pl-4 text-emerald-800 text-[11px] space-y-0.5 font-sans">
                          <li>USGS Landsat 9 TIRS-2 Band 10 Level-2 Collection 2 Science Product (100m native thermal resampled to 30m grid).</li>
                          <li>Copernicus Sentinel-2B MSI Level-2A Bottom-Of-Atmosphere (BOA) Reflectance (10m native optical).</li>
                          <li>Instantaneous morning overpass (~10:57 AM local solar time).</li>
                        </ul>
                      </div>

                      <div className="p-3 rounded bg-blue-50/70 border border-blue-200 space-y-1">
                        <span className="font-bold text-blue-900">2. DETERMINISTIC CALCULATIONS (Exact Mathematical Transformations)</span>
                        <ul className="list-disc pl-4 text-blue-800 text-[11px] space-y-0.5 font-sans">
                          <li>Landsat scaling equation: LST (°C) = DN × 0.00341802 - 124.15.</li>
                          <li>Sentinel-2B scaling: Reflectance = (DN - 1000) / 10000.</li>
                          <li>4×4 matrix exact area-weighted overlap aggregation to 30m target grid.</li>
                          <li>WGS84-to-UTM Zone 43N (EPSG:32643) projection calculations.</li>
                        </ul>
                      </div>

                      <div className="p-3 rounded bg-indigo-50/70 border border-indigo-200 space-y-1">
                        <span className="font-bold text-indigo-900">3. VERIFIED TECHNICAL REFERENCES (Statutory Building Codes & Engineering Standards)</span>
                        <ul className="list-disc pl-4 text-indigo-800 text-[11px] space-y-0.5 font-sans">
                          <li>BEE Energy Conservation Building Code (ECBC 2017) Section 4.3.1.1: Cool Roof minimum Initial Solar Reflectance ≥ 0.70, Emittance ≥ 0.75, SRI ≥ 78.</li>
                          <li>IEC 61215:2021 / Sandia PV Array Performance Model: Monocrystalline PV module temperature coefficient γ_Pmp between -0.35%/°C and -0.45%/°C above 25°C STC.</li>
                          <li>EPRI Report 3002016335 / SAE J1772: DC fast charging thermal management and equipment thermal cycling principles.</li>
                        </ul>
                      </div>

                      <div className="p-3 rounded bg-amber-50/70 border border-amber-200 space-y-1">
                        <span className="font-bold text-amber-900">4. GENERAL ENGINEERING GUIDANCE (Industry Best Practices)</span>
                        <ul className="list-disc pl-4 text-amber-800 text-[11px] space-y-0.5 font-sans">
                          <li>Elevated open racking (≥ 0.8m ground clearance) for natural sub-panel convective cooling.</li>
                          <li>Solar canopy shading over EV charging bays to limit pre-charging solar heat soaking.</li>
                          <li>High-SRI permeable concrete pavers for charging station aprons.</li>
                          <li>Native drought-tolerant broadleaf tree species (Neem, Peepal, Tamarind) for civic shading corridors.</li>
                        </ul>
                      </div>

                      <div className="p-3 rounded bg-rose-50/70 border border-rose-200 space-y-1">
                        <span className="font-bold text-rose-900">5. UNVERIFIED / REQUIRES ADDITIONAL DATA (Missing Site-Specific Telemetry)</span>
                        <ul className="list-disc pl-4 text-rose-800 text-[11px] space-y-0.5 font-sans">
                          <li>In-situ weather station measurements (2m ambient air temperature, relative humidity, wind speed).</li>
                          <li>Plane-of-array solar irradiance telemetry for actual PV derating calculation.</li>
                          <li>Cadastral 7/12 land revenue extracts and official Development Plan (DP) zoning certificates.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Delivered Products Table */}
                  <div className="p-4 rounded-panel bg-white border border-stone-200 space-y-2">
                    <h4 className="font-bold text-stone-900">Generated Raster Deliverables (public/data/heat/)</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-[11px] text-stone-600">
                        <thead>
                          <tr className="border-b border-stone-200 text-stone-400 uppercase">
                            <th className="py-1">Filename</th>
                            <th className="py-1">Format</th>
                            <th className="py-1">Resolution</th>
                            <th className="py-1">Provenance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {manifest?.products?.map((prod: any) => (
                            <tr key={prod.filename}>
                              <td className="py-1 text-stone-900 font-bold">{prod.filename}</td>
                              <td className="py-1">{prod.dataType}</td>
                              <td className="py-1">{prod.spatialResolutionMeters || 30}m</td>
                              <td className="py-1 text-emerald-700">{prod.provenance}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: MICROCLIMATE & HEAT MITIGATION */}
              {activeTab === "mitigation" && (
                <div className="space-y-4 text-xs text-stone-700">
                  <div className="p-4 rounded-panel bg-indigo-50/50 border border-indigo-200 space-y-3">
                    <h3 className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-indigo-700" />
                      <span>Urban Heat Mitigation & Planning Strategies Grounded in Technical Standards</span>
                    </h3>
                    <p className="text-[11px] text-indigo-900 leading-relaxed">
                      Continuous Land Surface Temperature and vegetation index distributions inform evidence-based microclimatic interventions. Recommendations are categorized by statutory standards and verified technical references.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-panel bg-white border border-stone-200 space-y-2 shadow-2xs">
                      <div className="flex items-center gap-2 text-stone-900 font-bold">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        <span>High-Albedo &ldquo;Cool Roof&rdquo; Coatings</span>
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        Commercial, civic, and residential rooftops in elevated thermal zones can implement high-reflectance coatings meeting or exceeding building codes:
                      </p>
                      <ul className="list-disc pl-4 text-[10.5px] text-stone-600 space-y-0.5 font-mono">
                        <li><strong>Statutory (BEE ECBC 2017 Table 4.1):</strong> Initial Reflectance ≥ 0.70, Emittance ≥ 0.75, SRI ≥ 78 for low-slope roofs.</li>
                        <li><strong>Advisory Green Rating (LEED v4 / IGBC):</strong> Advisory SRI ≥ 82 for voluntary green building certification.</li>
                        <li>Buffers conductive solar heat ingress through the building envelope.</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-panel bg-white border border-stone-200 space-y-2 shadow-2xs">
                      <div className="flex items-center gap-2 text-stone-900 font-bold">
                        <Trees className="w-4 h-4 text-emerald-600" />
                        <span>Strategic Vegetative Shading Corridors</span>
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        Public pedestrian corridors and roadway alignments in low-vegetation sectors benefit from targeted tree canopy expansion:
                      </p>
                      <ul className="list-disc pl-4 text-[10.5px] text-stone-600 space-y-0.5 font-mono">
                        <li><strong>Recommended Species:</strong> Azadirachta indica (Neem), Ficus religiosa (Peepal), Tamarindus indica (Tamarind).</li>
                        <li>Continuous tree pits with permeable perimeter pavers.</li>
                        <li>Provides microclimatic shade and buffers direct solar radiant heating of pavement surfaces.</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-panel bg-white border border-stone-200 space-y-2 shadow-2xs">
                      <div className="flex items-center gap-2 text-stone-900 font-bold">
                        <Sun className="w-4 h-4 text-amber-600" />
                        <span>Solar Photovoltaic Thermal Management</span>
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        Crystalline silicon PV modules specify temperature coefficients of -0.35% to -0.45%/°C above 25°C STC (IEC 61215:2021):
                      </p>
                      <ul className="list-disc pl-4 text-[10.5px] text-stone-600 space-y-0.5 font-mono">
                        <li><strong>Methodological Boundary:</strong> Satellite LST is ground skin temperature; actual PV cell derating requires on-site irradiance and wind telemetry.</li>
                        <li>Elevated open racking (≥ 0.8m ground clearance) facilitates natural sub-panel convective cooling.</li>
                        <li>Vegetative groundcover limits ground albedo heating compared to bare dry soil.</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-panel bg-white border border-stone-200 space-y-2 shadow-2xs">
                      <div className="flex items-center gap-2 text-stone-900 font-bold">
                        <Droplets className="w-4 h-4 text-blue-600" />
                        <span>EV Fast-Charging Canopy Shading</span>
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        Elevated ambient thermal environments increase vehicle battery thermal management energy demand and stress charging electronics:
                      </p>
                      <ul className="list-disc pl-4 text-[10.5px] text-stone-600 space-y-0.5 font-mono">
                        <li><strong>Technical Reference:</strong> EPRI Report 3002016335 (DC Fast Charging Thermal Management).</li>
                        <li>Dedicated solar PV canopies protect vehicles and dispensers from direct solar insolation.</li>
                        <li>Light-colored permeable pavers (SRI ≥ 29 per IGBC) limit apron heat absorption.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500 font-mono shrink-0">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Deterministic Satellite Preprocessing (Phase 3 Verified)</span>
          </div>

          <div className="flex items-center gap-2">
            <span>Coordinate System: EPSG:32643 (UTM Zone 43N)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
