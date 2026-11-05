"use client";

import React from "react";
import { ProvenanceTag, ProvenanceClassification } from "./ProvenanceTag";
import { GlossaryTooltip, GlossaryKey } from "./GlossaryTooltip";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  provenance: ProvenanceClassification;
  glossaryKey?: GlossaryKey;
  subtext?: string;
  trend?: {
    direction: "up" | "down" | "neutral";
    label: string;
  };
  highlight?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  provenance,
  glossaryKey,
  subtext,
  trend,
  highlight = false,
  className = "",
}) => {
  return (
    <div
      className={`p-3.5 rounded-lg border transition-all ${
        highlight
          ? "bg-slate-900/90 border-emerald-500/50 shadow-lg shadow-emerald-950/20"
          : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="text-xs font-medium text-slate-300">
          {glossaryKey ? (
            <GlossaryTooltip glossaryKey={glossaryKey} showIcon={false}>
              {label}
            </GlossaryTooltip>
          ) : (
            label
          )}
        </div>
        <ProvenanceTag type={provenance} size="sm" />
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-100">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-mono font-medium text-slate-400">
            {unit}
          </span>
        )}
      </div>

      {(subtext || trend) && (
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
          {subtext && <span>{subtext}</span>}
          {trend && (
            <span
              className={`font-medium ${
                trend.direction === "down"
                  ? "text-emerald-400"
                  : trend.direction === "up"
                  ? "text-rose-400"
                  : "text-slate-400"
              }`}
            >
              {trend.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
