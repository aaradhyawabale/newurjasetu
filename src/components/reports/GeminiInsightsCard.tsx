"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Shield,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
  Cpu,
  HelpCircle,
  Route,
} from "lucide-react";
import { AnalysisReportResult } from "@/server/analysis-engine/engine";
import { AiPlanningInsights, ProvenanceCategory } from "@/server/ai/types";

interface GeminiInsightsCardProps {
  report: AnalysisReportResult;
  onInsightsUpdated?: (insights: AiPlanningInsights) => void;
}

export const GeminiInsightsCard: React.FC<GeminiInsightsCardProps> = ({
  report,
  onInsightsUpdated,
}) => {
  const [insights, setInsights] = useState<AiPlanningInsights | null>(
    report.aiInsights || null
  );
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [modelName, setModelName] = useState<string>("gemini-2.5-flash");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"simple" | "technical">("simple");
  const [activeTab, setActiveTab] = useState<
    "overview" | "mitigations" | "statutory" | "costs" | "alternatives"
  >("overview");

  const analysisTargetId =
    report.analysisId || report.placementSnapshot?.id;

  // Check initial AI status if not already loaded in the report snapshot
  useEffect(() => {
    if (report.aiInsights) {
      setInsights(report.aiInsights);
      setIsConfigured(true);
      return;
    }

    if (!analysisTargetId) return;

    let isMounted = true;
    fetch(`/api/analyses/${analysisTargetId}/decision`)
      .then((res) => {
        if (!res.ok) throw new Error("Status check failed");
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (typeof data.configured === "boolean") {
          setIsConfigured(data.configured);
          if (data.model) setModelName(data.model);
          if (data.aiInsights) {
            setInsights(data.aiInsights);
            onInsightsUpdated?.(data.aiInsights);
          }
        }
      })
      .catch(() => {
        if (isMounted) setIsConfigured(false);
      });

    return () => {
      isMounted = false;
    };
  }, [analysisTargetId, report.aiInsights, onInsightsUpdated]);

  const handleGenerate = async (force = false) => {
    if (!analysisTargetId) return;
    setIsLoading(true);
    setError(null);

    try {
      const url = `/api/analyses/${analysisTargetId}/decision${
        force ? "?force=true" : ""
      }`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || data.error?.message || "Failed to generate AI planning insights"
        );
      }

      const receivedInsights = data.aiInsights || data.data?.aiInsights;
      setInsights(receivedInsights);
      onInsightsUpdated?.(receivedInsights);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while communicating with Gemini."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderProvenanceChip = (prov: ProvenanceCategory) => {
    switch (prov) {
      case "VERIFIED_INPUT":
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            VERIFIED INPUT
          </span>
        );
      case "DETERMINISTIC_RESULT":
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-300">
            DETERMINISTIC RESULT
          </span>
        );
      case "AI_INTERPRETATION":
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-300">
            AI INTERPRETATION
          </span>
        );
      case "UNVERIFIED_ASSUMPTION":
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
            UNVERIFIED ASSUMPTION
          </span>
        );
      default:
        return null;
    }
  };

  // State: Not configured in .env
  if (isConfigured === false && !insights) {
    return (
      <div className="p-4 rounded-panel bg-stone-50 border border-stone-200 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-stone-700 font-semibold text-xs font-mono uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>Gemini AI Planning Advisor</span>
        </div>
        <p className="text-xs text-stone-600 leading-relaxed">
          Google Gemini API key is not configured on this server. Add{" "}
          <code className="px-1 py-0.5 rounded bg-stone-200 font-mono text-[11px] text-stone-800">
            GEMINI_API_KEY
          </code>{" "}
          to your local <code className="px-1 py-0.5 rounded bg-stone-200 font-mono text-[11px] text-stone-800">.env</code> file to enable evidence-grounded AI decision support and statutory mitigation checklists.
        </p>
      </div>
    );
  }

  // State: Idle (Key configured, ready to generate)
  if (!insights && !isLoading) {
    return (
      <div className="p-4 rounded-panel bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-stone-50 border border-purple-200 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-stone-900">
                Gemini Urban Planning Advisor
              </span>
              <span className="text-[10px] font-mono text-purple-700">
                Model: {modelName} • Grounded Decision Synthesis
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleGenerate(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate AI Insights</span>
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => handleGenerate(true)}
                className="text-left font-bold text-red-900 hover:underline text-[11px]"
              >
                Retry Request
              </button>
            </div>
          </div>
        )}

        <p className="text-[11px] text-stone-600 leading-normal">
          Generates structured strategic trade-offs, engineering mitigations, required municipal NOCs, and qualitative civil/electrical CAPEX drivers based strictly on UrjaSetu&apos;s verified open spatial data.
        </p>
      </div>
    );
  }

  // State: Loading
  if (isLoading) {
    return (
      <div className="p-5 rounded-panel bg-purple-50/50 border border-purple-200 flex flex-col items-center justify-center gap-3 text-center">
        <div className="relative">
          <div className="w-9 h-9 rounded-full border-2 border-purple-300 border-t-purple-700 animate-spin" />
          <Sparkles className="w-4 h-4 text-purple-700 absolute top-2.5 left-2.5" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-stone-900">
            Synthesizing Spatial Evidence with Gemini...
          </span>
          <span className="text-[10px] font-mono text-stone-500">
            Evaluating {report.criteria.length} criteria, terrain slope, buffer exclusions, and sensitivity profiles
          </span>
        </div>
      </div>
    );
  }

  if (!insights) return null;

  // Assessment styling
  const assessmentColors: Record<
    string,
    { bg: string; border: string; text: string; badge: string }
  > = {
    FAVORABLE: {
      bg: "bg-emerald-50/60",
      border: "border-emerald-300",
      text: "text-emerald-950",
      badge: "bg-emerald-600 text-white",
    },
    CONDITIONAL: {
      bg: "bg-amber-50/60",
      border: "border-amber-300",
      text: "text-amber-950",
      badge: "bg-amber-600 text-white",
    },
    REQUIRES_FURTHER_REVIEW: {
      bg: "bg-blue-50/60",
      border: "border-blue-300",
      text: "text-blue-950",
      badge: "bg-blue-600 text-white",
    },
    UNFAVORABLE: {
      bg: "bg-red-50/60",
      border: "border-red-300",
      text: "text-red-950",
      badge: "bg-red-600 text-white",
    },
  };

  const style =
    assessmentColors[insights.preliminaryAssessment] ||
    assessmentColors.CONDITIONAL;

  return (
    <div className="p-4 rounded-panel bg-white border border-stone-200 flex flex-col gap-4 shadow-2xs">
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-700 flex items-center justify-center text-white shadow-xs shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-900">
                Gemini Urban Planning Copilot
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-50 text-purple-700 border border-purple-200">
                {insights.meta.modelUsed}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 font-mono">
              Confidence: {insights.confidenceIndicator.level} ({insights.confidenceIndicator.completenessPercent}% completeness)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold tracking-wide uppercase shadow-2xs ${style.badge}`}
          >
            {insights.preliminaryAssessment.replace(/_/g, " ")}
          </span>
          <button
            type="button"
            title="Regenerate Gemini assessment"
            onClick={() => handleGenerate(true)}
            disabled={isLoading}
            className="p-1.5 rounded hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Mode Switcher: Simple (Citizens) vs Technical (Planners & Engineers) */}
      <div className="flex items-center justify-between bg-stone-100 p-1 rounded-panel border border-stone-200">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("simple")}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
              mode === "simple"
                ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Simple Mode (Citizens)
          </button>
          <button
            type="button"
            onClick={() => setMode("technical")}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
              mode === "technical"
                ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Technical Mode (Planners & Engineers)
          </button>
        </div>
        <span className="text-[10px] font-mono text-stone-500 pr-2 hidden sm:inline">
          {mode === "simple" ? "Plain language & direct next steps" : "Full metrics, NOCs & provenance"}
        </span>
      </div>

      {mode === "simple" ? (
        <div className="flex flex-col gap-3">
          {/* Plain Language Summary */}
          <div className="p-3.5 bg-stone-50 rounded-control border border-stone-200 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>What this means for this site</span>
            </span>
            <p className="text-xs text-stone-700 leading-relaxed">
              {insights.executiveSummary}
            </p>
          </div>

          {/* Road Access & Connectivity Summary */}
          {report.validation?.roadAccess && (
            <div className="p-3 bg-amber-50/70 rounded-control border border-amber-200 flex flex-col gap-1">
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                <Route className="w-3.5 h-3.5 text-amber-700" />
                <span>Road Accessibility</span>
              </span>
              <p className="text-xs text-stone-700">
                {report.validation.roadAccess.requiresNewAccessRoad
                  ? `The proposed site does not have direct public road frontage. A new preliminary access road of approximately ${report.validation.roadAccess.distanceM} meters will be required to connect with ${report.validation.roadAccess.nearestRoadName}.`
                  : `Good road connectivity: the site is directly adjacent to ${report.validation.roadAccess.nearestRoadName}.`}
              </p>
              {report.validation.roadAccess.crossesObstacle && (
                <p className="text-[11px] text-red-700 font-medium">
                  Note: The proposed access path encounters an obstacle ({report.validation.roadAccess.obstacleDetails || "building/waterway"}).
                </p>
              )}
            </div>
          )}

          {/* Top Key Takeaways: Pros & Cons in plain language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 rounded-control bg-emerald-50/50 border border-emerald-200 flex flex-col gap-1.5">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Key Positive Factors</span>
              </span>
              <ul className="text-[11px] text-stone-700 list-disc list-inside space-y-1">
                {insights.advantages.slice(0, 3).map((a, i) => (
                  <li key={i}>
                    <strong>{a.title}:</strong> {a.description}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-control bg-red-50/50 border border-red-200 flex flex-col gap-1.5">
              <span className="text-xs font-bold text-red-900 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>Key Constraints & Risks</span>
              </span>
              <ul className="text-[11px] text-stone-700 list-disc list-inside space-y-1">
                {insights.constraints.slice(0, 3).map((c, i) => (
                  <li key={i}>
                    <strong>{c.title}:</strong> {c.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Actionable Next Step */}
          <div className="p-3 bg-purple-50/60 rounded-control border border-purple-200 flex flex-col gap-1">
            <span className="text-xs font-bold text-purple-950">Recommended Immediate Action</span>
            <p className="text-xs text-stone-800">
              {insights.recommendedMitigations[0]?.mitigation ||
                "Verify parcel boundaries with the local Town Planning Department before proceeding with layout design."}
            </p>
            {report.validation?.planningContext && (
              <span className="text-[10px] text-stone-500 font-mono mt-0.5">
                Authority: {report.validation.planningContext.jurisdiction} • {report.validation.planningContext.masterPlan}
              </span>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Executive Briefing Banner */}
          <div
            className={`p-3.5 rounded-control border ${style.bg} ${style.border} flex flex-col gap-1.5`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
              <Shield className="w-3.5 h-3.5 text-purple-700" />
              <span>Executive Synthesis & Planning Verdict</span>
            </div>
            <p className="text-xs text-stone-800 leading-relaxed">
              {insights.executiveSummary}
            </p>
            <p className="text-[11px] text-stone-600 leading-snug border-t border-stone-200/50 pt-1.5 mt-0.5">
              <strong>Assessment Rationale:</strong> {insights.assessmentRationale}
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-stone-200 text-xs overflow-x-auto pb-0.5">
            {[
              {
                id: "overview",
                label: `Pros & Cons (${insights.advantages.length}/${insights.constraints.length})`,
              },
              {
                id: "mitigations",
                label: `Mitigations (${insights.recommendedMitigations.length})`,
              },
              {
                id: "statutory",
                label: `NOC Checklist (${insights.statutoryChecklist.length})`,
              },
              { id: "costs", label: "Cost Drivers" },
              {
                id: "alternatives",
                label: `Alternatives & Gaps (${insights.planningAlternatives.length})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-2.5 py-1.5 rounded-t text-[11px] font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-stone-100 text-stone-900 border-b-2 border-purple-700 font-bold"
                    : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

      {/* Tab: Overview (Advantages & Constraints) */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Advantages */}
          <div className="p-3 rounded-control bg-stone-50/80 border border-stone-200 flex flex-col gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Evidence-Backed Advantages</span>
            </span>
            <div className="flex flex-col gap-2">
              {insights.advantages.map((adv, idx) => (
                <div key={idx} className="p-2 bg-white rounded border border-stone-200/80 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="text-xs font-bold text-stone-900">{adv.title}</span>
                    {renderProvenanceChip(adv.provenance)}
                  </div>
                  <p className="text-[11px] text-stone-600 leading-normal">{adv.description}</p>
                  <span className="text-[9px] font-mono text-stone-400">Ref: {adv.sourceReference}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Constraints */}
          <div className="p-3 rounded-control bg-stone-50/80 border border-stone-200 flex flex-col gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-amber-800 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Constraints & Risk Exposures</span>
            </span>
            <div className="flex flex-col gap-2">
              {insights.constraints.map((c, idx) => (
                <div key={idx} className="p-2 bg-white rounded border border-stone-200/80 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-stone-900">{c.title}</span>
                      <span
                        className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold ${
                          c.severity === "CRITICAL"
                            ? "bg-red-100 text-red-800"
                            : c.severity === "HIGH"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-stone-100 text-stone-700"
                        }`}
                      >
                        {c.severity}
                      </span>
                    </div>
                    {renderProvenanceChip(c.provenance)}
                  </div>
                  <p className="text-[11px] text-stone-600 leading-normal">{c.description}</p>
                  <span className="text-[9px] font-mono text-stone-400">Ref: {c.sourceReference}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Mitigations */}
      {activeTab === "mitigations" && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-stone-500">
            Actionable Engineering & Operational Mitigations
          </span>
          <div className="divide-y divide-stone-100 rounded-control border border-stone-200 bg-white">
            {insights.recommendedMitigations.map((m, idx) => (
              <div key={idx} className="p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-stone-900">
                    Issue: {m.issue}
                  </span>
                  {renderProvenanceChip(m.provenance)}
                </div>
                <p className="text-xs text-purple-950 font-medium bg-purple-50/60 p-2 rounded border border-purple-200/60 leading-normal">
                  <strong>Recommended Mitigation:</strong> {m.mitigation}
                </p>
                <div className="flex items-center justify-between text-[10px] text-stone-500 pt-0.5">
                  <span>Evidence: {m.supportingEvidence}</span>
                  <span className="font-mono text-stone-400">Ref: {m.sourceReference}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Statutory Checklist */}
      {activeTab === "statutory" && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-stone-500">
            Preliminary Statutory Verification & NOC Matrix
          </span>
          <div className="overflow-x-auto rounded-control border border-stone-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-100/75 border-b border-stone-200 text-stone-600 font-mono text-[10px] uppercase">
                  <th className="py-2 px-3 font-semibold">Authority</th>
                  <th className="py-2 px-3 font-semibold">Clearance / NOC</th>
                  <th className="py-2 px-3 font-semibold">Trigger Condition</th>
                  <th className="py-2 px-3 font-semibold w-24">Statutory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {insights.statutoryChecklist.map((item, idx) => (
                  <tr key={idx} className="hover:bg-stone-50/70">
                    <td className="py-2.5 px-3 font-medium text-stone-900 whitespace-nowrap">
                      {item.authority}
                    </td>
                    <td className="py-2.5 px-3 text-stone-800 font-semibold">
                      {item.clearanceName}
                    </td>
                    <td className="py-2.5 px-3 text-stone-600 text-[11px]">
                      {item.triggerCondition}
                    </td>
                    <td className="py-2.5 px-3">
                      {item.isMandatory ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-red-100 text-red-800">
                          MANDATORY
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono text-stone-600 bg-stone-100">
                          RECOMMENDED
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Cost Drivers */}
      {activeTab === "costs" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            { label: "Civil Engineering & Grading", desc: insights.costDrivers.civil, color: "border-stone-300" },
            { label: "Electrical & Grid Tie-In", desc: insights.costDrivers.electrical, color: "border-amber-300" },
            { label: "Environmental & Drainage", desc: insights.costDrivers.environmental, color: "border-emerald-300" },
            { label: "Operational & Logistical", desc: insights.costDrivers.operational, color: "border-blue-300" },
          ].map((cd, idx) => (
            <div key={idx} className={`p-3 bg-stone-50 rounded-control border ${cd.color} flex flex-col gap-1`}>
              <span className="text-xs font-bold text-stone-900">{cd.label}</span>
              <p className="text-[11px] text-stone-600 leading-normal">{cd.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Alternatives & Data Gaps */}
      {activeTab === "alternatives" && (
        <div className="flex flex-col gap-3">
          {/* Alternatives */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-stone-500">
              Alternative Planning Configurations
            </span>
            <div className="flex flex-col gap-2">
              {insights.planningAlternatives.map((alt, idx) => (
                <div key={idx} className="p-3 bg-stone-50 rounded-control border border-stone-200 flex flex-col gap-1">
                  <span className="text-xs font-bold text-stone-900">{alt.title}</span>
                  <p className="text-[11px] text-stone-700">{alt.description}</p>
                  <p className="text-[10px] text-purple-900 bg-purple-50 p-1.5 rounded border border-purple-100 mt-1">
                    <strong>Trade-offs:</strong> {alt.tradeOffs}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Unresolved Data Gaps */}
          {insights.unresolvedDataGaps.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-stone-500">
                Unresolved Data Gaps Requiring Field Verification
              </span>
              <div className="divide-y divide-stone-100 rounded-control border border-stone-200 bg-white">
                {insights.unresolvedDataGaps.map((gap, idx) => (
                  <div key={idx} className="p-2.5 flex flex-col gap-1 text-xs">
                    <span className="font-bold text-stone-900">{gap.fieldOrTopic}</span>
                    <p className="text-stone-600 text-[11px]">{gap.explanation}</p>
                    <span className="text-amber-800 text-[10px] font-medium bg-amber-50 p-1 rounded w-fit">
                      Required Action: {gap.requiredVerification}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* Provenance Footnote & Disclaimer */}
      <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400 font-mono flex-wrap gap-2">
        <span className="flex items-center gap-1">
          <Info className="w-3 h-3 text-stone-400" />
          <span>Grounded in UrjaSetu deterministic calculations. Indicative decision support only.</span>
        </span>
        <span>Generated: {new Date(insights.meta.generatedAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};
