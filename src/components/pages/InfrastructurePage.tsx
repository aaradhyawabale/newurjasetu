"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * InfrastructurePage: Infrastructure Upgrades
 * Ranked list and map of critical public facilities (hospitals, gardens, transit hubs)
 * by heat burden with upgrade options and checklist-style evidence.
 */

import React, { useState, useEffect } from 'react';
import { Site, Cell, InterventionOption } from '@/api/contract';
import { getSites, getCells, compareInterventions } from '@/api/client';
import { ToolPageHeader } from '@/components/ui/ToolPageHeader';
import { TruthChip } from '@/components/ui/TruthChip';
import { Skeleton, ErrorState } from '@/components/ui/FeedbackStates';
import { MapView } from '@/components/map/MapView';
import { PUNE_WARDS } from '@/api/mock/data';
import {
  Building2,
  Hospital,
  TreeDeciduous,
  Compass,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react';

export const InfrastructurePage: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('SITE-01');
  const [siteOptions, setSiteOptions] = useState<InterventionOption[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    structuralAudit: true,
    rooftopSolarReady: true,
    pedestrianBaysShaded: false,
    mistingStationsActive: false,
    drinkingWaterAccess: true,
  });
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [s, c] = await Promise.all([getSites(), getCells()]);
        setSites(s);
        setCells(c);
        if (s.length > 0) setSelectedSiteId(s[0].id);
      } catch (err: any) {
        setError(err?.message || 'Failed to load infrastructure data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedSiteId) return;
    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const opts = await compareInterventions(selectedSiteId);
        setSiteOptions(opts);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoadingOptions(false);
      }
    }
    loadOptions();
  }, [selectedSiteId]);

  if (loading) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[520px] w-full" />
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

  const filteredSites = sites
    .filter((s) => (selectedType === 'all' ? true : s.kind === selectedType))
    .filter((s) => (selectedWard === '' ? true : s.ward === selectedWard))
    .sort((a, b) => a.heat_burden_rank - b.heat_burden_rank);

  const activeSite = sites.find((s) => s.id === selectedSiteId) || sites[0];

  const handleChecklistToggle = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
      <ToolPageHeader
        title="Infrastructure Upgrades"
        purpose="Audit high-vulnerability public institutions (hospitals, bus termini, community parks) under severe pre-monsoon heat stress, and track cooling upgrade readiness."
        steps={[
          'Filter civic facilities by type and municipal ward to view thermal stress rank.',
          'Select any hospital or public building to inspect current shade coverage and cooling solutions.',
          'Review the thermal resilience checklist to ensure emergency patient and commuter heat safety.',
        ]}
        dataUsed={[
          { label: 'Public Asset Registry (PMC)', type: 'Measured' },
          { label: 'Satellite Surface Radiometry', type: 'Measured' },
          { label: 'Heat Burden Priority Ranking', type: 'Modelled' },
        ]}
        breadcrumbItems={[{ label: 'Infrastructure Upgrades' }]}
      />

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-slate-500">Asset Type:</span>
          <div className="flex p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'all', label: 'All Assets' },
              { id: 'hospital', label: 'Hospitals' },
              { id: 'garden', label: 'Gardens' },
              { id: 'corridor', label: 'Transit Hubs' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  selectedType === t.id
                    ? 'bg-white text-[#14212B] shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="infra-ward" className="font-semibold text-slate-500">
            Ward:
          </label>
          <select
            id="infra-ward"
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63] cursor-pointer"
          >
            <option value="">All Wards</option>
            {PUNE_WARDS.map((w) => (
              <option key={w} value={w}>
                {w} Ward
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Left ranked list + map, Right active site details + checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Ranked List & Map (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="h-[360px] rounded-xl overflow-hidden border border-slate-200">
            <MapView cells={cells} activeLayer="burden" height="100%" />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Ranked Public Assets ({filteredSites.length})
              </span>
              <TruthChip type="Modelled" label="Heat Burden Rank" compact />
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredSites.map((site) => {
                const isSelected = site.id === selectedSiteId;
                const Icon =
                  site.kind === 'hospital'
                    ? Hospital
                    : site.kind === 'garden'
                    ? TreeDeciduous
                    : Building2;

                return (
                  <button
                    key={site.id}
                    onClick={() => setSelectedSiteId(site.id)}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-[#0F5C63] bg-[#0F5C63]/5 ring-1 ring-[#0F5C63]/30 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#0F5C63] text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            #{site.heat_burden_rank} · {site.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {site.ward} · {site.area_ha} ha footprint
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold font-mono text-[#D64530] tabular-nums block">
                        {site.lst_mean} °C
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {site.current_shade_pct}% canopy
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Active Facility Audit & Resilience Checklist (6 cols) */}
        {activeSite && (
          <div className="lg:col-span-6 space-y-4">
            {/* Header info */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono font-bold text-[#0F5C63] bg-[#0F5C63]/10 px-2 py-0.5 rounded">
                    {activeSite.id} · Priority #{activeSite.heat_burden_rank}
                  </span>
                  <h2 className="text-lg font-bold text-[#14212B] mt-1">
                    {activeSite.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {activeSite.ward} Ward · Coordinates: [{activeSite.lat.toFixed(4)}, {activeSite.lng.toFixed(4)}]
                  </p>
                </div>
                <TruthChip type="Measured" compact />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Peak Surface Temp</span>
                  <span className="text-lg font-bold font-mono text-[#D64530] tabular-nums">
                    {activeSite.lst_mean} °C
                  </span>
                  <span className="text-[10px] text-slate-400 block">Pre-monsoon skin temp</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Pedestrian Volume</span>
                  <span className="text-lg font-bold font-mono text-slate-800 tabular-nums">
                    {activeSite.population.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 block">Electoral &amp; transit count</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Existing Shade</span>
                  <span className="text-lg font-bold font-mono text-emerald-800 tabular-nums">
                    {activeSite.current_shade_pct}%
                  </span>
                  <span className="text-[10px] text-slate-400 block">Tree / canopy coverage</span>
                </div>
              </div>

              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800 block mb-0.5">Municipal Site Notes:</span>
                <p>{activeSite.notes}</p>
              </div>

              {/* Checklist Evidence View */}
              <div className="pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2.5">
                  <Shield className="w-3.5 h-3.5 text-[#0F5C63]" />
                  Thermal Resilience Verification Checklist
                </h3>

                <div className="space-y-2 text-xs">
                  {[
                    {
                      id: 'structuralAudit',
                      label: 'Structural Rooftop Load Bearing Audit for Cool Roof / Solar',
                      desc: 'Assesses whether concrete roofs can support reflective membrane or solar ballast',
                    },
                    {
                      id: 'rooftopSolarReady',
                      label: 'Grid-Link Electrical Interconnection Ready',
                      desc: 'Allows solar canopy shade systems to feed into building power distribution',
                    },
                    {
                      id: 'pedestrianBaysShaded',
                      label: 'Shaded Patient Waiting & Bus Drop-off Bays',
                      desc: 'Direct physical shade protection for vulnerable waiting commuters and patients',
                    },
                    {
                      id: 'mistingStationsActive',
                      label: 'High-Efficiency Evaporative Misting Line',
                      desc: 'Deploys localized micro-misting during peak afternoon hours (>40°C)',
                    },
                    {
                      id: 'drinkingWaterAccess',
                      label: 'Potable Cold Water Refill Stations Connected',
                      desc: 'Free municipal hydration kiosks within 50 meters of entrance',
                    },
                  ].map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checklist[item.id] || false}
                        onChange={() => handleChecklistToggle(item.id)}
                        className="mt-0.5 w-4 h-4 rounded text-[#0F5C63] focus:ring-[#0F5C63] accent-[#0F5C63]"
                      />
                      <div>
                        <span className="font-semibold text-slate-800 block">
                          {item.label}
                        </span>
                        <span className="text-[11px] text-slate-500 leading-normal">
                          {item.desc}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Upgrade Options for this Facility */}
              {siteOptions.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-800 block mb-2">
                    Recommended Interventions for this Facility:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {siteOptions.map((opt) => (
                      <div
                        key={opt.id}
                        className={`p-2.5 rounded-lg border text-xs ${
                          opt.is_recommended
                            ? 'bg-emerald-50/60 border-emerald-300'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <span className="font-bold text-slate-900 block truncate">
                          {opt.name}
                        </span>
                        <span className="text-[11px] font-mono font-semibold text-sky-900 block">
                          -{opt.cooling_mean}°C cooling
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          ₹{opt.cost_inr_lakh} Lakh (Assumed)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
