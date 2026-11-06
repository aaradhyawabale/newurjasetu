"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HeatPlannerPage: The Main Heat Intelligence & Budget Planner
 * Single-page core experience for Pune municipal planners and SDG 13 judges.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Cell,
  ModelCard,
  OptimizeResult,
  OptimizeRequest,
} from '@/api/contract';
import {
  getCells,
  getModelCard,
  optimize,
  isDemoMode,
} from '@/api/client';
import { MapView, MapLayerType } from '@/components/map/MapView';
import { ProgressStrip } from '@/components/planner/ProgressStrip';
import { ScenarioPanel } from '@/components/planner/ScenarioPanel';
import { PortfolioSummary } from '@/components/planner/PortfolioSummary';
import { EvidenceDrawer } from '@/components/planner/EvidenceDrawer';
import { ScenarioCompareModal } from '@/components/planner/ScenarioCompareModal';
import { CopilotDock, CoachMarks } from '@/components/planner/CopilotDock';
import { Skeleton, ErrorState, Toast } from '@/components/ui/FeedbackStates';
import { ToolPageHeader } from '@/components/ui/ToolPageHeader';
import { Button } from '@/components/ui/Button';
import { useAppSearchParams, AppLink } from '@/lib/nav';
import { usePlan } from '@/context/PlanContext';
import { RankedZoneItem } from '@/components/planner/ScenarioPanel';

const COACH_MARKS_KEY = 'urjasetu_planner_tour_dismissed';

export const HeatPlannerPage: React.FC = () => {
  const [searchParams] = useAppSearchParams();
  const initialCellId = searchParams.get('cell');

  // Core State
  const [cells, setCells] = useState<Cell[]>([]);
  const [modelCard, setModelCard] = useState<ModelCard | null>(null);
  const [resultA, setResultA] = useState<OptimizeResult | null>(null);
  const [resultB, setResultB] = useState<OptimizeResult | null>(null);

  // Selected Zone for Evidence Drawer
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);

  // Optimizer Inputs
  const [budgetHa, setBudgetHa] = useState<number>(25);
  const [targetNdvi, setTargetNdvi] = useState<number>(0.5);
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

  // Scenario B
  const [hasScenarioB, setHasScenarioB] = useState<boolean>(false);
  const [budgetHaB, setBudgetHaB] = useState<number>(40);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);

  // Progress Stepper & Map Layer
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('burden');

  // Status & Coach Marks
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCoachMarks, setShowCoachMarks] = useState<boolean>(false);

  // Check Coach Marks dismissal
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(COACH_MARKS_KEY);
      if (!dismissed) {
        setShowCoachMarks(true);
      }
    } catch {
      // Ignore local storage error in sandboxed environment
    }
  }, []);

  const handleDismissCoachMarks = () => {
    setShowCoachMarks(false);
    try {
      localStorage.setItem(COACH_MARKS_KEY, 'true');
    } catch {
      // Ignore
    }
  };

  // Initial Load
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cellsData, cardData] = await Promise.all([
        getCells(),
        getModelCard(),
      ]);
      setCells(cellsData);
      setModelCard(cardData);

      // Run default optimization with 25 ha so the page is never empty on load
      const initialReq: OptimizeRequest = {
        budget_ha: 25,
        objective: 'people_cooling',
        target_ndvi: 0.5,
      };
      const optResult = await optimize(initialReq);
      setResultA(optResult);

      // If deep link parameter ?cell=PUN-Zxxx is present, open that cell's dossier
      if (initialCellId) {
        const found = cellsData.find((c) => c.id === initialCellId);
        if (found) {
          setSelectedCell(found);
          setIsEvidenceOpen(true);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize heat planner data');
    } finally {
      setIsLoading(false);
    }
  }, [initialCellId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Run Optimization for Scenario A (and Scenario B if toggled)
  const handleRunOptimization = async () => {
    setIsOptimizing(true);
    try {
      const reqA: OptimizeRequest = {
        budget_ha: budgetHa,
        objective: 'people_cooling',
        ward: selectedWard || undefined,
        target_ndvi: targetNdvi,
      };
      const resA = await optimize(reqA);
      setResultA(resA);

      if (hasScenarioB) {
        const reqB: OptimizeRequest = {
          budget_ha: budgetHaB,
          objective: 'people_cooling',
          ward: selectedWard || undefined,
          target_ndvi: targetNdvi,
        };
        const resB = await optimize(reqB);
        setResultB(resB);
      }

      setCurrentStep(3); // Progress to "Review the plan"
      setToastMessage(
        `Plan updated: ${resA.totals.zones} zones allocated covering ${resA.totals.people_covered.toLocaleString()} citizens.`
      );
    } catch (err: any) {
      setToastMessage(`Optimization error: ${err?.message || 'Calculation failed'}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const { addItem, plan } = usePlan();
  const addedZoneIds = useMemo(() => plan.sections.zones.map((z) => z.id), [plan.sections.zones]);

  const cellsMap = useMemo(() => {
    const map = new Map<string, Cell>();
    cells.forEach((c) => map.set(c.id, c));
    return map;
  }, [cells]);

  const [topPerWard, setTopPerWard] = useState(false);

  // Handle cell click on map
  const handleSelectCell = (cell: Cell) => {
    setSelectedCell(cell);
    setIsEvidenceOpen(true);
    setCurrentStep(3);
    // Two-way sync: scroll list into view if available
    setTimeout(() => {
      const el = document.getElementById(`zone-card-${cell.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  const handleSelectZoneFromList = (cellId: string) => {
    const found = cellsMap.get(cellId);
    if (found) {
      setSelectedCell(found);
      setIsEvidenceOpen(true);
      setCurrentStep(3);
    }
  };

  const displayedCells = useMemo(() => {
    if (!selectedWard) return cells;
    return cells.filter((c) => c.ward.toLowerCase() === selectedWard.toLowerCase());
  }, [cells, selectedWard]);

  // Ranked zone items for list display & map labels
  const rankedZoneItems = useMemo<RankedZoneItem[]>(() => {
    if (topPerWard) {
      const byWard = new Map<string, Cell[]>();
      displayedCells.forEach((c) => {
        const list = byWard.get(c.ward) || [];
        list.push(c);
        byWard.set(c.ward, list);
      });
      const items: RankedZoneItem[] = [];
      let rankCounter = 1;
      Array.from(byWard.entries()).forEach(([, wardCells]) => {
        const sorted = [...wardCells].sort((a, b) => {
          const burdenA = (a.population ?? 0) * (a.lst_mean ?? 0);
          const burdenB = (b.population ?? 0) * (b.lst_mean ?? 0);
          return burdenB - burdenA;
        });
        sorted.slice(0, 3).forEach((c) => {
          items.push({
            id: c.id,
            rank: rankCounter++,
            ward: c.ward,
            locality: c.locality,
            greenableHa: c.greenable_ha ?? 0,
            coolingC: c.cooling_mean ?? undefined,
            population: c.population ?? 0,
            lstMean: c.lst_mean ?? undefined,
          });
        });
      });
      return items;
    }

    if (!resultA) return [];
    return resultA.selected.map((s) => {
      const c = cellsMap.get(s.id);
      return {
        id: s.id,
        rank: s.rank,
        ward: c?.ward || '',
        locality: c?.locality,
        greenableHa: c?.greenable_ha ?? 0,
        coolingC: c?.cooling_mean ?? undefined,
        population: c?.population ?? 0,
        lstMean: c?.lst_mean ?? undefined,
      };
    });
  }, [topPerWard, displayedCells, resultA, cellsMap]);

  const rankedZonesMeta = useMemo(() => {
    return rankedZoneItems.map((rz) => ({
      id: rz.id,
      rank: rz.rank,
      label: `#${rz.rank} ${rz.ward} - ${rz.locality || rz.ward}`,
    }));
  }, [rankedZoneItems]);

  const handleAddZoneToPlan = (zone: RankedZoneItem) => {
    const loc = zone.locality || zone.ward;
    addItem({
      id: zone.id,
      title: `#${zone.rank} ${zone.ward} - ${loc}`,
      subtitle: `${zone.greenableHa} ha unbuilt greening · ${zone.population.toLocaleString('en-IN')} pop`,
      section: 'zones',
      metadata: {
        rank: zone.rank,
        ward: zone.ward,
        locality: zone.locality,
        greenableHa: zone.greenableHa,
        coolingC: zone.coolingC,
        population: zone.population,
      },
    });
    setToastMessage(`Added #${zone.rank} ${zone.ward} - ${loc} to municipal plan.`);
  };

  // Handle step click in progress strip
  const handleStepClick = (step: number) => {
    setCurrentStep(step);
    if (step === 1) {
      setActiveLayer('burden');
    } else if (step === 2) {
      // Focus on scenario panel
    } else if (step === 3 && resultA && resultA.selected.length > 0) {
      // Focus on top selected zone
      const topCell = cells.find((c) => c.id === resultA.selected[0].id);
      if (topCell) {
        setSelectedCell(topCell);
        setIsEvidenceOpen(true);
      }
    } else if (step === 4) {
      if (hasScenarioB) {
        setIsCompareModalOpen(true);
      } else {
        setHasScenarioB(true);
        setToastMessage('Scenario B enabled for side-by-side comparison');
      }
    }
  };

  const handleExportPlan = () => {
    if (!resultA) return;
    const content = JSON.stringify(
      {
        plan: 'UrjaSetu Pune Municipal Greening Allocation Plan',
        generatedAt: new Date().toISOString(),
        parameters: {
          budget_ha: budgetHa,
          ward: selectedWard || 'All Wards',
          target_ndvi: targetNdvi,
        },
        totals: resultA.totals,
        selectedZones: resultA.selected.map((s) => {
          const c = cells.find((cell) => cell.id === s.id);
          return {
            ...s,
            ward: c?.ward,
            lst_mean: c?.lst_mean,
            population: c?.population,
          };
        }),
      },
      null,
      2
    );
    const blob = new Blob([content], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `UrjaSetu-Plan-${budgetHa}ha-${selectedWard || 'Pune'}.json`;
    link.click();
    setToastMessage('Municipal plan exported successfully as JSON.');
  };

  const selectedZoneIds = resultA ? resultA.selected.map((s) => s.id) : [];

  const selectedZoneRank =
    selectedCell && resultA
      ? resultA.selected.find((s) => s.id === selectedCell.id)?.rank
      : undefined;

  const selectedZoneFrequency =
    selectedCell && resultA
      ? resultA.selected.find((s) => s.id === selectedCell.id)?.selection_frequency
      : undefined;

  if (isLoading) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[650px]">
          <Skeleton className="h-full lg:col-span-1" />
          <Skeleton className="h-full lg:col-span-3" />
        </div>
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-16">
        <ErrorState
          title="Failed to Load Heat Intelligence Data"
          message={error}
          onRetry={loadInitialData}
        />
      </main>
    );
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-4 min-h-[calc(100vh-4rem)]">
      {/* Tool Page Header */}
      <ToolPageHeader
        title="Heat Intelligence + Budget Planner"
        purpose="Find the hottest, most crowded places in Pune, set an unbuilt greening budget, and generate a ranked cooling plan defended by 30-seed model ensembles."
        steps={[
          'Examine the 250m heat burden grid to identify thermal hotspots in densely populated wards.',
          'Set available municipal greening hectares (ha) and target vegetation index (NDVI) on the left panel.',
          'Review selected priority zones, inspect uncertainty ranges in the Evidence Dossier, and export.',
        ]}
        dataUsed={[
          { label: 'Landsat-8/9 & Sentinel-2 LST', type: 'Measured' },
          { label: 'PMC Population Density', type: 'Assumed' },
          { label: '30-Model Cooling Ensemble', type: 'Modelled' },
          { label: 'Greening Budget Constraints', type: 'Assumed' },
        ]}
        breadcrumbItems={[{ label: 'Heat Planner' }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStepClick(4)}
            className="text-xs bg-white"
          >
            Compare Budgets
          </Button>
        }
      />

      {/* 4-Step Progress Strip */}
      <ProgressStrip currentStep={currentStep} onStepClick={handleStepClick} />

      {/* Main Workspace Split: Left ScenarioPanel, Centre MapView */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch">
        {/* Left: Scenario Configuration Panel (4 cols) */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col">
          <ScenarioPanel
            budgetHa={budgetHa}
            onBudgetChange={setBudgetHa}
            targetNdvi={targetNdvi}
            onTargetNdviChange={setTargetNdvi}
            selectedWard={selectedWard}
            onWardChange={setSelectedWard}
            onRunOptimization={handleRunOptimization}
            isOptimizing={isOptimizing}
            hasScenarioB={hasScenarioB}
            onToggleScenarioB={() => setHasScenarioB(!hasScenarioB)}
            budgetHaB={budgetHaB}
            onBudgetBChange={setBudgetHaB}
            topPerWard={topPerWard}
            onToggleTopPerWard={setTopPerWard}
            rankedZones={rankedZoneItems}
            selectedZoneId={selectedCell?.id}
            onSelectZone={handleSelectZoneFromList}
            onAddZoneToPlan={handleAddZoneToPlan}
            addedZoneIds={addedZoneIds}
            className="flex-1"
          />
        </div>

        {/* Centre: Map View (8 cols) */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-[520px] lg:min-h-0">
          <MapView
            cells={displayedCells}
            selectedIds={selectedZoneIds}
            highlightedCellId={selectedCell?.id}
            rankedZones={rankedZonesMeta}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            onSelect={handleSelectCell}
            fitBounds={true}
            height="100%"
            className="flex-1 min-h-[500px]"
          />
        </div>
      </div>

      {/* Bottom: Portfolio Summary */}
      <PortfolioSummary
        result={resultA}
        modelCard={modelCard}
        onCompareScenarios={() => {
          if (!hasScenarioB) setHasScenarioB(true);
          setIsCompareModalOpen(true);
        }}
        onExportPlan={handleExportPlan}
      />

      {/* Methodological Scope and Limitations */}
      <div
        data-tour="heat-limits"
        className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <div>
          <span className="font-semibold text-slate-700">Planning Model Limits:</span>{' '}
          Cooling predictions model daytime land surface skin temperature. Unbuilt greening requires on-site soil suitability, underground utility clearance, and municipal water access.
        </div>
        <AppLink to="/method" className="text-[#0F5C63] hover:underline font-semibold whitespace-nowrap">
          Read Method Card &rarr;
        </AppLink>
      </div>

      {/* Evidence Drawer for Selected Zone */}
      <EvidenceDrawer
        cell={selectedCell}
        modelCard={modelCard}
        isOpen={isEvidenceOpen}
        onClose={() => setIsEvidenceOpen(false)}
        rank={selectedZoneRank}
        selectionFrequency={selectedZoneFrequency}
      />

      {/* Scenario Compare Modal */}
      <ScenarioCompareModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        scenarioA={{
          name: 'Scenario A (Current)',
          budgetHa,
          result: resultA,
        }}
        scenarioB={{
          name: 'Scenario B',
          budgetHa: budgetHaB,
          result: resultB,
        }}
        modelCard={modelCard}
      />

      {/* Climate Copilot Dock */}
      <CopilotDock currentResult={resultA} selectedCell={selectedCell} />

      {/* First-visit Onboarding Coach Marks */}
      {showCoachMarks && <CoachMarks onDismiss={handleDismissCoachMarks} />}

      {/* Ephemeral Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="info"
          onClose={() => setToastMessage(null)}
        />
      )}
    </main>
  );
};
