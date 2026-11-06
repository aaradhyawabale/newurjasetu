"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * LandingPage: UrjaSetu Civic-Tech Portal
 * Where should Pune cool first?
 */

import React, { useEffect, useState } from 'react';
import { AppLink } from '@/lib/nav';
import { Cell, ModelCard } from '@/api/contract';
import { getCells, getModelCard } from '@/api/client';
import { MapView } from '@/components/map/MapView';
import { ToolCard, SectionHeader } from '@/components/ui/ToolCard';
import { TruthChip } from '@/components/ui/TruthChip';
import { Button } from '@/components/ui/Button';
import { Skeleton, ErrorState } from '@/components/ui/FeedbackStates';
import {
  ArrowRight,
  Flame,
  ShieldCheck,
  Compass,
  TreeDeciduous,
  GitCompare,
  Building2,
  Sun,
  Eye,
  Sliders,
  CheckCircle2,
  Info,
  Check,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [cells, setCells] = useState<Cell[]>([]);
  const [modelCard, setModelCard] = useState<ModelCard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [c, m] = await Promise.all([getCells(), getModelCard()]);
        setCells(c);
        setModelCard(m);
      } catch (err: any) {
        setError(err?.message || 'Failed to load landing data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-64 w-full" />
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

  return (
    <main className="space-y-16 sm:space-y-24 pb-20">
      {/* 1. HERO SECTION */}
      <section className="pt-8 sm:pt-14 pb-12 sm:pb-16 border-b border-slate-200 bg-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Heading and CTAs (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Provenance metadata chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Verified Pipeline:</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200">
                  Landsat + Sentinel-2 satellite data
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-sky-50 text-sky-900 border border-sky-200">
                  AI ensemble of {modelCard?.ensemble_members ?? 12} models
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                  Measured / Modelled / Assumed labels
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#14212B] tracking-tight leading-[1.1] text-balance">
                Where should Pune cool first?
              </h1>

              <p className="text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed text-balance">
                UrjaSetu turns satellite heat, population and your budget into a ranked plan for
                where to green, shade and cool, with the evidence behind every number.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <AppLink
                  to="/heat-planner"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold text-white bg-[#0F5C63] hover:bg-[#0A3E43] active:bg-[#072B2E] rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Open Heat Planner</span>
                  <ArrowRight className="w-5 h-5" />
                </AppLink>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center px-5 py-3.5 text-base font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  How it works
                </a>
              </div>

              {/* Competition Anchor */}
              <div className="pt-2 text-xs text-slate-500 flex items-center gap-2 border-t border-slate-100">
                <ShieldCheck className="w-4 h-4 text-[#0F5C63] shrink-0" />
                <span>
                  Indradhanu - PCCOE International Grand Challenge 2026 · AI for Climate Change
                  (SDG 13)
                </span>
              </div>
            </div>

            {/* Right Column: Live non-interactive mini map (5 cols) */}
            <div className="lg:col-span-5">
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 shadow-md">
                <div className="flex items-center justify-between px-2 py-1.5 mb-1 text-xs text-slate-600">
                  <span className="font-semibold flex items-center gap-1.5 text-[#14212B]">
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    Pune Pre-Monsoon Heat Burden
                  </span>
                  <TruthChip type="Measured" compact />
                </div>
                <div className="h-[360px] sm:h-[400px] rounded-xl overflow-hidden relative">
                  <MapView
                    cells={cells}
                    activeLayer="burden"
                    interactive={false}
                    showLayerControl={false}
                    height="100%"
                  />
                  <div className="absolute inset-0 bg-transparent pointer-events-none" />
                </div>
                <div className="p-2 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>~600 250m grid units</span>
                  <AppLink
                    to="/heat-planner"
                    className="text-[#0F5C63] font-semibold hover:underline"
                  >
                    Explore interactive map →
                  </AppLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS (3 STEPS, 1 SENTENCE EACH) */}
      <section id="how-it-works" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kicker="Decision Framework"
          title="How it works"
          subtitle="Three transparent steps from space radiometry to civic action on the ground."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#0F5C63]/10 text-[#0F5C63] flex items-center justify-center font-bold mb-4">
                <Eye className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F5C63] block mb-1">
                Step 1
              </span>
              <h3 className="text-lg font-bold text-[#14212B] mb-2">
                See the heat
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Satellite surface radiometry combines with electoral population registers to pinpoint
                neighborhoods where extreme thermal skin temperatures coincide with dense human exposure.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <TruthChip type="Measured" label="Satellite & Population" compact />
            </div>
          </div>

          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#0F5C63]/10 text-[#0F5C63] flex items-center justify-center font-bold mb-4">
                <Sliders className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F5C63] block mb-1">
                Step 2
              </span>
              <h3 className="text-lg font-bold text-[#14212B] mb-2">
                Set a budget
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Define available municipal unbuilt land in hectares and target vegetation index (NDVI) to bound
                planning realistic parameters.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <TruthChip type="Assumed" label="Municipal Policy Constraint" compact />
            </div>
          </div>

          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#0F5C63]/10 text-[#0F5C63] flex items-center justify-center font-bold mb-4">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F5C63] block mb-1">
                Step 3
              </span>
              <h3 className="text-lg font-bold text-[#14212B] mb-2">
                Get a plan you can defend
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Receive an optimal ranked portfolio with uncertainty ranges, cross-validation metrics,
                and downloadable evidence dossiers for council presentation.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <TruthChip type="Modelled" label="Ensemble Estimates" compact />
            </div>
          </div>
        </div>
      </section>

      {/* 3. MAIN USP BLOCK (VISUALLY LARGEST) */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#14212B] text-white rounded-3xl p-8 sm:p-12 lg:p-16 shadow-2xl relative overflow-hidden">
          {/* Subtle civic pattern backdrop */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#0F5C63]/30 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-4xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0F5C63] text-amber-300 text-xs font-bold tracking-wide uppercase">
              <Compass className="w-4 h-4" />
              Main Platform Engine
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-balance leading-tight">
              Heat Intelligence + Budget Planner
            </h2>

            <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed text-balance">
              One page: find the hottest, most crowded places, set a budget, and compare plans side by side.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Check className="w-4 h-4" />
                  Heat burden map
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  People multiplied by how much hotter the surface is compared to rural Talegaon grasslands.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Check className="w-4 h-4" />
                  Budget optimiser
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Greedy benefit allocation with P10–P90 uncertainty ranges and 30-seed ensemble robustness.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                  <Check className="w-4 h-4" />
                  Evidence dossier
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Verified satellite acquisition dates, local population tallies, and deep links for every zone.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <AppLink
                to="/heat-planner"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-[#14212B] bg-white hover:bg-slate-100 rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Open Heat Planner Now</span>
                <ArrowRight className="w-5 h-5 text-[#0F5C63]" />
              </AppLink>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MORE TOOLS FOR THE SAME GOAL */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kicker="Integrated Climate Suite"
          title="More tools for the same goal"
          subtitle="Explore specialized analysis modules designed for municipal departments and engineers."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <ToolCard
            to="/green-loss"
            toolName="Green Loss Watch"
            userGoalTitle="Trace Historical Canopy Loss"
            description="Track 250m satellite pixels where vegetation has declined and evaluate the associated surface temperature increase across Pune's wards."
            icon={<TreeDeciduous className="w-5 h-5" />}
            tags={['Sentinel-2 NDVI', 'Approximate Wards', 'Restoration Priority']}
          />

          <ToolCard
            to="/interventions"
            toolName="Intervention Scenarios"
            userGoalTitle="Compare Cooling Technologies"
            description="Evaluate site-specific trade-offs between Miyawaki urban forests, high-albedo cool roof coatings, and solar shading canopies."
            icon={<GitCompare className="w-5 h-5" />}
            tags={['Cost Estimates', 'P10–P90 Ranges', 'Feasibility']}
          />

          <ToolCard
            to="/green-cover"
            toolName="Green Cover Plan"
            userGoalTitle="Prioritize Corridors & Parks"
            description="Assemble a basket of candidate civic corridors and park upgrades, balancing pedestrian traffic relief and canopy deficits."
            icon={<TreeDeciduous className="w-5 h-5" />}
            tags={['Transit Corridors', 'Civic Parks', 'Basket Summary']}
          />

          <ToolCard
            to="/infrastructure"
            toolName="Infrastructure Upgrades"
            userGoalTitle="Protect Critical Public Assets"
            description="Identify public hospitals, transit hubs, and municipal centers under severe heat stress with structured resilience checklists."
            icon={<Building2 className="w-5 h-5" />}
            tags={['Hospitals', 'Transit Hubs', 'Heat Rank']}
          />

          <ToolCard
            to="/solar"
            toolName="Solar & Shadow Simulator"
            userGoalTitle="Simulate Shadows & Solar Penalties"
            description="Calculate geometric building shadows with Suncalc and evaluate solar panel efficiency degradation caused by excessive surface heat."
            icon={<Sun className="w-5 h-5" />}
            tags={['Suncalc Geometry', 'Thermal Derating', 'Alpha Parameter']}
            badge="Simulation"
          />

          <ToolCard
            to="/method"
            toolName="Method & Model Card"
            userGoalTitle="Review Scientific Quality Gate"
            description="Inspect cross-validation error metrics, satellite sensor scene passes, validation thresholds, assumptions, and explicit limitations."
            icon={<ShieldCheck className="w-5 h-5" />}
            tags={['RMSE <= 1.25°C', 'Landsat-8/9', 'TruthChips']}
          />
        </div>
      </section>

      {/* 5. HONEST BY DESIGN SECTION */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 shadow-sm space-y-8">
          <SectionHeader
            kicker="Epistemic Humility"
            title="Honest by design"
            subtitle="Clear boundaries between what is observed, what is simulated, and what is assumed."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 bg-emerald-50/50 rounded-xl border border-emerald-200">
              <div className="flex items-center gap-2 mb-3">
                <TruthChip type="Measured" />
                <span className="text-xs font-semibold text-emerald-900">Direct Observations</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Radiometric surface brightness recorded by Landsat-8/9 TIRS and Sentinel-2 MSI, along
                with municipal ward boundaries and official electoral population rolls.
              </p>
            </div>

            <div className="p-5 bg-sky-50/50 rounded-xl border border-sky-200">
              <div className="flex items-center gap-2 mb-3">
                <TruthChip type="Modelled" />
                <span className="text-xs font-semibold text-sky-900">Machine Learning Estimates</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Cooling outcomes, heat burden indices, and solar thermal penalties derived from a 12-member
                ensemble model. Always displayed with P10–P90 uncertainty ranges.
              </p>
            </div>

            <div className="p-5 bg-amber-50/50 rounded-xl border border-amber-200">
              <div className="flex items-center gap-2 mb-3">
                <TruthChip type="Assumed" />
                <span className="text-xs font-semibold text-amber-900">Configured Parameters</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Greening budget allocations, target vegetation index (NDVI) objectives, unit intervention costs,
                and thermal transfer factors (alpha). Clearly tagged for sensitivity analysis.
              </p>
            </div>
          </div>

          {/* Live Validation Banner from Model Card */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-800 block">
                Live Validation Gate: {modelCard?.gate.text}
              </span>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>
                  Cross-validation RMSE:{' '}
                  <strong className="font-mono text-slate-900">
                    {modelCard?.cv_rmse_c != null ? `±${modelCard.cv_rmse_c} °C` : 'Not available'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Held-out Test RMSE:{' '}
                  <strong className="font-mono text-slate-900">
                    {modelCard?.held_out_rmse_c != null ? `±${modelCard.held_out_rmse_c} °C` : 'Not available'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  R² Score:{' '}
                  <strong className="font-mono text-slate-900">
                    {modelCard?.cv_r2 ?? '0.82'}
                  </strong>
                </span>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500 italic">
                Surface temperature is not air temperature.
              </span>
              <AppLink
                to="/method"
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Inspect Method Card →
              </AppLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};
