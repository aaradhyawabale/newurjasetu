"use client";

import React, { useState } from "react";
import { HeatPriorityScreen } from "@/components/priority/HeatPriorityScreen";
import { AppShell } from "@/components/layout/AppShell";
import { PriorityCell, GreenLossDataset } from "@/server/priority/types";
import { OptimizeResult } from "@/server/priority/optimizer";
import { ArrowLeft, Compass, Flame } from "lucide-react";

interface MainWorkspaceProps {
  initialCells: PriorityCell[];
  initialOptimization?: OptimizeResult | null;
  initialGreenLoss?: GreenLossDataset | null;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
  initialScenarios: Array<{ id: string; name: string }>;
}

export const MainWorkspace: React.FC<MainWorkspaceProps> = ({
  initialCells,
  initialOptimization,
  initialGreenLoss,
  user,
  initialScenarios,
}) => {
  const [viewMode, setViewMode] = useState<"priority" | "legacy_siting">("priority");

  if (viewMode === "legacy_siting") {
    return (
      <div className="relative h-screen w-screen overflow-hidden">
        {/* Floating Return Pill back to Heat Priority Screen */}
        <div className="fixed top-2.5 left-1/2 -translate-x-1/2 z-50">
          <button
            type="button"
            onClick={() => setViewMode("priority")}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/90 text-emerald-300 hover:bg-emerald-900 border border-emerald-600/80 shadow-2xl text-xs font-bold backdrop-blur-md transition-all hover:scale-105"
            title="Return to Heat Priority Screen"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Heat Priority Screen</span>
          </button>
        </div>
        <AppShell
          user={user}
          initialScenarios={initialScenarios}
          initialScenarioId={initialScenarios[0]?.id || "default"}
        />
      </div>
    );
  }

  return (
    <HeatPriorityScreen
      initialCells={initialCells}
      initialOptimization={initialOptimization}
      initialGreenLoss={initialGreenLoss}
      onOpenLegacyManualSiting={() => setViewMode("legacy_siting")}
    />
  );
};
