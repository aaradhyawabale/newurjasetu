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
  className?: string;
}

export const PlacementPanel: React.FC<PlacementPanelProps> = ({
  placement,
  onChange,
  onValidate,
  validationResult,
  isValidating,
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-stone-500">
              Project Area Dimensions
            </span>
            <span className="text-xs font-mono font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {footprintAreaM2.toLocaleString()} m²
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Length"
              unit="m"
              value={placement.lengthM}
              onChange={(lengthM) => onChange({ ...placement, lengthM })}
              min={10}
              max={2000}
              step={5}
            />
            <NumberField
              label="Width"
              unit="m"
              value={placement.widthM}
              onChange={(widthM) => onChange({ ...placement, widthM })}
              min={5}
              max={1000}
              step={5}
            />
          </div>

          <div className="mt-1">
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

          <button
            type="button"
            onClick={onValidate}
            disabled={isValidating}
            className="w-full py-1.5 px-3 rounded-btn border border-stone-300 hover:border-stone-400 bg-stone-50 hover:bg-stone-100 text-xs font-medium text-stone-700 flex items-center justify-center gap-1.5 transition-colors"
          >
            {isValidating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-stone-600" />
            )}
            <span>{isValidating ? "Validating footprint..." : "Validate footprint against site"}</span>
          </button>

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
