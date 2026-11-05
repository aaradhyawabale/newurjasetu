"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * InterventionsPage: Intervention Scenarios
 * Side-by-side evaluation of urban greening vs cool roofs vs solar shade canopies.
 */

import React, { useState, useEffect } from 'react';
import { Site, InterventionOption, ModelCard } from '@/api/contract';
import { getSites, compareInterventions, getModelCard } from '@/api/client';
import { ToolPageHeader } from '@/components/ui/ToolPageHeader';
import { TruthChip } from '@/components/ui/TruthChip';
import { Skeleton, ErrorState } from '@/components/ui/FeedbackStates';
import { Button } from '@/components/ui/Button';
import { useAppSearchParams } from '@/lib/nav';
import {
  GitCompare,
  TreeDeciduous,
  Paintbrush,
  Sun,
  CheckCircle2,
  AlertCircle,
  Building2,
  Hospital,
} from 'lucide-react';

export const InterventionsPage: React.FC = () => {
  const [searchParams] = useAppSearchParams();
  const initialSiteId = searchParams.get('site');

  const [kindFilter, setKindFilter] = useState<'all' | 'hospital' | 'garden' | 'corridor'>('all');
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('SITE-01');
  const [interventions, setInterventions] = useState<InterventionOption[]>([]);
  const [modelCard, setModelCard] = useState<ModelCard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingInterventions, setLoadingInterventions] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSites() {
      try {
        const [s, m] = await Promise.all([getSites(), getModelCard()]);
        setSites(s);
        setModelCard(m);
        if (initialSiteId && s.some((item) => item.id === initialSiteId)) {
          setSelectedSiteId(initialSiteId);
        } else if (s.length > 0) {
          setSelectedSiteId(s[0].id);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load sites');
      } finally {
        setLoading(false);
      }
    }
    loadSites();
  }, [initialSiteId]);

  useEffect(() => {
    if (!selectedSiteId) return;
    async function loadOptions() {
      setLoadingInterventions(true);
      try {
        const opts = await compareInterventions(selectedSiteId);
        setInterventions(opts);
      } catch (err: any) {
        setError(err?.message || 'Failed to load intervention comparisons');
      } finally {
        setLoadingInterventions(false);
      }
    }
    loadOptions();
  }, [selectedSiteId]);

  if (loading) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[480px] w-full" />
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

  const filteredSites =
    kindFilter === 'all' ? sites : sites.filter((s) => s.kind === kindFilter);

  const selectedSite = sites.find((s) => s.id === selectedSiteId) || sites[0];

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
      <ToolPageHeader
        title="Intervention Scenarios"
        purpose="Compare candidate thermal cooling technologies for public hospitals, transit centers, and municipal parks before allocating capital expenditure."
        steps={[
          'Filter by site kind (hospitals, gardens, or transit corridors) and select a priority location.',
          'Review the side-by-side comparison of canopy greening, reflective cool roofs, and solar shade.',
          'Examine the AI model cooling estimate ranges and cost parameters to select the best civic fit.',
        ]}
        dataUsed={[
          { label: 'Site Thermal Exposure & Area', type: 'Measured' },
          { label: 'Modelled Surface Cooling Range', type: 'Modelled' },
          { label: 'Capital Cost Estimates (INR)', type: 'Assumed' },
        ]}
        breadcrumbItems={[{ label: 'Intervention Scenarios' }]}
      />

      {/* Top Filter & Site Picker Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Kind filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Filter Site Type:
          </span>
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'all', label: 'All Sites' },
              { id: 'hospital', label: 'Hospitals' },
              { id: 'garden', label: 'Gardens' },
              { id: 'corridor', label: 'Corridors' },
            ].map((k) => (
              <button
                key={k.id}
                onClick={() => setKindFilter(k.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  kindFilter === k.id
                    ? 'bg-white text-[#14212B] shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {/* Site dropdown */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <label htmlFor="site-select" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            Selected Site:
          </label>
          <select
            id="site-select"
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63] cursor-pointer"
          >
            {filteredSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.ward} · {s.lst_mean}°C)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Site Context Card */}
      {selectedSite && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">Location &amp; Ward</span>
            <span className="font-bold text-slate-800 text-sm">{selectedSite.name}</span>
            <span className="text-[11px] text-slate-500 block">{selectedSite.ward} Ward</span>
          </div>
          <div>
            <span className="text-slate-500 block">Baseline Surface Temp</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-[#D64530] tabular-nums">
                {selectedSite.lst_mean} °C
              </span>
              <TruthChip type="Measured" compact />
            </div>
            <span className="text-[10px] text-slate-400 block font-mono">Satellite skin temp</span>
          </div>
          <div>
            <span className="text-slate-500 block">Compound Area</span>
            <span className="text-xl font-bold font-mono text-slate-800 tabular-nums">
              {selectedSite.area_ha} ha
            </span>
            <span className="text-[10px] text-slate-400 block">Available footprint</span>
          </div>
          <div>
            <span className="text-slate-500 block">Current Tree Canopy</span>
            <span className="text-xl font-bold font-mono text-emerald-800 tabular-nums">
              {selectedSite.current_shade_pct}%
            </span>
            <span className="text-[10px] text-slate-400 block">Existing shade coverage</span>
          </div>
        </div>
      )}

      {/* Side-by-side 3 options comparison */}
      {loadingInterventions ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {interventions.map((opt) => {
            const isRec = opt.is_recommended;
            const Icon =
              opt.type === 'greening'
                ? TreeDeciduous
                : opt.type === 'cool_roof'
                ? Paintbrush
                : Sun;

            return (
              <div
                key={opt.id}
                className={`p-6 rounded-2xl border flex flex-col justify-between transition-all bg-white shadow-xs ${
                  isRec
                    ? 'border-2 border-[#0F5C63] ring-4 ring-[#0F5C63]/10 relative'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Recommended badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      <Icon className="w-5 h-5 text-[#0F5C63]" />
                    </div>

                    {isRec ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#0F5C63] text-white">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Recommended
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Alternative</span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-[#14212B] mb-2 leading-snug">
                    {opt.name}
                  </h3>

                  {/* Cooling estimate (Modelled) */}
                  <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-200 my-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">
                        Est. Surface Cooling:
                      </span>
                      <TruthChip type="Modelled" compact />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold font-mono text-sky-900 tabular-nums">
                        -{opt.cooling_mean} °C
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-600 block">
                      Range: -{opt.cooling_p10} °C to -{opt.cooling_p90} °C (P10–P90)
                    </span>
                  </div>

                  {/* Capital Cost Placeholder (Assumed) */}
                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/80 mb-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">
                        Estimated Capital Outlay:
                      </span>
                      <TruthChip type="Assumed" compact />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold font-mono text-amber-950 tabular-nums">
                        ₹ {opt.cost_inr_lakh} Lakh
                      </span>
                      <span className="text-[11px] text-slate-500">(INR benchmark)</span>
                    </div>
                  </div>

                  {/* Feasibility Notes */}
                  <div className="space-y-1 text-xs text-slate-600">
                    <span className="font-bold text-slate-800 block">Feasibility Note:</span>
                    <p className="leading-relaxed">{opt.feasibility_note}</p>
                  </div>
                </div>

                {/* Recommendation Reason */}
                <div className="mt-6 pt-4 border-t border-slate-100 text-xs">
                  <span className="font-bold text-slate-800 block mb-1">
                    Evaluation Rationale:
                  </span>
                  <p className="text-slate-600 leading-relaxed italic">
                    &ldquo;{opt.recommendation_reason}&rdquo;
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};
