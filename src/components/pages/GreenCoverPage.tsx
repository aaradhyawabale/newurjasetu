"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GreenCoverPage: Green Cover Plan
 * Map with candidate green corridors and park upgrades, budget slider,
 * ranked list with people served and vegetation gap, and add-to-plan basket.
 */

import React, { useState, useEffect } from 'react';
import { Site, Cell } from '@/api/contract';
import { getSites, getCells } from '@/api/client';
import { ToolPageHeader } from '@/components/ui/ToolPageHeader';
import { Slider } from '@/components/ui/FormControls';
import { TruthChip } from '@/components/ui/TruthChip';
import { Button } from '@/components/ui/Button';
import { Skeleton, ErrorState, Toast } from '@/components/ui/FeedbackStates';
import { MapView } from '@/components/map/MapView';
import { Plus, Trash2, ShoppingBag, Check, TreeDeciduous, Users, Sparkles } from 'lucide-react';

export const GreenCoverPage: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [budgetHa, setBudgetHa] = useState<number>(30);
  const [basket, setBasket] = useState<string[]>(['SITE-01', 'SITE-07']);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [s, c] = await Promise.all([getSites(), getCells()]);
        setSites(s);
        setCells(c);
      } catch (err: any) {
        setError(err?.message || 'Failed to load green cover data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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

  // Toggle item in basket
  const handleToggleBasket = (siteId: string) => {
    setBasket((prev) => {
      const exists = prev.includes(siteId);
      if (exists) {
        setToastMessage(`Removed from planning basket`);
        return prev.filter((id) => id !== siteId);
      } else {
        setToastMessage(`Added to planning basket`);
        return [...prev, siteId];
      }
    });
  };

  const basketSites = sites.filter((s) => basket.includes(s.id));
  const totalBasketArea = Math.round(basketSites.reduce((acc, s) => acc + s.area_ha, 0) * 10) / 10;
  const totalBasketPeople = basketSites.reduce((acc, s) => acc + s.population, 0);

  // Ranked candidates: highest population x surface temperature
  const rankedSites = [...sites].sort(
    (a, b) => b.population * (b.lst_mean - 32) - a.population * (a.lst_mean - 32)
  );

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
      <ToolPageHeader
        title="Green Cover Plan"
        purpose="Identify candidate green corridors and civic park upgrades, compute population served and vegetation deficit, and assemble an actionable municipal investment basket."
        steps={[
          'Explore candidate green corridors and park upgrades across Pune on the map.',
          'Review the priority ranking sorted by thermal exposure and pedestrian footfall.',
          'Add high-impact sites to your greening basket and export the aggregated summary.',
        ]}
        dataUsed={[
          { label: 'Candidate Corridor Polygons', type: 'Measured' },
          { label: 'Electoral Population Served', type: 'Measured' },
          { label: 'Vegetation Gap (NDVI Deficit)', type: 'Modelled' },
        ]}
        breadcrumbItems={[{ label: 'Green Cover Plan' }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Map & Basket Summary (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="h-[480px] rounded-xl overflow-hidden border border-slate-200">
            <MapView
              cells={cells}
              activeLayer="ndvi"
              height="100%"
            />
          </div>

          {/* Add-to-plan Basket Summary Card */}
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#0F5C63]" />
                <h3 className="text-sm font-bold text-[#14212B]">
                  Greening Basket Summary ({basket.length} Sites)
                </h3>
              </div>
              <TruthChip type="Assumed" label="User Basket" compact />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-500 block">Total Area</span>
                <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                  {totalBasketArea} ha
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  Target budget: {budgetHa} ha
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-500 block">Citizens Served</span>
                <span className="text-xl font-bold font-mono text-[#0F5C63] tabular-nums">
                  {totalBasketPeople.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 block">Transit &amp; residents</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg col-span-2 sm:col-span-1">
                <span className="text-[11px] text-slate-500 block">Budget Cap Status</span>
                <span
                  className={`text-sm font-bold tabular-nums block mt-1 ${
                    totalBasketArea <= budgetHa ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {totalBasketArea <= budgetHa
                    ? `✓ Within Budget (${Math.round(budgetHa - totalBasketArea)} ha left)`
                    : `⚠️ Exceeds Budget by +${Math.round(totalBasketArea - budgetHa)} ha`}
                </span>
              </div>
            </div>

            {basketSites.length > 0 ? (
              <div className="space-y-1.5 pt-2">
                <span className="text-xs font-semibold text-slate-700 block">
                  Sites in Current Plan Basket:
                </span>
                <div className="flex flex-wrap gap-2">
                  {basketSites.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0F5C63]/10 text-[#0F5C63] text-xs font-medium"
                    >
                      <span>{s.name}</span>
                      <button
                        onClick={() => handleToggleBasket(s.id)}
                        className="hover:text-red-600 transition-colors cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Your basket is empty. Click &quot;+ Add to Basket&quot; from the ranked candidate list on the right.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Budget Slider & Ranked Candidates (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-[#14212B]">
                Corridors &amp; Parks Ranking
              </h2>
              <span className="text-xs text-slate-500">
                Sorted by pedestrian volume &amp; canopy deficit
              </span>
            </div>
            <TruthChip type="Modelled" label="Ranked" compact />
          </div>

          {/* Budget Slider */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <Slider
              id="cover-budget-slider"
              label="Greening Cover Allocation Target"
              value={budgetHa}
              min={10}
              max={60}
              step={2}
              unit="ha"
              truth="Assumed"
              onChange={setBudgetHa}
            />
          </div>

          {/* Candidate list */}
          <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
            {rankedSites.map((site, idx) => {
              const inBasket = basket.includes(site.id);

              return (
                <div
                  key={site.id}
                  className={`p-3.5 rounded-xl border transition-all text-xs flex flex-col justify-between gap-2.5 ${
                    inBasket
                      ? 'border-[#0F5C63] bg-[#0F5C63]/5 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-slate-900">
                          #{idx + 1} {site.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {site.ward} Ward · {site.area_ha} ha footprint
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleBasket(site.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                        inBasket
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          : 'bg-[#0F5C63] text-white hover:bg-[#0A3E43]'
                      }`}
                    >
                      {inBasket ? (
                        <>
                          <Trash2 className="w-3 h-3" />
                          Remove
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          Add to Basket
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Surface Temp</span>
                      <span className="font-bold font-mono text-[#D64530]">
                        {site.lst_mean} °C
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Exposed Pop.</span>
                      <span className="font-bold font-mono text-slate-800">
                        {site.population.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Canopy Gap</span>
                      <span className="font-bold font-mono text-emerald-800">
                        {100 - site.current_shade_pct}% deficit
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {toastMessage && (
        <Toast message={toastMessage} type="success" onClose={() => setToastMessage(null)} />
      )}
    </main>
  );
};
