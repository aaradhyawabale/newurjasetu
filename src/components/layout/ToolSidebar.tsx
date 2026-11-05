"use client";

import React from "react";
import {
  Hospital,
  School,
  Trees,
  Route,
  Compass,
  Waves,
  Building2,
  TrainFront,
  Droplets,
  Sun,
  Crop,
  Trash2,
  History,
  Download,
  Info,
  Zap,
  X,
} from "lucide-react";
import { InfrastructureTypeId, INFRASTRUCTURE_TYPES } from "@/config/infra-types";

interface ToolSidebarProps {
  selectedTool: string;
  onSelectTool: (tool: string) => void;
  onRemoveClick: () => void;
  onHistoryClick: () => void;
  onExportMapClick: () => void;
  historyCount: number;
  hasActivePlacement: boolean;
  onClose?: () => void;
  className?: string;
}

interface ToolItem {
  id: string;
  label: string;
  icon: React.ElementType;
  isAction?: boolean;
}

export const ToolSidebar: React.FC<ToolSidebarProps> = ({
  selectedTool,
  onSelectTool,
  onRemoveClick,
  onHistoryClick,
  onExportMapClick,
  historyCount,
  hasActivePlacement,
  onClose,
  className = "",
}) => {
  const tools: ToolItem[] = [
    { id: "Select Area", label: "Select Area", icon: Crop },
    { id: "Hospital", label: "Hospital", icon: Hospital },
    { id: "Bridge", label: "Bridge", icon: Compass },
    { id: "Park", label: "Park", icon: Trees },
    { id: "Road", label: "Road", icon: Route },
    { id: "School", label: "School", icon: School },
    { id: "Water Canal", label: "Water Canal", icon: Waves },
    { id: "Building", label: "Building", icon: Building2 },
    { id: "Transit Station", label: "Transit Station", icon: TrainFront },
    { id: "Drainage", label: "Drainage", icon: Droplets },
    { id: "Solar Farm", label: "Solar Farm", icon: Sun },
    { id: "EV Charging Station", label: "EV Charging Station", icon: Zap },
    { id: "Remove", label: "Remove", icon: Trash2, isAction: true },
  ];

  const handleToolClick = (tool: ToolItem) => {
    if (tool.id === "Remove") {
      onRemoveClick();
    } else {
      onSelectTool(tool.id);
    }
  };

  return (
    <aside
      className={`w-full md:w-52 lg:w-60 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between shrink-0 select-none z-10 max-h-48 md:max-h-none overflow-y-auto ${className}`}
    >
      {/* Top Header & Tool List */}
      <div className="flex flex-col">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-400">
              Infrastructure Palette
            </span>
            <span className="text-[11px] text-slate-500">11 Siting & Civic Types</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Close infrastructure palette"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <nav className="p-2 flex flex-col gap-0.5">
          {tools.map((tool) => {
            const isSelected = selectedTool === tool.id && !tool.isAction;
            const Icon = tool.icon;
            const isRemoveDisabled = tool.id === "Remove" && !hasActivePlacement;

            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => handleToolClick(tool)}
                disabled={isRemoveDisabled}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-btn text-xs font-medium transition-all text-left ${
                  isSelected
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-semibold shadow-xs"
                    : tool.id === "Remove"
                    ? "text-red-400 hover:bg-red-950/30 hover:border hover:border-red-800/40"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent"
                } ${isRemoveDisabled ? "opacity-30 cursor-not-allowed hover:bg-transparent" : ""}`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isSelected
                      ? "text-emerald-400"
                      : tool.id === "Remove"
                      ? "text-red-400"
                      : "text-slate-400"
                  }`}
                />
                <span className="truncate">{tool.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Quick Actions */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50 flex flex-col gap-2">
        {/* Footprint Guide */}
        <div className="flex items-start gap-1.5 p-2 rounded bg-slate-800/70 border border-slate-700/60 text-[11px] text-slate-400 leading-tight">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            {selectedTool === "Bridge"
              ? "Bridge: Click start bank, then click opposite endpoint on map to span bridge."
              : selectedTool === "Select Area"
              ? "Select Area: Click 2 corners to draw, then drag any corner or edge with cursor to adjust size."
              : ["Road", "Water Canal", "Drainage"].includes(selectedTool)
              ? `${selectedTool}: Click start point, then click endpoint to bridge span.`
              : "Click map to place. Drag handles on map with cursor or use panel to adjust size in meters."}
          </span>
        </div>

        {/* Footer Links */}
        <div className="flex flex-col gap-1 pt-1">
          <button
            type="button"
            onClick={onExportMapClick}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-btn text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export map</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">PNG</span>
          </button>

          <button
            type="button"
            onClick={onHistoryClick}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-btn text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <span className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>History</span>
            </span>
            <span className="px-1.5 py-0.5 text-[11px] font-mono font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {historyCount}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};
