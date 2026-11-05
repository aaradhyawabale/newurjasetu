"use client";

import React, { useState, useEffect } from 'react';
import { SiteHeader, SiteFooter, DemoBanner } from '@/components/layout/SiteLayout';
import { isDemoMode } from '@/api/client';

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

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF7] text-[#14212B]">
      {showDemo && <DemoBanner />}
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
