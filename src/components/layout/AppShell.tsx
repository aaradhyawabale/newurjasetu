"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { TopBar } from "./TopBar";
import { ToolSidebar } from "./ToolSidebar";
import { MapView, StudyAreaBounds } from "../map/MapView";
import { PlacementPanel } from "../panels/PlacementPanel";
import { ReportDrawer } from "../reports/ReportDrawer";
import { HistoryDrawer, HistoryItem } from "../history/HistoryDrawer";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ShadowSimulatorModal } from "../solar/ShadowSimulatorModal";
import { SolarRealityModal } from "../solar/SolarRealityModal";
import { ScenarioComparisonModal } from "../scenarios/ScenarioComparisonModal";
import { useToast } from "../ui/Toast";
import { InfrastructureTypeId, INFRASTRUCTURE_TYPES } from "@/config/infra-types";
import { ValidationResult } from "@/server/analysis-engine/validation";
import { AnalysisReportResult } from "@/server/analysis-engine/engine";
import { exportPlacementsToGeoJson, downloadJsonFile } from "@/lib/geojson-export";
import { calculateDistanceMeters } from "@/server/gis/geometry";
import * as turf from "@turf/turf";

const LINEAR_TOOLS = ["Bridge", "Road", "Water Canal", "Drainage"];

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
  const initialScenario = initialScenarios.find((s) => s.id === initialScenarioId) || initialScenarios[0];
  const initialScName = initialScenario?.name?.toLowerCase() || "";
  const initialIsNashik = initialScName.includes("nashik");
  const initialIsPcmc = initialScName.includes("pcmc") || initialScName.includes("pimpri");
  const initialIsPune = initialScName.includes("pune") || (!initialIsNashik && !initialIsPcmc);

  const [activeTool, setActiveTool] = useState<string>("EV Charging Station");
  const [activePlacement, setActivePlacement] = useState<any | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>(
    initialIsNashik
      ? "Nashik Urban Study Area (NMC)"
      : initialIsPcmc
      ? "Pimpri-Chinchwad Study Area (PCMC)"
      : "Pune Central Study Area (PMC)"
  );
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: initialIsNashik ? 19.9975 : initialIsPcmc ? 18.6279 : 18.5204,
    lng: initialIsNashik ? 73.7898 : initialIsPcmc ? 73.8010 : 73.8567,
  });

  // State: Select Area 2-click bounding box
  const [areaStartCorner, setAreaStartCorner] = useState<{ lat: number; lng: number } | null>(null);
  const [studyArea, setStudyArea] = useState<StudyAreaBounds | null>(null);

  // State: 2-Click Linear & Footprint drawing mode (e.g. Bridge start -> endpoint)
  const [linearStartPoint, setLinearStartPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [isTwoClickDrawMode, setIsTwoClickDrawMode] = useState<boolean>(false);

  // Keyboard shortcut listener: Escape cancels active multi-click drawing modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (linearStartPoint || isTwoClickDrawMode) {
          setLinearStartPoint(null);
          setIsTwoClickDrawMode(false);
          showToast("Placement drawing cancelled", "info");
        }
        if (areaStartCorner) {
          setAreaStartCorner(null);
          showToast("Study area selection cancelled", "info");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [linearStartPoint, isTwoClickDrawMode, areaStartCorner, showToast]);

  // State: Validation & Analysis
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [currentReport, setCurrentReport] = useState<AnalysisReportResult | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // State: Shadow-of-the-Future & Solar Reality Modals
  const [isShadowSimulatorOpen, setIsShadowSimulatorOpen] = useState<boolean>(false);
  const [isSolarRealityOpen, setIsSolarRealityOpen] = useState<boolean>(false);
  const [solarShadingOverlay, setSolarShadingOverlay] = useState<any | null>(null);

  // State: Scenario Comparison Simulator
  const [isComparisonOpen, setIsComparisonOpen] = useState<boolean>(false);
  const [comparisonPlacementIds, setComparisonPlacementIds] = useState<string[] | undefined>(undefined);

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
          const currentSc = scenarios.find((s) => s.id === scenarioId);
          const scName = currentSc?.name?.toLowerCase() || "";
          if (scName.includes("nashik")) {
            setMapCenter({ lat: 19.9975, lng: 73.7898 });
            setLocationLabel("Nashik Urban Study Area (NMC)");
          } else if (scName.includes("pcmc") || scName.includes("pimpri")) {
            setMapCenter({ lat: 18.6279, lng: 73.8010 });
            setLocationLabel("Pimpri-Chinchwad Study Area (PCMC)");
          } else if (scName.includes("pune")) {
            setMapCenter({ lat: 18.5204, lng: 73.8567 });
            setLocationLabel("Pune Central Study Area (PMC)");
          }
        }
      }
    } catch (err) {
      console.warn("Placements fetch error", err);
    }
  }, [scenarios]);

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
  const handleValidateFootprint = async (targetId?: string, silent = false): Promise<ValidationResult | null> => {
    const idToValidate = typeof targetId === "string" ? targetId : activePlacement?.id;
    if (!idToValidate) return null;
    setIsValidating(true);
    try {
      const res = await fetch(`/api/placements/${idToValidate}/validate`, {
        method: "POST",
      });

      if (res && res.ok) {
        const data = await res.json();
        setValidationResult(data.validation);
        if (!silent) {
          showToast("Footprint validated against site features", "info");
        }
        return data.validation;
      }
    } catch (err) {
      if (!silent) {
        showToast("Site validation check failed", "error");
      }
    } finally {
      setIsValidating(false);
    }
    return null;
  };

  const [isSmartFitting, setIsSmartFitting] = useState(false);
  const [isBridgeRelocating, setIsBridgeRelocating] = useState(false);
  const [isBridgePlanningApproaches, setIsBridgePlanningApproaches] = useState(false);
  const [bridgeApproachData, setBridgeApproachData] = useState<any | null>(null);

  // Smart Fit to Road & Open Land (Township Planner Auto-Fit)
  const handleSmartFit = async () => {
    if (!activePlacement || !activePlacement.id) return;
    setIsSmartFitting(true);
    try {
      const res = await fetch(`/api/placements/${activePlacement.id}/smart-fit`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setActivePlacement(data.placement);
        setValidationResult(data.validation);
        showToast(
          data.smartFit?.summary || "Fitted to open space with direct road frontage",
          "success"
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || "Could not auto-fit footprint to road frontage", "error");
      }
    } catch {
      showToast("Smart fit calculation failed", "error");
    } finally {
      setIsSmartFitting(false);
    }
  };

  // Bridge Township Planning: Relocate to Connected River Crossing
  const handleBridgeRelocateToCrossing = async () => {
    if (!activePlacement || !activePlacement.id) return;
    setIsBridgeRelocating(true);
    try {
      const res = await fetch(`/api/placements/${activePlacement.id}/bridge-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "relocate_to_crossing" }),
      });
      if (res.ok) {
        const data = await res.json();
        setActivePlacement(data.placement);
        setValidationResult(data.validation);
        setBridgeApproachData(null);
        showToast(
          data.message || "Relocated bridge to connected river crossing",
          "success"
        );
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Could not relocate bridge to nearby crossing", "error");
      }
    } catch {
      showToast("Bridge relocation failed", "error");
    } finally {
      setIsBridgeRelocating(false);
    }
  };

  // Bridge Township Planning: Plan & Trace Approach Road Corridors
  const handleBridgePlanApproaches = async () => {
    if (!activePlacement || !activePlacement.id) return;
    setIsBridgePlanningApproaches(true);
    try {
      const res = await fetch(`/api/placements/${activePlacement.id}/bridge-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_appraisal" }),
      });
      if (res.ok) {
        const data = await res.json();
        setBridgeApproachData(data.appraisal);
        const sugg = data.appraisal?.recommendedActions?.suggestion2_approachRoads;
        showToast(
          `Generated approach corridors: ${Math.round(sugg?.totalApproachLengthM ?? 0)}m total extension (${sugg?.requiredRightOfWayM ?? 15}m RoW per IRC:SP:73).`,
          "success"
        );
      } else {
        showToast("Could not calculate approach corridors", "error");
      }
    } catch {
      showToast("Approach calculation failed", "error");
    } finally {
      setIsBridgePlanningApproaches(false);
    }
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

    const isLinear = LINEAR_TOOLS.includes(activeTool) || isTwoClickDrawMode;

    if (isLinear) {
      if (!linearStartPoint) {
        setLinearStartPoint({ lat, lng });
        showToast(
          `${toolToPlace} Start point set (${lat.toFixed(4)}, ${lng.toFixed(4)}) — click opposite endpoint across barrier to bridge span (Esc to cancel)`,
          "info"
        );
        return;
      }

      // Complete 2-point placement
      const start = linearStartPoint;
      const end = { lat, lng };
      const spanDistM = Math.max(10, Math.round(calculateDistanceMeters(start.lat, start.lng, end.lat, end.lng)));
      let b = turf.bearing(turf.point([start.lng, start.lat]), turf.point([end.lng, end.lat]));
      const bearingDeg = Math.round(((b % 360) + 360) % 360);
      const mid = turf.midpoint(turf.point([start.lng, start.lat]), turf.point([end.lng, end.lat]));
      const centerLat = mid.geometry.coordinates[1];
      const centerLng = mid.geometry.coordinates[0];
      const widthM =
        activePlacement && activePlacement.type === toolToPlace
          ? activePlacement.widthM
          : typeConfig?.defaultWidthM || 20;

      setLinearStartPoint(null);
      setIsTwoClickDrawMode(false);

      if (activePlacement) {
        const updated = {
          ...activePlacement,
          type: toolToPlace,
          lat: centerLat,
          lng: centerLng,
          lengthM: spanDistM,
          widthM,
          bearingDeg,
        };
        setActivePlacement(updated);
        setValidationResult(null);
        if (activePlacement.id) {
          fetch(`/api/placements/${activePlacement.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: toolToPlace,
              lat: centerLat,
              lng: centerLng,
              lengthM: spanDistM,
              widthM,
              bearingDeg,
            }),
          }).catch(() => {});
        }
        showToast(`${toolToPlace} span created: ${spanDistM}m at ${bearingDeg}°`, "success");
      } else {
        try {
          const label = await reverseGeocode(centerLat, centerLng);
          const res = await fetch("/api/placements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scenarioId: currentScenarioId,
              type: toolToPlace,
              lat: centerLat,
              lng: centerLng,
              lengthM: spanDistM,
              widthM,
              bearingDeg,
              params: initialParams,
              label,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            setActivePlacement(data.placement);
            setActiveTool(toolToPlace);
            setValidationResult(null);
            showToast(`Placed ${toolToPlace} on map: ${spanDistM}m span`, "success");
          }
        } catch (err) {
          showToast("Failed to save placement", "error");
        }
      }
      return;
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
          showToast(`Placed ${toolToPlace} pin on map`, "success");
          handleValidateFootprint(data.placement.id, true);
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
      const label = await reverseGeocode(lat, lng);

      if (activePlacement.id) {
        try {
          await fetch(`/api/placements/${activePlacement.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng, label }),
          });
          handleValidateFootprint(activePlacement.id, true);
        } catch {
          // silent fail/optimistic update
        }
      }
    }
  };

  // Handle map placement updates from interactive handles
  const handlePlacementChangeFromMap = (updated: {
    lat: number;
    lng: number;
    lengthM: number;
    widthM: number;
    bearingDeg: number;
  }) => {
    if (!activePlacement) return;
    const nextPlacement = {
      ...activePlacement,
      ...updated,
    };
    setActivePlacement(nextPlacement);
    setValidationResult(null);

    if (activePlacement.id) {
      if (patchTimerRef.current) {
        clearTimeout(patchTimerRef.current);
      }
      patchTimerRef.current = setTimeout(() => {
        fetch(`/api/placements/${activePlacement.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: updated.lat,
            lng: updated.lng,
            lengthM: updated.lengthM,
            widthM: updated.widthM,
            bearingDeg: updated.bearingDeg,
          }),
        }).catch(() => {});
      }, 300);
    }
  };

  // Handle Tool Selection
  const handleSelectTool = async (toolId: string) => {
    setActiveTool(toolId);
    setLinearStartPoint(null);
    setIsTwoClickDrawMode(false);
    if (toolId === "Select Area") {
      setAreaStartCorner(null);
      showToast("Select Area mode: click two corners on the map to draw a study zone", "info");
      return;
    }
    if (toolId === "Bridge") {
      showToast("Bridge tool active: Click start point on map, then click endpoint across barrier to bridge span", "info");
      return;
    }
    if (LINEAR_TOOLS.includes(toolId)) {
      showToast(`${toolId} tool active: Click start point, then click endpoint to bridge span`, "info");
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
      if (data.analysis.result?.validation) {
        setValidationResult(data.analysis.result.validation);
      }
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
        onCompareClick={() => {
          setComparisonPlacementIds(undefined);
          setIsComparisonOpen(true);
        }}
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
            activeCity={
              locationLabel.includes("Nashik")
                ? "nashik"
                : locationLabel.includes("PCMC") || locationLabel.includes("Pimpri")
                ? "pcmc"
                : "pune"
            }
            activeType={activePlacement?.type || activeTool}
            placement={activePlacement}
            studyArea={studyArea}
            linearStartPoint={linearStartPoint}
            conflicts={validationResult?.conflicts || currentReport?.validation?.conflicts || []}
            analyzedFeatures={currentReport?.analyzedFeatures || []}
            searchRings={currentReport?.searchRings || null}
            solarShadingData={solarShadingOverlay}
            bridgeApproachData={bridgeApproachData || currentReport?.bridgeAppraisal}
            onMapClick={handleMapClick}
            onPlacementChange={handlePlacementChangeFromMap}
            onMapLoaded={(exportFn) => {
              mapCanvasExportRef.current = exportFn;
            }}
          />

          {/* Linear / Bridge 2-Click Status Banner */}
          {(linearStartPoint || isTwoClickDrawMode) && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-xs border border-emerald-400 rounded-panel px-4 py-2 shadow-lg flex items-center gap-2.5 text-xs text-stone-800 font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>
                {linearStartPoint
                  ? `${activeTool} start set. Click opposite endpoint to bridge span`
                  : `Click start point on map for ${activeTool}...`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setLinearStartPoint(null);
                  setIsTwoClickDrawMode(false);
                }}
                className="ml-2 px-2 py-0.5 rounded text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-600 font-sans font-medium"
              >
                Cancel (Esc)
              </button>
            </div>
          )}

          {/* Study Area Status Pill */}
          {(areaStartCorner || studyArea) && (
            <div className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur-xs border border-sky-200 rounded-panel px-3 py-1.5 shadow-md flex items-center gap-2 text-xs text-stone-700 font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600 animate-pulse" />
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
          onOpenShadowSimulator={() => setIsShadowSimulatorOpen(true)}
          onOpenSolarReality={() => setIsSolarRealityOpen(true)}
          onStartTwoClickDraw={() => {
            setLinearStartPoint(null);
            setIsTwoClickDrawMode(true);
            showToast("Click start point on map, then click endpoint", "info");
          }}
          isDrawingTwoClick={isTwoClickDrawMode || Boolean(linearStartPoint)}
          onSmartFit={handleSmartFit}
          isSmartFitting={isSmartFitting}
          onBridgeRelocateToCrossing={handleBridgeRelocateToCrossing}
          isBridgeRelocating={isBridgeRelocating}
          onBridgePlanApproaches={handleBridgePlanApproaches}
          isBridgePlanningApproaches={isBridgePlanningApproaches}
        />
      </div>

      {/* Report Drawer */}
      <ReportDrawer
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        report={currentReport}
        onDownloadPdf={handleDownloadPdf}
        isDownloadingPdf={isDownloadingPdf}
        onBridgeRelocateToCrossing={handleBridgeRelocateToCrossing}
        isBridgeRelocating={isBridgeRelocating}
      />

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        historyItems={historyItems}
        onOpenReport={handleOpenSavedReport}
        onDeleteReport={handleDeleteReport}
        onOpenDetailedCompare={(placementIds) => {
          setComparisonPlacementIds(placementIds);
          setIsComparisonOpen(true);
        }}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Shadow-of-the-Future Solar Shading Simulator Modal */}
      {activePlacement && (
        <ShadowSimulatorModal
          isOpen={isShadowSimulatorOpen}
          onClose={() => setIsShadowSimulatorOpen(false)}
          placement={activePlacement}
          onApplyMapOverlay={(overlay) => setSolarShadingOverlay(overlay)}
        />
      )}

      {/* Solar Reality Generation & Financial Feasibility Modal */}
      {activePlacement && (
        <SolarRealityModal
          isOpen={isSolarRealityOpen}
          onClose={() => setIsSolarRealityOpen(false)}
          placement={activePlacement}
        />
      )}

      {/* Scenario Simulator & Candidate Comparison Modal */}
      <ScenarioComparisonModal
        isOpen={isComparisonOpen}
        onClose={() => {
          setIsComparisonOpen(false);
          setComparisonPlacementIds(undefined);
        }}
        scenarioId={currentScenarioId}
        scenarioName={scenarios.find((s) => s.id === currentScenarioId)?.name}
        selectedPlacementIds={comparisonPlacementIds}
        onSelectCandidateLocation={(lat, lng) => {
          setMapCenter({ lat, lng });
        }}
      />
    </div>
  );
};
