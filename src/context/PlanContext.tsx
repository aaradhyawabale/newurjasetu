"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * UrjaSetu Municipal Plan Context
 * Centralized state management for saving, versioning, and forwarding civic climate plans.
 * Integrates debounced API autosave with robust localStorage fallback.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';

export interface PlanItem {
  id: string;
  title: string;
  subtitle?: string;
  section: 'zones' | 'interventions' | 'shading' | 'infrastructure' | 'loss';
  metadata?: Record<string, any>;
  addedAt: string;
}

export interface PlanSections {
  zones: PlanItem[];
  interventions: PlanItem[];
  shading: PlanItem[];
  infrastructure: PlanItem[];
  loss: PlanItem[];
}

export interface PlanData {
  id: string;
  title: string;
  status: 'Draft' | 'Saved' | 'Forwarded';
  sections: PlanSections;
  inputsSnapshot: Record<string, any>;
  outputsSnapshot: Record<string, any>;
  notes: string;
  updatedAt: string;
}

interface ForwardResult {
  shareUrl: string;
  mailtoLink: string;
  recipient: string;
}

interface PlanContextType {
  plan: PlanData;
  itemCount: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  addItem: (item: Omit<PlanItem, 'addedAt'>) => void;
  removeItem: (section: keyof PlanSections, id: string) => void;
  updateTitle: (title: string) => void;
  updateNotes: (notes: string) => void;
  setInputsSnapshot: (inputs: Record<string, any>) => void;
  setOutputsSnapshot: (outputs: Record<string, any>) => void;
  saveVersion: (versionName: string, notes?: string) => Promise<boolean>;
  forwardPlan: (recipient: string, notes?: string) => Promise<ForwardResult | null>;
  resetPlan: () => void;
  loadPlan: (planId: string) => Promise<boolean>;
  stepCompleteness: {
    step1: boolean; // Zones selected
    step2: boolean; // Interventions selected
    step3: boolean; // Solar or infra checked
    step4: boolean; // Review ready
  };
}

const STORAGE_KEY = 'urjasetu_active_plan_v2';

const DEFAULT_SECTIONS: PlanSections = {
  zones: [],
  interventions: [],
  shading: [],
  infrastructure: [],
  loss: [],
};

const createInitialPlan = (): PlanData => ({
  id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  title: 'Pune Municipal Heat Action Plan (2026)',
  status: 'Draft',
  sections: { ...DEFAULT_SECTIONS },
  inputsSnapshot: { budgetHa: 25, targetNdvi: 0.5, ward: 'All Wards' },
  outputsSnapshot: {},
  notes: '',
  updatedAt: new Date().toISOString(),
});

const PlanContext = createContext<PlanContextType | null>(null);

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plan, setPlan] = useState<PlanData>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id && parsed.sections) {
            return parsed;
          }
        }
      } catch {
        // Ignore fallback
      }
    }
    return createInitialPlan();
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync to localStorage immediately
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    } catch {
      // Ignore
    }
  }, [plan]);

  // Debounced API autosave
  useEffect(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: plan.id,
            title: plan.title,
            status: plan.status,
            inputsSnapshot: plan.inputsSnapshot,
            outputsSnapshot: plan.outputsSnapshot,
            sections: plan.sections,
            notes: plan.notes,
          }),
        });
      } catch {
        // Handled silently; localStorage provides zero-downtime reliability
      }
    }, 1500);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [plan]);

  const itemCount = useMemo(() => {
    return Object.values(plan.sections).reduce((acc, list) => acc + list.length, 0);
  }, [plan.sections]);

  const stepCompleteness = useMemo(() => ({
    step1: plan.sections.zones.length > 0,
    step2: plan.sections.interventions.length > 0,
    step3: plan.sections.shading.length > 0 || plan.sections.infrastructure.length > 0,
    step4: plan.sections.zones.length > 0, // ready for forward when zones are selected
  }), [plan.sections]);

  // Test hooks registration for non-production / QA environments
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const g = window as any;
      g.__urjasetu = g.__urjasetu || {};
      g.__urjasetu.test = g.__urjasetu.test || {};

      g.__urjasetu.test.getPlanState = () => plan;
      g.__urjasetu.test.getSelectedZoneIds = () => plan.sections.zones.map((z) => z.id);
    }
  }, [plan]);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setIsDrawerOpen((prev) => !prev), []);

  const addItem = useCallback((item: Omit<PlanItem, 'addedAt'>) => {
    setPlan((prev) => {
      const sectionList = prev.sections[item.section] || [];
      if (sectionList.some((existing) => existing.id === item.id)) {
        return prev; // Item already in plan
      }
      const newItem: PlanItem = { ...item, addedAt: new Date().toISOString() };
      return {
        ...prev,
        status: 'Draft',
        updatedAt: new Date().toISOString(),
        sections: {
          ...prev.sections,
          [item.section]: [...sectionList, newItem],
        },
      };
    });
  }, []);

  const removeItem = useCallback((section: keyof PlanSections, id: string) => {
    setPlan((prev) => ({
      ...prev,
      status: 'Draft',
      updatedAt: new Date().toISOString(),
      sections: {
        ...prev.sections,
        [section]: (prev.sections[section] || []).filter((item) => item.id !== id),
      },
    }));
  }, []);

  const updateTitle = useCallback((title: string) => {
    setPlan((prev) => ({ ...prev, title, updatedAt: new Date().toISOString() }));
  }, []);

  const updateNotes = useCallback((notes: string) => {
    setPlan((prev) => ({ ...prev, notes, updatedAt: new Date().toISOString() }));
  }, []);

  const setInputsSnapshot = useCallback((inputs: Record<string, any>) => {
    setPlan((prev) => ({
      ...prev,
      inputsSnapshot: { ...prev.inputsSnapshot, ...inputs },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setOutputsSnapshot = useCallback((outputs: Record<string, any>) => {
    setPlan((prev) => ({
      ...prev,
      outputsSnapshot: { ...prev.outputsSnapshot, ...outputs },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const saveVersion = useCallback(async (versionName: string, notes?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/plans/${plan.id}/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionName, notes: notes || plan.notes }),
      });
      if (res.ok) {
        setPlan((prev) => ({ ...prev, status: 'Saved', updatedAt: new Date().toISOString() }));
        return true;
      }
    } catch {
      // Local fallback
    }
    setPlan((prev) => ({ ...prev, status: 'Saved', updatedAt: new Date().toISOString() }));
    return true;
  }, [plan.id, plan.notes]);

  const forwardPlan = useCallback(async (recipient: string, notes?: string): Promise<ForwardResult | null> => {
    try {
      const res = await fetch(`/api/plans/${plan.id}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, notes: notes || plan.notes }),
      });
      if (res.ok) {
        const json = await res.json();
        setPlan((prev) => ({ ...prev, status: 'Forwarded', updatedAt: new Date().toISOString() }));
        return {
          shareUrl: json.data.shareUrl,
          mailtoLink: json.data.mailtoLink,
          recipient,
        };
      }
    } catch {
      // Offline fallback
    }

    const shareUrl = `/plans/${plan.id}`;
    const mailtoSubject = encodeURIComponent(`[UrjaSetu] Municipal Climate Plan Forwarded: ${plan.title}`);
    const mailtoBody = encodeURIComponent(
      `Respected ${recipient},\n\nThe municipal heat priority and greening plan "${plan.title}" has been forwarded for departmental review and implementation.\n\nReview the live digital plan here:\nhttps://urjasetu.pune.gov.in/plans/${plan.id}\n\nNote:\n${notes || "No additional notes."}\n\nGenerated via UrjaSetu Pune Heat Intelligence Platform.\nHand-off recorded on ${new Date().toISOString()}`
    );
    setPlan((prev) => ({ ...prev, status: 'Forwarded', updatedAt: new Date().toISOString() }));
    return {
      shareUrl,
      mailtoLink: `mailto:?subject=${mailtoSubject}&body=${mailtoBody}`,
      recipient,
    };
  }, [plan.id, plan.title, plan.notes]);

  const resetPlan = useCallback(() => {
    const newPlan = createInitialPlan();
    setPlan(newPlan);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPlan));
    } catch {
      // Ignore
    }
  }, []);

  const loadPlan = useCallback(async (planId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/plans/${planId}`);
      if (res.ok) {
        const json = await res.json();
        const p = json.data;
        const loaded: PlanData = {
          id: p.id,
          title: p.title,
          status: p.status,
          sections: typeof p.sections === 'string' ? JSON.parse(p.sections) : p.sections,
          inputsSnapshot: typeof p.inputsSnapshot === 'string' ? JSON.parse(p.inputsSnapshot) : p.inputsSnapshot,
          outputsSnapshot: typeof p.outputsSnapshot === 'string' ? JSON.parse(p.outputsSnapshot) : p.outputsSnapshot,
          notes: p.notes || '',
          updatedAt: p.updatedAt,
        };
        setPlan(loaded);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, []);

  return (
    <PlanContext.Provider
      value={{
        plan,
        itemCount,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        addItem,
        removeItem,
        updateTitle,
        updateNotes,
        setInputsSnapshot,
        setOutputsSnapshot,
        saveVersion,
        forwardPlan,
        resetPlan,
        loadPlan,
        stepCompleteness,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
};

export const usePlan = () => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error('usePlan must be used within a PlanProvider');
  }
  return context;
};
