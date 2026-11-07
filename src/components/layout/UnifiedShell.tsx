"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { PriorityCell, GreenLossDataset } from "@/server/priority/types";
import { OptimizeResult } from "@/server/priority/optimizer";
import { UnifiedNavRail, NavMode } from "./UnifiedNavRail";
import { UnifiedTopBar } from "./UnifiedTopBar";
import { CityOverviewDashboard } from "@/components/dashboard/CityOverviewDashboard";
import { HeatPriorityScreen } from "@/components/priority/HeatPriorityScreen";
import { AppShell } from "./AppShell";
import { CopilotDrawer } from "@/components/copilot/CopilotDrawer";
import { TwoScenarioComparisonModal } from "@/components/priority/TwoScenarioComparisonModal";
import { ShadowSimulatorModal } from "@/components/solar/ShadowSimulatorModal";
import { SolarRealityModal } from "@/components/solar/SolarRealityModal";
import { ScenarioComparisonModal } from "@/components/scenarios/ScenarioComparisonModal";
import { CopilotChatContext } from "@/server/ai/advisor";

interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
}

interface Scenario {
  id: string;
  name: string;
}

interface UnifiedShellProps {
  initialCells: PriorityCell[];
  initialOptimization?: OptimizeResult | null;
  initialGreenLoss?: GreenLossDataset | null;
  user: UserProfile;
  initialScenarios: Scenario[];
}

export const UnifiedShell: React.FC<UnifiedShellProps> = ({
  initialCells,
  initialOptimization,
  initialGreenLoss,
  user,
  initialScenarios,
}) => {
  // Navigation & Shell State
  const [navMode, setNavMode] = useState<NavMode>("overview");
  const [isNavCollapsed, setIsNavCollapsed] = useState<boolean>(false);
  const [selectedWard, setSelectedWard] = useState<string>("All");

  // Modals & Drawers State
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [copilotInitialMessage, setCopilotInitialMessage] = useState<string | undefined>(undefined);
  const [isTwoScenarioModalOpen, setIsTwoScenarioModalOpen] = useState<boolean>(false);
  const [isShadowSimulatorOpen, setIsShadowSimulatorOpen] = useState<boolean>(false);
  const [isSolarRealityOpen, setIsSolarRealityOpen] = useState<boolean>(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState<boolean>(false);

  // Available unique wards extracted from authentic cell dataset
  const availableWards = useMemo(() => {
    const wardSet = new Set<string>();
    initialCells.forEach((c) => {
      if (c.ward) wardSet.add(c.ward);
    });
    return Array.from(wardSet).sort();
  }, [initialCells]);

  // Context passed to Copilot based on active view and selected ward
  const copilotContext: CopilotChatContext = useMemo(() => {
    return {
      studyArea: `Pune Central Study Area (PMC) - Ward: ${selectedWard}`,
      infrastructureType: navMode === "siting" ? "Civic Siting Infrastructure" : "Urban Heat & Cooling Interventions",
      placement: undefined,
      validation: undefined,
    };
  }, [selectedWard, navMode]);

  // Keyboard shortcut listener: ⌘J / Ctrl+J toggles AI Copilot
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsCopilotOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleOpenCopilot = useCallback((message?: string) => {
    if (message) {
      setCopilotInitialMessage(message);
    }
    setIsCopilotOpen(true);
  }, []);

  const handleNavSelect = useCallback((mode: NavMode) => {
    if (mode === "shadow_sim") {
      setIsShadowSimulatorOpen(true);
      return;
    }
    if (mode === "solar_reality") {
      setIsSolarRealityOpen(true);
      return;
    }
    if (mode === "reports") {
      setIsTwoScenarioModalOpen(true);
      return;
    }
    setNavMode(mode);
  }, []);

  const handleExportTopDossier = useCallback(async () => {
    try {
      let targetCellId = initialOptimization?.selected_cells?.[0]?.id || initialCells?.[0]?.id || "PMC_CELL_0001";
      if (selectedWard) {
        const wardCell = initialCells.find((c) => c.ward?.toLowerCase() === selectedWard.toLowerCase());
        if (wardCell) targetCellId = wardCell.id;
      }
      const res = await fetch(`/api/zone/${targetCellId}/dossier-pdf?target_ndvi=0.65&budget_ha=10.0`);
      if (!res.ok) throw new Error("Failed to export PDF dossier");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `UrjaSetu-Evidence-Dossier-${targetCellId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      setIsTwoScenarioModalOpen(true);
    }
  }, [initialOptimization, initialCells, selectedWard]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans select-none antialiased">
      {/* 1. Left Collapsible Navigation Rail */}
      <UnifiedNavRail
        currentMode={navMode}
        onSelectMode={handleNavSelect}
        isCollapsed={isNavCollapsed}
        onToggleCollapse={() => setIsNavCollapsed((prev) => !prev)}
        onOpenCopilot={() => handleOpenCopilot()}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Top Bar (Unified across all views) */}
        <UnifiedTopBar
          selectedWard={selectedWard}
          onSelectWard={setSelectedWard}
          availableWards={availableWards}
          onOpenCompare={() => setIsTwoScenarioModalOpen(true)}
          onOpenReport={handleExportTopDossier}
          onOpenCopilot={() => handleOpenCopilot()}
        />

        {/* View Switcher Container */}
        <main className="flex-1 relative flex overflow-hidden">
          {navMode === "overview" && (
            <CityOverviewDashboard
              cells={initialCells}
              greenLoss={initialGreenLoss || null}
              onNavigate={(mode) => setNavMode(mode)}
              onSelectWard={(ward) => {
                setSelectedWard(ward);
                setNavMode("heat_priority");
              }}
              onOpenCopilot={handleOpenCopilot}
            />
          )}

          {navMode === "heat_priority" && (
            <div className="w-full h-full relative">
              <HeatPriorityScreen
                initialCells={initialCells}
                initialOptimization={initialOptimization}
                initialGreenLoss={initialGreenLoss}
                selectedWard={selectedWard}
                onSelectWard={setSelectedWard}
                initialPanelTab="scenario"
                hideTopBar={true}
                onOpenTwoScenarioComparison={() => setIsTwoScenarioModalOpen(true)}
                onOpenLegacyManualSiting={() => setNavMode("siting")}
                onOpenLegacyShadowSimulator={() => setIsShadowSimulatorOpen(true)}
                onOpenLegacySolarReality={() => setIsSolarRealityOpen(true)}
                onOpenLegacyCopilot={() => handleOpenCopilot()}
              />
            </div>
          )}

          {navMode === "green_loss" && (
            <div className="w-full h-full relative">
              <HeatPriorityScreen
                initialCells={initialCells}
                initialOptimization={initialOptimization}
                initialGreenLoss={initialGreenLoss}
                selectedWard={selectedWard}
                onSelectWard={setSelectedWard}
                initialPanelTab="green_loss"
                hideTopBar={true}
                onOpenTwoScenarioComparison={() => setIsTwoScenarioModalOpen(true)}
                onOpenLegacyManualSiting={() => setNavMode("siting")}
                onOpenLegacyShadowSimulator={() => setIsShadowSimulatorOpen(true)}
                onOpenLegacySolarReality={() => setIsSolarRealityOpen(true)}
                onOpenLegacyCopilot={() => handleOpenCopilot()}
              />
            </div>
          )}

          {navMode === "siting" && (
            <div className="w-full h-full relative">
              <AppShell
                user={user}
                initialScenarios={initialScenarios}
                initialScenarioId={initialScenarios[0]?.id || "default"}
                embedded={true}
              />
            </div>
          )}
        </main>
      </div>

      {/* 3. Global AI Copilot Slide-Over Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => {
          setIsCopilotOpen(false);
          setCopilotInitialMessage(undefined);
        }}
        context={copilotContext}
      />

      {/* 4. Global Two-Scenario Comparison Modal & PDF Export */}
      <TwoScenarioComparisonModal
        isOpen={isTwoScenarioModalOpen}
        onClose={() => setIsTwoScenarioModalOpen(false)}
        initialWardA={selectedWard}
      />

      {/* 5. Solar Shadow Simulator Modal */}
      <ShadowSimulatorModal
        isOpen={isShadowSimulatorOpen}
        onClose={() => setIsShadowSimulatorOpen(false)}
        onApplyMapOverlay={() => {}}
        placement={{
          id: "pune-central-solar-site",
          lat: 18.5204,
          lng: 73.8567,
          lengthM: 60,
          widthM: 40,
          bearingDeg: 180,
          params: { systemType: "Rooftop Commercial", capacityKw: 150 },
        }}
      />

      {/* 6. Solar Reality & Financials Modal */}
      <SolarRealityModal
        isOpen={isSolarRealityOpen}
        onClose={() => setIsSolarRealityOpen(false)}
        placement={{
          id: "pune-central-solar-site",
          lat: 18.5204,
          lng: 73.8567,
          lengthM: 60,
          widthM: 40,
          bearingDeg: 180,
          params: { systemType: "Rooftop Commercial", capacityKw: 150 },
        }}
      />

      {/* 7. Siting Scenario Comparison Modal */}
      <ScenarioComparisonModal
        isOpen={isReportsModalOpen}
        onClose={() => setIsReportsModalOpen(false)}
      />
    </div>
  );
};
