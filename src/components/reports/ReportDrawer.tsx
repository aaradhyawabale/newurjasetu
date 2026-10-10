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
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {criteria.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-stone-900">
                      <div>{c.label}</div>
                      <div className="text-[10px] text-stone-500 font-normal max-w-xs truncate">
                        {c.description}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-stone-700 whitespace-nowrap">
                      {c.value}
                    </td>
                    <td className="py-2.5 px-3">
                      <ScoreBar score={c.score} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 font-mono text-stone-500 whitespace-nowrap">
                      {Math.round(c.weight * 100)}%
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-stone-500 max-w-xs leading-tight">
                      {c.benchmark}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {c.evidenceIds.map((eid) => (
                        <EvidenceChip key={eid} id={eid} />
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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

        {/* Evidence Verification Log */}
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-stone-500">
            Evidence Verification Log ({evidence.length} queries)
          </h4>

          <div className="divide-y divide-stone-100 rounded-panel border border-stone-200 bg-white">
            {evidence.map((ev) => (
              <div key={ev.id} className="p-3 flex items-start justify-between gap-3 text-xs">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-stone-900">{ev.id}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-stone-100 text-stone-600">
                      {ev.provider}
                    </span>
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

        {/* Methodology & Limitations */}
        <div className="p-4 rounded-panel bg-stone-100/60 border border-stone-200 flex flex-col gap-2 text-[11px] text-stone-500 leading-normal">
          <span className="font-mono uppercase font-semibold text-stone-600">
            Methodology & Limitations
          </span>
          <ul className="list-disc list-inside space-y-1">
            {limitations.map((lim, idx) => (
              <li key={idx}>{lim}</li>
            ))}
          </ul>
          <p className="pt-1 text-[10px] text-stone-400">
            Attribution: © OpenStreetMap contributors, MapLibre GL, Open-Meteo, NASA POWER.
          </p>
        </div>
      </div>
    </Drawer>
  );
};
