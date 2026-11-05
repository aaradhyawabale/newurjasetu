"use client";

import React from "react";
import { UnifiedShell } from "./UnifiedShell";
import { PriorityCell, GreenLossDataset } from "@/server/priority/types";
import { OptimizeResult } from "@/server/priority/optimizer";

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
  return (
    <UnifiedShell
      initialCells={initialCells}
      initialOptimization={initialOptimization}
      initialGreenLoss={initialGreenLoss}
      user={user}
      initialScenarios={initialScenarios}
    />
  );
};
