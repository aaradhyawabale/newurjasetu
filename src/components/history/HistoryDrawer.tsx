"use client";

import React from "react";
import { History, Trash2, ExternalLink, Calendar, MapPin, Layers } from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { StatusBadge } from "../ui/StatusBadge";
import { EmptyState } from "../ui/EmptyState";

export interface HistoryItem {
  id: string;
  placementId: string;
  engineVersion: string;
  overallScore: number;
  scoreBand: string;
  createdAt: string;
  type: string;
  label: string | null;
  lat: number;
  lng: number;
  scenarioName: string;
}

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  historyItems: HistoryItem[];
  onOpenReport: (id: string) => void;
  onDeleteReport: (id: string) => void;
  isLoading?: boolean;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  historyItems,
  onOpenReport,
  onDeleteReport,
  isLoading = false,
}) => {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Analysis History"
      subtitle={`${historyItems.length} stored reports across your scenarios`}
      size="md"
    >
      {historyItems.length === 0 ? (
        <EmptyState
          icon={History}
          title="No Past Analyses"
          description="Place an infrastructure pin on the map and click Analyze to generate and save your first suitability report."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {historyItems.map((item) => {
            const isHigh = item.overallScore >= 75;
            const isMod = item.overallScore >= 50;

            return (
              <div
                key={item.id}
                className="p-4 rounded-panel border border-stone-200 hover:border-stone-300 bg-white transition-all shadow-xs flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                      {item.scenarioName}
                    </span>
                    <h4 className="text-sm font-bold text-stone-900 mt-0.5">
                      {item.type}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-stone-900">
                      {item.overallScore}/100
                    </span>
                    <StatusBadge
                      status={isHigh ? "optimal" : isMod ? "acceptable" : "constrained"}
                      label={item.scoreBand}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-stone-500 font-mono">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-stone-400" />
                    <span>
                      {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-stone-400" />
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </span>
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenReport(item.id);
                      onClose();
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Reopen Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteReport(item.id)}
                    className="p-1 rounded text-stone-400 hover:text-red-600 transition-colors"
                    title="Delete report"
                    aria-label="Delete report"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
};
