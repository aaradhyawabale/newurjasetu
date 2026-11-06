"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { CHAPTERS } from '@/walkthrough/chapters';
import { useTour } from '@/walkthrough/engine/TourProvider';
import { AppLink } from '@/lib/nav';
import {
  Compass,
  CheckCircle2,
  PlayCircle,
  RotateCcw,
  Clock,
  ArrowRight,
  ShieldCheck,
  Flame,
  Layers,
  TreeDeciduous,
  GitCompare,
  Building2,
  Sun,
  Bookmark,
  FileCheck2,
} from 'lucide-react';

function WalkthroughHubContent() {
  const { state, startTour, restartTour } = useTour();

  const completedSet = new Set(state.completedChapters);
  const totalCompleted = state.completedChapters.length;
  const hasProgress = totalCompleted > 0 || state.activeChapterId !== null;

  const handleResume = () => {
    if (state.activeChapterId) {
      startTour(state.activeChapterId, state.activeStepIndex);
    } else {
      // Find first incomplete chapter
      const firstIncomplete = CHAPTERS.find((c) => !completedSet.has(c.id)) || CHAPTERS[0];
      startTour(firstIncomplete.id, 0);
    }
  };

  return (
    <AppLayout>
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
        {/* Hub Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-semibold">
              <Compass className="w-3.5 h-3.5 text-[#0F5C63]" />
              <span>Interactive Platform Tour · 10 Chapters</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#14212B] tracking-tight">
              UrjaSetu Platform Walkthrough
            </h1>
            <p className="text-base text-slate-600 leading-relaxed">
              Explore how satellite thermal radiometry, population density, and mathematical optimization combine to guide Pune&apos;s urban heat resilience investments.
            </p>
          </div>

          {/* Top Primary Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {hasProgress && (
              <button
                onClick={handleResume}
                data-tour="walkthrough-resume"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F5C63] hover:bg-[#0A3E43] text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Resume Tour ({totalCompleted}/10)</span>
              </button>
            )}

            <button
              onClick={() => startTour('ch0_big_picture', 0)}
              data-tour="walkthrough-start-all"
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer ${
                hasProgress
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                  : 'bg-[#0F5C63] hover:bg-[#0A3E43] text-white'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Start from beginning</span>
            </button>

            {hasProgress && (
              <button
                onClick={restartTour}
                data-tour="walkthrough-restart"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                title="Reset completion progress"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* 1. PLATFORM MAP DIAGRAM (Inline SVG, Zero External Assets) */}
        <section
          data-tour="walkthrough-map"
          className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#14212B] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#0F5C63]" />
                <span>UrjaSetu Platform Connection Architecture</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                How specialized planning modules feed into the municipal decision workflow
              </p>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
              Scientific Pipeline
            </span>
          </div>

          {/* SVG Map Architecture Diagram */}
          <div className="overflow-x-auto py-2">
            <svg
              viewBox="0 0 960 220"
              className="w-full min-w-[760px] h-auto select-none"
              aria-label="Platform Architecture Diagram"
            >
              <defs>
                <marker
                  id="flow-arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#94A3B8" />
                </marker>
                <filter id="soft-shadow" x="-5%" y="-5%" width="110%" height="115%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.06" />
                </filter>
              </defs>

              {/* Connecting Connector Lines */}
              <path
                d="M 190 110 L 260 60"
                stroke="#CBD5E1"
                strokeWidth="2"
                strokeDasharray="4 4"
                markerEnd="url(#flow-arrow)"
              />
              <path
                d="M 190 110 L 260 110"
                stroke="#0F5C63"
                strokeWidth="2.5"
                markerEnd="url(#flow-arrow)"
              />
              <path
                d="M 190 110 L 260 160"
                stroke="#CBD5E1"
                strokeWidth="2"
                strokeDasharray="4 4"
                markerEnd="url(#flow-arrow)"
              />

              <path
                d="M 430 60 L 500 110"
                stroke="#CBD5E1"
                strokeWidth="2"
                strokeDasharray="4 4"
                markerEnd="url(#flow-arrow)"
              />
              <path
                d="M 430 110 L 500 110"
                stroke="#0F5C63"
                strokeWidth="2.5"
                markerEnd="url(#flow-arrow)"
              />
              <path
                d="M 430 160 L 500 110"
                stroke="#CBD5E1"
                strokeWidth="2"
                strokeDasharray="4 4"
                markerEnd="url(#flow-arrow)"
              />

              <path
                d="M 670 110 L 740 110"
                stroke="#0F5C63"
                strokeWidth="2.5"
                markerEnd="url(#flow-arrow)"
              />

              {/* Node 1: SATELLITE RASTER INPUTS */}
              <g transform="translate(20, 75)" filter="url(#soft-shadow)">
                <rect width="170" height="70" rx="10" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1.5" />
                <circle cx="28" cy="35" r="14" fill="#0F5C63" />
                <path d="M 23 35 L 33 35 M 28 30 L 28 40" stroke="white" strokeWidth="2" />
                <text x="50" y="30" fontSize="11" fontWeight="700" fill="#14212B">Satellite Radiometry</text>
                <text x="50" y="46" fontSize="9.5" fill="#64748B">Landsat 9 + Sentinel-2</text>
                <text x="50" y="58" fontSize="8.5" fill="#0F5C63" fontWeight="600">Measured 250m Grid</text>
              </g>

              {/* Node 2A: Green Loss Watch */}
              <g transform="translate(260, 25)" filter="url(#soft-shadow)">
                <rect width="170" height="60" rx="8" fill="white" stroke="#E2E8F0" strokeWidth="1.5" />
                <text x="14" y="26" fontSize="11" fontWeight="700" fill="#047857">Green Loss Watch</text>
                <text x="14" y="42" fontSize="9.5" fill="#64748B">Multi-year vegetation loss</text>
              </g>

              {/* Node 2B: Heat Intelligence Planner (MAIN ENGINE) */}
              <g transform="translate(260, 80)" filter="url(#soft-shadow)">
                <rect width="170" height="70" rx="10" fill="#0F5C63" stroke="#0A3E43" strokeWidth="2" />
                <text x="16" y="28" fontSize="12" fontWeight="800" fill="white">Heat Planner (Main)</text>
                <text x="16" y="44" fontSize="9.5" fill="#E2E8F0">Greedy Knapsack Optimizer</text>
                <text x="16" y="58" fontSize="8.5" fill="#FCD34D" fontWeight="700">30-Seed Bootstrap</text>
              </g>

              {/* Node 2C: Solar & Shadow Simulator */}
              <g transform="translate(260, 155)" filter="url(#soft-shadow)">
                <rect width="170" height="55" rx="8" fill="white" stroke="#E2E8F0" strokeWidth="1.5" />
                <text x="14" y="24" fontSize="11" fontWeight="700" fill="#B45309">Solar Heat Penalty</text>
                <text x="14" y="40" fontSize="9.5" fill="#64748B">SCADA empirical gamma</text>
              </g>

              {/* Node 3: Intervention Scenarios & Upgrades */}
              <g transform="translate(500, 75)" filter="url(#soft-shadow)">
                <rect width="170" height="70" rx="10" fill="white" stroke="#0F5C63" strokeWidth="1.5" />
                <text x="16" y="28" fontSize="11.5" fontWeight="700" fill="#14212B">Climate Interventions</text>
                <text x="16" y="44" fontSize="9.5" fill="#64748B">Greening vs Cool Roofs</text>
                <text x="16" y="58" fontSize="8.5" fill="#0F5C63" fontWeight="600">Infrastructure Resilience</text>
              </g>

              {/* Node 4: Municipal Plans & Method Card */}
              <g transform="translate(740, 75)" filter="url(#soft-shadow)">
                <rect width="170" height="70" rx="10" fill="#F0FDF4" stroke="#86EFAC" strokeWidth="1.5" />
                <text x="16" y="28" fontSize="11.5" fontWeight="700" fill="#166534">Municipal Plan Portfolio</text>
                <text x="16" y="44" fontSize="9.5" fill="#15803D">Auditable Version Snapshots</text>
                <text x="16" y="58" fontSize="8.5" fill="#166534" fontWeight="600">Method Validation Gate</text>
              </g>
            </svg>
          </div>

          <div
            data-tour="walkthrough-flow"
            className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs text-slate-600"
          >
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#0F5C63] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                1
              </span>
              <div>
                <span className="font-bold text-slate-800 block">Screening &amp; Baselines</span>
                <span>Evaluate satellite surface temperature and population exposure in Heat Planner.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#0F5C63] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                2
              </span>
              <div>
                <span className="font-bold text-slate-800 block">Constrained Optimization</span>
                <span>Set municipal budget hectares to generate a counterfactual cooling allocation.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#0F5C63] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                3
              </span>
              <div>
                <span className="font-bold text-slate-800 block">Dossiers &amp; Portfolio</span>
                <span>Inspect cell evidence, verify validation gates, and export auditable municipal plans.</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. CHAPTER CARDS GRID */}
        <section data-tour="walkthrough-chapters" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-[#14212B]">
                Walkthrough Chapters
              </h2>
              <p className="text-xs text-slate-500">
                Play sequentially or launch any chapter directly to tour a specific tool
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600">
              {totalCompleted} of 10 completed
            </span>
          </div>

          <div data-tour="walkthrough-tools" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CHAPTERS.map((chap) => {
              const isCompleted = completedSet.has(chap.id);
              const estMinutes = Math.max(1, Math.round((chap.steps.length * 20) / 60));

              return (
                <div
                  key={chap.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 ${
                    isCompleted
                      ? 'bg-white border-emerald-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#0F5C63] uppercase tracking-wider">
                        Chapter {chap.number}
                      </span>
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Completed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>about {estMinutes} min</span>
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-[#14212B]">
                        {chap.title}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {chap.subtitle}
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-1">
                      <span>{chap.steps.length} guided steps</span>
                      <span>·</span>
                      <span className="font-mono text-slate-400">{chap.route}</span>
                    </div>
                  </div>

                  <div className="pt-5 border-t border-slate-100 flex items-center justify-between gap-2 mt-4">
                    <AppLink
                      to={chap.route}
                      className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      Visit page
                    </AppLink>

                    <button
                      onClick={() => startTour(chap.id, 0)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        isCompleted
                          ? 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                          : 'bg-[#0F5C63] hover:bg-[#0A3E43] text-white shadow-xs'
                      }`}
                    >
                      <span>{isCompleted ? 'Review Chapter' : 'Start Chapter'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. FINAL RECAP & CALL TO ACTION */}
        <section
          data-tour="walkthrough-limits"
          className="rounded-2xl bg-gradient-to-br from-slate-900 to-[#14212B] text-white p-8 sm:p-10 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/10 text-emerald-300 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Evidence-Backed Civic Planning</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ready to create your first municipal cooling plan?
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Open the Heat Intelligence Planner to set budget hectares, inspect unbuilt zones, and generate an auditable cooling allocation.
            </p>
          </div>

          <AppLink
            to="/heat-planner"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0F5C63] hover:bg-[#0A3E43] text-white text-sm font-bold shadow-md transition-all whitespace-nowrap shrink-0"
          >
            <span>Open Heat Planner</span>
            <ArrowRight className="w-4 h-4" />
          </AppLink>
        </section>
      </main>
    </AppLayout>
  );
}

export default function WalkthroughHubPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-slate-500">Loading walkthrough...</div>}>
      <WalkthroughHubContent />
    </React.Suspense>
  );
}
