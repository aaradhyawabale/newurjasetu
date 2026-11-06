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
import { useAppSearchParams, AppLink } from '@/lib/nav';
import { TreeDeciduous, AlertTriangle, ArrowUpDown, ShieldAlert, Sparkles, PlusCircle, Check, Info } from 'lucide-react';
import { usePlan } from '@/context/PlanContext';

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

  const { addItem, plan } = usePlan();
  const addedLossIds = plan.sections.loss.map((item) => item.id);

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

  const handleAddParcelToPlan = (c: Cell) => {
    const loc = c.locality || c.ward;
    addItem({
      id: c.id,
      title: `Restore ${c.ward} - ${loc}`,
      subtitle: `${c.loss_ha} ha lost vegetation · ${c.population.toLocaleString('en-IN')} pop`,
      section: 'loss',
      metadata: {
        loss_ha: c.loss_ha,
        heat_penalty_mean: c.heat_penalty_mean,
        population: c.population,
        ward: c.ward,
        locality: c.locality,
      },
    });
  };

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
      <div data-tour="greenloss-header">
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
      </div>

      {/* Season Matching Note & Loss Summary Metrics */}
      <div data-tour="greenloss-metrics" className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
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
          <div data-tour="greenloss-map" className="lg:col-span-7 space-y-3">
            <div className="h-[520px] rounded-xl overflow-hidden border border-slate-200">
              <MapView
                cells={cells}
                activeLayer="loss"
                fitBounds={true}
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
          <div data-tour="greenloss-ward-table" className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-[#14212B]">
                  Vegetation Loss by Ward
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
                    <th className="py-2 px-2.5 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <span>Exposed Pop.</span>
                        <TruthChip type="Assumed" compact />
                      </div>
                    </th>
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
                Greedily allocate recovery funds to zones where historical vegetation loss is associated
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
                    <th className="py-2.5 px-3">Ward &amp; Locality</th>
                    <th className="py-2.5 px-3 text-right">Loss Area</th>
                    <th className="py-2.5 px-3 text-right">NDVI Drop</th>
                    <th className="py-2.5 px-3 text-right">Associated Heat Increase</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {restoreCandidates.map((c, idx) => {
                    const isAdded = addedLossIds.includes(c.id);
                    const loc = c.locality || c.ward;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          #{idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800">{c.ward} - {loc}</div>
                          <div className="text-[10px] font-mono text-slate-500">{c.id} · Approx. centroid</div>
                        </td>
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
                        <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedCell(c);
                              setIsEvidenceOpen(true);
                            }}
                            className="px-2 py-1 text-[11px] font-semibold text-[#0F5C63] hover:bg-[#0F5C63]/10 rounded-md transition-colors cursor-pointer"
                          >
                            Dossier
                          </button>
                          <button
                            onClick={() => handleAddParcelToPlan(c)}
                            disabled={isAdded}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer ${
                              isAdded
                                ? 'bg-emerald-100 text-emerald-800 cursor-default'
                                : 'bg-[#0F5C63] text-white hover:bg-[#0B484E]'
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>In Plan</span>
                              </>
                            ) : (
                              <>
                                <PlusCircle className="w-3 h-3" />
                                <span>Add to Plan</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Methodological Limits Notice */}
      <div
        data-tour="greenloss-limits"
        className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <div>
          <span className="font-semibold text-slate-700">Vegetation Index Sensor Limits:</span>{' '}
          Sentinel-2 NDVI records photosynthetic chlorophyll reflectance. It does not measure physical tree height, wood density, or understory canopy structure.
        </div>
        <AppLink to="/method" className="text-[#0F5C63] hover:underline font-semibold whitespace-nowrap">
          Read Method Card &rarr;
        </AppLink>
      </div>

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
