"use client";

import React, { useState, useEffect } from 'react';
import { SiteHeader, SiteFooter, DemoBanner } from '@/components/layout/SiteLayout';
import { isDemoMode } from '@/api/client';
import { PlanProvider } from '@/context/PlanContext';
import { PlanDrawer } from '@/components/planner/PlanDrawer';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    // Check if client is using mock fallback
    const updateDemoState = () => {
      setShowDemo(isDemoMode());
    };
    updateDemoState();
    const interval = setInterval(updateDemoState, 1500);
    return () => clearInterval(interval);
  }, []);

  // Expose window.__urjasetu.test hooks in browser environment
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const g = window as any;
      g.__urjasetu = g.__urjasetu || {};
      g.__urjasetu.test = g.__urjasetu.test || {};

      g.__urjasetu.test.getMapLayerIds = () => {
        const map = (window as any).__urjasetu_map;
        if (!map || typeof map.getStyle !== 'function') return [];
        return (map.getStyle().layers || []).map((l: any) => l.id);
      };

      g.__urjasetu.test.getMapErrors = () => {
        return (window as any).__urjasetu_map_errors || [];
      };

      if (!g.__urjasetu.test.getSelectedZoneIds) {
        g.__urjasetu.test.getSelectedZoneIds = () => [];
      }
      if (!g.__urjasetu.test.getPlanState) {
        g.__urjasetu.test.getPlanState = () => null;
      }
    }
  }, []);

  return (
    <PlanProvider>
      <div className="min-h-screen flex flex-col bg-[#FAFAF7] text-[#14212B] overflow-x-hidden">
        {showDemo && <DemoBanner />}
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <PlanDrawer />
      </div>
    </PlanProvider>
  );
}
