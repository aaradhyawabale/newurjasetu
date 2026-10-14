"use client";

import React from "react";
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
} from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { ScoreBar } from "../ui/ScoreBar";
import { StatusBadge } from "../ui/StatusBadge";
import { EvidenceChip } from "../ui/EvidenceChip";
import { AnalysisReportResult } from "@/server/analysis-engine/engine";

interface ReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  report: AnalysisReportResult | null;
  onDownloadPdf: () => void;
  isDownloadingPdf?: boolean;
}

export const ReportDrawer: React.FC<ReportDrawerProps> = ({
  isOpen,
  onClose,
  report,
  onDownloadPdf,
  isDownloadingPdf = false,
}) => {
  const [expandedCriterionId, setExpandedCriterionId] = React.useState<string | null>(null);

  if (!report) return null;

  const { overall, placementSnapshot, criteria, supporting, risks, dataGaps, evidence, limitations } = report;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`${placementSnapshot.type} Siting Report`}
      subtitle={`Generated ${new Date(report.timestamp).toLocaleString()} • Engine v${report.engineVersion}`}
      size="xl"
    >
      <div className="flex flex-col gap-6">
        {/* Executive Verdict Banner */}
        <div
          className={`p-5 rounded-panel border flex flex-col gap-3 ${
            overall.tone === "positive"
              ? "bg-emerald-50/70 border-emerald-300"
              : overall.tone === "moderate"
              ? "bg-stone-50 border-stone-300"
              : overall.tone === "cautious"
              ? "bg-amber-50/70 border-amber-300"
              : "bg-red-50/70 border-red-300"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-stone-500">
                Indicative Suitability Assessment
              </span>
              <h3 className="text-xl font-bold text-stone-900 mt-0.5">
                {overall.band}
              </h3>
            </div>

            <div className="flex flex-col items-end">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-mono font-extrabold text-stone-900">
                  {overall.score}
                </span>
                <span className="text-xs font-mono text-stone-500">/ 100</span>
              </div>
              <span className="text-[10px] font-mono text-stone-500 mt-0.5">
                Confidence: {overall.confidence}%
              </span>
            </div>
          </div>

          <p className="text-xs text-stone-700 leading-relaxed font-normal">
            {overall.verdictSummary}
          </p>

          <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs font-mono text-stone-600">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-stone-400" />
                <span>
                  {placementSnapshot.lat.toFixed(4)}, {placementSnapshot.lng.toFixed(4)}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-stone-400" />
                <span>{placementSnapshot.areaM2.toLocaleString()} m²</span>
              </span>
            </div>

            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={isDownloadingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloadingPdf ? "Preparing PDF..." : "Download PDF"}</span>
            </button>
          </div>
        </div>

        {/* Mandatory Decision Support Disclaimer */}
        <div className="p-3 bg-stone-100 rounded-panel border border-stone-200 text-stone-600 text-[11px] leading-relaxed flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
          <span>
            <strong>DECISION SUPPORT NOTICE:</strong> This analysis is an indicative geospatial screening tool. It does not constitute an official government approval, environmental clearance, or structural engineering certification. All thresholds must be verified against local municipal development control regulations.
          </span>
        </div>

        {/* Why Build Here & Risks Columns */}
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
                {supporting.map((item, idx) => (
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
                {risks.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span className="leading-normal">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Multi-Criteria Scorecard Table */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-stone-500">
              Criteria Scorecard
            </h4>
            <span className="text-[10px] font-mono text-stone-400">
              Weighted Piecewise Evaluation
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
                            {c.status === "unknown" && (
                              <StatusBadge status="unknown" />
                            )}
                            {c.uncertaintyClassification && c.uncertaintyClassification !== "evidence_supported" && (
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
                                    Confidence: <strong className="font-mono uppercase">{c.uncertaintyClassification || "evidence_supported"}</strong>
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
                          {prof.scoreDeltaFromBaseline > 0 ? `+${prof.scoreDeltaFromBaseline}` : prof.scoreDeltaFromBaseline}
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

        {/* Calculation Assumptions & Methodology Limitations */}
        <div className="p-4 rounded-panel bg-stone-100/60 border border-stone-200 flex flex-col gap-3 text-[11px] text-stone-500 leading-normal">
          {report.assumptions && report.assumptions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="font-mono uppercase font-semibold text-stone-600">
                Calculation Assumptions
              </span>
              <ul className="list-disc list-inside space-y-1">
                {report.assumptions.map((assump, idx) => (
                  <li key={idx}>{assump}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="font-mono uppercase font-semibold text-stone-600">
              Methodology & Limitations
            </span>
            <ul className="list-disc list-inside space-y-1">
              {limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
          <p className="pt-1 text-[10px] text-stone-400">
            Attribution: © OpenStreetMap contributors, MapLibre GL, Open-Meteo, NASA POWER.
          </p>
        </div>
      </div>
    </Drawer>
  );
};
