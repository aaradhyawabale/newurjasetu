"use client";

import React, { useState } from "react";
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCw,
  Maximize2,
  Info,
  Loader2,
  ShieldCheck,
  Sun,
  Sparkles,
  Zap,
  Crosshair,
  Move,
  Ruler,
  Sliders,
  Compass,
  Route,
  FileText,
  AlertOctagon,
} from "lucide-react";
import {
  InfrastructureTypeId,
  INFRASTRUCTURE_TYPES,
  INFRASTRUCTURE_SEPARATION_RULES,
} from "@/config/infra-types";
import { NumberField } from "../ui/NumberField";
import { StatusBadge } from "../ui/StatusBadge";
import { ValidationResult } from "@/server/analysis-engine/validation";

interface PlacementData {
  id?: string;
  type: InfrastructureTypeId;
  lat: number;
  lng: number;
  lengthM: number;
  widthM: number;
  bearingDeg: number;
  params: Record<string, any>;
  label?: string;
}

interface PlacementPanelProps {
  placement: PlacementData | null;
  onChange: (updated: PlacementData) => void;
  onValidate: () => Promise<ValidationResult | null>;
  validationResult: ValidationResult | null;
  isValidating: boolean;
  onOpenShadowSimulator?: () => void;
  onOpenSolarReality?: () => void;
  onStartTwoClickDraw?: () => void;
  isDrawingTwoClick?: boolean;
  onSmartFit?: () => void;
  isSmartFitting?: boolean;
  onBridgeRelocateToCrossing?: () => void;
  isBridgeRelocating?: boolean;
  onBridgePlanApproaches?: () => void;
  isBridgePlanningApproaches?: boolean;
  onOpenCopilot?: () => void;
  className?: string;
}

export const PlacementPanel: React.FC<PlacementPanelProps> = ({
  placement,
  onChange,
  onValidate,
  validationResult,
  isValidating,
  onOpenShadowSimulator,
  onOpenSolarReality,
  onStartTwoClickDraw,
  isDrawingTwoClick = false,
  onSmartFit,
  isSmartFitting = false,
  onBridgeRelocateToCrossing,
  isBridgeRelocating = false,
  onBridgePlanApproaches,
  isBridgePlanningApproaches = false,
  onOpenCopilot,
  className = "",
}) => {
  if (!placement) {
    return (
      <aside
        className={`w-full md:w-80 lg:w-[360px] bg-white border-t md:border-t-0 md:border-l border-stone-200 p-6 flex flex-col justify-center items-center text-center select-none z-10 shrink-0 ${className}`}
      >
        <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3 border border-stone-200">
          <Layers className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-stone-900">No Project Placed</h3>
        <p className="mt-1.5 text-xs text-stone-500 max-w-[220px] leading-relaxed">
          Select an infrastructure tool from the left bar, then click anywhere on the map to set a proposed footprint pin.
        </p>
      </aside>
    );
  }

  const config = INFRASTRUCTURE_TYPES[placement.type];
  const footprintAreaM2 = Math.round(placement.lengthM * placement.widthM);
  const shortId = placement.id ? `#PLC-${placement.id.substring(0, 6).toUpperCase()}` : "#PLC-NEW";

  const handleParamChange = (paramId: string, val: any) => {
    onChange({
      ...placement,
      params: {
        ...placement.params,
        [paramId]: val,
      },
    });
  };

  return (
    <aside
      className={`w-full md:w-80 lg:w-[360px] bg-white border-t md:border-t-0 md:border-l border-stone-200 flex flex-col justify-between shrink-0 select-none z-10 overflow-y-auto max-h-80 md:max-h-none ${className}`}
    >
      <div className="p-5 flex flex-col gap-5">
        {/* Header: Short ID & Title */}
        <div className="flex items-start justify-between border-b border-stone-100 pb-3">
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase text-stone-400 tracking-wider">
              {shortId}
            </span>
            <h2 className="text-base font-bold text-stone-900">
              {config ? `${config.label} details` : `${placement.type} details`}
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-stone-100 border border-stone-200 text-stone-700 font-medium">
            {config?.category || "Civic"}
          </span>
        </div>

        {/* Coordinates Section */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-stone-500">
            Geographic Siting
          </span>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Latitude"
              value={placement.lat}
              onChange={(lat) => onChange({ ...placement, lat })}
              step={0.0001}
            />
            <NumberField
              label="Longitude"
              value={placement.lng}
              onChange={(lng) => onChange({ ...placement, lng })}
              step={0.0001}
            />
          </div>
        </div>

        {/* Footprint Dimensions Section */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-stone-500">
              Project Area Dimensions
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {footprintAreaM2.toLocaleString()} m²
              </span>
              <span className="text-[10px] font-mono text-stone-500">
                ({(footprintAreaM2 / 10000).toFixed(2)} ha)
              </span>
            </div>
          </div>

          {/* 2-Click Redraw Action Button */}
          {onStartTwoClickDraw && (
            <button
              type="button"
              onClick={onStartTwoClickDraw}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-panel text-xs font-medium border transition-all ${
                isDrawingTwoClick
                  ? "bg-amber-500 text-white border-amber-600 shadow-sm animate-pulse"
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 hover:border-emerald-300"
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>
                {isDrawingTwoClick
                  ? "Click Start & Endpoint on map now..."
                  : placement.type === "Bridge"
                  ? "Redraw Bridge Span (Click 2 Points)"
                  : "Redraw Footprint by Cursor (Click 2 Points)"}
              </span>
            </button>
          )}

          {/* Length in meters with quick steppers & slider */}
          <div className="flex flex-col gap-1 p-2.5 bg-stone-50 rounded-panel border border-stone-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-stone-700">Length (Span)</span>
              <div className="flex items-center gap-1">
                {[-50, -10, 10, 50].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => {
                      const next = Math.max(10, Math.min(2000, placement.lengthM + delta));
                      onChange({ ...placement, lengthM: next });
                    }}
                    className="px-1.5 py-0.5 text-[10px] font-mono bg-white hover:bg-stone-100 border border-stone-200 rounded text-stone-600 hover:text-stone-900"
                    title={`Adjust length by ${delta > 0 ? `+${delta}` : delta}m`}
                  >
                    {delta > 0 ? `+${delta}` : delta}m
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center mt-1">
              <input
                type="range"
                min={10}
                max={1000}
                step={5}
                value={Math.min(1000, placement.lengthM)}
                onChange={(e) => onChange({ ...placement, lengthM: Number(e.target.value) })}
                className="col-span-2 accent-emerald-700 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
              />
              <NumberField
                value={placement.lengthM}
                onChange={(lengthM) => onChange({ ...placement, lengthM })}
                unit="m"
                min={10}
                max={2000}
                step={5}
              />
            </div>
          </div>

          {/* Width in meters with quick steppers & slider */}
          <div className="flex flex-col gap-1 p-2.5 bg-stone-50 rounded-panel border border-stone-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-stone-700">Width (Cross-Section)</span>
              <div className="flex items-center gap-1">
                {[-10, -5, 5, 10].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => {
                      const next = Math.max(5, Math.min(500, placement.widthM + delta));
                      onChange({ ...placement, widthM: next });
                    }}
                    className="px-1.5 py-0.5 text-[10px] font-mono bg-white hover:bg-stone-100 border border-stone-200 rounded text-stone-600 hover:text-stone-900"
                    title={`Adjust width by ${delta > 0 ? `+${delta}` : delta}m`}
                  >
                    {delta > 0 ? `+${delta}` : delta}m
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center mt-1">
              <input
                type="range"
                min={5}
                max={200}
                step={2}
                value={Math.min(200, placement.widthM)}
                onChange={(e) => onChange({ ...placement, widthM: Number(e.target.value) })}
                className="col-span-2 accent-emerald-700 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
              />
              <NumberField
                value={placement.widthM}
                onChange={(widthM) => onChange({ ...placement, widthM })}
                unit="m"
                min={5}
                max={500}
                step={2}
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono uppercase text-stone-400">Presets:</span>
            {placement.type === "Bridge" ? (
              <>
                {[
                  { label: "40m (Culvert/Stream)", len: 40, wid: 15 },
                  { label: "80m (Canal/Rail)", len: 80, wid: 20 },
                  { label: "150m (River Bridge)", len: 150, wid: 24 },
                  { label: "300m (Major Span)", len: 300, wid: 28 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onChange({ ...placement, lengthM: preset.len, widthM: preset.wid })}
                    className="px-2 py-0.5 text-[10px] font-mono rounded bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 border border-stone-200 text-stone-600"
                  >
                    {preset.len}m
                  </button>
                ))}
              </>
            ) : (
              <>
                {[
                  { label: "Compact", len: Math.round((config?.defaultLengthM || 100) * 0.7), wid: Math.round((config?.defaultWidthM || 60) * 0.7) },
                  { label: "Standard", len: config?.defaultLengthM || 100, wid: config?.defaultWidthM || 60 },
                  { label: "Expansive", len: Math.round((config?.defaultLengthM || 100) * 1.5), wid: Math.round((config?.defaultWidthM || 60) * 1.5) },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onChange({ ...placement, lengthM: preset.len, widthM: preset.wid })}
                    className="px-2 py-0.5 text-[10px] font-mono rounded bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 border border-stone-200 text-stone-600"
                  >
                    {preset.label} ({preset.len}×{preset.wid}m)
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Orientation Bearing */}
          <div className="mt-0.5">
            <NumberField
              label="Orientation Bearing"
              unit="°"
              value={placement.bearingDeg}
              onChange={(bearingDeg) => onChange({ ...placement, bearingDeg })}
              min={0}
              max={360}
              step={5}
              helperText="Clockwise angle from North (0° = North, 90° = East)"
            />
          </div>

          {/* Interactive cursor tip */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50/60 rounded border border-emerald-200 text-[10px] text-emerald-800 leading-tight">
            <Move className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>
              Tip: Drag handles on map with cursor: green top/bottom handles stretch length, blue side handles adjust width, and corner squares scale freely with opposite edges anchored.
            </span>
          </div>
        </div>

        {/* Location-Specific Limits Card */}
        <div className="p-3 rounded-panel bg-stone-50 border border-stone-200 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-stone-500">
              Location-Specific Limits
            </span>
            <span className="text-[10px] font-mono text-stone-600 font-medium">
              {validationResult?.allowedAreaRange
                ? `${validationResult.allowedAreaRange.minM2.toLocaleString()} – ${validationResult.allowedAreaRange.maxM2.toLocaleString()} m²`
                : config
                ? `${config.minAreaM2.toLocaleString()} – ${config.maxAreaM2.toLocaleString()} m²`
                : ""}
            </span>
          </div>

          <p className="text-[11px] text-stone-600 leading-normal">
            {validationResult?.allowedAreaRange?.reason ||
              `Standard envelope for ${config?.label || "siting"}. Backend validates spatial constraints dynamically.`}
          </p>

          {INFRASTRUCTURE_SEPARATION_RULES[placement.type] && (
            <div className="pt-1.5 mt-0.5 border-t border-stone-200/80 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-stone-500">
                <span>Hazard / Rail / Hwy Buffer:</span>
                <span className="font-semibold text-stone-700">
                  {INFRASTRUCTURE_SEPARATION_RULES[placement.type].minHazardBufferM}m /{" "}
                  {INFRASTRUCTURE_SEPARATION_RULES[placement.type].minRailwayBufferM}m /{" "}
                  {INFRASTRUCTURE_SEPARATION_RULES[placement.type].minMotorwayBufferM}m
                </span>
              </div>
              <span className="text-[9px] font-mono text-stone-400 truncate">
                Ref: {INFRASTRUCTURE_SEPARATION_RULES[placement.type].standardReference}
              </span>
            </div>
          )}
        </div>

        {/* Type-Specific Parameters */}
        {config && config.parameters.length > 0 && (
          <div className="flex flex-col gap-2 pt-1 border-t border-stone-100">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-stone-500">
              Type-Specific Parameters
            </span>

            <div className="flex flex-col gap-2.5">
              {config.parameters.map((param) => {
                const currentVal =
                  placement.params[param.id] !== undefined
                    ? placement.params[param.id]
                    : param.defaultValue;

                if (param.type === "number") {
                  return (
                    <NumberField
                      key={param.id}
                      id={param.id}
                      label={param.label}
                      unit={param.unit}
                      value={Number(currentVal)}
                      onChange={(val) => handleParamChange(param.id, val)}
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      helperText={param.helperText}
                    />
                  );
                }

                if (param.type === "select" && param.options) {
                  return (
                    <div key={param.id} className="flex flex-col gap-1">
                      <label
                        htmlFor={param.id}
                        className="text-xs font-mono uppercase tracking-wider font-medium text-stone-600"
                      >
                        {param.label}
                      </label>
                      <select
                        id={param.id}
                        value={String(currentVal)}
                        onChange={(e) => handleParamChange(param.id, e.target.value)}
                        className="w-full text-xs font-mono px-2.5 py-1.5 rounded-panel border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                      >
                        {param.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-stone-500">{param.helperText}</span>
                    </div>
                  );
                }

                if (param.type === "boolean") {
                  return (
                    <label
                      key={param.id}
                      className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer pt-1"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(currentVal)}
                        onChange={(e) => handleParamChange(param.id, e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-700 border-stone-300"
                      />
                      <span className="font-medium">{param.label}</span>
                    </label>
                  );
                }

                return null;
              })}
            </div>
          </div>
        )}

        {/* Shadow-of-the-Future Simulator Action */}
        {placement.type === "Solar Farm" && (
          <div className="pt-2 border-t border-amber-200 bg-amber-50/70 p-3 rounded-lg flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-amber-900 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-600" />
                <span>Shadow-of-the-Future</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 bg-amber-200 text-amber-800 rounded font-bold">
                Shading AI
              </span>
            </div>
            <p className="text-[11px] text-amber-850 leading-snug">
              Simulate 3D solar positions, building shadows, and what-if future tower developments.
            </p>
            <button
              type="button"
              onClick={onOpenShadowSimulator}
              className="w-full py-1.5 px-3 rounded-btn bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulate Solar Shading</span>
            </button>

            <button
              type="button"
              onClick={onOpenSolarReality}
              className="w-full py-1.5 px-3 rounded-btn bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Solar Reality: Generation & Financials</span>
            </button>
          </div>
        )}

        {/* Bridge Township Planning Directives & Actions */}
        {placement.type === "Bridge" && (
          <div className="pt-2 border-t border-cyan-200 bg-cyan-50/70 p-3 rounded-lg flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-cyan-950 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-700" />
                <span>Bridge Continuity & Approaches</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 bg-cyan-200 text-cyan-800 rounded font-bold">
                IRC:5 / SP:73
              </span>
            </div>
            <p className="text-[11px] text-cyan-900 leading-snug">
              Township planning requires both bridge abutments to connect directly to compatible classified streets without dead-ends.
            </p>

            {onBridgeRelocateToCrossing && (
              <button
                type="button"
                onClick={onBridgeRelocateToCrossing}
                disabled={isBridgeRelocating}
                className="w-full py-1.5 px-3 rounded-btn bg-cyan-700 hover:bg-cyan-800 disabled:bg-stone-300 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                title="Relocate bridge to nearby location where roads connect on both riverbanks"
              >
                {isBridgeRelocating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-200" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                )}
                <span>{isBridgeRelocating ? "Finding Road-to-Road Crossing..." : "Snap to Road-to-Road River Crossing"}</span>
              </button>
            )}

            {onBridgePlanApproaches && (
              <button
                type="button"
                onClick={onBridgePlanApproaches}
                disabled={isBridgePlanningApproaches}
                className="w-full py-1.5 px-3 rounded-btn border border-cyan-300 hover:bg-cyan-100/70 text-cyan-900 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                title="Calculate and display approach road extension corridors on both riverbanks"
              >
                {isBridgePlanningApproaches ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-700" />
                ) : (
                  <Route className="w-3.5 h-3.5 text-cyan-700" />
                )}
                <span>{isBridgePlanningApproaches ? "Tracing Approach Corridors..." : "Plan & Trace Approach Corridors"}</span>
              </button>
            )}
          </div>
        )}

        {/* Validation Section */}
        <div className="pt-2 border-t border-stone-100 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-stone-500">
              Site Verification
            </span>
            {validationResult && (
              <StatusBadge
                status={validationResult.status}
                label={validationResult.status === "pass" ? "Passed" : validationResult.status === "warn" ? "Warning" : "Conflict"}
              />
            )}
          </div>

          {/* Smart Fit Action for Township Planning */}
          {onSmartFit && (
            <button
              type="button"
              onClick={onSmartFit}
              disabled={isSmartFitting || isValidating}
              className="w-full py-1.5 px-3 rounded-btn bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-300 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              title="Automatically aligns footprint to the nearest road edge (street frontage) and sizes it to fit open unbuilt land without overlapping buildings"
            >
              {isSmartFitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-200" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
              )}
              <span>{isSmartFitting ? "Fitting to Road & Open Land..." : "Township Planner: Snap to Road & Open Land"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onValidate}
            disabled={isValidating || isSmartFitting}
            className="w-full py-1.5 px-3 rounded-btn border border-stone-300 hover:border-stone-400 bg-stone-50 hover:bg-stone-100 text-xs font-medium text-stone-700 flex items-center justify-center gap-1.5 transition-colors"
          >
            {isValidating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-stone-600" />
            )}
            <span>{isValidating ? "Validating footprint..." : "Validate footprint against site"}</span>
          </button>

          {/* Township Planning Conflict Callout Card */}
          {validationResult && validationResult.conflicts.length > 0 && (
            <div className="p-2.5 rounded-lg border border-amber-300 bg-amber-50/90 flex flex-col gap-1.5 text-xs">
              <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Site Obstructions Detected ({validationResult.conflicts.length})</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-snug">
                Footprint collides with existing mapped structures or roads. Township planning requires siting in unbuilt parcels with direct street access.
              </p>
              {onSmartFit && (
                <button
                  type="button"
                  onClick={onSmartFit}
                  disabled={isSmartFitting}
                  className="mt-0.5 py-1 px-2.5 rounded bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-amber-200" />
                  <span>Auto-Align to Road & Fit Open Ground</span>
                </button>
              )}
            </div>
          )}

          {/* Conflict details if any */}
          {validationResult && validationResult.conflicts.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1 max-h-36 overflow-y-auto">
              {validationResult.conflicts.map((conf) => (
                <div
                  key={conf.id}
                  className={`p-2 rounded text-xs border ${
                    conf.severity === "critical"
                      ? "bg-red-50 border-red-200 text-red-800"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1">
                    {conf.severity === "critical" ? (
                      <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                    <span>{conf.label}</span>
                  </div>
                  <p className="text-[11px] mt-0.5 opacity-90 leading-tight">{conf.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Road Access & Connectivity Card */}
          {validationResult && validationResult.roadAccess && (
            <div className="p-3 rounded-panel bg-amber-50/70 border border-amber-200 flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-amber-900 flex items-center gap-1">
                  <Route className="w-3.5 h-3.5 text-amber-700" />
                  <span>Road Access & Alignment</span>
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                    validationResult.roadAccess.requiresNewAccessRoad
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  }`}
                >
                  {validationResult.roadAccess.requiresNewAccessRoad
                    ? "New Road Required"
                    : "Direct Frontage"}
                </span>
              </div>
              <div className="text-[11px] text-stone-700 flex flex-col gap-0.5 mt-0.5">
                <div>
                  <span className="font-semibold">Nearest road:</span>{" "}
                  {validationResult.roadAccess.nearestRoadName} (
                  <span className="capitalize">{validationResult.roadAccess.nearestRoadClass}</span>)
                </div>
                <div>
                  <span className="font-semibold">Access distance:</span>{" "}
                  {validationResult.roadAccess.distanceM}m
                </div>
                {validationResult.roadAccess.crossesObstacle && (
                  <div className="text-red-700 font-medium flex items-center gap-1 mt-0.5">
                    <AlertOctagon className="w-3 h-3 text-red-600 shrink-0" />
                    <span>{validationResult.roadAccess.obstacleDetails || "Crosses obstacle"}</span>
                  </div>
                )}
                <div className="text-[10px] text-stone-500 italic mt-1 leading-snug">
                  {validationResult.roadAccess.preliminaryNotice}
                </div>
              </div>
            </div>
          )}

          {/* Official Planning & Statutory Context Card */}
          {validationResult && validationResult.planningContext && (
            <div className="p-3 rounded-panel bg-sky-50/70 border border-sky-200 flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-sky-900 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-sky-700" />
                  <span>Planning Framework</span>
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-300 font-bold">
                  {validationResult.planningContext.zoningStatus}
                </span>
              </div>
              <div className="text-[11px] text-stone-700 flex flex-col gap-0.5">
                <div>
                  <span className="font-semibold">Jurisdiction:</span>{" "}
                  {validationResult.planningContext.jurisdiction}
                </div>
                <div>
                  <span className="font-semibold">Statutory DP:</span>{" "}
                  {validationResult.planningContext.masterPlan}
                </div>
                <div>
                  <span className="font-semibold">Norms:</span>{" "}
                  {validationResult.planningContext.statutoryRules}
                </div>
                <div className="text-[10px] text-stone-500 mt-1 leading-snug">
                  <span className="font-semibold text-amber-800">Unverified:</span>{" "}
                  {validationResult.planningContext.unverifiedAttributes.slice(0, 2).join("; ")}.
                </div>
              </div>
            </div>
          )}

          {validationResult && validationResult.messages.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              {validationResult.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded text-[11px] bg-stone-100 border border-stone-200 text-stone-700 leading-tight"
                >
                  {msg}
                </div>
              ))}
            </div>
          )}

          {/* Ask AI Planning Assistant Button */}
          {onOpenCopilot && (
            <button
              type="button"
              onClick={onOpenCopilot}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-xs font-semibold transition-colors shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-700" />
              <span>Consult AI Planning Assistant</span>
            </button>
          )}
        </div>
      </div>

      {/* Helper text at bottom */}
      <div className="p-4 border-t border-stone-200 bg-stone-50/70 text-[11px] text-stone-500 leading-normal flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
        <span>
          Backend validates footprint against terrain and mapped OSM features prior to running multi-criteria analysis.
        </span>
      </div>
    </aside>
  );
};
