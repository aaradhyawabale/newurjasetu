"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Municipal Plans Portfolio: /plans
 * List, filter, duplicate, compare, and manage municipal climate action plans.
 */

import React, { useState, useEffect } from 'react';
import { ToolPageHeader } from '@/components/ui/ToolPageHeader';
import { TruthChip } from '@/components/ui/TruthChip';
import { Button } from '@/components/ui/Button';
import { Skeleton, ErrorState } from '@/components/ui/FeedbackStates';
import { usePlan } from '@/context/PlanContext';
import {
  FileText,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Layers,
  Send,
  Calendar,
  Filter,
  Download,
  GitCompare,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

interface PlanSummary {
  id: string;
  title: string;
  status: 'Draft' | 'Saved' | 'Forwarded';
  inputsSnapshot: string | Record<string, any>;
  outputsSnapshot: string | Record<string, any>;
  sections: string | Record<string, any>;
  notes: string;
  createdAt: string;
  updatedAt: string;
  versions?: Array<{ id: string; versionNumber: number; versionName: string; createdAt: string }>;
  events?: Array<{ id: string; eventType: string; recipient?: string; timestamp: string }>;
}

function PlansPageContent() {
  const { plan: activePlan, loadPlan, resetPlan, openDrawer } = usePlan();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Saved' | 'Forwarded'>('All');
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plans');
      if (res.ok) {
        const json = await res.json();
        setPlans(json.data || []);
      } else {
        // Fallback to local active plan if API route returns empty or error
        setPlans([activePlan as any]);
      }
    } catch {
      // Local fallback
      setPlans([activePlan as any]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [activePlan]);

  const handleDeletePlan = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this municipal plan?')) return;
    try {
      await fetch(`/api/plans/${id}`, { method: 'DELETE' });
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setPlans((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleDuplicatePlan = async (planToDup: PlanSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newPlan = {
        title: `${planToDup.title} (Copy)`,
        status: 'Draft',
        inputsSnapshot: planToDup.inputsSnapshot,
        outputsSnapshot: planToDup.outputsSnapshot,
        sections: planToDup.sections,
        notes: planToDup.notes,
      };
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlan),
      });
      if (res.ok) {
        fetchPlans();
      }
    } catch {
      // ignore
    }
  };

  const handleExportJson = (p: PlanSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(p, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${p.title.replace(/\s+/g, '_')}_Plan.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredPlans = plans.filter((p) => {
    if (statusFilter === 'All') return true;
    return p.status === statusFilter;
  });

  const toggleSelectPlan = (id: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setSelectedPlanIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <ToolPageHeader
        title="Municipal Climate Plans Portfolio"
        purpose="Review, version, compare, and forward city-wide heat priority and capital expenditure action plans across Pune Municipal Corporation departments."
        steps={[
          'Filter through active drafts, saved council snapshots, and forwarded departmental hand-offs.',
          'Open any plan into the live Heat Planner workspace or inspect read-only versions.',
          'Export municipal JSON and PDF packages, or forward plans to ward officers.',
        ]}
        dataUsed={[
          { label: 'PMC Priority Cells Allocation', type: 'Modelled' },
          { label: 'Council Greening Targets', type: 'Assumed' },
          { label: 'Official Inter-Agency Hand-offs', type: 'Measured' },
        ]}
        breadcrumbItems={[{ label: 'Plans Portfolio' }]}
        actions={
          <div className="flex items-center gap-2">
            <div data-tour="plans-save-version">
              <Button
                variant="outline"
                size="sm"
                onClick={openDrawer}
                className="bg-white text-xs"
              >
                Open Plan Drawer
              </Button>
            </div>
            <div data-tour="plans-forward">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  resetPlan();
                  openDrawer();
                }}
                icon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Create New Plan
              </Button>
            </div>
          </div>
        }
      />

      {/* Filter and Selection Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter Status:</span>
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
            {(['All', 'Draft', 'Saved', 'Forwarded'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-[#14212B] shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Compare count */}
        {selectedPlanIds.length >= 2 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">
              {selectedPlanIds.length} plans selected
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                alert(`Comparing plans: ${selectedPlanIds.join(', ')}`);
              }}
              icon={<GitCompare className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Compare Portfolios
            </Button>
          </div>
        )}
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No plans found in this filter</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create a new municipal heat plan from the Heat Planner or click &ldquo;Create New Plan&rdquo;.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetPlan();
              openDrawer();
            }}
          >
            Create New Plan
          </Button>
        </div>
      ) : (
        <div data-tour="plans-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
          {filteredPlans.map((p) => {
            const sections = typeof p.sections === 'string' ? JSON.parse(p.sections || '{}') : p.sections || {};
            const zonesCount = sections.zones?.length || 0;
            const interventionsCount = sections.interventions?.length || 0;
            const shadingCount = (sections.shading?.length || 0) + (sections.infrastructure?.length || 0);
            const totalItems = zonesCount + interventionsCount + shadingCount;
            const isSelected = selectedPlanIds.includes(p.id);

            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
                  isSelected ? 'border-[#0F5C63] ring-2 ring-[#0F5C63]/20' : 'border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelectPlan(p.id, e)}
                        className="rounded border-slate-300 text-[#0F5C63] focus:ring-[#0F5C63] cursor-pointer"
                        aria-label={`Select plan ${p.title}`}
                      />
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          p.status === 'Forwarded'
                            ? 'bg-purple-100 text-purple-800'
                            : p.status === 'Saved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3" />
                      {new Date(p.updatedAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm hover:text-[#0F5C63] transition-colors line-clamp-1">
                      {p.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">ID: {p.id}</p>
                  </div>

                  {/* Portfolio Sections Badges */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-medium">Zones</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">{zonesCount}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-medium">Packages</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">{interventionsCount}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-medium">Solar/Infra</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">{shadingCount}</span>
                    </div>
                  </div>

                  {/* Versions & Forward Events Info */}
                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    {p.versions && p.versions.length > 0 && (
                      <span className="block">
                        • <strong>{p.versions.length}</strong> immutable version snapshots
                      </span>
                    )}
                    {p.events && p.events.length > 0 && (
                      <span className="block text-purple-700">
                        • Hand-off recorded: {p.events[0].recipient || 'Department'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDuplicatePlan(p, e)}
                      title="Duplicate Plan"
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleExportJson(p, e)}
                      title="Export JSON"
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeletePlan(p.id, e)}
                      title="Delete Plan"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <Link
                    href={`/plans/${p.id}`}
                    className="px-3 py-1.5 text-xs font-semibold text-[#0F5C63] hover:bg-[#0F5C63]/10 rounded-lg transition-colors inline-flex items-center gap-1"
                  >
                    View Plan
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Administrative Status Disclaimer */}
      <div
        data-tour="plans-limits"
        className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <div>
          <span className="font-semibold text-slate-700">Administrative Status:</span>{' '}
          Saving or forwarding plans records internal municipal drafts for inter-agency coordination. It does not constitute statutory financial expenditure authorization.
        </div>
        <Link href="/method" className="text-[#0F5C63] hover:underline font-semibold whitespace-nowrap">
          Read Method Card &rarr;
        </Link>
      </div>
    </main>
  );
}

export default function PlansPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-slate-500">Loading plans portfolio...</div>}>
      <PlansPageContent />
    </React.Suspense>
  );
}
