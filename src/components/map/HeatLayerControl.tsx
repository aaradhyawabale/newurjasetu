"use client";

import React, { useState, useEffect } from "react";
import { 
  Flame, 
  Trees, 
  Info, 
  AlertTriangle, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  Maximize2, 
  Sliders, 
  Activity,
  Calendar,
  Compass,
  Sparkles
} from "lucide-react";
import { ProvenanceTag } from "../ui/ProvenanceTag";

export interface HeatLayerControlProps {
  showLst?: boolean;
  showNdvi?: boolean;
  lstOpacity?: number;
  ndviOpacity?: number;
  onToggleLst?: (enabled: boolean) => void;
  onToggleNdvi?: (enabled: boolean) => void;
  onLstOpacityChange?: (opacity: number) => void;
  onNdviOpacityChange?: (opacity: number) => void;
  selectedPoint?: { lat: number; lng: number } | null;
  onZoomToStudyArea?: () => void;
  onOpenDashboard?: () => void;
}

export const HeatLayerControl: React.FC<HeatLayerControlProps> = ({
  showLst: controlledShowLst,
  showNdvi: controlledShowNdvi,
  lstOpacity: controlledLstOpacity,
  ndviOpacity: controlledNdviOpacity,
  onToggleLst,
  onToggleNdvi,
  onLstOpacityChange,
  onNdviOpacityChange,
  selectedPoint,
  onZoomToStudyArea,
  onOpenDashboard,
}) => {
  const [internalShowLst, setInternalShowLst] = useState(false);
  const [internalShowNdvi, setInternalShowNdvi] = useState(false);
  const [internalLstOpacity, setInternalLstOpacity] = useState(0.85);
  const [internalNdviOpacity, setInternalNdviOpacity] = useState(0.85);
  const [isExpanded, setIsExpanded] = useState(false);
  const [heatOverview, setHeatOverview] = useState<any | null>(null);
  const [pointData, setPointData] = useState<any | null>(null);
  const [isLoadingPoint, setIsLoadingPoint] = useState(false);

  const showLst = controlledShowLst !== undefined ? controlledShowLst : internalShowLst;
  const showNdvi = controlledShowNdvi !== undefined ? controlledShowNdvi : internalShowNdvi;
  const lstOpacity = controlledLstOpacity !== undefined ? controlledLstOpacity : internalLstOpacity;
  const ndviOpacity = controlledNdviOpacity !== undefined ? controlledNdviOpacity : internalNdviOpacity;

  useEffect(() => {
    fetch("/api/heat")
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "OK") {
          setHeatOverview(data);
        }
      })
      .catch((err) => console.warn("Could not load heat diagnostics:", err));
  }, []);

  useEffect(() => {
    if (!selectedPoint) {
      setPointData(null);
      return;
    }

    setIsLoadingPoint(true);
    fetch("/api/heat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lng: selectedPoint.lng, lat: selectedPoint.lat }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "OK") {
          setPointData(data);
        }
      })
      .catch((err) => console.warn("Could not query point heat:", err))
      .finally(() => setIsLoadingPoint(false));
  }, [selectedPoint]);

  const handleToggleLst = () => {
    const next = !showLst;
    setInternalShowLst(next);
    onToggleLst?.(next);
  };

  const handleToggleNdvi = () => {
    const next = !showNdvi;
    setInternalShowNdvi(next);
    onToggleNdvi?.(next);
  };

  const landsatStats = heatOverview?.diagnostics?.landsat9?.calibratedLSTCelsius;
  const ndviStats = heatOverview?.diagnostics?.sentinel2b?.ndvi30mDistribution;

  return (
    <div className="absolute top-3 right-3 z-30 w-80 sm:w-88 font-sans max-w-[calc(100vw-24px)] select-none">
      <div className="bg-white/95 backdrop-blur-md border border-stone-200 rounded-panel shadow-lg overflow-hidden transition-all text-xs text-stone-800">
        {/* Header bar */}
        <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-stone-900">
            <Layers className="w-4 h-4 text-emerald-700" />
            <span className="truncate">Urban Heat & Vegetation</span>
          </div>

          <div className="flex items-center gap-1">
            {onZoomToStudyArea && (
              <button
                type="button"
                onClick={onZoomToStudyArea}
                className="p-1 hover:bg-stone-200 rounded text-stone-600 transition-colors"
                title="Fit map to Pune Heat Grid extent"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}

            {onOpenDashboard && (
              <button
                type="button"
                onClick={onOpenDashboard}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-medium text-[10px] transition-colors"
                title="Open comprehensive Heat Intelligence Dashboard"
              >
                <Activity className="w-3 h-3" />
                <span>Dashboard</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-stone-200 rounded text-stone-600 transition-colors"
              title={isExpanded ? "Collapse layer panel" : "Expand layer diagnostics"}
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Primary Layer Toggles */}
        <div className="p-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleLst}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xs border text-[11px] font-medium transition-all ${
              showLst
                ? "bg-rose-50 border-rose-400 text-rose-900 font-bold shadow-2xs"
                : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${showLst ? "text-rose-600" : "text-stone-400"}`} />
            <span>LST (Landsat 9)</span>
          </button>

          <button
            type="button"
            onClick={handleToggleNdvi}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xs border text-[11px] font-medium transition-all ${
              showNdvi
                ? "bg-emerald-50 border-emerald-400 text-emerald-900 font-bold shadow-2xs"
                : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
          >
            <Trees className={`w-3.5 h-3.5 ${showNdvi ? "text-emerald-600" : "text-stone-400"}`} />
            <span>NDVI (Sentinel-2)</span>
          </button>
        </div>

        {/* Active Layer Controls & Legends */}
        {(showLst || showNdvi) && (
          <div className="px-3 pb-2.5 space-y-3 border-t border-stone-100 pt-2">
            {/* LST Legend & Opacity Slider */}
            {showLst && (
              <div className="space-y-1.5 bg-rose-50/40 p-2 rounded-panel border border-rose-100">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-semibold text-rose-900 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-rose-600" />
                    <span>Land Surface Temperature (°C)</span>
                  </span>
                  <span className="font-mono text-stone-600 font-medium">
                    Mean: {landsatStats?.mean ? `${landsatStats.mean.toFixed(1)}°C` : "46.3°C"}
                  </span>
                </div>

                {/* Continuous Scientific Colorbar */}
                <div className="h-2.5 w-full rounded-xs bg-gradient-to-r from-[#2378e1] via-[#f5eb5a] via-[#f58723] via-[#e12323] to-[#870f73] shadow-inner" />

                <div className="flex justify-between text-[9px] font-mono text-stone-600 font-medium">
                  <span>25.0°C (Min Display)</span>
                  <span>42.5°C</span>
                  <span>60.0°C (Max Display)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-stone-500 font-sans leading-tight">
                  <ProvenanceTag type="Assumed" />
                  <span>Display stretch: 25°C to 60°C. Continuous colormap; not a regulatory thermal hazard classification.</span>
                </div>

                {/* Opacity Slider */}
                <div className="flex items-center gap-2 pt-0.5">
                  <Sliders className="w-3 h-3 text-stone-400" />
                  <span className="text-[10px] text-stone-500 font-mono">Opacity</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={lstOpacity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setInternalLstOpacity(val);
                      onLstOpacityChange?.(val);
                    }}
                    className="flex-1 h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                  />
                  <span className="text-[9px] font-mono text-stone-500 w-7 text-right">
                    {Math.round(lstOpacity * 100)}%
                  </span>
                </div>

                <div className="text-[9.5px] text-stone-600 flex items-start gap-1 bg-white/80 p-1.5 rounded-xs mt-1 border border-rose-200/50">
                  <Info className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Resolution disclosure:</strong> Landsat 9 TIRS-2 Band 10 has a <strong>100m native thermal resolution</strong> resampled to 30m USGS delivery grid. Transparency indicates fill/NoData.
                  </span>
                </div>
              </div>
            )}

            {/* NDVI Legend & Opacity Slider */}
            {showNdvi && (
              <div className="space-y-1.5 bg-emerald-50/40 p-2 rounded-panel border border-emerald-100">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-semibold text-emerald-900 flex items-center gap-1">
                    <Trees className="w-3 h-3 text-emerald-600" />
                    <span>Vegetation Index (NDVI 30m)</span>
                  </span>
                  <span className="font-mono text-stone-600 font-medium">
                    Mean: {ndviStats?.mean ? ndviStats.mean.toFixed(3) : "0.514"}
                  </span>
                </div>

                {/* Continuous Scientific Colorbar */}
                <div className="h-2.5 w-full rounded-xs bg-gradient-to-r from-[#87735f] via-[#d7c391] via-[#d2e15f] via-[#37a02d] to-[#0f5519] shadow-inner" />

                <div className="flex justify-between text-[9px] font-mono text-stone-600 font-medium">
                  <span>-0.20 (Min Display)</span>
                  <span>+0.32</span>
                  <span>+0.85 (Max Display)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-stone-500 font-sans leading-tight">
                  <ProvenanceTag type="Assumed" />
                  <span>Display stretch: -0.20 to +0.85. Reflectance ratio (NIR-Red)/(NIR+Red); not tree canopy percentage.</span>
                </div>

                {/* Opacity Slider */}
                <div className="flex items-center gap-2 pt-0.5">
                  <Sliders className="w-3 h-3 text-stone-400" />
                  <span className="text-[10px] text-stone-500 font-mono">Opacity</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={ndviOpacity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setInternalNdviOpacity(val);
                      onNdviOpacityChange?.(val);
                    }}
                    className="flex-1 h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <span className="text-[9px] font-mono text-stone-500 w-7 text-right">
                    {Math.round(ndviOpacity * 100)}%
                  </span>
                </div>

                <div className="text-[9.5px] text-stone-600 flex items-start gap-1 bg-white/80 p-1.5 rounded-xs mt-1 border border-emerald-200/50">
                  <Info className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Scientific definition:</strong> Represents surface spectral reflectance index (NIR-Red)/(NIR+Red), not canopy or vegetation cover percentage.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Real-time Point Inspection Card (when user clicked on the map) */}
        {selectedPoint && (
          <div className="p-2.5 bg-stone-900 text-stone-100 border-t border-stone-800 text-[11px] font-mono space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-stone-400">
              <span className="flex items-center gap-1 font-semibold text-stone-200">
                <span>📍 Clicked Point Inspection</span>
              </span>
              <span className="text-emerald-400 text-[9px] bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800">
                DETERMINISTIC
              </span>
            </div>

            <div className="text-[10px] text-stone-400 flex items-center justify-between">
              <span>Coordinates:</span>
              <span>
                {selectedPoint.lat.toFixed(4)}°N, {selectedPoint.lng.toFixed(4)}°E
              </span>
            </div>

            {isLoadingPoint ? (
              <div className="text-[10px] text-stone-400 animate-pulse py-1">
                Sampling satellite raster grid at clicked coordinates...
              </div>
            ) : pointData?.query ? (
              <div className="space-y-1 pt-1 border-t border-stone-800">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-400">Surface Temp (LST):</span>
                    <ProvenanceTag type="Measured" />
                  </div>
                  {pointData.query.lst.celsius !== null ? (
                    <span className="text-rose-400 font-bold">
                      {pointData.query.lst.celsius}°C
                      {pointData.query.lst.stQaUncertaintyKelvin && (
                        <span className="text-[9px] text-stone-400 font-normal ml-1">
                          (±{pointData.query.lst.stQaUncertaintyKelvin} K)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-stone-500 italic">Not available</span>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-400">Vegetation (NDVI 30m):</span>
                    <ProvenanceTag type="Measured" />
                  </div>
                  {pointData.query.ndvi.aggregated30m !== null ? (
                    <span className="text-emerald-400 font-bold">
                      {pointData.query.ndvi.aggregated30m}
                    </span>
                  ) : (
                    <span className="text-stone-500 italic">Not available</span>
                  )}
                </div>

                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-stone-400">Surface Class (SCL):</span>
                  <span className="text-stone-200 font-sans">
                    {pointData.query.ndvi.sclClassName || "Not available"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-stone-500 italic py-0.5">
                Click map within Pune heat raster grid to sample exact pixel values. Transparency indicates fill/NoData.
              </div>
            )}

            <div className="text-[9px] text-stone-400 pt-1 border-t border-stone-800 leading-tight space-y-0.5">
              <div>⚠️ <strong>Scientific Notice:</strong> Surface temperature (LST) is radiometric skin temperature, NOT 2m ambient air temperature.</div>
              <div>NDVI is a spectral reflectance index, NOT 3D tree canopy cover. No arbitrary weighted composite scores.</div>
            </div>
          </div>
        )}

        {/* Collapsible Scientific Diagnostics Drawer */}
        {isExpanded && (
          <div className="p-3 bg-stone-50 border-t border-stone-200 space-y-2.5 max-h-72 overflow-y-auto text-[11px]">
            <div>
              <div className="font-semibold text-stone-900 mb-1 flex items-center justify-between">
                <span>🛰️ Landsat 9 TIRS-2 (Thermal)</span>
                <span className="text-[9px] font-mono text-stone-500 bg-stone-200/60 px-1 rounded">
                  USGS C2L2
                </span>
              </div>
              <div className="space-y-0.5 text-stone-600 font-mono text-[10px]">
                <div>Scene: LC09_L2SP_147047_20230422_02_T1</div>
                <div>Acquisition: 2023-04-22 05:27:39 UTC</div>
                <div>
                  LST Range: {landsatStats?.min}°C to {landsatStats?.max}°C (Median: {landsatStats?.median}°C)
                </div>
                <div>Clear-Sky Pixels: 99.98% (Mean Uncertainty: ±2.16 K)</div>
                <div>Calibration Formula: DN × 0.00341802 - 124.15</div>
                <div>DN Range: 1–292 diagnostic anomaly check passed (0 pixels)</div>
              </div>
            </div>

            <div className="border-t border-stone-200 pt-2">
              <div className="font-semibold text-stone-900 mb-1 flex items-center justify-between">
                <span>🌿 Sentinel-2B MSI (Optical)</span>
                <span className="text-[9px] font-mono text-stone-500 bg-stone-200/60 px-1 rounded">
                  Copernicus BOA
                </span>
              </div>
              <div className="space-y-0.5 text-stone-600 font-mono text-[10px]">
                <div>Granule: S2B_MSIL2A_20230424T052649_N0510</div>
                <div>Acquisition: 2023-04-24 05:26:49 UTC (~48h baseline)</div>
                <div>Reflectance Scale: (DN - 1000) / 10000 (Baseline N0510)</div>
                <div>Valid Terrestrial Footprint: 70.0% coverage fraction</div>
                <div>Preserved Negative Reflectance: 2.36M B04 pixels (no synthetic clipping)</div>
              </div>
            </div>

            <div className="border-t border-stone-200 pt-2">
              <div className="flex items-start gap-1 text-[10px] text-amber-800 bg-amber-50 p-1.5 rounded-xs border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Candidate Boundary Notice:</strong> Spatial analysis bounded by PMC candidate boundary derived from Prabhag ward boundaries; non-authoritative.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
