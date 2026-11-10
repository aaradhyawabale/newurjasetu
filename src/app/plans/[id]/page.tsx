"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Municipal Plan Detail & Audit View: /plans/[id]
 * Read-only shareable view of plan version snapshots, hand-off events, and JSON/PDF exports.
 */

import React, { useState, useEffect } from 'react';
import { ToolPageHeader } from '../../../components/ui/ToolPageHeader';
import { TruthChip } from '../../../components/ui/TruthChip';
import { Button } from '../../../components/ui/Button';
import { Skeleton, ErrorState } from '../../../components/ui/FeedbackStates';
import { usePlan } from '../../../context/PlanContext';
import {
  FileText,
  Download,
  Share2,
  Calendar,
  Send,
  Layers,
  TreeDeciduous,
  Sun,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  Mail,
  Copy,
  Check,
} from 'lucide-react';
import Link from 'next/link';

interface PlanDetailProps {
  params: { id: string };
}

export default function PlanDetailPage({ params }: PlanDetailProps) {
  const { loadPlan, openDrawer } = usePlan();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    async function fetchPlan() {
      setLoading(true);
      try {
        const res = await fetch(`/api/plans/${params.id}`);
        if (res.ok) {
          const json = await res.json();
          setPlan(json.data);
        } else {
          setError('Municipal plan not found or has been archived.');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load plan details.');
      } finally {
        setLoading(false);
      }
    }
    fetchPlan();
  }, [params.id]);

  const handleExportJson = () => {
    if (!plan) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(plan, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${plan.title.replace(/\s+/g, '_')}_Snapshot.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyShareLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loading) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  if (error || !plan) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <ErrorState
          title="Plan Not Found"
          message={error || 'This municipal plan does not exist.'}
          onRetry={() => window.location.assign('/plans')}
        />
      </main>
    );
  }

  const sections = typeof plan.sections === 'string' ? JSON.parse(plan.sections || '{}') : plan.sections || {};
  const inputs = typeof plan.inputsSnapshot === 'string' ? JSON.parse(plan.inputsSnapshot || '{}') : plan.inputsSnapshot || {};
  const outputs = typeof plan.outputsSnapshot === 'string' ? JSON.parse(plan.outputsSnapshot || '{}') : plan.outputsSnapshot || {};

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/plans"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Plans Portfolio
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyShareLink}
            icon={copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            className="bg-white text-xs"
          >
            {copiedLink ? 'Link Copied' : 'Share Plan Link'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            icon={<Download className="w-3.5 h-3.5" />}
            className="bg-white text-xs"
          >
            Export JSON
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={async () => {
              await loadPlan(plan.id);
              openDrawer();
            }}
            className="text-xs"
          >
            Load into Active Workspace
          </Button>
        </div>
      </div>

      {/* Plan Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                  plan.status === 'Forwarded'
                    ? 'bg-purple-100 text-purple-800'
                    : plan.status === 'Saved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {plan.status}
              </span>
              <TruthChip type="Modelled" label="Certified AI Ensemble" compact />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{plan.title}</h1>
            <p className="text-xs text-slate-500 font-mono">Plan ID: {plan.id}</p>
          </div>

          <div className="text-xs text-slate-500 space-y-1 font-mono text-right sm:text-left md:text-right">
            <div>Created: {new Date(plan.createdAt).toLocaleString('en-IN')}</div>
            <div>Updated: {new Date(plan.updatedAt).toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Inputs & Parameters Snapshot Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block text-[11px] font-medium">Greening Budget</span>
            <span className="text-lg font-bold font-mono text-slate-800">{inputs.budgetHa || 25} ha</span>
            <span className="text-[10px] text-slate-400 block">Municipal constraint [Assumed]</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block text-[11px] font-medium">Target NDVI</span>
            <span className="text-lg font-bold font-mono text-emerald-800">{inputs.targetNdvi || 0.5} NDVI</span>
            <span className="text-[10px] text-slate-400 block">Target vegetation index</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block text-[11px] font-medium">Geographic Scope</span>
            <span className="text-lg font-bold font-mono text-slate-800 truncate block">
              {inputs.ward || 'All Wards'}
            </span>
            <span className="text-[10px] text-slate-400 block">Municipal ward boundary</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block text-[11px] font-medium">Priority Zones</span>
            <span className="text-lg font-bold font-mono text-[#0F5C63]">
              {sections.zones?.length || 0} parcels
            </span>
            <span className="text-[10px] text-slate-400 block">Optimized portfolio [Modelled]</span>
          </div>
        </div>
      </div>

      {/* Plan Sections Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Section Items (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section: Priority Zones */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0F5C63]" />
                Selected Priority Zones ({sections.zones?.length || 0})
              </h2>
              <TruthChip type="Modelled" compact />
            </div>

            {!sections.zones || sections.zones.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No priority zones selected in this snapshot.</p>
            ) : (
              <div className="space-y-2">
                {sections.zones.map((zone: any, idx: number) => (
                  <div
                    key={zone.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block text-sm">
                        #{idx + 1} {zone.title}
                      </span>
                      {zone.subtitle && (
                        <span className="text-slate-500 text-[11px] block mt-0.5">{zone.subtitle}</span>
                      )}
                    </div>
                    <span className="px-2 py-1 bg-white border border-slate-200 rounded-md font-mono font-semibold text-slate-700">
                      {zone.id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Interventions Packages */}
          {sections.interventions && sections.interventions.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TreeDeciduous className="w-4 h-4 text-emerald-600" />
                  Civic Interventions ({sections.interventions.length})
                </h2>
                <TruthChip type="Assumed" compact />
              </div>

              <div className="space-y-2">
                {sections.interventions.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">{item.title}</span>
                      {item.subtitle && <span className="text-slate-500 block">{item.subtitle}</span>}
                    </div>
                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono text-[11px]">
                      {item.id}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Planning Notes */}
          {plan.notes && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Planning Notes &amp; Council Directives
              </h3>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{plan.notes}</p>
            </div>
          )}
        </div>

        {/* Right: History & Version Audit Log (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Departmental Hand-Off Events */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-purple-600" />
              Departmental Hand-Off History
            </h3>

            {!plan.events || plan.events.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hand-off events recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {plan.events.map((evt: any) => (
                  <div key={evt.id} className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold text-purple-900">
                      <span>{evt.eventType}</span>
                      <span className="font-mono text-[10px] text-purple-600">
                        {new Date(evt.timestamp).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    {evt.recipient && (
                      <p className="text-slate-700">
                        Recipient: <strong>{evt.recipient}</strong>
                      </p>
                    )}
                    {evt.notes && <p className="text-slate-600 italic mt-1 text-[11px]">&ldquo;{evt.notes}&rdquo;</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Immutable Versions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Immutable Versions ({plan.versions?.length || 0})
            </h3>

            {!plan.versions || plan.versions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No saved versions for this plan.</p>
            ) : (
              <div className="space-y-2">
                {plan.versions.map((ver: any) => (
                  <div key={ver.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-0.5">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>
                        v{ver.versionNumber}: {ver.versionName}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {new Date(ver.createdAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
