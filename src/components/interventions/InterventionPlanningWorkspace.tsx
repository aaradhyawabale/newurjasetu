"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Building2,
  TreePine,
  Sun,
  ShieldAlert,
  Compass,
  FileText,
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Search,
  ExternalLink,
  Layers,
  ChevronRight,
  Printer,
  Copy,
  Check,
  MapPin,
  Flame,
  Activity,
  RefreshCw,
  Database,
  Sparkles,
  BadgeCheck,
  Info
} from "lucide-react";
import {
  InterventionCandidate,
  InterventionCategoryId,
  CandidateStatus,
  CandidateComparison,
  PlanningDossier,
  CandidateProvenanceType,
  AnalysisRun,
  DatasetRegistryItem
} from "@/server/intervention-engine/types";
import { ProvenanceTag } from "../ui/ProvenanceTag";

interface InterventionWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  onLocateCandidate?: (lat: number, lng: number, name: string) => void;
}

export const InterventionPlanningWorkspace: React.FC<InterventionWorkspaceProps> = ({
  isOpen,
  onClose,
  onLocateCandidate
}) => {
  const [candidates, setCandidates] = useState<InterventionCandidate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<InterventionCategoryId | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | "ALL">("ALL");
  const [provenanceMode, setProvenanceMode] = useState<"DATASET_DERIVED" | "SAMPLE_LOCATION" | "ALL">("DATASET_DERIVED");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic discovery & Dataset Registry State
  const [latestRun, setLatestRun] = useState<AnalysisRun | null>(null);
  const [isTriggeringDiscovery, setIsTriggeringDiscovery] = useState(false);
  const [isRegistryModalOpen, setIsRegistryModalOpen] = useState(false);
  const [registeredDatasets, setRegisteredDatasets] = useState<DatasetRegistryItem[]>([]);
  const [datasetSummary, setDatasetSummary] = useState<any | null>(null);

  // Modals
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [comparisonData, setComparisonData] = useState<CandidateComparison | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
  const [activeDossier, setActiveDossier] = useState<PlanningDossier | null>(null);
  const [isGeneratingDossier, setIsGeneratingDossier] = useState(false);
  const [copiedDossier, setCopiedDossier] = useState(false);

  // Fetch candidates from API
  useEffect(() => {
    if (!isOpen) return;

    async function loadCandidates() {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (provenanceMode === "DATASET_DERIVED") {
          queryParams.set("provenanceType", "DATASET_DERIVED");
        } else if (provenanceMode === "SAMPLE_LOCATION") {
          queryParams.set("provenanceType", "SAMPLE_LOCATION");
        } else {
          queryParams.set("includeSamples", "true");
        }

        const [candsRes, metaRes] = await Promise.all([
          fetch(`/api/interventions/candidates?${queryParams.toString()}`),
          fetch("/api/interventions")
        ]);

        if (!candsRes.ok) throw new Error(`HTTP ${candsRes.status}: Failed to load candidates`);
        const candsData = await candsRes.json();
        setCandidates(candsData.candidates || []);
        if (candsData.candidates && candsData.candidates.length > 0) {
          setActiveCandidateId(candsData.candidates[0].id);
        }

        if (metaRes.ok) {
          const metaData = await metaRes.json();
          if (metaData.latestAnalysisRun) {
            setLatestRun(metaData.latestAnalysisRun);
          }
          if (metaData.datasetRegistrySummary) {
            setDatasetSummary(metaData.datasetRegistrySummary);
          }
        }
      } catch (err: any) {
        console.error("Error fetching intervention candidates:", err);
        setError(err.message || "Failed to load candidates");
      } finally {
        setIsLoading(false);
      }
    }

    loadCandidates();
  }, [isOpen, provenanceMode]);

  // Trigger dynamic spatial discovery run
  const handleTriggerDiscovery = async () => {
    setIsTriggeringDiscovery(true);
    try {
      const res = await fetch("/api/interventions/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studyAreaId: "pune-pmc" })
      });
      if (!res.ok) throw new Error("Dynamic spatial discovery failed");
      const data = await res.json();
      setLatestRun(data.analysisRun);
      setProvenanceMode("DATASET_DERIVED");
      setCandidates(data.candidates || []);
      if (data.candidates && data.candidates.length > 0) {
        setActiveCandidateId(data.candidates[0].id);
      }
    } catch (err: any) {
      alert("Discovery run failed: " + err.message);
    } finally {
      setIsTriggeringDiscovery(false);
    }
  };

  // Open dataset registry modal
  const handleOpenDatasetRegistry = async () => {
    setIsRegistryModalOpen(true);
    if (registeredDatasets.length === 0) {
      try {
        const res = await fetch("/api/interventions/datasets");
        if (res.ok) {
          const data = await res.json();
          setRegisteredDatasets(data.datasets || []);
          setDatasetSummary(data.summary || null);
        }
      } catch (err) {
        console.error("Failed to load dataset registry", err);
      }
    }
  };

  // Filtered candidate list
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (selectedCategory !== "ALL" && c.categoryId !== selectedCategory) return false;
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchWard = c.wardOrPrabhag.toLowerCase().includes(q);
        const matchLoc = c.locationSummary.toLowerCase().includes(q);
        if (!matchName && !matchWard && !matchLoc) return false;
      }
      return true;
    });
  }, [candidates, selectedCategory, statusFilter, searchQuery]);

  const activeCandidate = useMemo(() => {
    return candidates.find((c) => c.id === activeCandidateId) || filteredCandidates[0] || null;
  }, [candidates, activeCandidateId, filteredCandidates]);

  // Handle comparison selection toggle
  const toggleComparisonSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForComparison((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 4) {
        alert("A maximum of 4 candidates can be compared simultaneously.");
        return prev;
      }
      return [...prev, id];
    });
  };

  // Launch comparison
  const handleOpenComparison = async () => {
    if (selectedForComparison.length < 2) return;
    setIsComparing(true);
    try {
      const res = await fetch("/api/interventions/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateIds: selectedForComparison })
      });
      if (!res.ok) throw new Error("Comparison request failed");
      const data = await res.json();
      setComparisonData(data.comparison);
      setIsCompareModalOpen(true);
    } catch (err: any) {
      alert("Failed to compare candidates: " + err.message);
    } finally {
      setIsComparing(false);
    }
  };

  // Launch dossier generation
  const handleOpenDossier = async (candidateId: string) => {
    setIsGeneratingDossier(true);
    try {
      const res = await fetch("/api/interventions/dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId })
      });
      if (!res.ok) throw new Error("Failed to generate dossier");
      const data = await res.json();
      setActiveDossier(data.dossier);
      setIsDossierModalOpen(true);
    } catch (err: any) {
      alert("Failed to generate planning dossier: " + err.message);
    } finally {
      setIsGeneratingDossier(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between px-6 py-3.5 border-b border-stone-200 bg-stone-50/80 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Building2 className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-stone-900">
                  Urban Intervention Planning & Opportunity Discovery
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Phase 6 Dynamic Spatial Discovery
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  Official PMC Data
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Dynamic opportunity screening from official municipal registers, OSM road alignments, and Landsat 9/Sentinel-2 rasters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleTriggerDiscovery}
              disabled={isTriggeringDiscovery}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition-colors"
              title="Execute dynamic spatial discovery across official spatial datasets"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTriggeringDiscovery ? "animate-spin" : ""}`} />
              <span>{isTriggeringDiscovery ? "Discovering..." : "Run Discovery"}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenDatasetRegistry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 hover:border-stone-400 bg-white text-stone-700 hover:text-stone-900 text-xs font-semibold shadow-2xs transition-colors"
              title="View central spatial dataset registry, verification status, and data gap roadmap"
            >
              <Database className="w-3.5 h-3.5 text-stone-600" />
              <span>Dataset Registry</span>
            </button>

            {selectedForComparison.length >= 2 && (
              <button
                type="button"
                onClick={handleOpenComparison}
                disabled={isComparing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Compare ({selectedForComparison.length}/4)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-stone-200 text-stone-500 hover:text-stone-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Project Scientific Rules & Disclaimers Banner */}
        <div className="px-6 py-2 bg-stone-100 border-b border-stone-200 flex items-center justify-between flex-wrap gap-2 text-[10.5px] text-stone-700 font-mono shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-stone-900 uppercase">Scientific Disclaimers:</span>
            <span>• Surface temperature (LST) is radiometric skin temperature, NOT 2m ambient air temperature</span>
            <span>• NDVI is a spectral reflectance index, NOT 3D tree canopy cover</span>
            <span>• No arbitrary weighted composite scores</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-stone-500 text-[10px]">Data Provenance:</span>
            <ProvenanceTag type="Measured" />
            <ProvenanceTag type="Modelled" />
            <ProvenanceTag type="Assumed" />
          </div>
        </div>

        {/* Discovery & Provenance Mode Sub-bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2 bg-stone-100/70 border-b border-stone-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-stone-600">Candidate Mode:</span>
            <div className="inline-flex rounded-lg border border-stone-300 bg-stone-200/60 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setProvenanceMode("DATASET_DERIVED")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  provenanceMode === "DATASET_DERIVED"
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <span>Dataset-Derived Opportunities</span>
              </button>

              <button
                type="button"
                onClick={() => setProvenanceMode("SAMPLE_LOCATION")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  provenanceMode === "SAMPLE_LOCATION"
                    ? "bg-white text-amber-800 shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Curated Reference Landmarks</span>
              </button>

              <button
                type="button"
                onClick={() => setProvenanceMode("ALL")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  provenanceMode === "ALL"
                    ? "bg-white text-stone-900 shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                All
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-stone-500">
            {latestRun && (
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-stone-200">
                Run: <strong>{latestRun.analysisId}</strong> ({latestRun.featuresEvaluated} features screened)
              </span>
            )}
            <span className="text-stone-500">
              Verified datasets: <strong className="text-stone-800">{datasetSummary?.officialVerifiedCount || 4}</strong> of {datasetSummary?.totalRegistered || 10}
            </span>
          </div>
        </div>

        {/* Category Pills Navigation */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-white border-b border-stone-200 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
              selectedCategory === "ALL"
                ? "bg-stone-900 text-white"
                : "bg-stone-100 hover:bg-stone-200 text-stone-700"
            }`}
          >
            All Categories ({candidates.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("URBAN_GREENING_CORRIDOR")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
              selectedCategory === "URBAN_GREENING_CORRIDOR"
                ? "bg-emerald-700 text-white"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
            }`}
          >
            <TreePine className="w-3.5 h-3.5" />
            <span>Urban Greening Corridors</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("COOL_ROOF_FEASIBILITY")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
              selectedCategory === "COOL_ROOF_FEASIBILITY"
                ? "bg-cyan-700 text-white"
                : "bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Cool Roof Opportunities</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("SOLAR_CANOPY_EV_COLOCATION")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
              selectedCategory === "SOLAR_CANOPY_EV_COLOCATION"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200"
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Solar Canopy & EV Hubs</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("GREEN_SPACE_ENHANCEMENT")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
              selectedCategory === "GREEN_SPACE_ENHANCEMENT"
                ? "bg-teal-700 text-white"
                : "bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200"
            }`}
          >
            <TreePine className="w-3.5 h-3.5" />
            <span>Green Space Improvement</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory("INTEGRATED_FACILITY_UPGRADE")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
              selectedCategory === "INTEGRATED_FACILITY_UPGRADE"
                ? "bg-purple-700 text-white"
                : "bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Integrated Facility Upgrades</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-stone-50 border-b border-stone-200 text-xs">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidate sites by name, road, or prabhag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-800 placeholder-stone-400 text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="ELIGIBLE_FOR_REVIEW">Eligible for Review</option>
              <option value="CONDITIONALLY_ELIGIBLE">Conditionally Eligible</option>
              <option value="REQUIRES_SITE_VALIDATION">Requires Site Validation</option>
            </select>
          </div>

          <div className="flex items-center gap-4 text-stone-500 font-medium">
            <span>Showing <strong className="text-stone-900">{filteredCandidates.length}</strong> of {candidates.length} candidates</span>
            {selectedForComparison.length > 0 && (
              <span className="text-emerald-700 font-semibold">
                {selectedForComparison.length} selected for comparison
              </span>
            )}
          </div>
        </div>

        {/* Workspace Body: Split View */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Column: Candidate List */}
          <div className="w-full md:w-5/12 lg:w-4/12 border-r border-stone-200 overflow-y-auto p-4 space-y-3 bg-stone-50/50">
            {isLoading && (
              <div className="p-8 text-center text-xs text-stone-500">
                Loading intervention candidates from spatial registry...
              </div>
            )}

            {error && (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {error}
              </div>
            )}

            {!isLoading && filteredCandidates.length === 0 && (
              <div className="p-8 text-center text-xs text-stone-500">
                No intervention candidates match the selected filters.
              </div>
            )}

            {filteredCandidates.map((c) => {
              const isActive = activeCandidate?.id === c.id;
              const isChecked = selectedForComparison.includes(c.id);
              const lstDelta = c.thermalContext.lstDeltaToBaselineCelsius;
              const ndviDelta = c.vegetationContext.ndviDeltaToBaseline;

              return (
                <div
                  key={c.id}
                  onClick={() => setActiveCandidateId(c.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                    isActive
                      ? "bg-white border-emerald-600 shadow-sm ring-1 ring-emerald-600/20"
                      : "bg-white border-stone-200 hover:border-stone-300 shadow-2xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                          {c.categoryId.replace(/_/g, " ")}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          c.status === "ELIGIBLE_FOR_REVIEW"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : c.status === "CONDITIONALLY_ELIGIBLE"
                            ? "bg-blue-50 text-blue-800 border border-blue-200"
                            : c.status === "REQUIRES_SITE_VALIDATION"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}>
                          {c.status.replace(/_/g, " ")}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          c.provenanceType === "DATASET_DERIVED"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : c.provenanceType === "MANUALLY_CURATED"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-stone-200 text-stone-700 border border-stone-300"
                        }`}>
                          {c.provenanceType === "DATASET_DERIVED" ? "DATASET" : c.provenanceType === "MANUALLY_CURATED" ? "CURATED" : "SAMPLE"}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-stone-900 mt-1.5 leading-snug">
                        {c.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-0.5 flex-wrap">
                        <span>{c.wardOrPrabhag}</span>
                        {c.sourceFeatureId && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[10px] text-stone-400 truncate max-w-[140px]">{c.sourceFeatureId}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => toggleComparisonSelection(c.id, e)}
                      className={`p-1.5 rounded-md text-xs font-medium border transition-colors shrink-0 ${
                        isChecked
                          ? "bg-emerald-700 border-emerald-700 text-white"
                          : "border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600"
                      }`}
                      title={isChecked ? "Remove from comparison" : "Select for side-by-side comparison"}
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Satellite Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-stone-100 text-[11px]">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="font-semibold text-stone-900 truncate">
                          {c.thermalContext.surfaceTemperatureCelsius !== null ? `${c.thermalContext.surfaceTemperatureCelsius}°C` : "Not available"}
                        </span>
                        {lstDelta !== null && (
                          <span className={`text-[10px] font-medium ${lstDelta > 0 ? "text-rose-600 font-bold" : "text-stone-500"}`}>
                            ({lstDelta > 0 ? "+" : ""}{lstDelta}°C)
                          </span>
                        )}
                      </div>
                      <ProvenanceTag type="Measured" />
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <TreePine className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-stone-900 truncate">
                          {c.vegetationContext.ndvi30m !== null ? c.vegetationContext.ndvi30m : "Not available"}
                        </span>
                        <span className="text-[10px] text-stone-500">
                          NDVI
                        </span>
                      </div>
                      <ProvenanceTag type="Measured" />
                    </div>
                  </div>

                  {/* Constraints Summary Tag */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-100 text-[10px] text-stone-500">
                    <span>
                      {c.constraints.length} Constraints ({c.constraints.filter(x => x.severity === "CRITICAL_BLOCKER").length} Blocker)
                    </span>
                    <span className="font-medium text-stone-600">
                      {c.missingSurveyChecklist.length} Surveys Required
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Detailed Candidate Dossier View */}
          <div className="w-full md:w-7/12 lg:w-8/12 overflow-y-auto p-6 bg-white space-y-6">
            {activeCandidate ? (
              <>
                {/* Candidate Header Profile */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-stone-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-700 border border-stone-200">
                        {activeCandidate.categoryId.replace(/_/g, " ")}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {activeCandidate.status.replace(/_/g, " ")}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                        Evidence: {activeCandidate.evidenceCompleteness}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-stone-900 mt-2">
                      {activeCandidate.name}
                    </h3>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed max-w-2xl">
                      {activeCandidate.locationSummary}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {onLocateCandidate && (
                      <button
                        type="button"
                        onClick={() => onLocateCandidate(activeCandidate.coordinates.lat, activeCandidate.coordinates.lng, activeCandidate.name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 hover:border-emerald-700 bg-white hover:bg-emerald-50 text-stone-700 hover:text-emerald-800 text-xs font-semibold transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Locate on Map</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenDossier(activeCandidate.id)}
                      disabled={isGeneratingDossier}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{isGeneratingDossier ? "Generating..." : "Generate Planning Dossier"}</span>
                    </button>
                  </div>
                </div>

                {/* Candidate Provenance & Traceability Panel */}
                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/80 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-700">Provenance & Origin:</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        activeCandidate.provenanceType === "DATASET_DERIVED"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : activeCandidate.provenanceType === "MANUALLY_CURATED"
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-stone-200 text-stone-800 border border-stone-300"
                      }`}>
                        {activeCandidate.provenanceType === "DATASET_DERIVED"
                          ? "DATASET_DERIVED (Official Municipal Register / Verified OSM)"
                          : activeCandidate.provenanceType === "MANUALLY_CURATED"
                          ? "MANUALLY_CURATED (Curated Corridor Sample / Seed)"
                          : "SAMPLE_LOCATION (Historical Demonstration Landmark)"}
                      </span>
                    </div>

                    {activeCandidate.analysisRunId && (
                      <span className="font-mono text-[10px] text-stone-500 bg-white px-2 py-0.5 rounded border border-stone-200">
                        Run: {activeCandidate.analysisRunId}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-2 border-t border-stone-200">
                    <div>
                      <span className="text-stone-500">Source Dataset: </span>
                      <strong className="text-stone-800">{activeCandidate.sourceDatasetName || "Municipal / OSM Register"}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500">Source Feature ID: </span>
                      <strong className="font-mono text-stone-800">{activeCandidate.sourceFeatureId || "Unassigned"}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500">Geometry Type: </span>
                      <strong className="text-stone-800">{activeCandidate.sourceGeometryType || "Point"} (Representative Centroid)</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-stone-500 pt-1">
                    <Info className="w-3 h-3 text-stone-400 shrink-0" />
                    <span>
                      Planning Notice: Technical screening classification only; does NOT constitute municipal sanction or budget sanction. Building footprint is not usable rooftop area. Available transformer headroom requires formal MSEDCL clearance.
                    </span>
                  </div>
                </div>

                {/* Spatial Evidence Grid */}
                <div>
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-3">
                    1. Verified Spatial & Satellite Evidence
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Thermal Card */}
                    <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 text-rose-800 text-xs font-bold">
                          <Flame className="w-4 h-4 text-rose-600" />
                          <span>Landsat 9 LST</span>
                        </div>
                        <ProvenanceTag type="Measured" />
                      </div>
                      <div className="mt-2 text-xl font-bold text-stone-900">
                        {activeCandidate.thermalContext.surfaceTemperatureCelsius !== null ? `${activeCandidate.thermalContext.surfaceTemperatureCelsius}°C` : "Not available"}
                      </div>
                      <p className="text-[11px] text-stone-600 mt-1 flex items-center justify-between">
                        <span>
                          {activeCandidate.thermalContext.lstDeltaToBaselineCelsius !== null 
                            ? `${activeCandidate.thermalContext.lstDeltaToBaselineCelsius > 0 ? "+" : ""}${activeCandidate.thermalContext.lstDeltaToBaselineCelsius}°C vs Baseline (46.3°C)`
                            : "Baseline comparison unavailable"}
                        </span>
                        {activeCandidate.thermalContext.lstDeltaToBaselineCelsius !== null && (
                          <ProvenanceTag type="Modelled" />
                        )}
                      </p>
                      <p className="text-[10px] text-stone-500 mt-1 flex items-center justify-between">
                        <span>USGS ST_QA: ±{activeCandidate.thermalContext.landsatStQaUncertaintyK ?? 2.16} K uncertainty</span>
                        <ProvenanceTag type="Measured" />
                      </p>
                    </div>

                    {/* Vegetation Card */}
                    <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold">
                          <TreePine className="w-4 h-4 text-emerald-600" />
                          <span>Sentinel-2 NDVI (30m)</span>
                        </div>
                        <ProvenanceTag type="Measured" />
                      </div>
                      <div className="mt-2 text-xl font-bold text-stone-900">
                        {activeCandidate.vegetationContext.ndvi30m !== null ? activeCandidate.vegetationContext.ndvi30m : "Not available"}
                      </div>
                      <p className="text-[11px] text-stone-600 mt-1">
                        SCL: {activeCandidate.vegetationContext.sclClassName || "Not available"} (Class {activeCandidate.vegetationContext.sclClassId})
                      </p>
                      <p className="text-[10px] text-stone-500 mt-1 flex items-center justify-between">
                        <span>Delta vs Baseline: {activeCandidate.vegetationContext.ndviDeltaToBaseline ?? "Not available"}</span>
                        {activeCandidate.vegetationContext.ndviDeltaToBaseline !== null && (
                          <ProvenanceTag type="Modelled" />
                        )}
                      </p>
                    </div>

                    {/* Infrastructure Card */}
                    <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 text-blue-800 text-xs font-bold">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          <span>Civil Frontage</span>
                        </div>
                        <ProvenanceTag type="Modelled" />
                      </div>
                      <div className="mt-2 text-sm font-bold text-stone-900 truncate">
                        {activeCandidate.infrastructureContext.nearestRoadName}
                      </div>
                      <p className="text-[11px] text-stone-600 mt-1 flex items-center justify-between">
                        <span>Road setback: {activeCandidate.infrastructureContext.nearestRoadDistanceM !== null ? `${activeCandidate.infrastructureContext.nearestRoadDistanceM}m` : "Not available"}</span>
                        <ProvenanceTag type="Modelled" />
                      </p>
                      {activeCandidate.infrastructureContext.nearestSubstationName && (
                        <p className="text-[10px] text-stone-500 mt-1 flex items-center justify-between truncate">
                          <span className="truncate">Substation: {activeCandidate.infrastructureContext.nearestSubstationName} ({activeCandidate.infrastructureContext.nearestSubstationDistanceM}m)</span>
                          <ProvenanceTag type="Modelled" />
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Constraints & Critical Blockers */}
                <div>
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-3">
                    2. Site Constraints & Engineering Blockers ({activeCandidate.constraints.length})
                  </h4>
                  <div className="space-y-2.5">
                    {activeCandidate.constraints.map((con) => (
                      <div
                        key={con.id}
                        className={`p-3.5 rounded-xl border ${
                          con.severity === "CRITICAL_BLOCKER"
                            ? "border-rose-300 bg-rose-50/50"
                            : "border-amber-300 bg-amber-50/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {con.severity === "CRITICAL_BLOCKER" ? (
                            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-stone-900">
                            {con.title}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.2 rounded-full uppercase ${
                            con.severity === "CRITICAL_BLOCKER"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {con.severity.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-xs text-stone-700 mt-1.5 leading-relaxed">
                          {con.description}
                        </p>
                        <div className="mt-2 pt-2 border-t border-stone-200/60 text-[11px] text-stone-800 font-medium">
                          <strong>Mitigation Requirement:</strong> {con.mitigationRequirement}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mandatory Pre-Implementation Survey Checklist */}
                <div>
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-3">
                    3. Mandatory Pre-Implementation Site Survey Plan ({activeCandidate.missingSurveyChecklist.length})
                  </h4>
                  <div className="border border-stone-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                        <tr>
                          <th className="px-3.5 py-2">Survey Task</th>
                          <th className="px-3.5 py-2">Required Phase</th>
                          <th className="px-3.5 py-2">Governing Methodology / Standard</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {activeCandidate.missingSurveyChecklist.map((item) => (
                          <tr key={item.id} className="hover:bg-stone-50">
                            <td className="px-3.5 py-2.5">
                              <span className="font-semibold text-stone-900">{item.itemName}</span>
                              <p className="text-[11px] text-stone-500 mt-0.5">{item.description}</p>
                            </td>
                            <td className="px-3.5 py-2.5 font-medium text-stone-700">
                              <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold">
                                {item.requiredForPhase}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-stone-600 font-mono text-[11px]">
                              {item.surveyStandardOrMethodology}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Scientific Evidence Ledger */}
                <div>
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-3">
                    4. Scientific Evidence Ledger ({activeCandidate.evidenceLedger.length} Items)
                  </h4>
                  <div className="border border-stone-200 rounded-xl overflow-hidden text-xs">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200 sticky top-0">
                          <tr>
                            <th className="px-3 py-2">Parameter</th>
                            <th className="px-3 py-2">Provenance</th>
                            <th className="px-3 py-2">Observed Value</th>
                            <th className="px-3 py-2">Source Dataset / Standard</th>
                            <th className="px-3 py-2">Uncertainty / Disclaimer</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 text-[11px]">
                          {activeCandidate.evidenceLedger.map((e) => {
                            const provType: "Measured" | "Modelled" | "Assumed" =
                              e.category === "SATELLITE_OBSERVATION"
                                ? "Measured"
                                : e.category === "DETERMINISTIC_CALCULATION"
                                ? "Modelled"
                                : "Assumed";

                            return (
                              <tr key={e.id} className="hover:bg-stone-50">
                                <td className="px-3 py-2 font-medium text-stone-900">{e.parameterName}</td>
                                <td className="px-3 py-2">
                                  <ProvenanceTag type={provType} />
                                </td>
                                <td className="px-3 py-2 font-mono font-bold text-stone-800">
                                  {e.observedValue !== null ? String(e.observedValue) : "Not available"} {e.unit || ""}
                                </td>
                                <td className="px-3 py-2 text-stone-600">{e.sourceDataset}</td>
                                <td className="px-3 py-2 text-stone-500 text-[10px]">{e.uncertaintyOrDisclaimer}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Recommended Next Action Callout */}
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-emerald-900">
                      Recommended Immediate Municipal Action
                    </h5>
                    <p className="text-xs text-emerald-800 mt-1">
                      {activeCandidate.recommendedNextAction}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-stone-400 text-xs">
                Select an intervention candidate to view its full spatial dossier.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Side-by-Side Comparison Modal */}
      {isCompareModalOpen && comparisonData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-900/70 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
              <div className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-stone-900">
                  Side-by-Side Candidate Comparison ({comparisonData.candidates.length} Sites)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-200 text-stone-500 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Matrix Table */}
              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-stone-100 text-stone-800 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-2.5 w-1/3">Evaluation Metric</th>
                      {comparisonData.candidates.map((c) => (
                        <th key={c.id} className="px-4 py-2.5">
                          <span className="font-bold text-stone-900 block">{c.name}</span>
                          <span className="text-[10px] text-stone-500 font-normal">{c.wardOrPrabhag}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {comparisonData.comparisonMatrix.map((row, idx) => (
                      <tr key={idx} className="hover:bg-stone-50">
                        <td className="px-4 py-2 font-medium text-stone-700 bg-stone-50/50">
                          {row.attribute}
                        </td>
                        {comparisonData.candidates.map((c) => (
                          <td key={c.id} className="px-4 py-2 font-mono text-stone-900 font-semibold">
                            {row.values[c.id] !== undefined ? String(row.values[c.id]) : "N/A"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Trade-Off Analysis */}
              <div>
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">
                  Trade-Off Synthesis Across Planning Dimensions
                </h4>
                <div className="space-y-3">
                  {comparisonData.tradeOffAnalysis.map((item, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50">
                      <h5 className="text-xs font-bold text-stone-900">{item.dimension}</h5>
                      <ul className="list-disc list-inside text-xs text-stone-700 mt-1.5 space-y-1">
                        {item.observations.map((obs, obsIdx) => (
                          <li key={obsIdx}>{obs}</li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-stone-500 mt-2 pt-2 border-t border-stone-200">
                        <strong>Governing Consideration:</strong> {item.governingConsideration}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-stone-100 text-[11px] text-stone-600">
                {comparisonData.planningNotice}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formal Municipal Dossier Modal */}
      {isDossierModalOpen && activeDossier && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-900/70 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    Municipal Planning Dossier: {activeDossier.candidate.name}
                  </h3>
                  <span className="font-mono text-[10px] text-stone-500">
                    Ref ID: {activeDossier.dossierId} | Generated {activeDossier.generatedAt.split("T")[0]}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(activeDossier, null, 2));
                    setCopiedDossier(true);
                    setTimeout(() => setCopiedDossier(false), 2000);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-xs text-stone-700 transition-colors"
                >
                  {copiedDossier ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDossier ? "Copied" : "Copy JSON"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-xs text-stone-700 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDossierModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-stone-200 text-stone-500 hover:text-stone-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs text-stone-800">
              {/* Executive Summary */}
              <div>
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                  1. Executive Summary
                </h4>
                <p className="text-xs text-stone-700 leading-relaxed p-3 rounded-lg bg-stone-50 border border-stone-200">
                  {activeDossier.executiveSummary}
                </p>
              </div>

              {/* Spatial Evidence Summary */}
              <div>
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                  2. Spatial Evidence Profile
                </h4>
                <div className="space-y-2 p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs">
                  <p><strong>Landsat 9 Thermal:</strong> {activeDossier.spatialEvidenceSummary.landsat9ThermalSummary}</p>
                  <p><strong>Sentinel-2 Vegetation:</strong> {activeDossier.spatialEvidenceSummary.sentinel2VegetationSummary}</p>
                  <p><strong>Infrastructure Context:</strong> {activeDossier.spatialEvidenceSummary.infrastructureProximitySummary}</p>
                </div>
              </div>

              {/* Statutory Standards Alignment */}
              <div>
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                  3. Statutory & Engineering Standard Alignment
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-700">
                  {activeDossier.regulatoryAndStandardAlignment.map((reg, idx) => (
                    <li key={idx}>{reg}</li>
                  ))}
                </ul>
              </div>

              {/* Pre-Implementation Survey Plan */}
              <div>
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                  4. Mandated Pre-Implementation Survey Plan
                </h4>
                <div className="border border-stone-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-100 font-semibold border-b border-stone-200 text-stone-700">
                      <tr>
                        <th className="px-3 py-2">Survey Task</th>
                        <th className="px-3 py-2">Mandated Technique / Standard</th>
                        <th className="px-3 py-2">Responsible Agency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {activeDossier.preImplementationSurveyPlan.map((s, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium text-stone-900">{s.surveyTask}</td>
                          <td className="px-3 py-2 font-mono text-[11px] text-stone-700">{s.mandatedTechnique}</td>
                          <td className="px-3 py-2 text-stone-600">{s.responsibleDepartment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                {activeDossier.nonAuthoritativeDisclaimer}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dataset Registry & Data Gap Modal */}
      {isRegistryModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-800 border border-blue-200">
                  <Database className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    Central Spatial Dataset Registry & Verification Audit
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Catalog of ingested geospatial, satellite, and municipal infrastructure datasets for Pune.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRegistryModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-stone-200 text-stone-500 hover:text-stone-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs text-stone-800">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Registered Datasets</span>
                  <div className="text-2xl font-bold text-stone-900 mt-1">{registeredDatasets.length || datasetSummary?.totalRegistered || 10}</div>
                  <p className="text-[10px] text-stone-500 mt-0.5">Spanning satellite, municipal, and electrical layers</p>
                </div>
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Officially Verified</span>
                  <div className="text-2xl font-bold text-emerald-800 mt-1">{datasetSummary?.officialVerifiedCount || 4}</div>
                  <p className="text-[10px] text-emerald-600 mt-0.5">PMC health, garden, and statutory registers</p>
                </div>
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
                  <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Data Gap Action Items</span>
                  <div className="text-2xl font-bold text-amber-800 mt-1">{datasetSummary?.missingDatasetsRoadmap?.length || 4}</div>
                  <p className="text-[10px] text-amber-600 mt-0.5">Missing utility cadastre & transformer telemetry</p>
                </div>
              </div>

              {/* Registered Datasets Table */}
              <div>
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2.5">
                  1. Ingested Datasets
                </h4>
                <div className="border border-stone-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-100 font-semibold border-b border-stone-200 text-stone-700">
                      <tr>
                        <th className="px-3.5 py-2.5">Dataset Name & Source</th>
                        <th className="px-3.5 py-2.5">Verification</th>
                        <th className="px-3.5 py-2.5">Geometry / Resolution</th>
                        <th className="px-3.5 py-2.5">Planning Use & Limitations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 text-[11px]">
                      {registeredDatasets.map((ds) => (
                        <tr key={ds.id} className="hover:bg-stone-50">
                          <td className="px-3.5 py-2.5">
                            <span className="font-bold text-stone-900">{ds.name}</span>
                            <div className="text-[10px] text-stone-500 mt-0.5">{ds.sourceOrganization}</div>
                            <div className="text-[10px] font-mono text-stone-400">License: {ds.license}</div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ds.verificationStatus === "VERIFIED_OFFICIAL"
                                ? "bg-emerald-100 text-emerald-800"
                                : ds.verificationStatus === "VERIFIED_OPENSTREETMAP"
                                ? "bg-blue-100 text-blue-800"
                                : ds.verificationStatus === "RESEARCH_DERIVED"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-stone-100 text-stone-700"
                            }`}>
                              {ds.verificationStatus.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-[10px] text-stone-700">
                            <div>{ds.geometryTypeOrRasterResolution}</div>
                            <div className="text-stone-400 mt-0.5">CRS: {ds.crs}</div>
                            {ds.featureOrPixelCount && (
                              <div className="text-stone-500 mt-0.5">{String(ds.featureOrPixelCount)} records</div>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-stone-600 max-w-sm">
                            <p className="font-medium text-stone-800">{ds.intendedUse}</p>
                            <p className="text-[10px] text-stone-500 mt-1 italic leading-relaxed">
                              Limitation: {ds.knownLimitations}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Data Gap Register & Statutory Roadmap */}
              <div>
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2.5">
                  2. Critical Missing Datasets & Governance Roadmap
                </h4>
                <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-amber-100/70 font-semibold border-b border-amber-200 text-amber-900">
                      <tr>
                        <th className="px-3.5 py-2">Missing Dataset</th>
                        <th className="px-3.5 py-2">Issuing Authority</th>
                        <th className="px-3.5 py-2">Priority</th>
                        <th className="px-3.5 py-2">Impact on Implementation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-200/60 text-[11px]">
                      {(datasetSummary?.missingDatasetsRoadmap || [
                        {
                          datasetName: "PMC Right-of-Way (ROW) & Utility Cadastre",
                          issuingAgency: "PMC Road Dept / City Engineer",
                          priority: "VERY_HIGH",
                          impact: "Mandates on-site GPR scanning before any tree-basin or canopy excavation."
                        },
                        {
                          datasetName: "MSEDCL Distribution Transformer SCADA Headroom",
                          issuingAgency: "MSEDCL Urban Circle",
                          priority: "VERY_HIGH",
                          impact: "Requires individual site-specific interconnection studies for EV charging hubs."
                        },
                        {
                          datasetName: "PMC Property Tax & Building Structural Cadastre",
                          issuingAgency: "PMC Assessment Dept",
                          priority: "HIGH",
                          impact: "Prevents automatic structural qualification of roof slabs without non-destructive testing."
                        },
                        {
                          datasetName: "Local Ambient Weather Sensor AWS Network",
                          issuingAgency: "IMD Pune / PMC Environment Dept",
                          priority: "MEDIUM",
                          impact: "Requires clearly communicating that satellite LST is surface skin temperature, not ambient air temperature."
                        }
                      ]).map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-amber-100/40">
                          <td className="px-3.5 py-2.5 font-bold text-stone-900">{item.datasetName}</td>
                          <td className="px-3.5 py-2.5 text-stone-700">{item.issuingAgency}</td>
                          <td className="px-3.5 py-2.5 font-bold text-rose-700">{item.priority}</td>
                          <td className="px-3.5 py-2.5 text-stone-600">{item.impact}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Legal / Scientific Governance Notice */}
              <div className="p-3.5 rounded-lg bg-stone-100 border border-stone-200 text-[11px] text-stone-600 leading-relaxed">
                <strong>Scientific Governance Notice:</strong> All opportunity rankings and candidate classifications in UrjaSetu represent exploratory planning screenings derived from publicly accessible and municipal open data. They do not constitute formal administrative sanctions, architectural clearance, or budgetary allocations by the Pune Municipal Corporation (PMC).
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
