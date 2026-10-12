"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { TopBar } from "./TopBar";
import { ToolSidebar } from "./ToolSidebar";
import { MapView, StudyAreaBounds } from "../map/MapView";
import { PlacementPanel } from "../panels/PlacementPanel";
import { ReportDrawer } from "../reports/ReportDrawer";
import { HistoryDrawer, HistoryItem } from "../history/HistoryDrawer";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useToast } from "../ui/Toast";
import { InfrastructureTypeId, INFRASTRUCTURE_TYPES } from "@/config/infra-types";
import { ValidationResult } from "@/server/analysis-engine/validation";
import { AnalysisReportResult } from "@/server/analysis-engine/engine";
import { exportPlacementsToGeoJson, downloadJsonFile } from "@/lib/geojson-export";
import { calculateDistanceMeters } from "@/server/gis/geometry";

interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
}

interface Scenario {
  id: string;
  name: string;
}

interface AppShellProps {
  user: UserProfile;
  initialScenarios: Scenario[];
  initialScenarioId: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  user,
  initialScenarios,
  initialScenarioId,
}) => {
  const { showToast } = useToast();

  // State: Scenarios
  const [scenarios, setScenarios] = useState<Scenario[]>(initialScenarios);
  const [currentScenarioId, setCurrentScenarioId] = useState<string>(initialScenarioId);

  // State: Tools & Placements
  const [activeTool, setActiveTool] = useState<string>("Hospital");
  const [activePlacement, setActivePlacement] = useState<any | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>("");
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 28.6139,
    lng: 77.2090, // Default New Delhi coordinates
  });

  // State: Select Area 2-click bounding box
  const [areaStartCorner, setAreaStartCorner] = useState<{ lat: number; lng: number } | null>(null);
  const [studyArea, setStudyArea] = useState<StudyAreaBounds | null>(null);

  // State: Validation & Analysis
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [currentReport, setCurrentReport] = useState<AnalysisReportResult | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // State: History
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  // State: Confirm Dialogs
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  // Map canvas export ref & debounced PATCH timer ref
  const mapCanvasExportRef = useRef<(() => string | null) | null>(null);
  const patchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load History for the User
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/analyses");
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data.analyses || []);
      }
    } catch (err) {
      console.warn("History fetch error", err);
    }
  }, []);

  // Load Placements for the current Scenario
  const loadPlacements = useCallback(async (scenarioId: string) => {
    try {
      const res = await fetch(`/api/placements?scenarioId=${scenarioId}`);
      if (res.ok) {
        const data = await res.json();
        const list = data.placements || [];
        if (list.length > 0) {
          const first = list[0];
          setActivePlacement(first);
          setActiveTool(first.type);
          setMapCenter({ lat: first.lat, lng: first.lng });
          setLocationLabel(first.label || `${first.lat.toFixed(4)}, ${first.lng.toFixed(4)}`);
        } else {
          setActivePlacement(null);
        }
      }
    } catch (err) {
      console.warn("Placements fetch error", err);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    if (currentScenarioId) {
      loadPlacements(currentScenarioId);
    }
  }, [currentScenarioId, loadHistory, loadPlacements]);

  // Reverse Geocoding Helper
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/reverse?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        setLocationLabel(data.label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        return data.label;
      }
    } catch {
      // ignore
    }
    const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    setLocationLabel(fallback);
    return fallback;
  };

  // Validate Footprint
  const handleValidateFootprint = async (): Promise<ValidationResult | null> => {
    if (!activePlacement || !activePlacement.id) return null;
    setIsValidating(true);
    try {
      const res = await fetch(`/api/placements/${activePlacement.id}/validate`, {
        method: "POST",
      });

      if (res && res.ok) {
        const data = await res.json();
        setValidationResult(data.validation);
        showToast("Footprint validated against site features", "info");
        return data.validation;
      }
    } catch (err) {
      showToast("Site validation check failed", "error");
    } finally {
      setIsValidating(false);
    }
    return null;
  };

  // Handle Map Click: Place or Move Pin, or Draw Study Area Box
  const handleMapClick = async (lat: number, lng: number) => {
    if (activeTool === "Select Area") {
      if (!areaStartCorner) {
        setAreaStartCorner({ lat, lng });
        setStudyArea(null);
        showToast("Corner 1 set — click a second point on the map to complete the study area rectangle", "info");
      } else {
        const swLat = Math.min(areaStartCorner.lat, lat);
        const neLat = Math.max(areaStartCorner.lat, lat);
        const swLng = Math.min(areaStartCorner.lng, lng);
        const neLng = Math.max(areaStartCorner.lng, lng);
        setStudyArea({ swLat, swLng, neLat, neLng });
        setAreaStartCorner(null);

        const widthM = calculateDistanceMeters(swLat, swLng, swLat, neLng);
        const heightM = calculateDistanceMeters(swLat, swLng, neLat, swLng);
        const areaHa = ((widthM * heightM) / 10000).toFixed(2);
        showToast(`Study area defined: ${Math.round(widthM)}m × ${Math.round(heightM)}m (${areaHa} ha)`, "success");
      }
      return;
    }

    const typeConfig = INFRASTRUCTURE_TYPES[activeTool as InfrastructureTypeId] || INFRASTRUCTURE_TYPES["Hospital"];
    const toolToPlace = INFRASTRUCTURE_TYPES[activeTool as InfrastructureTypeId] ? activeTool : "Hospital";
    const initialParams: Record<string, any> = {};
    if (typeConfig) {
      for (const p of typeConfig.parameters) {
        initialParams[p.id] = p.defaultValue;
      }
    }

    if (!activePlacement) {
      // Create new placement in DB
      try {
        const label = await reverseGeocode(lat, lng);
        const res = await fetch("/api/placements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioId: currentScenarioId,
            type: toolToPlace,
            lat,
            lng,
            lengthM: typeConfig?.defaultLengthM || 100,
            widthM: typeConfig?.defaultWidthM || 60,
            bearingDeg: 0,
            params: initialParams,
            label,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setActivePlacement(data.placement);
          setActiveTool(toolToPlace);
          setValidationResult(null);
          showToast(`Placed ${toolToPlace} pin on map`, "success");
        }
      } catch (err) {
        showToast("Failed to save placement", "error");
      }
    } else {
      // Move existing placement to new coordinates
      const updated = {
        ...activePlacement,
        lat,
        lng,
      };
      setActivePlacement(updated);
      setValidationResult(null);
      const label = await reverseGeocode(lat, lng);

      if (activePlacement.id) {
        try {
          await fetch(`/api/placements/${activePlacement.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng, label }),
          });
        } catch {
          // silent fail/optimistic update
        }
      }
    }
  };

  // Handle Tool Selection
  const handleSelectTool = async (toolId: string) => {
    setActiveTool(toolId);
    if (toolId === "Select Area") {
      setAreaStartCorner(null);
      showToast("Select Area mode: click two corners on the map to draw a study zone", "info");
      return;
    }

    if (toolId !== "Remove" && activePlacement) {
      // Switch type of active placement and reset type-specific parameters to defaults
      const typeConfig = INFRASTRUCTURE_TYPES[toolId as InfrastructureTypeId];
      if (typeConfig) {
        const defaultParams: Record<string, any> = {};
        for (const p of typeConfig.parameters) {
          defaultParams[p.id] = p.defaultValue;
        }

        const updated = {
          ...activePlacement,
          type: toolId,
          lengthM: typeConfig.defaultLengthM,
          widthM: typeConfig.defaultWidthM,
          params: defaultParams,
        };
        setActivePlacement(updated);
        setValidationResult(null);
        if (activePlacement.id) {
          fetch(`/api/placements/${activePlacement.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: toolId,
              lengthM: typeConfig.defaultLengthM,
              widthM: typeConfig.defaultWidthM,
              params: defaultParams,
              replaceParams: true,
            }),
          }).catch(() => {});
        }
      }
    }
  };

  // Handle Remove Placement (with confirmation)
  const handleRemoveClick = () => {
    if (!activePlacement) return;
    setConfirmDialog({
      isOpen: true,
      title: "Remove Project Placement",
      description: `Are you sure you want to delete the placed ${activePlacement.type} project and all its associated analysis reports? This cannot be undone.`,
      onConfirm: async () => {
        try {
          if (activePlacement.id) {
            await fetch(`/api/placements/${activePlacement.id}`, {
              method: "DELETE",
            });
          }
          setActivePlacement(null);
          setValidationResult(null);
          setCurrentReport(null);
          setCurrentAnalysisId(null);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          showToast("Placement removed successfully", "info");
          loadHistory();
        } catch {
          showToast("Failed to delete placement", "error");
        }
      },
    });
  };

  // Run Multi-Criteria Analysis
  const handleRunAnalysis = async () => {
    if (!activePlacement || !activePlacement.id) {
      showToast("Place an infrastructure pin before running analysis", "error");
      return;
    }

    // Flush any pending debounced PATCH before running analysis
    if (patchTimerRef.current) {
      clearTimeout(patchTimerRef.current);
      patchTimerRef.current = null;
      await fetch(`/api/placements/${activePlacement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activePlacement.type,
          lat: activePlacement.lat,
          lng: activePlacement.lng,
          lengthM: activePlacement.lengthM,
          widthM: activePlacement.widthM,
          bearingDeg: activePlacement.bearingDeg,
          params: activePlacement.params,
        }),
      }).catch(() => {});
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placementId: activePlacement.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Analysis failed");
      }

      const data = await res.json();
      setCurrentReport(data.analysis.result);
      setCurrentAnalysisId(data.analysis.id);
      setIsReportOpen(true);
      showToast(`Analysis complete: Score ${data.analysis.overallScore}/100`, "success");
      loadHistory();
    } catch (err: any) {
      showToast(err.message || "Failed to execute analysis engine", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Download PDF Report
  const handleDownloadPdf = async () => {
    if (!currentReport) {
      showToast("Run 'Analyze' first to generate a report before downloading PDF", "info");
      return;
    }

    setIsDownloadingPdf(true);
    try {
      let mapPng: string | null = null;
      if (mapCanvasExportRef.current) {
        mapPng = mapCanvasExportRef.current();
      }

      const targetId = currentAnalysisId || currentReport.placementSnapshot.id;
      const res = await fetch(`/api/analyses/${targetId}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapImage: mapPng }),
      });

      if (!res.ok) throw new Error("PDF generation failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `UrjaSetu-Report-${currentReport.placementSnapshot.type}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast("PDF report downloaded", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to download PDF report", "error");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Export Map Canvas as PNG
  const handleExportMapPng = () => {
    if (!mapCanvasExportRef.current) {
      showToast("Map canvas not yet initialized", "error");
      return;
    }

    try {
      const dataUrl = mapCanvasExportRef.current();
      if (!dataUrl) throw new Error("Could not capture map canvas");

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `UrjaSetu-Map-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast("Map exported successfully as PNG", "success");
    } catch (err) {
      showToast("Failed to export map PNG", "error");
    }
  };

  // Export GeoJSON
  const handleExportGeoJson = () => {
    const placementsToExport = activePlacement ? [activePlacement] : [];
    if (placementsToExport.length === 0) {
      showToast("No placements available to export", "info");
      return;
    }
    const currentScenario = scenarios.find((s) => s.id === currentScenarioId);
    const jsonStr = exportPlacementsToGeoJson(placementsToExport, currentScenario?.name || "Scenario");
    downloadJsonFile(`UrjaSetu-Placements-${Date.now()}.geojson`, jsonStr);
    showToast("Placements exported as GeoJSON", "success");
  };

  // Reopen Saved Analysis Report from History
  const handleOpenSavedReport = async (analysisId: string) => {
    try {
      const res = await fetch(`/api/analyses/${analysisId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentReport(data.analysis.result);
        setCurrentAnalysisId(data.analysis.id);
        setIsReportOpen(true);
      }
    } catch {
      showToast("Failed to open report", "error");
    }
  };

  // Delete Analysis from History
  const handleDeleteReport = async (analysisId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Analysis Report",
      description: "Are you sure you want to delete this historical analysis report? This action cannot be undone.",
      onConfirm: async () => {
        try {
          await fetch(`/api/analyses/${analysisId}`, { method: "DELETE" });
          if (currentAnalysisId === analysisId) {
            setCurrentReport(null);
            setCurrentAnalysisId(null);
            setIsReportOpen(false);
          }
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          showToast("Analysis report deleted", "info");
          loadHistory();
        } catch {
          showToast("Failed to delete analysis", "error");
        }
      },
    });
  };

  // Create Scenario
  const handleCreateScenario = async (name: string) => {
    try {
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        setScenarios([data.scenario, ...scenarios]);
        setCurrentScenarioId(data.scenario.id);
        setActivePlacement(null);
        setValidationResult(null);
        showToast(`Created scenario "${name}"`, "success");
      }
    } catch {
      showToast("Failed to create scenario", "error");
    }
  };

  // Rename Scenario
  const handleRenameScenario = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/scenarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        setScenarios((prev) =>
          prev.map((sc) => (sc.id === id ? { ...sc, name: data.scenario.name } : sc))
        );
        showToast(`Renamed scenario to "${data.scenario.name}"`, "success");
      }
    } catch {
      showToast("Failed to rename scenario", "error");
    }
  };

  // Delete Scenario
  const handleDeleteScenario = async (id: string) => {
    try {
      await fetch(`/api/scenarios/${id}`, { method: "DELETE" });
      const remaining = scenarios.filter((s) => s.id !== id);
      setScenarios(remaining);
      if (remaining.length > 0) {
        setCurrentScenarioId(remaining[0].id);
      }
      showToast("Scenario deleted", "info");
    } catch {
      showToast("Failed to delete scenario", "error");
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch {
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* TopBar (56px) */}
      <TopBar
        locationLabel={locationLabel}
        selectedPointName={
          activePlacement
            ? `${activePlacement.type} (${activePlacement.lat.toFixed(3)}, ${activePlacement.lng.toFixed(3)})`
            : ""
        }
        scenarios={scenarios}
        currentScenarioId={currentScenarioId}
        onSelectScenario={(id) => setCurrentScenarioId(id)}
        onCreateScenario={handleCreateScenario}
        onRenameScenario={handleRenameScenario}
        onDeleteScenario={handleDeleteScenario}
        onAnalyzeClick={handleRunAnalysis}
        onPdfClick={handleDownloadPdf}
        onHistoryClick={() => setIsHistoryOpen(true)}
        onExportMapClick={handleExportMapPng}
        onExportGeoJsonClick={handleExportGeoJson}
        onSearchSelectLocation={(lat, lng, label) => {
          setMapCenter({ lat, lng });
          setLocationLabel(label);
          handleMapClick(lat, lng);
        }}
        onSignOut={handleSignOut}
        userName={user.name || user.email}
        historyCount={historyItems.length}
        isAnalyzing={isAnalyzing}
        hasActivePlacement={Boolean(activePlacement)}
      />

      {/* Main Workspace: Left Sidebar + Center Map + Right Panel */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Tool Sidebar */}
        <ToolSidebar
          selectedTool={activeTool}
          onSelectTool={handleSelectTool}
          onRemoveClick={handleRemoveClick}
          onHistoryClick={() => setIsHistoryOpen(true)}
          onExportMapClick={handleExportMapPng}
          historyCount={historyItems.length}
          hasActivePlacement={Boolean(activePlacement)}
        />

        {/* Center Map View */}
        <main className="flex-1 h-full min-h-[260px] relative overflow-hidden bg-stone-100">
          <MapView
            centerLat={mapCenter.lat}
            centerLng={mapCenter.lng}
            activeType={activePlacement?.type || activeTool}
            placement={activePlacement}
            studyArea={studyArea}
            onMapClick={handleMapClick}
            onMapLoaded={(exportFn) => {
              mapCanvasExportRef.current = exportFn;
            }}
          />

          {/* Study Area Status Pill */}
          {(areaStartCorner || studyArea) && (
            <div className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur-xs border border-sky-200 rounded-panel px-3 py-1.5 shadow-md flex items-center gap-2 text-xs text-stone-700 font-mono">
              <span className="w-2 h-2 rounded-full bg-sky-600 animate-pulse" />
              {areaStartCorner ? (
                <span>Click second corner to finish study box...</span>
              ) : (
                <span>Study area bounding box active</span>
              )}
              <button
                type="button"
                onClick={() => {
                  setAreaStartCorner(null);
                  setStudyArea(null);
                }}
                className="ml-1 text-[10px] text-sky-700 hover:underline font-semibold"
              >
                Clear
              </button>
            </div>
          )}
        </main>

        {/* Right Placement Panel */}
        <PlacementPanel
          placement={activePlacement}
          onChange={(updated) => {
            setActivePlacement(updated);
            if (updated.id) {
              if (patchTimerRef.current) {
                clearTimeout(patchTimerRef.current);
              }
              patchTimerRef.current = setTimeout(() => {
                fetch(`/api/placements/${updated.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: updated.type,
                    lat: updated.lat,
                    lng: updated.lng,
                    lengthM: updated.lengthM,
                    widthM: updated.widthM,
                    bearingDeg: updated.bearingDeg,
                    params: updated.params,
                  }),
                }).catch(() => {});
              }, 300);
            }
          }}
          onValidate={handleValidateFootprint}
          validationResult={validationResult}
          isValidating={isValidating}
        />
      </div>

      {/* Report Drawer */}
      <ReportDrawer
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        report={currentReport}
        onDownloadPdf={handleDownloadPdf}
        isDownloadingPdf={isDownloadingPdf}
      />

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        historyItems={historyItems}
        onOpenReport={handleOpenSavedReport}
        onDeleteReport={handleDeleteReport}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
