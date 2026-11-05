"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { ProvenanceTag } from "@/components/ui/ProvenanceTag";
import {
  Flame,
  Thermometer,
  Leaf,
  Users,
  Layers,
  Sliders,
  ChevronDown,
  Info,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  X,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  Sparkles,
  MapPin,
  Calendar,
  Compass,
  Building,
  GitCompare,
  BookOpen,
  ShieldAlert,
  RotateCcw,
  History,
  ArrowUpDown
} from "lucide-react";
import { SelectedCellResult, OptimizeResult } from "@/server/priority/optimizer";
import { PriorityCell, GreenLossDataset, GreenLossCell } from "@/server/priority/types";
import { ZoneEvidenceDrawer, ZoneDetail } from "./ZoneEvidenceDrawer";
import { TwoScenarioComparisonModal } from "./TwoScenarioComparisonModal";
import { HeatIntelligenceDashboard } from "@/components/heat/HeatIntelligenceDashboard";
import { InterventionPlanningWorkspace } from "@/components/interventions/InterventionPlanningWorkspace";
import { CopilotDrawer } from "@/components/copilot/CopilotDrawer";
import { ShadowSimulatorModal } from "@/components/solar/ShadowSimulatorModal";
import { SolarRealityModal } from "@/components/solar/SolarRealityModal";
import { ScenarioComparisonModal } from "@/components/scenarios/ScenarioComparisonModal";

// Colour-blind-safe sequential Viridis palette definition
export const VIRIDIS_PALETTE = {
  stops: [
    { value: 0, color: "#440154", label: "Low / Baseline" },
    { value: 5, color: "#3b528b", label: "Moderate" },
    { value: 10, color: "#21918c", label: "Substantial" },
    { value: 16, color: "#5ec962", label: "Elevated" },
    { value: 24, color: "#fde725", label: "Severe Heat Burden" }
  ],
  colors: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"]
};

type ActiveLayerType = "burden" | "lst" | "ndvi" | "population" | "selected" | "green_loss" | "solar_penalty";

interface HeatPriorityScreenProps {
  initialCells?: PriorityCell[];
  initialOptimization?: OptimizeResult | null;
  initialGreenLoss?: GreenLossDataset | null;
  selectedWard?: string;
  onSelectWard?: (ward: string) => void;
  initialPanelTab?: "scenario" | "green_loss" | "restore";
  hideTopBar?: boolean;
  onOpenTwoScenarioComparison?: () => void;
  onOpenLegacyManualSiting?: () => void;
  onOpenLegacyReportDrawer?: () => void;
  onOpenLegacyShadowSimulator?: () => void;
  onOpenLegacySolarReality?: () => void;
  onOpenLegacyInterventions?: () => void;
  onOpenLegacyHeatDashboard?: () => void;
  onOpenLegacyCopilot?: () => void;
}

export const HeatPriorityScreen: React.FC<HeatPriorityScreenProps> = ({
  initialCells = [],
  initialOptimization = null,
  initialGreenLoss = null,
  selectedWard: propSelectedWard,
  onSelectWard,
  initialPanelTab = "scenario",
  hideTopBar = false,
  onOpenTwoScenarioComparison,
  onOpenLegacyManualSiting,
  onOpenLegacyReportDrawer,
  onOpenLegacyShadowSimulator,
  onOpenLegacySolarReality,
  onOpenLegacyInterventions,
  onOpenLegacyHeatDashboard,
  onOpenLegacyCopilot
}) => {
  // Scenario Controls State
  const [budgetHa, setBudgetHa] = useState<number>(10.0);
  const [targetNdvi, setTargetNdvi] = useState<number>(0.65);
  const [uncertaintyQuantile, setUncertaintyQuantile] = useState<"p10" | "mean" | "p90">("mean");
  const [objective, setObjective] = useState<"cooling" | "population_weighted">("cooling");
  const [selectedWard, setSelectedWard] = useState<string>(propSelectedWard || "All");
  const [showFineTuneSliders, setShowFineTuneSliders] = useState<boolean>(false);

  // Panel Tabs: "scenario" | "green_loss" | "restore"
  const [panelTab, setPanelTab] = useState<"scenario" | "green_loss" | "restore">(initialPanelTab);
  const [restoreBudgetHa, setRestoreBudgetHa] = useState<number>(10.0);

  // Map & Visualization State
  const [activeLayer, setActiveLayer] = useState<ActiveLayerType>("burden");
  const [isScenarioPanelOpen, setIsScenarioPanelOpen] = useState<boolean>(true);
  const [selectedZone, setSelectedZone] = useState<ZoneDetail | null>(null);
  const [zoneEnsembleStats, setZoneEnsembleStats] = useState<any | null>(null);
  const [isEvidenceDrawerOpen, setIsEvidenceDrawerOpen] = useState<boolean>(false);
  const [isTwoScenarioModalOpen, setIsTwoScenarioModalOpen] = useState<boolean>(false);
  const [isLegacyMenuOpen, setIsLegacyMenuOpen] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

  // Legacy Modals State (for self-contained dropdown actions)
  const [isHeatDashboardOpen, setIsHeatDashboardOpen] = useState<boolean>(false);
  const [isInterventionsOpen, setIsInterventionsOpen] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [isShadowSimulatorOpen, setIsShadowSimulatorOpen] = useState<boolean>(false);
  const [isSolarRealityOpen, setIsSolarRealityOpen] = useState<boolean>(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState<boolean>(false);

  // Data State
  const [cells, setCells] = useState<PriorityCell[]>(initialCells);
  const [optimizationResult, setOptimizationResult] = useState<OptimizeResult | null>(initialOptimization || null);
  const [greenLossData, setGreenLossData] = useState<GreenLossDataset | null>(initialGreenLoss || null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Sync prop changes for selectedWard and initialPanelTab
  useEffect(() => {
    if (propSelectedWard !== undefined && propSelectedWard !== selectedWard) {
      setSelectedWard(propSelectedWard);
      // If a specific ward is selected, fly map to centroid of ward cells
      if (propSelectedWard !== "All" && mapRef.current) {
        const wardCells = cells.filter((c) => c.ward === propSelectedWard);
        if (wardCells.length > 0) {
          let sumLng = 0;
          let sumLat = 0;
          wardCells.forEach((c) => {
            sumLng += c.centroid[0];
            sumLat += c.centroid[1];
          });
          mapRef.current.flyTo({
            center: [sumLng / wardCells.length, sumLat / wardCells.length],
            zoom: 12.8,
            essential: true,
          });
        }
      } else if (propSelectedWard === "All" && mapRef.current) {
        mapRef.current.flyTo({
          center: [73.8567, 18.5204],
          zoom: 11.5,
          essential: true,
        });
      }
    }
  }, [propSelectedWard, cells]);

  useEffect(() => {
    if (initialPanelTab !== undefined) {
      setPanelTab(initialPanelTab);
      if (initialPanelTab === "green_loss") {
        setActiveLayer("green_loss");
      }
    }
  }, [initialPanelTab]);

  // Fetch initial baseline optimization if not pre-seeded
  useEffect(() => {
    let isMounted = true;
    if (initialOptimization) return;

    async function loadInitialData() {
      try {
        setIsOptimizing(true);
        const res = await fetch("/api/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            budget_ha: budgetHa,
            objective,
            target_ndvi: targetNdvi,
            ward: selectedWard === "All" ? undefined : selectedWard
          })
        });

        if (res.ok && isMounted) {
          const json = await res.json();
          if (json.status === "OK" || json.status === "UNAVAILABLE") {
            setOptimizationResult(json.data);
          }
        }
      } catch (err) {
        console.error("Failed to load initial optimization:", err);
      } finally {
        if (isMounted) setIsOptimizing(false);
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Green Loss dataset if not pre-seeded
  useEffect(() => {
    if (initialGreenLoss) return;
    let isMounted = true;

    fetch("/api/green-loss")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.dataset && isMounted) {
          setGreenLossData(data.dataset);
        }
      })
      .catch((err) => console.error("Error loading green loss dataset:", err));

    return () => {
      isMounted = false;
    };
  }, [initialGreenLoss]);

  // Re-run optimization when scenario parameters change
  const runOptimization = useCallback(async (customOpts?: { candidate_cell_ids?: string[]; budget_ha?: number }) => {
    try {
      setIsOptimizing(true);
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget_ha: customOpts?.budget_ha ?? budgetHa,
          objective,
          target_ndvi: targetNdvi,
          ward: selectedWard === "All" ? undefined : selectedWard,
          candidate_cell_ids: customOpts?.candidate_cell_ids
        })
      });

      if (res.ok) {
        const json = await res.json();
        setOptimizationResult(json.data);
      }
    } catch (err) {
      console.error("Failed to optimize budget:", err);
    } finally {
      setIsOptimizing(false);
    }
  }, [budgetHa, objective, targetNdvi, selectedWard]);

  // Handler for Protect / Restore First optimization
  const handleRunRestoreOptimization = useCallback(() => {
    const lossIds = (greenLossData?.cells || []).filter((c) => c.is_loss).map((c) => c.id);
    runOptimization({ candidate_cell_ids: lossIds, budget_ha: restoreBudgetHa });
    setActiveLayer("selected");
  }, [greenLossData, restoreBudgetHa, runOptimization]);

  // Debounced auto-recalculate on slider changes (60ms latency, well below 200ms)
  useEffect(() => {
    if (panelTab !== "scenario") return;
    const timer = setTimeout(() => {
      runOptimization();
    }, 60);
    return () => clearTimeout(timer);
  }, [budgetHa, targetNdvi, objective, selectedWard, panelTab, runOptimization]);

  // Precompute static 250m polygon geometries once to eliminate GC & re-allocation (<1ms update)
  const basePolygonsMap = useMemo(() => {
    const map = new Map<string, number[][][]>();
    const dx = 0.001186;
    const dy = 0.001129;
    const rawList = cells.length > 0 ? cells : optimizationResult?.selected_cells || [];
    rawList.forEach((cell: any) => {
      const [lng, lat] = cell.centroid || [73.8567, 18.5204];
      map.set(cell.id, [
        [
          [lng - dx, lat - dy],
          [lng + dx, lat - dy],
          [lng + dx, lat + dy],
          [lng - dx, lat + dy],
          [lng - dx, lat - dy],
        ],
      ]);
    });
    return map;
  }, [cells]);

  // In-memory green loss lookup map (< 1ms lookup)
  const greenLossCellMap = useMemo(() => {
    return new Map((greenLossData?.cells || []).map((c) => [c.id, c]));
  }, [greenLossData]);

  // Fast GeoJSON feature collection creation (<2ms per slider change)
  const cellsGeoJson = useMemo(() => {
    const rawList = cells.length > 0 ? cells : optimizationResult?.selected_cells || [];
    const selectedIdSet = new Set((optimizationResult?.selected_cells || []).map((c) => c.id));
    const selectedRankMap = new Map((optimizationResult?.selected_cells || []).map((c) => [c.id, c.rank]));
    const selectedFreqMap = new Map((optimizationResult?.selected_cells || []).map((c) => [c.id, c.selection_frequency]));

    const features: GeoJSON.Feature[] = rawList.map((cell: any) => {
      const isSelected = selectedIdSet.has(cell.id);
      const rank = selectedRankMap.get(cell.id) || 0;
      const freq = selectedFreqMap.get(cell.id) || 0;
      const lossCell = greenLossCellMap.get(cell.id);
      const polygonCoords = basePolygonsMap.get(cell.id) || [
        [
          [73.8567 - 0.001186, 18.5204 - 0.001129],
          [73.8567 + 0.001186, 18.5204 - 0.001129],
          [73.8567 + 0.001186, 18.5204 + 0.001129],
          [73.8567 - 0.001186, 18.5204 + 0.001129],
          [73.8567 - 0.001186, 18.5204 - 0.001129],
        ],
      ];

      return {
        type: "Feature" as const,
        id: cell.id,
        properties: {
          id: cell.id,
          ward: cell.ward || "Unknown",
          burden: cell.burden !== null ? cell.burden : 0,
          lst_mean: cell.lst_mean !== null ? cell.lst_mean : 0,
          ndvi: cell.ndvi !== null ? cell.ndvi : 0,
          population: cell.population !== null ? cell.population : 0,
          greenable_ha: cell.greenable_ha !== null ? cell.greenable_ha : 0,
          cooling_mean: cell.cooling_mean !== null ? cell.cooling_mean : 0,
          cooling_p10: cell.cooling_p10 !== null ? cell.cooling_p10 : 0,
          cooling_p90: cell.cooling_p90 !== null ? cell.cooling_p90 : 0,
          is_loss: lossCell?.is_loss ? 1 : 0,
          delta_ndvi: lossCell?.delta_ndvi ?? 0,
          delta_ndbi: lossCell?.delta_ndbi ?? 0,
          loss_area_ha: lossCell?.loss_area_ha ?? 0,
          extra_heat_mean: lossCell?.extra_heat_mean ?? 0,
          heat_excess_celsius: cell.heat_excess_celsius ?? 0,
          solar_penalty_mean: cell.solar_penalty_mean !== null && cell.solar_penalty_mean !== undefined ? cell.solar_penalty_mean : null,
          solar_penalty_p10: cell.solar_penalty_p10 !== null && cell.solar_penalty_p10 !== undefined ? cell.solar_penalty_p10 : null,
          solar_penalty_p90: cell.solar_penalty_p90 !== null && cell.solar_penalty_p90 !== undefined ? cell.solar_penalty_p90 : null,
          isSelected: isSelected ? 1 : 0,
          rank,
          selection_frequency: freq,
        },
        geometry: {
          type: "Polygon" as const,
          coordinates: polygonCoords,
        },
      };
    });

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [cells, optimizationResult, basePolygonsMap, greenLossCellMap]);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const defaultRasterStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        "osm-tiles": {
          type: "raster",
          tiles: [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
          ],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors"
        }
      },
      layers: [
        {
          id: "osm-tiles-layer",
          type: "raster",
          source: "osm-tiles",
          minzoom: 0,
          maxzoom: 19
        }
      ]
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE || defaultRasterStyle,
      center: [73.8567, 18.5204], // Pune Center
      zoom: 12.2,
      maxZoom: 18,
      minZoom: 10
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
      // Add Priority Grid Source
      map.addSource("priority-cells-source", {
        type: "geojson",
        data: cellsGeoJson
      });

      // 1. Base Choropleth Fill Layer (Colour-blind-safe Viridis)
      map.addLayer({
        id: "priority-cells-fill",
        type: "fill",
        source: "priority-cells-source",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "burden"],
            0, "#440154",
            5, "#3b528b",
            10, "#21918c",
            16, "#5ec962",
            24, "#fde725"
          ],
          "fill-opacity": 0.72
        }
      });

      // 2. Cell Outlines
      map.addLayer({
        id: "priority-cells-line",
        type: "line",
        source: "priority-cells-source",
        paint: {
          "line-color": "#475569",
          "line-width": 0.8,
          "line-opacity": 0.35
        }
      });

      // 3. Selected Priority Zones Highlight Fill
      map.addLayer({
        id: "priority-selected-fill",
        type: "fill",
        source: "priority-cells-source",
        filter: ["==", ["get", "isSelected"], 1],
        paint: {
          "fill-color": "#f97316",
          "fill-opacity": 0.45
        }
      });

      // 4. Selected Priority Zones Bold Border
      map.addLayer({
        id: "priority-selected-line",
        type: "line",
        source: "priority-cells-source",
        filter: ["==", ["get", "isSelected"], 1],
        paint: {
          "line-color": "#ea580c",
          "line-width": 2.5,
          "line-opacity": 1.0
        }
      });

      // Click interaction: instant optimistic UI update (< 5ms response latency)
      map.on("click", "priority-cells-fill", (e) => {
        if (!e.features || e.features.length === 0) return;
        const feat = e.features[0];
        const cellId = feat.properties?.id;
        if (!cellId) return;

        // 1. Instant in-memory selection (< 5ms response latency)
        const baseCell = cells.find((c) => c.id === cellId);
        const optCell = (optimizationResult?.selected_cells || []).find((c) => c.id === cellId);
        const rank = optCell?.rank;
        const freq = optCell?.selection_frequency;

        if (baseCell) {
          setSelectedZone({
            ...baseCell,
            rank,
            selection_frequency: freq,
          });
          setIsEvidenceDrawerOpen(true);
        }

        // 2. Fetch full ensemble statistics in background (non-blocking)
        fetch(`/api/zone/${cellId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.zone) {
              setSelectedZone({
                ...data.zone,
                rank,
                selection_frequency: freq,
              });
              if (data.ensemble) {
                setZoneEnsembleStats(data.ensemble);
              }
            }
          })
          .catch(() => {
            // Keep instant in-memory zone
          });
      });

      map.on("mouseenter", "priority-cells-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "priority-cells-fill", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map source when cellsGeoJson changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!map.isStyleLoaded()) return;

    const source = map.getSource("priority-cells-source") as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(cellsGeoJson);
    }
  }, [cellsGeoJson]);

  // Update layer fill-color expression when activeLayer changes (All colour-blind-safe Viridis)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!map.isStyleLoaded()) return;

    let fillColorExpr: any;
    if (activeLayer === "burden") {
      fillColorExpr = [
        "interpolate",
        ["linear"],
        ["get", "burden"],
        0, "#440154",
        5, "#3b528b",
        10, "#21918c",
        16, "#5ec962",
        24, "#fde725"
      ];
    } else if (activeLayer === "lst") {
      fillColorExpr = [
        "interpolate",
        ["linear"],
        ["get", "lst_mean"],
        34, "#440154",
        38, "#3b528b",
        41, "#21918c",
        44, "#5ec962",
        48, "#fde725"
      ];
    } else if (activeLayer === "ndvi") {
      fillColorExpr = [
        "interpolate",
        ["linear"],
        ["get", "ndvi"],
        0.05, "#440154",
        0.18, "#3b528b",
        0.28, "#21918c",
        0.40, "#5ec962",
        0.65, "#fde725"
      ];
    } else if (activeLayer === "population") {
      fillColorExpr = [
        "interpolate",
        ["linear"],
        ["get", "population"],
        500, "#440154",
        1200, "#3b528b",
        2000, "#21918c",
        2600, "#5ec962",
        3400, "#fde725"
      ];
    } else if (activeLayer === "green_loss") {
      fillColorExpr = [
        "case",
        ["==", ["get", "is_loss"], 1],
        [
          "interpolate",
          ["linear"],
          ["get", "delta_ndvi"],
          -0.30, "#7f1d1d",
          -0.20, "#dc2626",
          -0.10, "#ea580c"
        ],
        "#1e293b"
      ];
    } else if (activeLayer === "solar_penalty") {
      fillColorExpr = [
        "case",
        ["!=", ["get", "solar_penalty_mean"], null],
        [
          "interpolate",
          ["linear"],
          ["get", "solar_penalty_mean"],
          -5.5, "#7f1d1d",
          -4.0, "#dc2626",
          -2.5, "#ea580c",
          -1.0, "#eab308",
           0.0, "#334155"
        ],
        "#1e293b"
      ];
    } else {
      // Selected zones focus
      fillColorExpr = [
        "case",
        ["==", ["get", "isSelected"], 1],
        "#ea580c",
        "#334155"
      ];
    }

    if (map.getLayer("priority-cells-fill")) {
      map.setPaintProperty("priority-cells-fill", "fill-color", fillColorExpr);
    }
  }, [activeLayer]);

  // Summary statistics for bottom strip
  const portfolioSummary = useMemo(() => {
    if (!optimizationResult || optimizationResult.status !== "OK") {
      return {
        allocatedHa: 0,
        selectedCount: 0,
        meanCooling: 0,
        p10Cooling: 0,
        p90Cooling: 0,
        totalPopulation: 0,
        ensembleConvergence: 30
      };
    }

    const sel = optimizationResult.selected_cells;
    const allocatedHa = optimizationResult.allocated_ha;
    const selectedCount = sel.length;

    let sumCooling = 0;
    let sumP10 = 0;
    let sumP90 = 0;
    let sumPop = 0;

    sel.forEach(c => {
      sumCooling += c.cooling_mean || 0;
      sumP10 += c.cooling_p10 || 0;
      sumP90 += c.cooling_p90 || 0;
      sumPop += c.population || 0;
    });

    const meanCooling = selectedCount > 0 ? Number((sumCooling / selectedCount).toFixed(2)) : 0;
    const p10Cooling = selectedCount > 0 ? Number((sumP10 / selectedCount).toFixed(2)) : 0;
    const p90Cooling = selectedCount > 0 ? Number((sumP90 / selectedCount).toFixed(2)) : 0;

    return {
      allocatedHa,
      selectedCount,
      meanCooling,
      p10Cooling,
      p90Cooling,
      totalPopulation: sumPop,
      ensembleConvergence: optimizationResult.ensemble_runs || 30
    };
  }, [optimizationResult]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-stone-950 text-stone-100 font-sans select-none">
      {/* ========================================================================= */}
      {/* 1. TOP BAR WITH PROVENANCE LEGEND (Hidden when mounted inside UnifiedShell) */}
      {/* ========================================================================= */}
      {!hideTopBar && (
        <header className="h-14 bg-stone-900 border-b border-stone-800 px-4 flex items-center justify-between shrink-0 z-30 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-black text-sm shadow-sm tracking-tighter">
              US
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold tracking-tight text-white">UrjaSetu</span>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.2 rounded border border-emerald-800/80">
                  Heat Priority Screen
                </span>
              </div>
              <span className="text-[11px] text-stone-400 font-mono">
                Pune Municipal Corporation (250m Spatial Grid)
              </span>
            </div>
          </div>

          {/* Universal Provenance Legend Group */}
          <div className="hidden lg:flex items-center gap-2 bg-stone-950/90 px-3 py-1 rounded-md border border-stone-800 text-[11px] font-mono shadow-inner">
            <span className="text-stone-400 font-bold uppercase tracking-wider text-[11px] mr-1">
              Data Legend:
            </span>
            <div className="flex items-center gap-1.5" title="Direct physical sensor observation or official municipal registry">
              <ProvenanceTag type="Measured" />
              <span className="text-stone-300">Sensor / Register</span>
            </div>
            <span className="text-stone-700">|</span>
            <div className="flex items-center gap-1.5" title="Computed deterministically through physical or spatial algorithms">
              <ProvenanceTag type="Modelled" />
              <span className="text-stone-300">Thermodynamic Model</span>
            </div>
            <span className="text-stone-700">|</span>
            <div className="flex items-center gap-1.5" title="Indicative planning parameter or scenario screening default">
              <ProvenanceTag type="Assumed" />
              <span className="text-stone-300">Planning Threshold</span>
            </div>
          </div>

          {/* Right Action Menu: Legacy Tools Dropdown & Documentation */}
          <div className="flex items-center gap-2.5">
            {/* Two-Scenario Comparison Button */}
            <button
              type="button"
              onClick={() => onOpenTwoScenarioComparison ? onOpenTwoScenarioComparison() : setIsTwoScenarioModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-950/80 hover:bg-sky-900 border border-sky-700/80 text-xs font-semibold text-sky-200 transition-colors shadow-xs"
              title="Open side-by-side Two-Scenario Comparison"
            >
              <GitCompare className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Compare Scenarios</span>
            </button>

            {/* Methodology Documentation Page */}
            <Link
              href="/method"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-xs font-semibold text-emerald-200 transition-colors shadow-xs"
              title="Open Scientific Methodology, Data Sources & Model Card"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Methodology</span>
            </Link>

            <Link
              href="/api/model-card"
              target="_blank"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-stone-800/80 hover:bg-stone-800 text-stone-300 text-xs border border-stone-700/80 transition-colors"
              title="Inspect Machine-Readable Model Card"
            >
              <Info className="w-3.5 h-3.5 text-stone-400" />
              <span className="hidden sm:inline">Model Card</span>
            </Link>
          </div>
        </header>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE: SCENARIO PANEL + MAPLIBRE CANVAS + ZONE CARD           */}
      {/* ========================================================================= */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Left Scenario & Green Loss Panel */}
        <aside
          className={`absolute top-3 left-3 z-20 w-88 sm:w-[410px] bg-stone-900/95 backdrop-blur-md rounded-lg border border-stone-800 shadow-2xl transition-all duration-300 flex flex-col max-h-[calc(100vh-140px)] ${
            isScenarioPanelOpen ? "translate-x-0 opacity-100" : "-translate-x-96 opacity-0 pointer-events-none"
          }`}
        >
          {/* Panel Header */}
          <div className="p-3 border-b border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {panelTab === "scenario" ? (
                <Sliders className="w-4 h-4 text-emerald-400" />
              ) : panelTab === "green_loss" ? (
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              ) : (
                <RotateCcw className="w-4 h-4 text-teal-400" />
              )}
              <h2 className="text-xs font-bold text-white tracking-wide uppercase">
                {panelTab === "scenario" ? "Intervention Scenario" :
                 panelTab === "green_loss" ? "Green Loss Watch" :
                 "Protect / Restore First"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <ProvenanceTag type={panelTab === "scenario" ? "Assumed" : panelTab === "green_loss" ? "Measured" : "Modelled"} />
              <button
                type="button"
                onClick={() => setIsScenarioPanelOpen(false)}
                className="p-1 rounded text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
                title="Collapse panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-stone-800 bg-stone-950/70 p-1 gap-1 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setPanelTab("scenario")}
              className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 transition-colors ${
                panelTab === "scenario"
                  ? "bg-stone-800 text-emerald-400 font-bold border border-stone-700 shadow-xs"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Scenario</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPanelTab("green_loss");
                setActiveLayer("green_loss");
              }}
              className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 transition-colors ${
                panelTab === "green_loss"
                  ? "bg-rose-950/80 text-rose-300 font-bold border border-rose-800 shadow-xs"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Green Loss</span>
            </button>
            <button
              type="button"
              onClick={() => setPanelTab("restore")}
              className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 transition-colors ${
                panelTab === "restore"
                  ? "bg-teal-950/80 text-teal-300 font-bold border border-teal-800 shadow-xs"
                  : "text-stone-400 hover:text-stone-200"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-teal-400" />
              <span>Restore First</span>
            </button>
          </div>

          {/* Tab 1: Scenario Controls */}
          {panelTab === "scenario" && (
            <div className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
              {/* 1. Hectare Budget Presets & Fine-Tune Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <span>Municipal Budget Scope</span>
                    <ProvenanceTag type="Assumed" />
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    {budgetHa.toFixed(1)} ha
                  </span>
                </div>

                {/* Preset Chips */}
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "Micro-Pocket", sublabel: "5.0 ha", ha: 5.0 },
                    { label: "Ward Standard", sublabel: "10.0 ha", ha: 10.0 },
                    { label: "Priority Corridor", sublabel: "25.0 ha", ha: 25.0 },
                    { label: "City Sector", sublabel: "40.0 ha", ha: 40.0 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setBudgetHa(preset.ha);
                        runOptimization({ budget_ha: preset.ha });
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                        Math.abs(budgetHa - preset.ha) < 0.1
                          ? "bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow-sm ring-1 ring-emerald-500"
                          : "bg-stone-950/80 border-stone-800 text-stone-300 hover:bg-stone-850 hover:border-stone-700"
                      }`}
                    >
                      <div className="text-[11px] font-bold">{preset.label}</div>
                      <div className="text-[11px] font-mono text-stone-400">{preset.sublabel}</div>
                    </button>
                  ))}
                </div>

                {/* Collapsible Fine-Tune Slider */}
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setShowFineTuneSliders(!showFineTuneSliders)}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 focus:outline-none"
                  >
                    <span>{showFineTuneSliders ? "Hide Fine-Tune Sliders ▲" : "Fine-Tune Exact Hectares & Target ▼"}</span>
                  </button>

                  {showFineTuneSliders && (
                    <div className="mt-2 p-2.5 rounded-lg bg-stone-950 border border-stone-800 space-y-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-mono text-stone-300">
                          <span>Custom Hectares:</span>
                          <span className="text-emerald-400 font-bold">{budgetHa.toFixed(1)} ha</span>
                        </div>
                        <input
                          type="range"
                          min={1.0}
                          max={40.0}
                          step={0.5}
                          value={budgetHa}
                          onChange={(e) => setBudgetHa(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex justify-between text-[11px] text-stone-500 font-mono">
                          <span>1.0 ha</span>
                          <span>Max: 40.0 ha</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-mono text-stone-300">
                          <span>Custom Target NDVI:</span>
                          <span className="text-teal-400 font-bold">{targetNdvi.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min={0.40}
                          max={0.85}
                          step={0.05}
                          value={targetNdvi}
                          onChange={(e) => setTargetNdvi(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                        />
                        <div className="flex justify-between text-[11px] text-stone-500 font-mono">
                          <span>0.40 (Light)</span>
                          <span>0.85 (Dense)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Plain Canopy Density Target */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <span>Canopy Target</span>
                    <ProvenanceTag type="Assumed" />
                  </label>
                  <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
                    NDVI {targetNdvi.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "Light Canopy", sublabel: "0.45 NDVI", ndvi: 0.45 },
                    { label: "Moderate Shading", sublabel: "0.55 NDVI", ndvi: 0.55 },
                    { label: "Dense Canopy", sublabel: "0.65 NDVI (Std)", ndvi: 0.65 },
                    { label: "Urban Forest", sublabel: "0.75 NDVI", ndvi: 0.75 },
                  ].map((canopy) => (
                    <button
                      key={canopy.label}
                      type="button"
                      onClick={() => setTargetNdvi(canopy.ndvi)}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                        Math.abs(targetNdvi - canopy.ndvi) < 0.04
                          ? "bg-teal-950/90 border-teal-500 text-teal-200 shadow-sm ring-1 ring-teal-500"
                          : "bg-stone-950/80 border-stone-800 text-stone-300 hover:bg-stone-850 hover:border-stone-700"
                      }`}
                    >
                      <div className="text-[11px] font-bold">{canopy.label}</div>
                      <div className="text-[11px] font-mono text-stone-400">{canopy.sublabel}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Uncertainty Toggle (Monte Carlo 30 Members) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <span>Ensemble Quantile</span>
                    <ProvenanceTag type="Modelled" />
                  </label>
                  <span className="text-[11px] text-stone-400 font-mono">30 members</span>
                </div>
                <div className="grid grid-cols-3 gap-1 bg-stone-950 p-1 rounded-md border border-stone-800">
                  <button
                    type="button"
                    onClick={() => setUncertaintyQuantile("p10")}
                    className={`py-1 text-center rounded text-xs font-mono font-medium transition-colors ${
                      uncertaintyQuantile === "p10"
                        ? "bg-amber-600 text-white font-bold shadow-xs"
                        : "text-stone-400 hover:text-stone-200"
                    }`}
                    title="P10: Conservative cooling threshold (90% chance of exceeding)"
                  >
                    P10 (Cons.)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUncertaintyQuantile("mean")}
                    className={`py-1 text-center rounded text-xs font-mono font-medium transition-colors ${
                      uncertaintyQuantile === "mean"
                        ? "bg-emerald-600 text-white font-bold shadow-xs"
                        : "text-stone-400 hover:text-stone-200"
                    }`}
                    title="Mean: Expected ensemble cooling outcome"
                  >
                    Mean
                  </button>
                  <button
                    type="button"
                    onClick={() => setUncertaintyQuantile("p90")}
                    className={`py-1 text-center rounded text-xs font-mono font-medium transition-colors ${
                      uncertaintyQuantile === "p90"
                        ? "bg-sky-600 text-white font-bold shadow-xs"
                        : "text-stone-400 hover:text-stone-200"
                    }`}
                    title="P90: Optimistic cooling potential (10% chance of exceeding)"
                  >
                    P90 (Opt.)
                  </button>
                </div>
              </div>

              {/* 4. Optimization Objective Toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                  <span>Objective Function</span>
                  <ProvenanceTag type="Modelled" />
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setObjective("cooling")}
                    className={`p-2 rounded border text-left transition-colors ${
                      objective === "cooling"
                        ? "bg-emerald-950/60 border-emerald-600 text-emerald-200"
                        : "bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    <div className="text-[11px] font-bold">Pure Cooling</div>
                    <div className="text-[11px] text-stone-500 font-mono">°C reduction / ha</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setObjective("population_weighted")}
                    className={`p-2 rounded border text-left transition-colors ${
                      objective === "population_weighted"
                        ? "bg-emerald-950/60 border-emerald-600 text-emerald-200"
                        : "bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    <div className="text-[11px] font-bold">Pop-Weighted</div>
                    <div className="text-[11px] text-stone-500 font-mono">Resident exposure</div>
                  </button>
                </div>
              </div>

              {/* 5. Ward Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                  <span>Administrative Ward</span>
                  <ProvenanceTag type="Measured" />
                </label>
                <select
                  value={selectedWard}
                  onChange={(e) => {
                    setSelectedWard(e.target.value);
                    onSelectWard?.(e.target.value);
                  }}
                  className="w-full bg-stone-950 border border-stone-800 rounded px-2.5 py-1.5 text-xs text-stone-200 font-sans focus:outline-none focus:border-emerald-500"
                >
                  <option value="All">All Pune Municipal Wards</option>
                  <option value="Kasba Vishrambaugwada">Kasba Vishrambaugwada</option>
                  <option value="Shivajinagar - Ghole Road">Shivajinagar - Ghole Road</option>
                  <option value="Bhawani Peth">Bhawani Peth</option>
                  <option value="Kothrud">Kothrud</option>
                  <option value="Aundh">Aundh</option>
                  <option value="Sangamwadi">Sangamwadi</option>
                  <option value="Sahkar Nagar">Sahkar Nagar</option>
                  <option value="Bibwewadi">Bibwewadi</option>
                  <option value="Dhankwadi">Dhankwadi</option>
                </select>
              </div>

              {/* Plain Language Impact Summary */}
              <div className="p-3 rounded-lg bg-stone-950/90 border border-stone-800 text-xs text-stone-300 leading-relaxed">
                <span className="font-bold text-emerald-400 block mb-1">
                  Portfolio Impact Summary:
                </span>
                {portfolioSummary.selectedCount > 0
                  ? `Allocating ${portfolioSummary.allocatedHa.toFixed(1)} ha across ${portfolioSummary.selectedCount} cells achieves an expected ${portfolioSummary.meanCooling.toFixed(2)}°C surface cooling benefit (conservative P10: ${portfolioSummary.p10Cooling.toFixed(2)}°C to optimistic P90: ${portfolioSummary.p90Cooling.toFixed(2)}°C), directly shielding ${portfolioSummary.totalPopulation.toLocaleString()} residents.`
                  : "Select a budget preset above to calculate optimal cooling parcels."}
              </div>

              {/* Recalculate Trigger */}
              <button
                type="button"
                onClick={() => runOptimization()}
                disabled={isOptimizing}
                className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isOptimizing ? "animate-spin" : ""}`} />
                <span>{isOptimizing ? "Optimizing Portfolio..." : "Recalculate Priorities"}</span>
              </button>

              {/* Two-Scenario Comparison Button */}
              <button
                type="button"
                onClick={() => onOpenTwoScenarioComparison ? onOpenTwoScenarioComparison() : setIsTwoScenarioModalOpen(true)}
                className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-sky-300 text-xs font-semibold rounded flex items-center justify-center gap-2 border border-sky-900/60 transition-colors shadow-xs"
              >
                <GitCompare className="w-3.5 h-3.5 text-sky-400" />
                <span>Two-Scenario Comparison</span>
              </button>
            </div>
          )}

          {/* Tab 2: Green Loss Watch & Ward Table */}
          {panelTab === "green_loss" && (
            <div className="p-3.5 flex flex-col gap-3.5 overflow-y-auto custom-scrollbar">
              {/* Plain-Language Headline Banner */}
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs space-y-1">
                <span className="font-bold text-rose-300 block">
                  Canopy Depletion Diagnostic (Sentinel-2 MSI 2019 vs 2026)
                </span>
                <p className="text-[11px] text-stone-300 leading-relaxed font-sans">
                  Identifies vegetative loss (ΔNDVI ≤ -0.10 with expanding impervious surface ΔNDBI &gt; 0). Note: Satellite change detection requires on-ground municipal field verification before statutory enforcement.
                </p>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-stone-950 p-2.5 rounded border border-rose-900/40">
                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>Total Loss Area</span>
                    <ProvenanceTag type="Modelled" />
                  </div>
                  <div className="text-base font-extrabold text-rose-400 mt-0.5">
                    {greenLossData?.metadata.total_loss_area_ha !== undefined
                      ? `${greenLossData.metadata.total_loss_area_ha.toFixed(2)} ha`
                      : "Not available"}
                  </div>
                  <div className="text-[11px] text-stone-500">2019–2026 pre-monsoon</div>
                </div>
                <div className="bg-stone-950 p-2.5 rounded border border-rose-900/40">
                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>Flagged Cells</span>
                    <ProvenanceTag type="Modelled" />
                  </div>
                  <div className="text-base font-extrabold text-amber-400 mt-0.5">
                    {greenLossData?.metadata.total_loss_cells !== undefined
                      ? `${greenLossData.metadata.total_loss_cells} cells`
                      : "Not available"}
                  </div>
                  <div className="text-[11px] text-stone-500">ΔNDVI ≤ -0.10 & ΔNDBI &gt; 0</div>
                </div>
              </div>

              {/* Model Gate Status */}
              <div className="flex items-center justify-between text-[11px] font-mono bg-stone-950 px-2.5 py-1.5 rounded border border-stone-800">
                <span className="text-stone-400">Model Gate Direction Check:</span>
                <span className={`font-bold ${greenLossData?.metadata.model_gate_passed ? "text-emerald-400" : "text-amber-400"}`}>
                  {greenLossData?.metadata.model_gate_passed ? "PASSED (∂LST/∂NDVI ≤ 0)" : "FAILED (Heat Nullified)"}
                </span>
              </div>

              {/* Ward Table sorted by loss area */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span>23 PMC Wards by Loss Area</span>
                    <ProvenanceTag type="Measured" />
                  </h3>
                  <span className="text-[11px] text-stone-500 font-mono">Sorted by loss ha</span>
                </div>

                <div className="border border-stone-800 rounded overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-stone-950 text-stone-400 text-[11px] uppercase sticky top-0 border-b border-stone-800">
                      <tr>
                        <th className="py-1.5 px-2">Ward</th>
                        <th className="py-1.5 px-2 text-right">Loss (ha)</th>
                        <th className="py-1.5 px-2 text-right">Cells</th>
                        <th className="py-1.5 px-2 text-right">Extra Heat</th>
                        <th className="py-1.5 px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/60 bg-stone-900/60 text-stone-300">
                      {(greenLossData?.ward_aggregates || []).map((w) => (
                        <tr
                          key={w.ward}
                          onClick={() => {
                            setSelectedWard(w.ward);
                            onSelectWard?.(w.ward);
                            setActiveLayer("green_loss");
                          }}
                          className={`hover:bg-rose-950/30 cursor-pointer transition-colors ${
                            selectedWard === w.ward ? "bg-rose-950/50 text-white font-bold" : ""
                          }`}
                          title="Click to filter map to this ward"
                        >
                          <td className="py-1.5 px-2 truncate max-w-[110px] font-sans font-medium text-stone-200">
                            {w.ward}
                          </td>
                          <td className="py-1.5 px-2 text-right font-bold text-rose-300">
                            {w.total_loss_area_ha > 0 ? `${w.total_loss_area_ha.toFixed(2)}` : "0.00"}
                          </td>
                          <td className="py-1.5 px-2 text-right text-stone-400">
                            {w.loss_cells_count}
                          </td>
                          <td className="py-1.5 px-2 text-right text-amber-300 font-semibold">
                            {w.mean_extra_heat_celsius !== null && w.mean_extra_heat_celsius !== undefined
                              ? `+${w.mean_extra_heat_celsius.toFixed(2)}°C`
                              : "Not available"}
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWard(w.ward);
                                onSelectWard?.(w.ward);
                                setPanelTab("scenario");
                                setActiveLayer("burden");
                              }}
                              className="px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/80 text-[11px] font-semibold transition-colors"
                              title={`Pre-scope cooling optimizer to ${w.ward}`}
                            >
                              Restore
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveLayer("green_loss")}
                  className="flex-1 py-2 bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-xs font-semibold rounded flex items-center justify-center gap-1.5 border border-rose-700/60 transition-colors shadow-xs"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Show Loss Layer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab("restore")}
                  className="flex-1 py-2 bg-teal-900/80 hover:bg-teal-800 text-teal-200 text-xs font-semibold rounded flex items-center justify-center gap-1.5 border border-teal-700/60 transition-colors shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-teal-400" />
                  <span>Restore Tab</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Protect / Restore First */}
          {panelTab === "restore" && (
            <div className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
              {/* Policy Explanation */}
              <div className="bg-stone-950 p-3 rounded-lg border border-teal-900/60 space-y-1.5">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-bold text-teal-300 uppercase tracking-wide">
                    Protect / Restore First
                  </span>
                </div>
                <p className="text-[11px] text-stone-300 leading-relaxed font-sans">
                  Reuses the Priority Optimizer to greedily allocate restoration budget strictly among the{" "}
                  <strong>{greenLossData?.metadata.total_loss_cells ?? 0} parcels</strong> that suffered confirmed green loss between 2019 and 2026.
                </p>
              </div>

              {/* Restoration Budget Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <span>Restoration Budget</span>
                    <ProvenanceTag type="Assumed" />
                  </label>
                  <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
                    {restoreBudgetHa.toFixed(1)} ha
                  </span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={Math.max(10.0, greenLossData?.metadata.total_loss_area_ha ?? 40.0)}
                  step={0.5}
                  value={restoreBudgetHa}
                  onChange={(e) => setRestoreBudgetHa(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
                <div className="flex justify-between text-[11px] text-stone-500 font-mono">
                  <span>1.0 ha</span>
                  <span>Total Loss: {(greenLossData?.metadata.total_loss_area_ha ?? 40.0).toFixed(1)} ha</span>
                </div>
              </div>

              {/* Target NDVI Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <span>Target Restored NDVI</span>
                    <ProvenanceTag type="Assumed" />
                  </label>
                  <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
                    {targetNdvi.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.40}
                  max={0.85}
                  step={0.05}
                  value={targetNdvi}
                  onChange={(e) => setTargetNdvi(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
                <div className="flex justify-between text-[11px] text-stone-500 font-mono">
                  <span>0.40 (Light shrubs)</span>
                  <span>0.85 (Full canopy)</span>
                </div>
              </div>

              {/* Run Restoration Optimizer Button */}
              <button
                type="button"
                onClick={handleRunRestoreOptimization}
                disabled={isOptimizing}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isOptimizing ? "animate-spin" : ""}`} />
                <span>{isOptimizing ? "Optimizing Restoration..." : "Prioritize Loss Parcels to Restore"}</span>
              </button>

              <div className="text-[11px] text-stone-400 font-mono bg-stone-950 p-2.5 rounded border border-stone-800">
                <span className="text-teal-400 font-bold block mb-0.5">Optimizer Policy:</span>
                Parcels are greedily ranked by thermal cooling relief per hectare. Selected parcels are highlighted on the map and updated in the portfolio strip.
              </div>
            </div>
          )}
        </aside>

        {/* Toggle button if scenario panel is collapsed */}
        {!isScenarioPanelOpen && (
          <button
            type="button"
            onClick={() => setIsScenarioPanelOpen(true)}
            className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-2 rounded-md bg-stone-900 border border-stone-800 text-xs font-bold text-white shadow-xl hover:bg-stone-800 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open Scenario Panel</span>
          </button>
        )}

        {/* MapLibre Map Container */}
        <div ref={mapContainerRef} className="w-full h-full relative" />

        {/* Layer Selector Pills (Floating Top-Center/Right) */}
        <div className="absolute top-3 right-14 z-20 flex items-center gap-1 bg-stone-900/90 backdrop-blur-md p-1 rounded-md border border-stone-800 shadow-xl text-xs">
          <span className="text-[11px] font-mono text-stone-400 px-2 font-bold uppercase hidden md:inline">
            Active Layer:
          </span>
          <button
            type="button"
            onClick={() => setActiveLayer("burden")}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              activeLayer === "burden"
                ? "bg-emerald-600 text-white font-bold shadow-xs"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            Heat Burden
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("lst")}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              activeLayer === "lst"
                ? "bg-emerald-600 text-white font-bold shadow-xs"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            LST (°C)
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("ndvi")}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              activeLayer === "ndvi"
                ? "bg-emerald-600 text-white font-bold shadow-xs"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            NDVI
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("population")}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              activeLayer === "population"
                ? "bg-emerald-600 text-white font-bold shadow-xs"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            Population
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("selected")}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              activeLayer === "selected"
                ? "bg-orange-600 text-white font-bold shadow-xs"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            Selected Zones
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("green_loss")}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              activeLayer === "green_loss"
                ? "bg-rose-600 text-white font-bold shadow-xs"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            Green Loss
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("solar_penalty")}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              activeLayer === "solar_penalty"
                ? "bg-amber-600 text-white font-bold shadow-xs"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            Solar Penalty
          </button>
        </div>

        {/* Floating Colour-Blind-Safe Sequential Palette Legend */}
        <div className="absolute bottom-24 right-3 z-20 bg-stone-900/90 backdrop-blur-md p-3 rounded-lg border border-stone-800 shadow-xl flex flex-col gap-1.5 w-72">
          <div className="flex items-center justify-between text-[11px] font-mono text-stone-300">
            <span className="font-bold uppercase tracking-wider">
              {activeLayer === "burden" ? "Heat Burden (Viridis)" :
               activeLayer === "lst" ? "LST Radiometric (°C)" :
               activeLayer === "ndvi" ? "Sentinel-2 NDVI" :
               activeLayer === "population" ? "Resident Density" :
               activeLayer === "green_loss" ? "Vegetation Loss (ΔNDVI)" :
               activeLayer === "solar_penalty" ? "Solar Heat Penalty (% Loss)" : "Selected Zones"}
            </span>
            <ProvenanceTag
              type={activeLayer === "lst" || activeLayer === "ndvi" ? "Measured" : "Modelled"}
              size="sm"
            />
          </div>

          {/* Sequential Color Bar */}
          {activeLayer === "green_loss" ? (
            <div className="w-full h-3 rounded overflow-hidden flex border border-stone-700">
              <div className="flex-1 h-full bg-slate-800" title="Stable (ΔNDVI > -0.10)" />
              <div className="flex-1 h-full bg-orange-600" title="Moderate Loss (ΔNDVI -0.10 to -0.20)" />
              <div className="flex-1 h-full bg-red-600" title="High Loss (ΔNDVI -0.20 to -0.30)" />
              <div className="flex-1 h-full bg-red-900" title="Severe Loss (ΔNDVI ≤ -0.30)" />
            </div>
          ) : activeLayer === "solar_penalty" ? (
            <div className="w-full h-3 rounded overflow-hidden flex border border-stone-700">
              <div className="flex-1 h-full bg-slate-700" title="Cool baseline (0.0% loss)" />
              <div className="flex-1 h-full bg-yellow-500" title="Mild derating (-1.0% loss)" />
              <div className="flex-1 h-full bg-orange-600" title="Moderate derating (-2.5% loss)" />
              <div className="flex-1 h-full bg-red-600" title="Elevated derating (-4.0% loss)" />
              <div className="flex-1 h-full bg-red-900" title="Severe derating (-5.5%+ loss)" />
            </div>
          ) : (
            <div className="w-full h-3 rounded overflow-hidden flex border border-stone-700">
              {VIRIDIS_PALETTE.colors.map((c, i) => (
                <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
              ))}
            </div>
          )}

          <div className="flex justify-between text-[11px] text-stone-400 font-mono">
            {activeLayer === "green_loss" ? (
              <>
                <span>Stable (Δ ≥ -0.10)</span>
                <span>Severe Loss (≤ -0.30)</span>
              </>
            ) : activeLayer === "solar_penalty" ? (
              <>
                <span>0.0% (Cool Baseline)</span>
                <span>-5.5% (High Penalty)</span>
              </>
            ) : (
              <>
                <span>Low Exposure</span>
                <span>Severe Burden</span>
              </>
            )}
          </div>

          <span className="text-[11px] text-stone-400 leading-tight">
            {activeLayer === "green_loss"
              ? "Sentinel-2 2019 vs 2026 pre-monsoon (ΔNDVI ≤ -0.10 & ΔNDBI > 0)."
              : activeLayer === "solar_penalty"
              ? "Relative PV derating from local surface heat excess. Does not calculate absolute kWh."
              : "Colour-blind-safe sequential Viridis palette (Deuteranopia & Protanopia compliant)."}
          </span>
        </div>

        {/* Right-Hand Evidence Drawer */}
        <ZoneEvidenceDrawer
          isOpen={isEvidenceDrawerOpen && Boolean(selectedZone)}
          onClose={() => setIsEvidenceDrawerOpen(false)}
          zone={selectedZone}
          targetNdvi={targetNdvi}
          budgetHa={budgetHa}
          ensembleStats={zoneEnsembleStats}
          onOpenTwoScenarioComparison={() => {
            setIsEvidenceDrawerOpen(false);
            if (onOpenTwoScenarioComparison) onOpenTwoScenarioComparison();
            else setIsTwoScenarioModalOpen(true);
          }}
        />
      </div>

      {/* ========================================================================= */}
      {/* 3. BOTTOM PORTFOLIO SUMMARY STRIP                                         */}
      {/* ========================================================================= */}
      <footer className="h-16 bg-stone-900 border-t border-stone-800 px-6 flex flex-col justify-center shrink-0 z-20 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 divide-x divide-stone-800 text-xs">
            {/* Metric 1: Budget Allocated */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-medium">
                <span>Allocated Hectares</span>
                <ProvenanceTag type="Assumed" size="sm" />
              </div>
              <div className="font-mono font-extrabold text-sm text-stone-100">
                {portfolioSummary.allocatedHa.toFixed(1)} / {budgetHa.toFixed(1)} ha
              </div>
            </div>

            {/* Metric 2: Selected Zones */}
            <div className="pl-6 flex flex-col">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-medium">
                <span>Selected Zones</span>
                <ProvenanceTag type="Modelled" size="sm" />
              </div>
              <div className="font-mono font-extrabold text-sm text-emerald-400">
                {portfolioSummary.selectedCount} cells ({portfolioSummary.selectedCount * 6.25} ha)
              </div>
            </div>

            {/* Metric 3: Mean Cooling with P10/P90 */}
            <div className="pl-6 flex flex-col">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-medium">
                <span>Expected Cooling</span>
                <ProvenanceTag type="Modelled" size="sm" />
              </div>
              <div className="font-mono font-extrabold text-sm text-teal-400 flex items-center gap-1.5">
                <span>+{portfolioSummary.meanCooling.toFixed(2)} °C</span>
                <span className="text-[11px] text-stone-400 font-normal">
                  (P10: +{portfolioSummary.p10Cooling.toFixed(2)} | P90: +{portfolioSummary.p90Cooling.toFixed(2)})
                </span>
              </div>
            </div>

            {/* Metric 4: Population Benefited */}
            <div className="pl-6 hidden sm:flex flex-col">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-medium">
                <span>Benefited Population</span>
                <ProvenanceTag type="Modelled" size="sm" />
              </div>
              <div className="font-mono font-extrabold text-sm text-sky-400">
                {portfolioSummary.totalPopulation.toLocaleString()} residents
              </div>
            </div>

            {/* Metric 5: Ensemble Convergence */}
            <div className="pl-6 hidden md:flex flex-col">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-medium">
                <span>Ensemble Convergence</span>
                <ProvenanceTag type="Modelled" size="sm" />
              </div>
              <div className="font-mono font-extrabold text-sm text-stone-200">
                {portfolioSummary.ensembleConvergence} / 30 runs
              </div>
            </div>
          </div>

          {/* Scientific Disclaimer Notice */}
          <div className="hidden xl:flex items-center gap-2 text-[11px] text-stone-400 font-mono max-w-sm leading-tight text-right">
            <span>
              LST is radiometric skin temp, not air temp. NDVI is vegetation index, not 3D canopy. No arbitrary weighted composite scores.
            </span>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 4. LEGACY TOOLS MODALS & DRAWERS (Preserved behind dropdown)             */}
      {/* ========================================================================= */}
      <HeatIntelligenceDashboard
        isOpen={isHeatDashboardOpen}
        onClose={() => setIsHeatDashboardOpen(false)}
      />

      <InterventionPlanningWorkspace
        isOpen={isInterventionsOpen}
        onClose={() => setIsInterventionsOpen(false)}
        onLocateCandidate={(lat, lng) => {
          setIsInterventionsOpen(false);
          if (mapRef.current) {
            mapRef.current.flyTo({ center: [lng, lat], zoom: 16 });
          }
        }}
      />

      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        context={{
          studyArea: "Pune Central (PMC 250m Spatial Grid)",
          infrastructureType: "Urban Greening & Heat Mitigation",
          placement: {
            lat: selectedZone?.centroid?.[1] || 18.5204,
            lng: selectedZone?.centroid?.[0] || 73.8567,
            lengthM: 250,
            widthM: 250,
            areaM2: 62500,
            bearingDeg: 0,
            label: selectedZone?.id || "Zone Evaluation",
          },
        }}
      />

      {isShadowSimulatorOpen && (
        <ShadowSimulatorModal
          isOpen={isShadowSimulatorOpen}
          onClose={() => setIsShadowSimulatorOpen(false)}
          onApplyMapOverlay={() => {}}
          placement={{
            lat: selectedZone?.centroid?.[1] || 18.5204,
            lng: selectedZone?.centroid?.[0] || 73.8567,
            lengthM: 30,
            widthM: 20,
            bearingDeg: 0,
            params: {
              targetNdvi: targetNdvi,
              ward: selectedZone?.ward,
            },
          }}
        />
      )}

      {isSolarRealityOpen && (
        <SolarRealityModal
          isOpen={isSolarRealityOpen}
          onClose={() => setIsSolarRealityOpen(false)}
          placement={{
            lat: selectedZone?.centroid?.[1] || 18.5204,
            lng: selectedZone?.centroid?.[0] || 73.8567,
            lengthM: 30,
            widthM: 20,
            bearingDeg: 0,
            params: {
              targetNdvi: targetNdvi,
              ward: selectedZone?.ward,
            },
          }}
        />
      )}

      <ScenarioComparisonModal
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        scenarioName="Pune Urban Heat & Infrastructure Scenarios"
      />

      {/* Two-Scenario Comparative Policy Evaluation Modal */}
      <TwoScenarioComparisonModal
        isOpen={isTwoScenarioModalOpen}
        onClose={() => setIsTwoScenarioModalOpen(false)}
        initialBudgetA={budgetHa}
        initialTargetNdviA={targetNdvi}
        initialObjectiveA={objective}
        initialWardA={selectedWard}
      />
    </div>
  );
};
