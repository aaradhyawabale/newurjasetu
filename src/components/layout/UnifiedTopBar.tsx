"use client";

import React from "react";
import { ProvenanceTag } from "@/components/ui/ProvenanceTag";
import {
  GitCompare,
  FileText,
  Sparkles,
  MapPin,
  ChevronDown,
  Building,
  Layers
} from "lucide-react";

interface UnifiedTopBarProps {
  selectedWard: string;
  onSelectWard: (ward: string) => void;
  availableWards: string[];
  onOpenCompare: () => void;
  onOpenReport: () => void;
  onOpenCopilot: () => void;
}

export const UnifiedTopBar: React.FC<UnifiedTopBarProps> = ({
  selectedWard,
  onSelectWard,
  availableWards,
  onOpenCompare,
  onOpenReport,
  onOpenCopilot,
}) => {
  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between shrink-0 z-20 shadow-sm select-none">
      {/* Left: Jurisdiction & Ward Scope */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* City Scope Pill */}
        <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800">
          <Building className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-200 leading-tight">
              Pune Municipal Corporation
            </span>
            <span className="text-[11px] font-mono text-emerald-400 leading-tight">
              250m Resolution Grid
            </span>
          </div>
        </div>

        {/* Ward Selector Dropdown */}
        <div className="relative">
          <label htmlFor="ward-scope-select" className="sr-only">
            Select Municipal Ward
          </label>
          <div className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700 text-xs font-medium text-slate-200 transition-colors">
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              id="ward-scope-select"
              value={selectedWard}
              onChange={(e) => onSelectWard(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer pr-4 appearance-none"
            >
              <option value="All" className="bg-slate-900 text-slate-200">
                All Wards (Entire PMC)
              </option>
              {availableWards.map((w) => (
                <option key={w} value={w} className="bg-slate-900 text-slate-200">
                  {w}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none -ml-3 shrink-0" />
          </div>
        </div>
      </div>

      {/* Center: Provenance Legend (Visible on large screens) */}
      <div className="hidden xl:flex items-center gap-2.5 bg-slate-950/90 px-3 py-1 rounded-md border border-slate-800 text-[11px] font-mono shadow-inner">
        <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] mr-1">
          Provenance:
        </span>
        <div className="flex items-center gap-1" title="Direct satellite radiometric sensor observation or official register">
          <ProvenanceTag type="Measured" size="sm" showBrackets={false} />
          <span className="text-slate-300">Sensor / Register</span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="flex items-center gap-1" title="Computed through LightGBM machine learning or thermodynamic physics model">
          <ProvenanceTag type="Modelled" size="sm" showBrackets={false} />
          <span className="text-slate-300">Model / Simulation</span>
        </div>
        <span className="text-slate-700">|</span>
        <div className="flex items-center gap-1" title="Indicative planning parameter or statutory screening baseline">
          <ProvenanceTag type="Assumed" size="sm" showBrackets={false} />
          <span className="text-slate-300">Planning Norm</span>
        </div>
      </div>

      {/* Right: Quick Action Controls */}
      <div className="flex items-center gap-2">
        {/* Scenario Comparison Modal Trigger */}
        <button
          type="button"
          onClick={onOpenCompare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-700/80 text-xs font-semibold text-sky-200 transition-colors shadow-xs"
          title="Compare two intervention scenarios side-by-side"
        >
          <GitCompare className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Compare</span>
        </button>

        {/* Universal PDF Export */}
        <button
          type="button"
          onClick={onOpenReport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors shadow-xs"
          title="Export Committee-Ready PDF Dossier"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Export PDF</span>
        </button>

        {/* AI Copilot Trigger */}
        <button
          type="button"
          onClick={onOpenCopilot}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/80 text-xs font-bold text-emerald-300 transition-all shadow-xs"
          title="Ask Gemini AI Planning Advisor (⌘J)"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">AI Advisor</span>
        </button>
      </div>
    </header>
  );
};
