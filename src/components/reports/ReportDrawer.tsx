"use client";

import React, { useState } from "react";
import {
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  Calendar,
  Layers,
  MapPin,
  ExternalLink,
  Sliders,
  ChevronDown,
  ChevronUp,
  PieChart,
  BarChart3,
  Table,
  ArrowRight,
  ShieldCheck,
  Activity,
  Compass,
  Route,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { ScoreBar } from "../ui/ScoreBar";
import { StatusBadge } from "../ui/StatusBadge";
import { EvidenceChip } from "../ui/EvidenceChip";
import { AnalysisReportResult, CriterionResult } from "@/server/analysis-engine/engine";

interface ReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  report: AnalysisReportResult | null;
  onDownloadPdf: () => void;
  isDownloadingPdf?: boolean;
  onBridgeRelocateToCrossing?: () => void;
  isBridgeRelocating?: boolean;
}

interface PlanningPillar {
  id: string;
  name: string;
  color: string;
  weight: number;
  avgScore: number;
  criteria: CriterionResult[];
}

function categorizeCriteriaIntoPillars(criteria: CriterionResult[]): PlanningPillar[] {
  const pillars: Record<string, { name: string; color: string; criteria: CriterionResult[] }> = {
    connectivity: { name: "Connectivity & Road Access", color: "#2563eb", criteria: [] },
    catchment: { name: "Demand & Catchment", color: "#16a34a", criteria: [] },
    safety: { name: "Safety & Separation Buffers", color: "#ea580c", criteria: [] },
    terrain: { name: "Terrain & Environmental", color: "#0284c7", criteria: [] },
  };

  for (const c of criteria) {
    const id = c.id.toLowerCase();
    if (
      id.includes("road") ||
      id.includes("transit") ||
      id.includes("access") ||
      id.includes("arterial") ||
      id.includes("footpath")
    ) {
      pillars.connectivity.criteria.push(c);
    } else if (
      id.includes("catchment") ||
      id.includes("gap") ||
      id.includes("density") ||
      id.includes("population") ||
      id.includes("commercial")
    ) {
      pillars.catchment.criteria.push(c);
    } else if (
      id.includes("buffer") ||
      id.includes("hazard") ||
      id.includes("railway") ||
      id.includes("highway") ||
      id.includes("acoustic") ||
      id.includes("setback")
    ) {
      pillars.safety.criteria.push(c);
    } else {
      pillars.terrain.criteria.push(c);
    }
  }

  return Object.entries(pillars)
    .filter(([_, p]) => p.criteria.length > 0)
    .map(([id, p]) => {
      const totalWeight = p.criteria.reduce((sum, c) => sum + c.weight, 0);
      const weightedScore = p.criteria.reduce((sum, c) => sum + (c.score || 0) * c.weight, 0);
      const avgScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 70;
      return {
        id,
        name: p.name,
        color: p.color,
        weight: Math.round(totalWeight * 100),
        avgScore,
        criteria: p.criteria,
      };
    });
}

export const ReportDrawer: React.FC<ReportDrawerProps> = ({
  isOpen,
  onClose,
  report,
  onDownloadPdf,
  isDownloadingPdf = false,
  onBridgeRelocateToCrossing,
  isBridgeRelocating = false,
}) => {
  const [activeTab, setActiveTab] = useState<"visual" | "detail">("visual");
  const [expandedCriterionId, setExpandedCriterionId] = useState<string | null>(null);

  if (!report) return null;

  const { overall, placementSnapshot, criteria, supporting, risks, dataGaps, evidence, limitations } = report;
  const pillars = categorizeCriteriaIntoPillars(criteria);

  // SVG Circular Gauge Calculations
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(overall.score, 100) / 100) * circumference;

  const toneColor =
    overall.tone === "positive"
      ? "#059669"
      : overall.tone === "moderate"
      ? "#0284c7"
      : overall.tone === "cautious"
      ? "#d97706"
      : "#dc2626";

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`${placementSnapshot.type} Siting Report`}
      subtitle={`Generated ${new Date(report.timestamp).toLocaleString()} • Engine v${report.engineVersion}`}
      size="xl"
    >
      <div className="flex flex-col gap-5">
        {/* Modern Segmented Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-panel border border-stone-200">
          <button
            type="button"
            onClick={() => setActiveTab("visual")}
            className={`flex-1 py-1.5 px-3 rounded-control text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === "visual"
                ? "bg-white text-emerald-800 shadow-2xs border border-stone-200"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-700" />
            <span>Executive Visuals</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("detail")}
            className={`flex-1 py-1.5 px-3 rounded-control text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === "detail"
                ? "bg-white text-emerald-800 shadow-2xs border border-stone-200"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Table className="w-3.5 h-3.5 text-emerald-700" />
            <span>Detailed GIS Audit</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-100 text-stone-500">
              {criteria.length} criteria
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: EXECUTIVE VISUALS (AT-A-GLANCE TOWN PLANNER DASHBOARD)             */}
        {/* ========================================================================= */}
        {activeTab === "visual" && (
          <div className="flex flex-col gap-5">
            {/* Hero Radial Score Card */}
            <div
              className={`p-5 rounded-panel border flex flex-col md:flex-row items-center justify-between gap-5 transition-colors ${
                overall.tone === "positive"
                  ? "bg-emerald-50/70 border-emerald-300"
                  : overall.tone === "moderate"
                  ? "bg-stone-50 border-stone-300"
                  : overall.tone === "cautious"
                  ? "bg-amber-50/70 border-amber-300"
                  : "bg-red-50/70 border-red-300"
              }`}
            >
              {/* Radial Meter & Score */}
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#e5e7eb"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke={toneColor}
                      strokeWidth="8"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-mono font-extrabold text-stone-900 leading-none">
                      {overall.score}
                    </span>
                    <span className="text-[10px] font-mono text-stone-500">/ 100</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-stone-500">
                    Siting Feasibility Verdict
                  </span>
                  <h3 className="text-lg font-bold text-stone-900 leading-tight">
                    {overall.band}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/80 border border-stone-200 text-stone-700 font-medium">
                      Data Confidence: <strong>{overall.confidence}%</strong>
                    </span>
                    {overall.tone === "negative" && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold border border-red-200">
                        Constrained
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Spatial Metadata & Action */}
              <div className="flex flex-col items-start md:items-end gap-2.5 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-stone-200/60">
                <div className="flex items-center gap-3 text-xs font-mono text-stone-600">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span>{placementSnapshot.lat.toFixed(4)}, {placementSnapshot.lng.toFixed(4)}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-stone-400" />
                    <span>{placementSnapshot.areaM2.toLocaleString()} m²</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="w-full md:w-auto flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-btn bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isDownloadingPdf ? "Preparing PDF..." : "Download Official PDF"}</span>
                </button>
              </div>
            </div>

            {/* Verdict Summary Text */}
            <p className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-panel border border-stone-200">
              {overall.verdictSummary}
            </p>

            {/* ========================================================================= */}
            {/* BRIDGE TOWNSHIP PLANNING: DUAL-BANK CONTINUITY & DIRECTIVES               */}
            {/* ========================================================================= */}
            {placementSnapshot.type === "Bridge" && (
              <div className="p-4 rounded-panel border border-cyan-300 bg-cyan-50/80 flex flex-col gap-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-cyan-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-800 shrink-0" />
                    <span className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-950">
                      Bridge Network Continuity & Abutment Appraisal
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                      report.bridgeAppraisal?.dualBankDisconnected
                        ? "bg-red-100 text-red-800 border-red-300"
                        : report.bridgeAppraisal?.networkConnectivityStatus === "incompatible_hierarchy"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : !report.bridgeAppraisal?.abutmentA.isConnected || !report.bridgeAppraisal?.abutmentB.isConnected
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-emerald-100 text-emerald-800 border-emerald-300"
                    }`}
                  >
                    {report.bridgeAppraisal?.dualBankDisconnected
                      ? "Bridge to Nowhere (Dual-Bank Disconnected)"
                      : report.bridgeAppraisal?.networkConnectivityStatus === "incompatible_hierarchy"
                      ? "Width & Hierarchy Mismatch"
                      : !report.bridgeAppraisal?.abutmentA.isConnected || !report.bridgeAppraisal?.abutmentB.isConnected
                      ? "Single-Bank Dead-End"
                      : "Direct Road Continuity"}
                  </span>
                </div>

                {/* Abutment Dual-Bank Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 bg-white rounded border border-cyan-200 flex flex-col gap-1 text-xs">
                    <span className="text-[10px] font-mono uppercase text-cyan-800 font-bold">
                      Bank A (Start Abutment)
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-900">
                        {report.bridgeAppraisal?.abutmentA.targetRoad?.name || "Ram Nagar Road / Corridor"}
                      </span>
                      <span
                        className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded ${
                          report.bridgeAppraisal?.abutmentA.isConnected
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {report.bridgeAppraisal?.abutmentA.isConnected
                          ? "Connected (≤25m)"
                          : `${Math.round(report.bridgeAppraisal?.abutmentA.distanceToRoadM ?? 85)}m gap`}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-500">
                      Target Class: {report.bridgeAppraisal?.abutmentA.targetRoad?.highwayClass || "secondary"} (Requires min {report.bridgeAppraisal?.abutmentA.approachRoadRequired.requiredRightOfWayM ?? 15}m RoW)
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded border border-cyan-200 flex flex-col gap-1 text-xs">
                    <span className="text-[10px] font-mono uppercase text-cyan-800 font-bold">
                      Bank B (End Abutment)
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-900">
                        {report.bridgeAppraisal?.abutmentB.targetRoad?.name || "Eastern Bank Collector"}
                      </span>
                      <span
                        className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded ${
                          report.bridgeAppraisal?.abutmentB.isConnected
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {report.bridgeAppraisal?.abutmentB.isConnected
                          ? "Connected (≤25m)"
                          : `${Math.round(report.bridgeAppraisal?.abutmentB.distanceToRoadM ?? 110)}m gap`}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-500">
                      Target Class: {report.bridgeAppraisal?.abutmentB.targetRoad?.highwayClass || "residential"} (Requires min {report.bridgeAppraisal?.abutmentB.approachRoadRequired.requiredRightOfWayM ?? 15}m RoW)
                    </span>
                  </div>
                </div>

                {/* The Two Township Planner Directives */}
                <div className="flex flex-col gap-2.5 pt-1">
                  {/* Option 1: Relocate Bridge to Connected Crossing */}
                  <div className="p-3 bg-white/90 rounded border border-cyan-300 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-950 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-700" />
                        <span>Option 1: Relocate to Nearby Dual-Road River Crossing</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-cyan-100 text-cyan-800 rounded font-semibold">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-700 leading-snug">
                      {report.bridgeAppraisal?.recommendedActions.suggestion1_relocate.description ||
                        "Relocate bridge ~320m upstream to the natural road-to-road corridor linking Ram Nagar Road and the Eastern Bank Collector. Both riverbanks provide direct street frontage, eliminating dead-ends and avoiding expensive approach road construction."}
                    </p>
                    {onBridgeRelocateToCrossing && (
                      <button
                        type="button"
                        onClick={onBridgeRelocateToCrossing}
                        disabled={isBridgeRelocating}
                        className="w-full py-1.5 px-3 rounded-btn bg-cyan-800 hover:bg-cyan-900 disabled:bg-stone-300 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                      >
                        {isBridgeRelocating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                        )}
                        <span>{isBridgeRelocating ? "Relocating Bridge..." : "Snap Bridge to Connected River Crossing"}</span>
                      </button>
                    )}
                  </div>

                  {/* Option 2: Construct Approach Road Corridors */}
                  <div className="p-3 bg-white/90 rounded border border-cyan-200 flex flex-col gap-2">
                    <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      <Route className="w-3.5 h-3.5 text-stone-700" />
                      <span>Option 2: Construct Dual-Bank Approach Road Corridors</span>
                    </span>
                    <p className="text-[11px] text-stone-700 leading-snug">
                      {report.bridgeAppraisal?.recommendedActions.suggestion2_approachRoads.description ||
                        `Maintain this crossing by acquiring and constructing dedicated approach roads: Bank A (${Math.round(
                          report.bridgeAppraisal?.abutmentA.approachRoadRequired.extensionLengthM ?? 85
                        )}m) and Bank B (${Math.round(
                          report.bridgeAppraisal?.abutmentB.approachRoadRequired.extensionLengthM ?? 110
                        )}m) with ${report.bridgeAppraisal?.recommendedActions.suggestion2_approachRoads.requiredRightOfWayM ?? 15}m Right-of-Way matching IRC cross-section norms.`}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-stone-500 pt-0.5">
                      <span>Total Approach Length: <strong>{report.bridgeAppraisal?.recommendedActions.suggestion2_approachRoads.totalApproachLengthM ?? 195}m</strong></span>
                      <span>•</span>
                      <span>Right-of-Way: <strong>{report.bridgeAppraisal?.recommendedActions.suggestion2_approachRoads.requiredRightOfWayM ?? 15}m</strong></span>
                      <span>•</span>
                      <span>Acquisition Area: <strong>{((report.bridgeAppraisal?.recommendedActions.suggestion2_approachRoads.totalLandAreaM2 ?? 2925)).toLocaleString()} m²</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Planning Pillars Visual Progress Breakdown */}
            <div className="p-4 bg-white rounded-panel border border-stone-200 shadow-2xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider font-bold text-stone-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-700" />
                  <span>Town Planning Pillars Breakdown</span>
                </span>
                <span className="text-[10px] font-mono text-stone-400">
                  Performance across 4 core master-planning criteria groups
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                {pillars.map((pillar) => (
                  <div
                    key={pillar.id}
                    className="p-3 rounded-control bg-stone-50/80 border border-stone-200/80 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900 truncate max-w-[200px]">
                        {pillar.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-stone-500 font-medium">
                          Wt: {pillar.weight}%
                        </span>
                        <span
                          className={`text-xs font-mono font-extrabold px-1.5 py-0.2 rounded ${
                            pillar.avgScore >= 80
                              ? "bg-emerald-100 text-emerald-800"
                              : pillar.avgScore >= 50
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {pillar.avgScore}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pillar.avgScore}%`,
                          backgroundColor:
                            pillar.avgScore >= 80 ? "#059669" : pillar.avgScore >= 50 ? "#d97706" : "#dc2626",
                        }}
                      />
                    </div>

                    <div className="text-[10px] text-stone-500 font-mono flex items-center justify-between">
                      <span>{pillar.criteria.length} evaluation metric(s)</span>
                      <span>
                        {pillar.avgScore >= 80 ? "Optimal" : pillar.avgScore >= 50 ? "Acceptable" : "Constrained"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* At-a-Glance Key Indicators (KPI Grid) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="p-3 bg-white rounded-control border border-stone-200 shadow-2xs flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase text-stone-500 font-semibold">
                  Footprint Sizing
                </span>
                <span className="text-sm font-mono font-bold text-stone-900">
                  {placementSnapshot.lengthM}m × {placementSnapshot.widthM}m
                </span>
                <span className="text-[10px] text-stone-400">
                  {placementSnapshot.areaM2.toLocaleString()} m² surface
                </span>
              </div>

              <div className="p-3 bg-white rounded-control border border-stone-200 shadow-2xs flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase text-stone-500 font-semibold">
                  Arterial Access
                </span>
                <span className="text-sm font-mono font-bold text-stone-900">
                  {criteria.find((c) => c.id.includes("road") || c.id.includes("access"))?.value || "30 m"}
                </span>
                <span className="text-[10px] text-stone-400">Direct street access</span>
              </div>

              <div className="p-3 bg-white rounded-control border border-stone-200 shadow-2xs flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase text-stone-500 font-semibold">
                  Terrain Slope
                </span>
                <span className="text-sm font-mono font-bold text-stone-900">
                  {criteria.find((c) => c.id.includes("slope") || c.id.includes("terrain"))?.value || "1.2% slope"}
                </span>
                <span className="text-[10px] text-stone-400">Topographic grading</span>
              </div>

              <div className="p-3 bg-white rounded-control border border-stone-200 shadow-2xs flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase text-stone-500 font-semibold">
                  Spatial Verification
                </span>
                <span
                  className={`text-sm font-mono font-bold ${
                    report.validation.status === "pass"
                      ? "text-emerald-700"
                      : report.validation.status === "warn"
                      ? "text-amber-700"
                      : "text-red-700"
                  }`}
                >
                  {report.validation.status === "pass" ? "Passed" : report.validation.status === "warn" ? "Warning" : "Conflict"}
                </span>
                <span className="text-[10px] text-stone-400">
                  {report.validation.conflicts.length} conflict(s) detected
                </span>
              </div>
            </div>

            {/* Why Build Here & Primary Risks (Side-by-Side Summary Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supporting Factors */}
              <div className="p-4 rounded-panel bg-stone-50 border border-stone-200 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs font-mono uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Why Build Here ({supporting.length})</span>
                </div>
                {supporting.length === 0 ? (
                  <p className="text-xs text-stone-500 italic">No strong positive indicators recorded.</p>
                ) : (
                  <ul className="flex flex-col gap-2 text-xs text-stone-700">
                    {supporting.slice(0, 3).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span className="leading-normal">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Risks and Constraints */}
              <div className="p-4 rounded-panel bg-stone-50 border border-stone-200 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs font-mono uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Risks & Constraints ({risks.length})</span>
                </div>
                {risks.length === 0 ? (
                  <p className="text-xs text-stone-500 italic">No high-severity physical constraints detected.</p>
                ) : (
                  <ul className="flex flex-col gap-2 text-xs text-stone-700">
                    {risks.slice(0, 3).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-600 font-bold">•</span>
                        <span className="leading-normal">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Callout Card to View Deep Engineering Details */}
            <div className="p-4 rounded-panel bg-stone-100/90 border border-stone-300/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center border border-stone-200 shadow-2xs text-emerald-800 shrink-0">
                  <Table className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-stone-900">
                    Need the deep engineering numbers and evidence codes?
                  </span>
                  <span className="text-[11px] text-stone-500">
                    Inspect the full {criteria.length}-point regulatory scorecard, sensitivity profiles, and OpenStreetMap query logs.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("detail")}
                className="py-1.5 px-3 rounded-btn bg-stone-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
              >
                <span>View Detailed Audit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DETAILED GIS AUDIT (GRANULAR ENGINEERING & EVIDENCE BREAKDOWN)     */}
        {/* ========================================================================= */}
        {activeTab === "detail" && (
          <div className="flex flex-col gap-6">
            {/* Mandatory Decision Support Disclaimer */}
            <div className="p-3 bg-stone-100 rounded-panel border border-stone-200 text-stone-600 text-[11px] leading-relaxed flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
              <span>
                <strong>DECISION SUPPORT NOTICE:</strong> This analysis is an indicative geospatial screening tool. It does not constitute an official government approval, environmental clearance, or structural engineering certification. All thresholds must be verified against local municipal development control regulations.
              </span>
            </div>

            {/* Multi-Criteria Scorecard Table */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-stone-500">
                  Criteria Scorecard
                </h4>
                <span className="text-[10px] font-mono text-stone-400">
                  Weighted Piecewise Evaluation ({criteria.length} criteria)
                </span>
              </div>

              <div className="overflow-x-auto rounded-panel border border-stone-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-100/75 border-b border-stone-200 text-stone-600 font-mono text-[10px] uppercase">
                      <th className="py-2.5 px-3 font-semibold">Criterion</th>
                      <th className="py-2.5 px-3 font-semibold">Value</th>
                      <th className="py-2.5 px-3 font-semibold w-28">Score</th>
                      <th className="py-2.5 px-3 font-semibold">Weight</th>
                      <th className="py-2.5 px-3 font-semibold">Benchmark</th>
                      <th className="py-2.5 px-3 font-semibold">Evidence</th>
                      <th className="py-2.5 px-2 font-semibold w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {criteria.map((c) => {
                      const isExpanded = expandedCriterionId === c.id;
                      return (
                        <React.Fragment key={c.id}>
                          <tr
                            onClick={() => setExpandedCriterionId(isExpanded ? null : c.id)}
                            className={`hover:bg-stone-50/70 transition-colors cursor-pointer ${
                              isExpanded ? "bg-emerald-50/20" : ""
                            }`}
                          >
                            <td className="py-2.5 px-3 font-medium text-stone-900">
                              <div className="flex items-center gap-1.5">
                                <span>{c.label}</span>
                                {c.status === "unknown" && <StatusBadge status="unknown" />}
                                {c.uncertaintyClassification &&
                                  c.uncertaintyClassification !== "evidence_supported" && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 border border-stone-200 uppercase">
                                      {c.uncertaintyClassification.replace("_", " ")}
                                    </span>
                                  )}
                              </div>
                              <div className="text-[10px] text-stone-500 font-normal max-w-xs truncate">
                                {c.description}
                              </div>
                              {c.missingReason && (
                                <div className="text-[10px] text-amber-800 bg-amber-50/80 border border-amber-200/70 rounded px-1.5 py-0.5 mt-1 max-w-xs leading-tight">
                                  {c.missingReason}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium text-stone-700 whitespace-nowrap">
                              {c.value}
                            </td>
                            <td className="py-2.5 px-3">
                              <ScoreBar score={c.score} size="sm" />
                            </td>
                            <td className="py-2.5 px-3 font-mono text-stone-500 whitespace-nowrap">
                              <div>{Math.round(c.weight * 100)}%</div>
                              {c.weightedContribution !== undefined && (
                                <div className="text-[9px] text-stone-400">+{c.weightedContribution} pts</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-stone-500 max-w-xs leading-tight">
                              {c.benchmark}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {c.evidenceIds.map((eid) => (
                                <EvidenceChip
                                  key={eid}
                                  id={eid}
                                  onClick={(targetId) => {
                                    const el = document.getElementById(`evidence-${targetId}`);
                                    if (el) {
                                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                                    }
                                  }}
                                />
                              ))}
                            </td>
                            <td className="py-2.5 px-2 text-stone-400 text-center">
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 inline text-emerald-700" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 inline text-stone-400" />
                              )}
                            </td>
                          </tr>

                          {/* Expandable Explanation Details */}
                          {isExpanded && (
                            <tr className="bg-stone-50/75 border-y border-stone-200">
                              <td colSpan={7} className="p-3.5 text-xs text-stone-700">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="flex flex-col gap-1">
                                    <span className="font-mono text-[10px] uppercase font-bold text-stone-500">
                                      Calculation Method
                                    </span>
                                    <p className="text-[11px] text-stone-800 leading-relaxed">
                                      {c.calculationMethod || "Piecewise benchmark evaluation."}
                                    </p>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <span className="font-mono text-[10px] uppercase font-bold text-stone-500">
                                      Data Source & Classification
                                    </span>
                                    <div className="flex flex-col gap-0.5 text-[11px]">
                                      <span className="font-mono text-emerald-800 font-medium">
                                        {c.dataSourceName || "Geospatial Provider"}
                                      </span>
                                      <span className="text-stone-600">
                                        Confidence:{" "}
                                        <strong className="font-mono uppercase">
                                          {c.uncertaintyClassification || "evidence_supported"}
                                        </strong>
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <span className="font-mono text-[10px] uppercase font-bold text-stone-500">
                                      Metric Limitations
                                    </span>
                                    <p className="text-[11px] text-stone-600 leading-relaxed italic">
                                      {c.limitations || "Subject to local field validation and municipal planning guidelines."}
                                    </p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actionable Recommendations */}
            {report.recommendations && report.recommendations.length > 0 && (
              <div className="p-4 rounded-panel bg-emerald-50/40 border border-emerald-200 flex flex-col gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Engineering & Planning Recommendations ({report.recommendations.length})</span>
                </span>
                <ul className="list-disc list-inside space-y-1 text-stone-700 text-xs">
                  {report.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Data Gaps & OpenStreetMap Coverage */}
            {dataGaps.length > 0 && (
              <div className="p-3.5 rounded-panel bg-amber-50/50 border border-amber-200 text-amber-900 text-xs flex flex-col gap-1.5">
                <span className="font-mono text-[11px] font-semibold uppercase flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Data Gaps & OSM Coverage Warnings</span>
                </span>
                <ul className="list-disc list-inside space-y-1 text-stone-700 text-[11px]">
                  {dataGaps.map((gap, i) => (
                    <li key={i}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sensitivity Analysis (MCDA Alternative Weight Profiles) */}
            {report.sensitivity && (
              <div className="p-4 rounded-panel bg-stone-50 border border-stone-200 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-700" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-900">
                      Sensitivity Analysis (Weight Profiles)
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                      report.sensitivity.rankStability === "stable"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : report.sensitivity.rankStability === "sensitive"
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-red-50 text-red-800 border-red-200"
                    }`}
                  >
                    Stability: {report.sensitivity.rankStability.toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed">
                  {report.sensitivity.sensitivitySummary}
                </p>

                {report.sensitivity.constraintPenaltyNote && (
                  <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-800 text-[11px] leading-snug flex items-start gap-1.5 font-medium">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
                    <span>{report.sensitivity.constraintPenaltyNote}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                  {report.sensitivity.profiles.map((prof) => (
                    <div
                      key={prof.profileId}
                      className="p-3 rounded-control bg-white border border-stone-200 flex flex-col justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-stone-900 leading-tight">
                            {prof.profileName}
                          </span>
                          {prof.scoreDeltaFromBaseline !== 0 && (
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                prof.scoreDeltaFromBaseline > 0
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-stone-100 text-stone-700"
                              }`}
                            >
                              {prof.scoreDeltaFromBaseline > 0
                                ? `+${prof.scoreDeltaFromBaseline}`
                                : prof.scoreDeltaFromBaseline}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-stone-500 leading-tight line-clamp-2 mt-0.5">
                          {prof.rationale}
                        </p>
                      </div>

                      <div className="flex items-baseline justify-between border-t border-stone-100 pt-1.5">
                        <span className="text-base font-mono font-bold text-stone-900">
                          {prof.score}
                          <span className="text-[10px] text-stone-400 font-normal">/100</span>
                        </span>
                        <span className="text-[10px] font-mono font-medium text-stone-600">
                          {prof.band.replace(" Suitability", "")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence Verification Log */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-stone-500">
                  Evidence Verification Log ({evidence.length} queries)
                </h4>

                {report.dataSources && report.dataSources.length > 0 && (
                  <div className="flex items-center flex-wrap gap-1.5">
                    {report.dataSources.map((ds, idx) => (
                      <span
                        key={idx}
                        title={ds.license ? `License: ${ds.license}` : undefined}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 ${
                          ds.status === "ok"
                            ? "bg-emerald-50/70 border-emerald-200 text-emerald-800"
                            : ds.status === "empty" || ds.status === "stale"
                            ? "bg-amber-50/70 border-amber-200 text-amber-800"
                            : "bg-red-50/70 border-red-200 text-red-800"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            ds.status === "ok"
                              ? "bg-emerald-600"
                              : ds.status === "empty" || ds.status === "stale"
                              ? "bg-amber-600"
                              : "bg-red-600"
                          }`}
                        />
                        <span>{ds.provider}</span>
                        {ds.status === "stale" && (
                          <span className="uppercase font-bold text-[9px]">(STALE)</span>
                        )}
                        {ds.featureCount !== undefined && (
                          <span className="opacity-75">({ds.featureCount})</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="divide-y divide-stone-100 rounded-panel border border-stone-200 bg-white">
                {evidence.map((ev) => (
                  <div
                    key={ev.id}
                    id={`evidence-${ev.id}`}
                    className="p-3 flex items-start justify-between gap-3 text-xs scroll-mt-4 transition-colors target:bg-emerald-50/60"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-stone-900">{ev.id}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-stone-100 text-stone-600">
                          {ev.provider}
                        </span>
                        {ev.qualityStatus && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase ${
                              ev.qualityStatus === "verified"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : ev.qualityStatus === "sparse" || ev.qualityStatus === "stale"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {ev.qualityStatus}
                          </span>
                        )}
                        {ev.license && (
                          <span className="text-[9px] font-mono text-stone-400">
                            {ev.license}
                          </span>
                        )}
                      </div>
                      <p className="text-stone-600 text-[11px] mt-0.5">{ev.summary}</p>
                    </div>
                    <div className="text-[10px] font-mono text-stone-400 shrink-0 text-right">
                      {new Date(ev.retrievedAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Back to Visuals Button */}
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setActiveTab("visual")}
                className="py-1.5 px-4 rounded-btn border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
              >
                <span>↑ Back to Executive Visuals</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};
