"use client";

import React from "react";
import { Activity, Cpu, SlidersHorizontal } from "lucide-react";

export type ProvenanceClassification = "Measured" | "Modelled" | "Assumed";

interface ProvenanceTagProps {
  type: ProvenanceClassification;
  className?: string;
  showBrackets?: boolean;
  showIcon?: boolean;
  size?: "sm" | "md";
}

/**
 * Standardized Government-Grade Provenance Badge for UrjaSetu.
 * Strictly labels every displayed scientific, geospatial, or engineering metric as
 * Measured, Modelled, or Assumed with distinct icon, color, and WCAG AA contrast.
 * Strict minimum typography size >= 11px.
 */
export const ProvenanceTag: React.FC<ProvenanceTagProps> = ({
  type,
  className = "",
  showBrackets = true,
  showIcon = true,
  size = "sm",
}) => {
  const colorMap: Record<ProvenanceClassification, string> = {
    Measured:
      "bg-emerald-950/80 text-emerald-300 border-emerald-600/80 shadow-xs",
    Modelled:
      "bg-sky-950/80 text-sky-300 border-sky-600/80 shadow-xs",
    Assumed:
      "bg-amber-950/80 text-amber-300 border-amber-600/80 shadow-xs",
  };

  const descriptions: Record<ProvenanceClassification, string> = {
    Measured:
      "Measured: Direct physical observation from calibrated satellite instrument (Landsat-9 / Sentinel-2), ground sensor, or official municipal master register.",
    Modelled:
      "Modelled: Computed deterministically via physical, spatial, LightGBM machine learning, or astronomical algorithms with uncertainty bounds.",
    Assumed:
      "Assumed: Indicative planning parameter, scenario threshold, or preliminary constraint baseline requiring municipal field validation.",
  };

  const IconComponent = {
    Measured: Activity,
    Modelled: Cpu,
    Assumed: SlidersHorizontal,
  }[type];

  const sizeClass = size === "md" ? "text-xs px-2 py-0.5" : "text-[11px] px-1.5 py-0.5";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm font-mono font-bold border uppercase tracking-wider select-none align-middle transition-colors ${sizeClass} ${colorMap[type]} ${className}`}
      title={descriptions[type]}
      role="status"
      aria-label={`Data provenance: ${type}`}
    >
      {showIcon && <IconComponent className="w-3 h-3 shrink-0" aria-hidden="true" />}
      <span>{showBrackets ? `[${type}]` : type}</span>
    </span>
  );
};
