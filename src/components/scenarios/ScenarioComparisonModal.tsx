"use client";

import React, { useState, useEffect } from "react";
import {
  GitCompare,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  Info,
  Layers,
  MapPin,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  X,
  Compass,
  ArrowRight,
  Sun,
  Ruler,
  Scale,
  Users,
  Zap,
} from "lucide-react";
import { ScenarioComparisonResult, CandidateSummary } from "@/server/scenarios/types";
import { StatusBadge } from "../ui/StatusBadge";

interface ScenarioComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarioId?: string;
  scenarioName?: string;
  selectedPlacementIds?: string[];
  onSelectCandidateLocation?: (lat: number, lng: number) => void;
}

export const ScenarioComparisonModal: React.FC<ScenarioComparisonModalProps> = ({
  isOpen,
  onClose,
  scenarioId,
  scenarioName,
  selectedPlacementIds,
  onSelectCandidateLocation,
}) => {
  const [comparison, setComparison] = useState<ScenarioComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "rankings" | "tradeoffs" | "baseline" | "equity" | "criteria" | "uncertainty"
  >("rankings");


  const loadComparison = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      let res: Response;
      if (selectedPlacementIds && selectedPlacementIds.length > 0) {
        res = await fetch("/api/scenarios/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placementIds: selectedPlacementIds }),
        });
      } else if (scenarioId) {
        res = await fetch(`/api/scenarios/${scenarioId}/compare`);
      } else {
        throw new Error("No scenario or placement candidates provided for comparison.");
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || "Failed to compare scenario candidates");
      }

      setComparison(data.comparison || data.data?.comparison);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load comparative scenario analysis");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadComparison();
    }
  }, [isOpen, scenarioId, selectedPlacementIds]);

  const handleDownloadPdf = async () => {
    if (!comparison || comparison.candidates.length === 0) return;
    setIsExportingPdf(true);
    try {
      let res: Response;
      if (selectedPlacementIds && selectedPlacementIds.length > 0) {
        res = await fetch("/api/scenarios/compare/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placementIds: selectedPlacementIds }),
        });
      } else if (scenarioId) {
        res = await fetch(`/api/scenarios/${scenarioId}/compare/pdf`);
      } else {
        return;
      }

      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `UrjaSetu-Scenario-Comparison-${scenarioName || "Export"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to export PDF: " + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-panel border border-stone-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-stone-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-emerald-800 text-white flex items-center justify-center shadow-xs">
              <GitCompare className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900 tracking-tight">
                  Scenario Simulator & Multi-Candidate Comparison
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                  Decision Support
                </span>
              </div>
              <p className="text-xs text-stone-500 font-mono mt-0.5">
                {scenarioName ? `Scenario: ${scenarioName}` : "Multi-Candidate Evaluation"}{" "}
                {comparison && `• ${comparison.candidates.length} candidate sites`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf || !comparison || comparison.candidates.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-btn border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 shadow-2xs transition-colors disabled:opacity-50"
              title="Download Comparison PDF Report"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
              ) : (
                <Download className="w-3.5 h-3.5 text-stone-500" />
              )}
              <span>Export PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-btn text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-700 mb-3" />
            <p className="text-sm font-semibold text-stone-800">
              Evaluating candidate locations and differential trade-offs...
            </p>
            <p className="text-xs text-stone-500 font-mono mt-1">
              Extracting criteria matrix, spatial proximity proxies, and mandatory constraints
            </p>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-10 h-10 text-amber-600 mb-3" />
            <h3 className="text-sm font-bold text-stone-900 mb-1">Comparative Analysis Unavailable</h3>
            <p className="text-xs text-stone-600 max-w-md">{errorMsg}</p>
            <button
              type="button"
              onClick={loadComparison}
              className="mt-4 px-4 py-1.5 rounded-btn bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
            >
              Retry Comparison
            </button>
          </div>
        ) : !comparison || comparison.candidates.length === 0 ? (
          <div className="flex-1 p-12 flex flex-col items-center justify-center text-center">
            <Layers className="w-10 h-10 text-stone-400 mb-3" />
            <h3 className="text-sm font-bold text-stone-900 mb-1">Insufficient Candidate Evidence</h3>
            <p className="text-xs text-stone-500 max-w-md">
              This scenario does not have analyzed placement candidates yet. Place infrastructure pins on the map and run the analysis engine to compare alternatives.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Comparability Advisory Notice */}
            {!comparison.comparability.isCompatible && (
              <div className="px-6 py-2.5 bg-amber-50/80 border-b border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <span className="font-bold">Cross-Domain Comparison Advisory: </span>
                  {comparison.comparability.advisoryNotice}
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="px-6 border-b border-stone-200 flex gap-4 bg-white shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("rankings")}
                className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  activeTab === "rankings"
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>Rankings ({comparison.candidates.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tradeoffs")}
                className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  activeTab === "tradeoffs"
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <Scale className="w-4 h-4" />
                <span>Decision Trade-Offs</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("baseline")}
                className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  activeTab === "baseline"
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Baseline Comparison</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("equity")}
                className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  activeTab === "equity"
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Equity & Catchment</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("criteria")}
                className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  activeTab === "criteria"
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <GitCompare className="w-4 h-4" />
                <span>Criteria Matrix ({comparison.criteriaMatrix.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("uncertainty")}
                className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  activeTab === "uncertainty"
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Data Quality & Uncertainty</span>
              </button>
            </div>


            {/* Tab Panes */}
            <div className="flex-1 overflow-y-auto p-6 bg-stone-50/50">
              {/* TAB 1: RANKINGS & EXECUTIVE OVERVIEW */}
              {activeTab === "rankings" && (
                <div className="flex flex-col gap-5">
                  {/* Executive Verdict Banner */}
                  <div className="p-4 rounded-panel bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-950">
                        Executive Recommendation
                      </h4>
                      <p className="text-xs text-stone-800 mt-1 leading-relaxed">
                        {comparison.executiveSummary}
                      </p>
                    </div>
                  </div>

                  {/* Candidate Ranking Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {comparison.ranking.map((rank) => {
                      const cand = comparison.candidates.find((c) => c.placementId === rank.placementId);
                      const isWinner = rank.rank === 1 && !rank.hasMandatoryViolation;

                      return (
                        <div
                          key={rank.placementId}
                          className={`rounded-panel border p-4 bg-white shadow-2xs flex flex-col justify-between transition-all ${
                            isWinner
                              ? "border-emerald-700/60 ring-2 ring-emerald-600/20"
                              : rank.hasMandatoryViolation
                              ? "border-red-300 bg-red-50/20"
                              : "border-stone-200"
                          }`}
                        >
                          <div>
                            {/* Card Header */}
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                                  isWinner
                                    ? "bg-emerald-700 text-white"
                                    : "bg-stone-100 text-stone-600 border border-stone-200"
                                }`}
                              >
                                Rank #{rank.rank}
                              </span>
                              <span className="text-[10px] font-mono text-stone-400 truncate">
                                {rank.type}
                              </span>
                            </div>

                            <h3 className="text-sm font-bold text-stone-900 truncate mb-1">
                              {rank.label}
                            </h3>

                            {/* Score & Band */}
                            <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-stone-100">
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-mono font-extrabold text-stone-900">
                                  {rank.overallScore}
                                </span>
                                <span className="text-xs text-stone-400 font-mono">/100</span>
                              </div>
                              <StatusBadge
                                status={
                                  rank.overallScore >= 75
                                    ? "optimal"
                                    : rank.overallScore >= 50
                                    ? "acceptable"
                                    : "constrained"
                                }
                                label={rank.scoreBand.replace(" Suitability", "")}
                              />
                            </div>

                            {/* Mandatory Constraints Status */}
                            <div className="mt-3 py-1.5 px-2.5 rounded-control text-xs flex items-center justify-between font-mono bg-stone-50 border border-stone-200">
                              <span className="text-[11px] text-stone-600">Mandatory Rules:</span>
                              {rank.hasMandatoryViolation ? (
                                <span className="text-red-700 font-bold flex items-center gap-1 text-[11px]">
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>{rank.mandatoryViolationsCount} Violations</span>
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Passed (0 conflicts)</span>
                                </span>
                              )}
                            </div>

                            {/* Rationale */}
                            <p className="text-xs text-stone-600 mt-2.5 leading-snug">
                              {rank.rankingRationale}
                            </p>

                            {/* Top Advantages */}
                            {rank.topAdvantages.length > 0 && (
                              <div className="mt-3">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400 font-bold mb-1">
                                  Key Strengths ({rank.winningCriteriaCount} criteria won)
                                </div>
                                <ul className="text-xs text-stone-700 space-y-1">
                                  {rank.topAdvantages.map((adv, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                                      <span className="text-emerald-700 font-bold">✓</span>
                                      <span className="line-clamp-1">{adv}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Top Disadvantages */}
                            {rank.topDisadvantages.length > 0 && (
                              <div className="mt-2.5">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400 font-bold mb-1">
                                  Constraints & Penalties
                                </div>
                                <ul className="text-xs text-red-700 space-y-1">
                                  {rank.topDisadvantages.map((dis, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                                      <span className="font-bold">✗</span>
                                      <span className="line-clamp-1">{dis}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Footer Action */}
                          {cand && onSelectCandidateLocation && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectCandidateLocation(cand.lat, cand.lng);
                                onClose();
                              }}
                              className="mt-4 w-full py-1.5 px-3 rounded-btn border border-stone-200 hover:border-emerald-700/50 bg-stone-50 hover:bg-emerald-50/50 text-xs font-semibold text-stone-700 hover:text-emerald-800 flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span>Focus Candidate on Map</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: CRITERIA DIFFERENTIAL MATRIX */}
              {activeTab === "criteria" && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between text-xs text-stone-600 bg-white p-3 rounded-control border border-stone-200">
                    <span className="flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>
                        Criteria differential matrix compares measured metrics and normalized scores (0–100) side-by-side across all candidates.
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-stone-400">
                      Delta = Leader Score − Trailing Score
                    </span>
                  </div>

                  <div className="bg-white rounded-panel border border-stone-200 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-mono text-[11px] uppercase">
                            <th className="py-2.5 px-4 font-semibold">Evaluation Criterion</th>
                            <th className="py-2.5 px-3 font-semibold text-center">Weight</th>
                            {comparison.candidates.map((cand) => (
                              <th key={cand.placementId} className="py-2.5 px-3 font-semibold max-w-[160px] truncate">
                                {cand.label}
                              </th>
                            ))}
                            <th className="py-2.5 px-3 font-semibold text-center">Score Delta</th>
                            <th className="py-2.5 px-3 font-semibold">Advantage Rationale</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 font-sans">
                          {comparison.criteriaMatrix.map((crit) => (
                            <tr key={crit.criterionId} className="hover:bg-stone-50/60 transition-colors">
                              {/* Criterion Label & Benchmark */}
                              <td className="py-3 px-4">
                                <div className="font-bold text-stone-900">{crit.label}</div>
                                <div className="text-[10px] text-stone-500 font-mono mt-0.5 line-clamp-1">
                                  Benchmark: {crit.benchmark}
                                </div>
                              </td>

                              {/* Weight */}
                              <td className="py-3 px-3 text-center font-mono text-stone-600">
                                {crit.weight}%
                              </td>

                              {/* Candidate Values */}
                              {comparison.candidates.map((cand) => {
                                const val = crit.valuesByPlacement[cand.placementId];
                                const isWinner = cand.placementId === crit.bestPlacementId && crit.deltaScore > 0;

                                return (
                                  <td
                                    key={cand.placementId}
                                    className={`py-3 px-3 ${
                                      isWinner ? "bg-emerald-50/50" : ""
                                    }`}
                                  >
                                    {val ? (
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-mono font-bold text-stone-900">
                                            {val.score !== null ? `${val.score}/100` : "--"}
                                          </span>
                                          {isWinner && (
                                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                                              LEAD
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-stone-600 font-mono mt-0.5">
                                          {val.valueText}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-stone-400 font-mono text-[11px]">N/A</span>
                                    )}
                                  </td>
                                );
                              })}

                              {/* Delta Score */}
                              <td className="py-3 px-3 text-center">
                                {crit.deltaScore > 0 ? (
                                  <span
                                    className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                                      crit.deltaScore >= 20
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-stone-100 text-stone-700"
                                    }`}
                                  >
                                    +{crit.deltaScore} pts
                                  </span>
                                ) : (
                                  <span className="text-stone-400 font-mono text-[11px]">Tie</span>
                                )}
                              </td>

                              {/* Explanation */}
                              <td className="py-3 px-3 text-stone-600 text-xs max-w-xs">
                                {crit.explanation}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: DECISION TRADE-OFFS (PART E) */}
              {activeTab === "tradeoffs" && (
                <div className="flex flex-col gap-5">
                  <div className="p-4 rounded-panel bg-white border border-stone-200 shadow-2xs">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-stone-900 mb-1 flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-emerald-700" />
                      <span>Decision Trade-Offs & Siting Differentiators</span>
                    </h4>
                    <p className="text-xs text-stone-600">
                      Transparent accounting of key advantages, disadvantages, differentiating drivers, and epistemic uncertainties across candidate sites.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(comparison.tradeoffs || []).map((item) => {
                      const cand = comparison.candidates.find((c) => c.placementId === item.placementId);
                      const isWinner = item.rank === 1;

                      return (
                        <div
                          key={item.placementId}
                          className={`p-4 rounded-panel bg-white border shadow-2xs flex flex-col justify-between gap-3 ${
                            isWinner
                              ? "border-emerald-600/70 ring-1 ring-emerald-500/20"
                              : "border-stone-200"
                          }`}
                        >
                          <div>
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                                    isWinner ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-700"
                                  }`}
                                >
                                  Rank #{item.rank}
                                </span>
                                <h4 className="text-xs font-bold text-stone-900 truncate max-w-[200px]">
                                  {item.label}
                                </h4>
                              </div>
                              <span className="text-[11px] font-mono text-stone-500 font-bold">
                                {cand?.overallScore}/100
                              </span>
                            </div>

                            {/* Critical Tradeoff Summary */}
                            <div
                              className={`mt-3 p-2.5 rounded text-xs leading-relaxed font-sans ${
                                isWinner
                                  ? "bg-emerald-50/70 text-emerald-950 border border-emerald-200"
                                  : "bg-stone-50 text-stone-800 border border-stone-200"
                              }`}
                            >
                              <span className="font-bold block text-[10px] font-mono uppercase text-stone-500 mb-0.5">
                                Trade-off Rationale
                              </span>
                              {item.criticalTradeoffSummary}
                            </div>

                            {/* Primary Advantage & Disadvantage */}
                            <div className="grid grid-cols-1 gap-2 mt-3 text-xs">
                              <div className="p-2 rounded bg-emerald-50/40 border border-emerald-100 flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-[10px] uppercase font-mono text-emerald-800 block">
                                    Primary Advantage
                                  </span>
                                  <span className="text-stone-800">{item.primaryAdvantage}</span>
                                </div>
                              </div>

                              <div className="p-2 rounded bg-amber-50/40 border border-amber-100 flex items-start gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-[10px] uppercase font-mono text-amber-800 block">
                                    Primary Disadvantage / Constraint
                                  </span>
                                  <span className="text-stone-800">{item.primaryDisadvantage}</span>
                                </div>
                              </div>
                            </div>

                            {/* Differentiating Factors */}
                            <div className="mt-3">
                              <span className="text-[10px] font-mono uppercase font-bold text-stone-400 block mb-1">
                                Differentiating Siting Metrics
                              </span>
                              <ul className="space-y-1 text-xs text-stone-700">
                                {item.differentiatingFactors.map((diff, idx) => (
                                  <li key={idx} className="flex items-center gap-1.5 font-mono text-[11px]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 shrink-0" />
                                    <span>{diff}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Epistemic Limitations */}
                          <div className="mt-2 pt-2 border-t border-stone-100">
                            <span className="text-[10px] font-mono uppercase font-bold text-stone-400 block mb-1">
                              Methodological Boundaries & Unknowns
                            </span>
                            <div className="space-y-0.5 text-[10px] text-stone-500 font-mono">
                              {item.epistemicLimitations.map((lim, idx) => (
                                <div key={idx}>• {lim}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB: BASELINE COMPARISON (PART C) */}
              {activeTab === "baseline" && (
                <div className="flex flex-col gap-5">
                  <div className="p-4 rounded-panel bg-white border border-stone-200 shadow-2xs">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-stone-900 mb-1 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-700" />
                      <span>Multi-Baseline Comparative Simulation</span>
                    </h4>
                    <p className="text-xs text-stone-600">
                      Evaluates candidates against explicit baselines: Status Quo (undeveloped baseline state) and Naive Proximity Baseline (unoptimized road-adjacent placement).
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs">
                      <div className="p-2.5 rounded bg-stone-50 border border-stone-200">
                        <span className="text-[10px] font-mono uppercase text-stone-500 font-bold block">
                          Baseline 1: Status Quo State
                        </span>
                        <div className="font-semibold text-stone-800 mt-0.5">
                          {comparison.baselineEvaluation?.statusQuo.description}
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                          0 m² new footprint • 0 kW added load/generation • Natural terrain undisturbed
                        </div>
                      </div>

                      <div className="p-2.5 rounded bg-stone-50 border border-stone-200">
                        <span className="text-[10px] font-mono uppercase text-stone-500 font-bold block">
                          Baseline 2: Naive Siting Standard
                        </span>
                        <div className="font-semibold text-stone-800 mt-0.5">
                          {comparison.baselineEvaluation?.naiveProximityBaseline.description}
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                          150m standard arterial setback • 50-point neutral multicriteria baseline
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Candidate Metrics Table vs Baselines */}
                  <div className="space-y-4">
                    {comparison.candidates.map((cand) => {
                      const metrics = comparison.baselineEvaluation?.metricsByCandidate[cand.placementId] || [];

                      return (
                        <div
                          key={cand.placementId}
                          className="rounded-panel border border-stone-200 bg-white overflow-hidden shadow-2xs"
                        >
                          <div className="px-4 py-2.5 bg-stone-50/80 border-b border-stone-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-stone-900">{cand.label}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-200/70 text-stone-700">
                                {cand.type}
                              </span>
                            </div>
                            <span className="text-xs font-mono font-bold text-emerald-800">
                              Suitability: {cand.overallScore}/100 ({cand.scoreBand})
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-stone-200 bg-stone-100/50 text-[10px] font-mono text-stone-500 uppercase">
                                  <th className="py-2 px-3 font-semibold">Evaluation Metric</th>
                                  <th className="py-2 px-3 font-semibold">Reference Baseline</th>
                                  <th className="py-2 px-3 font-semibold">Baseline Value</th>
                                  <th className="py-2 px-3 font-semibold">Candidate Value</th>
                                  <th className="py-2 px-3 font-semibold text-center">Absolute Delta (Δ)</th>
                                  <th className="py-2 px-3 font-semibold text-center">% Change</th>
                                  <th className="py-2 px-3 font-semibold">Interpretation & Method Notice</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100 font-sans">
                                {metrics.map((m) => (
                                  <tr key={m.metricId} className="hover:bg-stone-50/60">
                                    <td className="py-2.5 px-3 font-bold text-stone-900">{m.label}</td>
                                    <td className="py-2.5 px-3 font-mono text-stone-600">
                                      {m.baselineType === "status_quo" ? "Status Quo" : "Naive Proximity"}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-stone-600">{m.baselineValueText}</td>
                                    <td className="py-2.5 px-3 font-mono font-bold text-stone-900">
                                      {m.candidateValueText}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono font-bold text-center">
                                      {m.absoluteDelta !== null ? (
                                        <span
                                          className={
                                            m.absoluteDelta > 0
                                              ? "text-emerald-800"
                                              : m.absoluteDelta < 0
                                              ? "text-amber-700"
                                              : "text-stone-500"
                                          }
                                        >
                                          {m.absoluteDelta > 0 ? `+${m.absoluteDelta}` : m.absoluteDelta}{" "}
                                          {m.unit || ""}
                                        </span>
                                      ) : (
                                        "--"
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-center">
                                      {m.percentageChange !== null ? (
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                            m.percentageChange > 0
                                              ? "bg-emerald-100 text-emerald-800"
                                              : m.percentageChange < 0
                                              ? "bg-amber-100 text-amber-800"
                                              : "bg-stone-100 text-stone-600"
                                          }`}
                                        >
                                          {m.percentageChange > 0
                                            ? `+${m.percentageChange}%`
                                            : `${m.percentageChange}%`}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-stone-400 font-mono">
                                          Net Addition
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-stone-600 text-[11px] max-w-xs">
                                      <div>{m.interpretation}</div>
                                      <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                                        {m.limitations}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Baseline Limitations Notice */}
                  <div className="p-3 rounded-control bg-stone-100 text-stone-600 text-[11px] font-mono space-y-1">
                    <span className="font-bold text-stone-800 uppercase block">
                      Comparative Baseline Disclosure:
                    </span>
                    {(comparison.baselineEvaluation?.limitations || []).map((lim, idx) => (
                      <div key={idx}>• {lim}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: EQUITY & ACCESSIBILITY (PART D) */}
              {activeTab === "equity" && (
                <div className="flex flex-col gap-5">
                  {/* Strict Geographic Disclaimer */}
                  <div className="p-3.5 rounded-panel bg-amber-50/80 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <span className="font-bold block uppercase text-[10px] font-mono text-amber-800">
                        Equity & Accessibility Geographic Disclosures
                      </span>
                      Service catchments are geometric approximations calculated using a standard 500m Euclidean radial buffer (0.79 km²). They do NOT calculate census population figures, demographic distributions, or transit network routing. Inferences regarding underserved communities are based strictly on observed absence of mapped OpenStreetMap civic and transit nodes.
                    </div>
                  </div>

                  {/* Candidate Equity Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {comparison.candidates.map((cand) => {
                      const eq = comparison.equityAccessibilityMatrix?.[cand.placementId] || cand.impacts.equityAccessibility;

                      return (
                        <div
                          key={cand.placementId}
                          className="p-4 rounded-panel bg-white border border-stone-200 shadow-2xs flex flex-col gap-3"
                        >
                          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                            <div>
                              <span className="text-[10px] font-mono text-stone-400 uppercase">
                                Accessibility Catchment
                              </span>
                              <h4 className="text-xs font-bold text-stone-900">{cand.label}</h4>
                            </div>
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                                eq?.accessibilityTier === "High Access"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : eq?.accessibilityTier === "Moderate Access"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {eq?.accessibilityTier || "Unassessed"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded bg-stone-50 border border-stone-100">
                              <span className="text-[10px] font-mono text-stone-400 uppercase block">
                                Catchment Area (500m)
                              </span>
                              <span className="text-sm font-bold font-mono text-stone-900">
                                {eq?.catchmentAreaKm2 ?? 0.79} km²
                              </span>
                              <span className="text-[10px] font-mono text-stone-500 block mt-0.5">
                                Euclidean radial boundary
                              </span>
                            </div>

                            <div className="p-2.5 rounded bg-stone-50 border border-stone-100">
                              <span className="text-[10px] font-mono text-stone-400 uppercase block">
                                Connected Arterials
                              </span>
                              <span className="text-sm font-bold font-mono text-stone-900">
                                {eq?.connectedArterialsCount ?? 0}
                              </span>
                              <span className="text-[10px] font-mono text-stone-500 block mt-0.5">
                                Arterial within 300m
                              </span>
                            </div>

                            <div className="p-2.5 rounded bg-stone-50 border border-stone-100 col-span-2">
                              <span className="text-[10px] font-mono text-stone-400 uppercase block">
                                Service Zone Status
                              </span>
                              <div className="font-semibold text-stone-800 mt-0.5">
                                {eq?.underservedZoneFlag ? (
                                  <span className="text-amber-800 flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Underserved Facility Zone — Elevated Siting Priority</span>
                                  </span>
                                ) : (
                                  <span className="text-emerald-800 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>Integrated Service Zone — Proximate Supporting Nodes</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-stone-500 font-mono mt-1">
                                {cand.impacts.serviceCatchmentProxy.nearbyAmenitiesCount} civic amenities observed in immediate 500m radius.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Geodesic Spatial Separation Matrix */}
                  {comparison.spatialSeparation.length > 0 && (
                    <div className="p-4 rounded-panel bg-white border border-stone-200 shadow-2xs">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-stone-900 mb-2 flex items-center gap-1.5">
                        <Ruler className="w-4 h-4 text-emerald-700" />
                        <span>Candidate Geodesic Separation Matrix (Cannibalization Guard)</span>
                      </h4>
                      <div className="space-y-1.5 mt-2">
                        {comparison.spatialSeparation.map((sep, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-2 rounded-control bg-stone-50 border border-stone-100 text-xs flex items-center justify-between font-mono"
                          >
                            <span className="text-stone-700">
                              {sep.labelA} ⟷ {sep.labelB}
                            </span>
                            <span className="font-bold text-emerald-800">
                              {sep.distanceMeters.toLocaleString()} meters
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* TAB 4: DATA QUALITY & UNCERTAINTY */}
              {activeTab === "uncertainty" && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-panel bg-white border border-stone-200 shadow-2xs">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-stone-900 mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>Data Completeness & Evidence Uncertainty Profiles</span>
                    </h4>
                    <p className="text-xs text-stone-600">
                      Transparency classification distinguishing confirmed constraints, empirical evidence, screening proxies, and unobserved data gaps.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {comparison.candidates.map((cand) => {
                      const profile = comparison.uncertaintyProfiles[cand.placementId];
                      return (
                        <div
                          key={cand.placementId}
                          className="p-4 rounded-panel bg-white border border-stone-200 shadow-2xs flex flex-col gap-3"
                        >
                          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                            <h4 className="text-xs font-bold text-stone-900 truncate">{cand.label}</h4>
                            <span className="text-[11px] font-mono font-bold text-emerald-800">
                              {Math.round((profile?.evidenceCompleteness ?? 0.8) * 100)}% completeness
                            </span>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between py-1 border-b border-stone-50">
                              <span className="text-stone-600">Confirmed Constraints:</span>
                              <span className="font-mono font-bold text-stone-900">
                                {profile?.confirmedConstraints ?? 0}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-stone-50">
                              <span className="text-stone-600">Evidence Supported Criteria:</span>
                              <span className="font-mono font-bold text-emerald-700">
                                {profile?.evidenceSupported ?? 0}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-stone-50">
                              <span className="text-stone-600">Screening Proxies:</span>
                              <span className="font-mono font-bold text-amber-700">
                                {profile?.estimatedProxies ?? 0}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-stone-50">
                              <span className="text-stone-600">Unknown / Unobserved Gaps:</span>
                              <span className="font-mono font-bold text-stone-500">
                                {profile?.unknownCount ?? 0}
                              </span>
                            </div>
                          </div>

                          {/* Data Sources Provenance */}
                          <div className="mt-2 pt-2 border-t border-stone-100">
                            <span className="text-[10px] font-mono text-stone-400 uppercase font-bold block mb-1">
                              Authoritative Sources Polled
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {cand.dataSources.map((ds, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200"
                                >
                                  {ds.provider} ({ds.status})
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Bar */}
            <div className="px-6 py-3 border-t border-stone-200 bg-stone-50/70 flex items-center justify-between text-xs text-stone-500 shrink-0">
              <span className="font-mono text-[11px]">
                UrjaSetu Decision Support • Geospatial Engine v1.0.0
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-btn bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold transition-colors text-xs"
              >
                Close Simulator
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
