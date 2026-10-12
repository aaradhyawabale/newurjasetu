"use client";

import React, { useState } from "react";
import {
  History,
  Trash2,
  ExternalLink,
  Calendar,
  MapPin,
  GitCompare,
  X,
  Check,
} from "lucide-react";
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
}) => {
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  const selectedCandidates = compareIds
    .map((id) => historyItems.find((h) => h.id === id))
    .filter((h): h is HistoryItem => Boolean(h));

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
          {historyItems.length >= 2 && selectedCandidates.length < 2 && (
            <div className="px-3 py-2 rounded-control bg-stone-50 border border-stone-200 flex items-center justify-between text-xs text-stone-600">
              <span className="flex items-center gap-1.5">
                <GitCompare className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  {selectedCandidates.length === 0
                    ? "Select any 2 analyses below to compare candidates side-by-side."
                    : "Select 1 more analysis to view side-by-side comparison."}
                </span>
              </span>
              {selectedCandidates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCompareIds([])}
                  className="text-[11px] font-semibold text-stone-500 hover:text-stone-800"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Side-by-Side Candidate Comparison Card */}
          {selectedCandidates.length === 2 && (
            <div className="p-3.5 rounded-panel border-2 border-emerald-700/30 bg-emerald-50/40 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2">
                <div className="flex items-center gap-1.5">
                  <GitCompare className="w-4 h-4 text-emerald-800" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 font-mono">
                    Candidate Comparison
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCompareIds([])}
                  className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {selectedCandidates.map((cand, idx) => {
                  const other = selectedCandidates[1 - idx];
                  const diff = cand.overallScore - other.overallScore;
                  const isHigh = cand.overallScore >= 75;
                  const isMod = cand.overallScore >= 50;

                  return (
                    <div
                      key={cand.id}
                      className="p-3 rounded-control bg-white border border-stone-200 flex flex-col gap-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-mono text-stone-400 uppercase truncate">
                          {cand.scenarioName}
                        </span>
                        {diff > 0 && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            +{diff} pts
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-stone-900 truncate">
                        {cand.type}
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-mono font-bold text-stone-900">
                          {cand.overallScore}
                          <span className="text-xs text-stone-400 font-normal">/100</span>
                        </span>
                        <StatusBadge
                          status={isHigh ? "optimal" : isMod ? "acceptable" : "constrained"}
                          label={cand.scoreBand.replace(" Suitability", "")}
                        />
                      </div>
                      <div className="text-[10px] font-mono text-stone-500 truncate">
                        {cand.lat.toFixed(4)}, {cand.lng.toFixed(4)}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenReport(cand.id);
                          onClose();
                        }}
                        className="mt-1 w-full py-1 px-2 rounded bg-stone-100 hover:bg-emerald-50 text-emerald-800 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {historyItems.map((item) => {
            const isHigh = item.overallScore >= 75;
            const isMod = item.overallScore >= 50;
            const isSelectedForCompare = compareIds.includes(item.id);

            return (
              <div
                key={item.id}
                className={`p-4 rounded-panel border transition-all shadow-xs flex flex-col gap-2.5 ${
                  isSelectedForCompare
                    ? "border-emerald-600 bg-emerald-50/20"
                    : "border-stone-200 hover:border-stone-300 bg-white"
                }`}
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
                  <div className="flex items-center gap-3">
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

                    {historyItems.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => toggleCompare(item.id)}
                        className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded transition-colors ${
                          isSelectedForCompare
                            ? "bg-emerald-700 text-white"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        {isSelectedForCompare ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <GitCompare className="w-3 h-3" />
                        )}
                        <span>{isSelectedForCompare ? "Comparing" : "Compare"}</span>
                      </button>
                    )}
                  </div>

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
