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
      className={`w-full md:w-52 lg:w-60 bg-white border-b md:border-b-0 md:border-r border-stone-200 flex flex-col justify-between shrink-0 select-none z-10 max-h-48 md:max-h-none overflow-y-auto ${className}`}
    >
      {/* Top Header & Tool List */}
      <div className="flex flex-col">
        <div className="px-4 py-3.5 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-stone-500">
            Urban Tools
          </span>
          <span className="text-[10px] font-mono text-stone-400">11 Types</span>
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
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-300 font-semibold shadow-xs"
                    : tool.id === "Remove"
                    ? "text-red-700 hover:bg-red-50 hover:border hover:border-red-200"
                    : "text-stone-700 hover:bg-stone-100 border border-transparent"
                } ${isRemoveDisabled ? "opacity-40 cursor-not-allowed hover:bg-transparent" : ""}`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isSelected
                      ? "text-emerald-700"
                      : tool.id === "Remove"
                      ? "text-red-600"
                      : "text-stone-500"
                  }`}
                />
                <span className="truncate">{tool.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Quick Actions */}
      <div className="p-3 border-t border-stone-200 bg-stone-50/60 flex flex-col gap-2">
        {/* Footprint Guide */}
        <div className="flex items-start gap-1.5 p-2 rounded bg-stone-100/80 border border-stone-200 text-[11px] text-stone-500 leading-tight">
          <Info className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
          <span>
            {selectedTool === "Bridge"
              ? "Bridge: Click start bank, then click opposite endpoint on map to span bridge."
              : selectedTool === "Select Area"
              ? "Select Area: Click 2 opposite corners to draw a study zone."
              : ["Road", "Water Canal", "Drainage"].includes(selectedTool)
              ? `${selectedTool}: Click start point, then click endpoint to bridge span.`
              : "Click map to place. Drag handles on map or use panel to adjust size in meters."}
          </span>
        </div>

        {/* Footer Links */}
        <div className="flex flex-col gap-1 pt-1">
          <button
            type="button"
            onClick={onExportMapClick}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-btn text-xs text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-stone-500" />
              <span>Export map</span>
            </span>
            <span className="text-[10px] font-mono text-stone-400">PNG</span>
          </button>

          <button
            type="button"
            onClick={onHistoryClick}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-btn text-xs text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 transition-colors"
          >
            <span className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-stone-500" />
              <span>History</span>
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded-full bg-stone-200 text-stone-700">
              {historyCount}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};
