"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppLink, useAppLocation } from '@/lib/nav';
import {
  Flame,
  ChevronDown,
  Menu,
  X,
  Compass,
  TreeDeciduous,
  GitCompare,
  Building2,
  Sun,
  BookOpen,
} from 'lucide-react';

export const SiteHeader: React.FC = () => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useAppLocation();

  const isCurrent = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-30 bg-[#FAFAF7]/95 backdrop-blur-md border-b border-[#E5E7EB]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark with icon */}
        <AppLink
          to="/"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#14212B] hover:text-[#0F5C63] transition-colors whitespace-nowrap shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-[#0F5C63] text-white flex items-center justify-center font-bold">
            <Flame className="w-4 h-4 text-amber-300" />
          </div>
          <span className="font-display font-extrabold tracking-tight">UrjaSetu</span>
          <span className="text-xs font-normal text-slate-500 hidden sm:inline">
            · Pune Climate AI
          </span>
        </AppLink>

        {/* Zone 2: 4-5 concise single-line text navigation links */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <AppLink
            to="/heat-planner"
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              isCurrent('/heat-planner')
                ? 'text-[#0F5C63] font-semibold border-b-2 border-[#0F5C63]'
                : 'hover:text-[#14212B]'
            }`}
          >
            Heat Planner
          </AppLink>

          {/* Tools Menu Grouped */}
          <div
            className="relative"
            onMouseEnter={() => setToolsOpen(true)}
            onMouseLeave={() => setToolsOpen(false)}
          >
            {(() => {
              const isToolsActive =
                isCurrent('/green-loss') ||
                isCurrent('/interventions') ||
                isCurrent('/green-cover') ||
                isCurrent('/infrastructure') ||
                isCurrent('/solar');
              return (
                <button
                  onClick={() => setToolsOpen(!toolsOpen)}
                  className={`inline-flex items-center gap-1.5 py-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isToolsActive
                      ? 'text-[#0F5C63] font-semibold border-b-2 border-[#0F5C63]'
                      : 'text-slate-600 hover:text-[#14212B]'
                  }`}
                  aria-expanded={toolsOpen}
                  aria-haspopup="true"
                >
                  <span>Climate Tools</span>
                  <ChevronDown className={`w-3.5 h-3.5 ${isToolsActive ? 'text-[#0F5C63]' : 'text-slate-400'}`} />
                </button>
              );
            })()}

            {toolsOpen && (
              <div
                className="absolute top-full left-0 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-3 px-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                role="menu"
              >
                <div className="px-3 py-1 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Main Planning Engine
                  </span>
                </div>
                <AppLink
                  to="/heat-planner"
                  onClick={() => setToolsOpen(false)}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-[#0F5C63] transition-colors"
                  role="menuitem"
                >
                  <Compass className="w-4 h-4 text-[#0F5C63] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold block text-[#14212B]">
                      Heat Intelligence Planner
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Budget-constrained cooling allocation
                    </span>
                  </div>
                </AppLink>

                <div className="my-2 border-t border-slate-100" />

                <div className="px-3 py-1 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Supporting Climate Tools
                  </span>
                </div>

                <AppLink
                  to="/green-loss"
                  onClick={() => setToolsOpen(false)}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-[#0F5C63] transition-colors"
                  role="menuitem"
                >
                  <TreeDeciduous className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold block text-[#14212B]">
                      Green Loss Watch
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Historical canopy depletion tracking
                    </span>
                  </div>
                </AppLink>

                <AppLink
                  to="/interventions"
                  onClick={() => setToolsOpen(false)}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-[#0F5C63] transition-colors"
                  role="menuitem"
                >
                  <GitCompare className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold block text-[#14212B]">
                      Intervention Scenarios
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Greening vs cool roof vs shade
                    </span>
                  </div>
                </AppLink>

                <AppLink
                  to="/green-cover"
                  onClick={() => setToolsOpen(false)}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-[#0F5C63] transition-colors"
                  role="menuitem"
                >
                  <TreeDeciduous className="w-4 h-4 text-[#0F5C63] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold block text-[#14212B]">
                      Green Cover Plan
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Corridors and park upgrades
                    </span>
                  </div>
                </AppLink>

                <AppLink
                  to="/infrastructure"
                  onClick={() => setToolsOpen(false)}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-[#0F5C63] transition-colors"
                  role="menuitem"
                >
                  <Building2 className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold block text-[#14212B]">
                      Infrastructure Upgrades
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Hospital & transit heat resilience
                    </span>
                  </div>
                </AppLink>

                <AppLink
                  to="/solar"
                  onClick={() => setToolsOpen(false)}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-[#0F5C63] transition-colors"
                  role="menuitem"
                >
                  <Sun className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold block text-[#14212B]">
                      Solar & Shadow Simulator
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Suncalc geometric shadow & thermal penalty
                    </span>
                  </div>
                </AppLink>
              </div>
            )}
          </div>

          <AppLink
            to="/method"
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              isCurrent('/method')
                ? 'text-[#0F5C63] font-semibold border-b-2 border-[#0F5C63]'
                : 'hover:text-[#14212B]'
            }`}
          >
            Method & Model Card
          </AppLink>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {isCurrent('/heat-planner') ? (
            <AppLink
              to="/method"
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#0F5C63] bg-[#0F5C63]/10 hover:bg-[#0F5C63]/20 border border-[#0F5C63]/30 rounded-xl transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63]"
            >
              Method & Model Card
            </AppLink>
          ) : (
            <AppLink
              to="/heat-planner"
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0F5C63] hover:bg-[#0A3E43] rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63]"
            >
              Open Heat Planner
            </AppLink>
          )}

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-[#14212B] rounded-lg"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
          <div className="font-semibold text-xs text-slate-400 uppercase tracking-wider">
            Navigation
          </div>
          <div className="space-y-1">
            <AppLink
              to="/heat-planner"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Heat Planner (Main Tool)
            </AppLink>
            <AppLink
              to="/green-loss"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Green Loss Watch
            </AppLink>
            <AppLink
              to="/interventions"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Intervention Scenarios
            </AppLink>
            <AppLink
              to="/green-cover"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Green Cover Plan
            </AppLink>
            <AppLink
              to="/infrastructure"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Infrastructure Upgrades
            </AppLink>
            <AppLink
              to="/solar"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Solar &amp; Shadow Simulator
            </AppLink>
            <AppLink
              to="/method"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Method &amp; Model Card
            </AppLink>
          </div>
        </div>
      )}
    </header>
  );
};

export const SiteFooter: React.FC = () => {
  return (
    <footer className="border-t border-[#E5E7EB] bg-white pt-8 pb-24 sm:pb-20 text-xs text-slate-500">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-medium text-[#14212B]">
            UrjaSetu · Pune Heat Intelligence &amp; Climate Action Platform
          </p>
          <p className="mt-1 text-slate-500">
            Built for the Indradhanu - PCCOE International Grand Challenge 2026 - AI for Climate Change (SDG 13).
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 sm:gap-6">
          <AppLink to="/method" className="hover:text-[#0F5C63] transition-colors">
            Method &amp; Validation Gate
          </AppLink>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span>Surface temperature is not air temperature</span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <AppLink to="/heat-planner" className="hover:text-[#0F5C63] font-semibold transition-colors">
            Heat Planner
          </AppLink>
        </div>
      </div>
    </footer>
  );
};

export const DemoBanner: React.FC = () => {
  return (
    <div
      role="banner"
      className="bg-[#14212B] text-slate-300 text-[11px] py-1.5 px-4 text-center border-b border-slate-800 flex items-center justify-center gap-2"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
      <span className="font-semibold tracking-wide text-white">DEMO DATA</span>
      <span>— not real measurements. Generated for Grand Challenge evaluation.</span>
      <AppLink
        to="/method"
        className="underline text-amber-300 hover:text-amber-200 ml-1 font-medium"
      >
        Read Method Card
      </AppLink>
    </div>
  );
};
