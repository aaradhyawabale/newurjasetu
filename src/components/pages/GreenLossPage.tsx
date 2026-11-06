"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GreenLossPage: Green Loss Watch
 * Tracks 250m satellite pixels with historical vegetation decline
 * and models the heat penalty associated with loss.
 */

import React, { useState, useEffect } from 'react';
import { Cell, WardSummary, ModelCard } from '@/api/contract';
import { getCells, getWardSummary, getModelCard } from '@/api/client';
import { MapView } from '@/components/map/MapView';
import { ToolPageHeader } from '@/components/ui/ToolPageHeader';
import { Tabs, Slider } from '@/components/ui/FormControls';
import { TruthChip } from '@/components/ui/TruthChip';
import { Skeleton, ErrorState } from '@/components/ui/FeedbackStates';
import { EvidenceDrawer } from '@/components/planner/EvidenceDrawer';
import { useAppSearchParams } from '@/lib/nav';
import { TreeDeciduous, AlertTriangle, ArrowUpDown, ShieldAlert, Sparkles } from 'lucide-react';

export const GreenLossPage: React.FC = () => {
  const [searchParams] = useAppSearchParams();
  const initialCellId = searchParams.get('cell');

  const [cells, setCells] = useState<Cell[]>([]);
  const [wardSummaries, setWardSummaries] = useState<WardSummary[]>([]);
  const [modelCard, setModelCard] = useState<ModelCard | null>(null);
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'restore'>('overview');
  const [restoreBudgetHa, setRestoreBudgetHa] = useState<number>(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [c, w, m] = await Promise.all([
          getCells(),
          getWardSummary(),
          getModelCard(),
        ]);
        setCells(c);
        setWardSummaries(w);
        setModelCard(m);

        if (initialCellId) {
          const found = c.find((cell) => cell.id === initialCellId);
          if (found) {
            setSelectedCell(found);
            setIsEvidenceOpen(true);
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load green loss data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [initialCellId]);

  if (loading) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[500px] w-full" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </main>
    );
  }

  // Filter cells that have verified loss records
  const lossCells = cells
    .filter((c) => c.loss_ha !== null && c.loss_ha > 0)
    .sort((a, b) => (b.loss_ha || 0) - (a.loss_ha || 0));

  // "Restore First" ranking based on heat penalty associated with loss
  let restoreAllocatedHa = 0;
  const restoreCandidates: Cell[] = [];
  const candidatePool = [...lossCells].sort(
    (a, b) => (b.heat_penalty_mean || 0) * b.population - (a.heat_penalty_mean || 0) * a.population
  );

  for (const cell of candidatePool) {
    const area = cell.loss_ha || 0.5;
    if (restoreAllocatedHa + area <= restoreBudgetHa) {
      restoreCandidates.push(cell);
      restoreAllocatedHa += area;
    }
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
      <ToolPageHeader
        title="Green Loss Watch"
        purpose="Monitor multi-year vegetation depletion across Pune, and prioritize sites for rapid restoration where vegetation loss is associated with severe surface heat excess."
        steps={[
          'Examine the satellite loss layer to find cells with verified baseline-to-current vegetation loss.',
          'Review the approximate ward breakdown to locate clusters of historical vegetation depletion.',
          'Switch to the "Restore first" tab to generate a budget-constrained re-greening recovery plan.',
        ]}
        dataUsed={[
          { label: 'Sentinel-2 Multi-Temporal NDVI', type: 'Measured' },
          { label: 'Ward Loss Aggregation (approximate)', type: 'Measured' },
          { label: 'Associated Heat Penalty Range', type: 'Modelled' },
        ]}
        breadcrumbItems={[{ label: 'Green Loss Watch' }]}
      />

      {/* Season Matching Note */}
      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Temporal Calibration Note:</span> Same season compared:
          baseline pre-monsoon windows (April–May 2023) vs current pre-monsoon windows
          (April–May 2024) to avoid false phenological anomalies.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <Tabs
          tabs={[
            { id: 'overview', label: 'Ward Loss Overview' },
            { id: 'restore', label: 'Restore First Prioritization' },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as 'overview' | 'restore')}
        />

        <div className="text-xs text-slate-500 hidden sm:block">
          Showing <strong>{lossCells.length}</strong> monitored loss pixels
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Map Column (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="h-[520px] rounded-xl overflow-hidden border border-slate-200">
              <MapView
                cells={cells}
                activeLayer="loss"
                onSelect={(cell) => {
                  setSelectedCell(cell);
                  setIsEvidenceOpen(true);
                }}
                height="100%"
              />
            </div>
            <div className="text-xs text-slate-500 flex items-center justify-between px-1">
              <span>Click any pixel to inspect baseline vs current NDVI and associated heat penalty.</span>
              <TruthChip type="Measured" label="Loss Ha" compact />
            </div>
          </div>

          {/* Ward Table Column (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-[#14212B]">
                  Canopy Loss by Ward
                </h2>
                <span className="text-[11px] text-slate-500">
                  Approximate municipal ward boundaries
                </span>
              </div>
              <TruthChip type="Measured" label="Approx. Wards" compact />
            </div>

            <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2 px-2.5">Ward Name</th>
                    <th className="py-2 px-2.5 text-right">Lost Area (ha)</th>
                    <th className="py-2 px-2.5 text-right">% of Baseline</th>
                    <th className="py-2 px-2.5 text-right">Exposed Pop.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wardSummaries.map((w) => (
                    <tr key={w.ward} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-2.5 font-medium text-slate-800">
                        {w.ward}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono font-bold text-rose-700 tabular-nums">
                        {w.loss_ha} ha
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-600 tabular-nums">
                        {w.loss_pct_of_baseline_green}%
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-600 tabular-nums">
                        {w.people_in_loss_cells !== null
                          ? w.people_in_loss_cells.toLocaleString()
                          : 'Not available'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESTORE FIRST */}
      {activeTab === 'restore' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Controls (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#14212B]">
                Restoration Budget Planner
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Greedily allocate recovery funds to zones where historical canopy loss is associated
                with the highest surface temperature increase.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <Slider
                id="restore-budget-slider"
                label="Restoration Budget Target"
                value={restoreBudgetHa}
                min={5}
                max={40}
                step={1}
                unit="ha"
                truth="Input"
                onChange={setRestoreBudgetHa}
                helpText="Hectares of lost vegetation to restore"
              />
            </div>

            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs space-y-1">
              <span className="font-bold text-emerald-900 block">
                Plan Yield:
              </span>
              <p className="text-slate-700">
                Covers <strong>{restoreCandidates.length}</strong> critical recovery zones totaling{' '}
                <strong className="font-mono">{Math.round(restoreAllocatedHa * 10) / 10} ha</strong>.
              </p>
              <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Modelled Heat Penalty Field:</span>
                <span className="font-semibold text-slate-700 italic">Not yet validated</span>
              </div>
            </div>
          </div>

          {/* Ranked List (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-[#14212B]">
                  Restoration Priority Ranking
                </h3>
                <span className="text-xs text-slate-500">
                  Ranked by population-weighted heat penalty associated with loss
                </span>
              </div>
              <TruthChip type="Modelled" compact />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Rank &amp; Zone</th>
                    <th className="py-2.5 px-3">Ward</th>
                    <th className="py-2.5 px-3 text-right">Loss Area</th>
                    <th className="py-2.5 px-3 text-right">NDVI Drop</th>
                    <th className="py-2.5 px-3 text-right">Associated Heat Increase</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {restoreCandidates.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        #{idx + 1} · {c.id}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{c.ward}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 tabular-nums">
                        {c.loss_ha} ha
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                        {c.baseline_ndvi} → {c.current_ndvi}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700 tabular-nums">
                        +{c.heat_penalty_mean} °C
                        <span className="block text-[10px] text-slate-400 font-normal">
                          ({c.heat_penalty_p10} to {c.heat_penalty_p90}°C)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedCell(c);
                            setIsEvidenceOpen(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#0F5C63] hover:bg-[#0F5C63]/10 rounded-md transition-colors cursor-pointer"
                        >
                          View Dossier →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Drawer */}
      <EvidenceDrawer
        cell={selectedCell}
        modelCard={modelCard}
        isOpen={isEvidenceOpen}
        onClose={() => setIsEvidenceOpen(false)}
      />
    </main>
  );
};
