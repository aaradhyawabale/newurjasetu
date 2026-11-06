"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Compass, X, ArrowRight } from 'lucide-react';
import { AppLink } from '@/lib/nav';
import { useTour } from './TourProvider';

const BANNER_STORAGE_KEY = 'urjasetu_first_visit_banner_dismissed';

export const FirstVisitBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const { startTour, state } = useTour();

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(BANNER_STORAGE_KEY);
      if (!dismissed) {
        setVisible(true);
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(BANNER_STORAGE_KEY, 'true');
    } catch {
      // Ignore
    }
  };

  const handleStart = () => {
    handleDismiss();
    startTour('ch0_big_picture', 0);
  };

  // Do not show while tour is currently active or if dismissed
  if (!visible || state.isRunning) {
    return null;
  }

  return (
    <div
      data-tour="first-visit-banner"
      role="region"
      aria-label="Welcome walkthrough banner"
      className="bg-[#0F5C63] text-white text-xs px-4 py-2.5 shadow-md flex items-center justify-between gap-3 border-b border-[#0A3E43] relative z-20"
    >
      <div className="flex items-center gap-2.5 max-w-[1440px] mx-auto w-full justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-amber-300 shrink-0" />
          <span className="font-medium text-slate-100">
            <span className="font-bold text-white">New to UrjaSetu?</span> Take an interactive walkthrough of Pune&apos;s heat intelligence platform.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleStart}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white text-[#0F5C63] font-bold hover:bg-slate-100 transition-colors cursor-pointer text-[11px]"
          >
            <span>Start Walkthrough</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          <AppLink
            to="/walkthrough"
            className="hidden sm:inline-flex px-2 py-1 text-slate-200 hover:text-white transition-colors text-[11px]"
          >
            Platform Hub
          </AppLink>

          <button
            onClick={handleDismiss}
            className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1"
            aria-label="Dismiss welcome banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
