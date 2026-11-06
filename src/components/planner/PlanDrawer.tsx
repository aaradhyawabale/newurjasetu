"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PlanDrawer Component
 * Municipal Climate Action Plan Drawer sliding in from the right.
 * Provides 4-step workflow, item inspection, immutable version saving, and departmental forwarding.
 */

import React, { useState } from 'react';
import { usePlan, PlanSections } from '@/context/PlanContext';
import { TruthChip } from '@/components/ui/TruthChip';
import { Button } from '@/components/ui/Button';
import {
  X,
  FileText,
  Bookmark,
  Send,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Mail,
  Copy,
  Check,
  Building,
  Layers,
  Sun,
  TreeDeciduous,
} from 'lucide-react';
import Link from 'next/link';

const RECIPIENT_PRESETS = [
  'Ward Officer (Kasba / Nagar Road / Hadapsar)',
  'PMC Garden Department (Superintendent of Gardens)',
  'PMC Engineering & Civil Works Department',
  'Municipal Commissioner Office (Secretariat)',
  'Chief Sustainability & Climate Officer',
];

export const PlanDrawer: React.FC = () => {
  const {
    plan,
    isDrawerOpen,
    closeDrawer,
    removeItem,
    updateTitle,
    updateNotes,
    saveVersion,
    forwardPlan,
    resetPlan,
    stepCompleteness,
    itemCount,
  } = usePlan();

  const [activeTab, setActiveTab] = useState<'items' | 'version' | 'forward'>('items');
  const [versionName, setVersionName] = useState('');
  const [versionNotes, setVersionNotes] = useState('');
  const [recipient, setRecipient] = useState(RECIPIENT_PRESETS[0]);
  const [customRecipient, setCustomRecipient] = useState('');
  const [forwardNotes, setForwardNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forwardResult, setForwardResult] = useState<{ shareUrl: string; mailtoLink: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isDrawerOpen) return null;

  const handleSaveVersion = async () => {
    if (!versionName.trim()) return;
    setIsSubmitting(true);
    await saveVersion(versionName.trim(), versionNotes);
    setIsSubmitting(false);
    setVersionName('');
    setVersionNotes('');
    setActiveTab('items');
  };

  const handleForward = async () => {
    const finalRecipient = customRecipient.trim() || recipient;
    if (!finalRecipient) return;
    setIsSubmitting(true);
    const result = await forwardPlan(finalRecipient, forwardNotes);
    setIsSubmitting(false);
    if (result) {
      setForwardResult(result);
    }
  };

  const handleCopyLink = () => {
    if (forwardResult?.shareUrl) {
      const fullUrl = `${window.location.origin}${forwardResult.shareUrl}`;
      navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const steps = [
    {
      num: 1,
      title: 'Select Priority Zones',
      route: '/heat-planner',
      done: stepCompleteness.step1,
      items: plan.sections.zones.length,
      warning: !stepCompleteness.step1 ? 'No zones selected yet. Allocate budget in Heat Planner.' : null,
    },
    {
      num: 2,
      title: 'Choose Interventions',
      route: '/interventions',
      done: stepCompleteness.step2,
      items: plan.sections.interventions.length,
      warning: !stepCompleteness.step2 ? 'Optional: Pick cooling interventions for critical sites.' : null,
    },
    {
      num: 3,
      title: 'Check Solar & Infrastructure',
      route: '/solar',
      done: stepCompleteness.step3,
      items: plan.sections.shading.length + plan.sections.infrastructure.length,
      warning: null,
    },
    {
      num: 4,
      title: 'Review & Forward Hand-off',
      route: '/plans',
      done: stepCompleteness.step4,
      items: null,
      warning: !stepCompleteness.step4 ? 'Must complete Step 1 (Priority Zones) before forwarding.' : null,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 z-50 transform transition-transform"
        role="dialog"
        aria-label="Municipal Climate Plan Drawer"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0F5C63]" />
              <h2 className="text-base font-bold text-[#14212B]">My Municipal Plan</h2>
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[#0F5C63]/10 text-[#0F5C63]">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                  plan.status === 'Forwarded'
                    ? 'bg-purple-100 text-purple-800'
                    : plan.status === 'Saved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {plan.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              City-wide heat mitigation &amp; capital greening portfolio
            </p>
          </div>
          <button
            onClick={closeDrawer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close Plan Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* Plan Title & Metadata editable */}
          <div className="space-y-1.5">
            <label htmlFor="plan-title-input" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Plan Title
            </label>
            <input
              id="plan-title-input"
              type="text"
              value={plan.title}
              onChange={(e) => updateTitle(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63]"
              placeholder="Enter municipal plan title..."
            />
          </div>

          {/* 4-Step Progress Strip inside Drawer */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Municipal Workflow Progress</span>
              <span className="font-mono text-[11px] text-slate-500">
                {steps.filter((s) => s.done).length} / 4 Steps Complete
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {steps.map((st) => (
                <div
                  key={st.num}
                  className={`p-2 rounded-lg text-[10px] text-center border transition-all ${
                    st.done
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <span className="block font-bold">Step {st.num}</span>
                  <span className="truncate block mt-0.5">
                    {st.num === 1 ? 'Zones' : st.num === 2 ? 'Options' : st.num === 3 ? 'Solar' : 'Review'}
                  </span>
                </div>
              ))}
            </div>

            {/* Warnings or next actions */}
            <div className="pt-1 space-y-1 text-xs">
              {steps
                .filter((s) => s.warning)
                .map((s) => (
                  <div key={s.num} className="flex items-center justify-between text-[11px] text-amber-800 bg-amber-50/80 p-1.5 rounded-md border border-amber-200">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      {s.warning}
                    </span>
                    <Link
                      href={s.route}
                      onClick={closeDrawer}
                      className="font-bold text-[#0F5C63] hover:underline shrink-0 ml-2"
                    >
                      Go to Step {s.num} →
                    </Link>
                  </div>
                ))}
            </div>
          </div>

          {/* Navigation Tabs in Drawer */}
          <div className="flex border-b border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('items')}
              className={`py-2 px-3 border-b-2 cursor-pointer transition-colors ${
                activeTab === 'items'
                  ? 'border-[#0F5C63] text-[#0F5C63]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Plan Items ({itemCount})
            </button>
            <button
              onClick={() => setActiveTab('version')}
              className={`py-2 px-3 border-b-2 cursor-pointer transition-colors ${
                activeTab === 'version'
                  ? 'border-[#0F5C63] text-[#0F5C63]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Save Version Snapshot
            </button>
            <button
              onClick={() => setActiveTab('forward')}
              disabled={!stepCompleteness.step4}
              className={`py-2 px-3 border-b-2 cursor-pointer transition-colors ${
                activeTab === 'forward'
                  ? 'border-[#0F5C63] text-[#0F5C63]'
                  : !stepCompleteness.step4
                  ? 'border-transparent text-slate-300 cursor-not-allowed'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Forward Hand-off
            </button>
          </div>

          {/* TAB 1: ITEMS LIST */}
          {activeTab === 'items' && (
            <div className="space-y-5">
              {itemCount === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-3">
                  <FileText className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-sm font-medium">Your plan is currently empty.</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Click &ldquo;Add to Plan&rdquo; on priority zones in the Heat Planner, candidate sites
                    in Intervention Scenarios, or shading footprints in the Solar Simulator.
                  </p>
                  <Link
                    href="/heat-planner"
                    onClick={closeDrawer}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F5C63] hover:underline"
                  >
                    Open Heat Planner to allocate zones →
                  </Link>
                </div>
              ) : (
                <>
                  {/* Section 1: Priority Zones */}
                  {plan.sections.zones.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-[#0F5C63]" />
                          Allocated Priority Zones ({plan.sections.zones.length})
                        </span>
                        <TruthChip type="Modelled" compact />
                      </div>
                      <div className="space-y-1.5">
                        {plan.sections.zones.map((item) => (
                          <div
                            key={item.id}
                            className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs hover:bg-slate-100/70 transition-colors"
                          >
                            <div>
                              <div className="font-semibold text-slate-800">{item.title}</div>
                              {item.subtitle && (
                                <div className="text-[11px] text-slate-500">{item.subtitle}</div>
                              )}
                            </div>
                            <button
                              onClick={() => removeItem('zones', item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Remove zone from plan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 2: Interventions */}
                  {plan.sections.interventions.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <TreeDeciduous className="w-3.5 h-3.5 text-emerald-600" />
                          Intervention Packages ({plan.sections.interventions.length})
                        </span>
                        <TruthChip type="Assumed" compact />
                      </div>
                      <div className="space-y-1.5">
                        {plan.sections.interventions.map((item) => (
                          <div
                            key={item.id}
                            className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-800">{item.title}</div>
                              {item.subtitle && (
                                <div className="text-[11px] text-slate-500">{item.subtitle}</div>
                              )}
                            </div>
                            <button
                              onClick={() => removeItem('interventions', item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Remove from plan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 3: Shading & Solar */}
                  {plan.sections.shading.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Sun className="w-3.5 h-3.5 text-amber-500" />
                          Solar &amp; Shading Simulations ({plan.sections.shading.length})
                        </span>
                        <TruthChip type="Modelled" compact />
                      </div>
                      <div className="space-y-1.5">
                        {plan.sections.shading.map((item) => (
                          <div
                            key={item.id}
                            className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-800">{item.title}</div>
                              {item.subtitle && (
                                <div className="text-[11px] text-slate-500">{item.subtitle}</div>
                              )}
                            </div>
                            <button
                              onClick={() => removeItem('shading', item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Remove from plan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes Area */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label htmlFor="plan-notes-area" className="text-xs font-bold text-slate-700 block">
                      Planning Notes &amp; Municipal Justification
                    </label>
                    <textarea
                      id="plan-notes-area"
                      value={plan.notes}
                      onChange={(e) => updateNotes(e.target.value)}
                      rows={3}
                      className="w-full p-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63]"
                      placeholder="Add justifications, budgetary allocation requests, or inter-agency memos..."
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: SAVE VERSION SNAPSHOT */}
          {activeTab === 'version' && (
            <div className="space-y-4">
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 leading-relaxed">
                <span className="font-bold">Immutable Version Snapshot:</span> Saving a version
                freezes the current portfolio totals, selected zone IDs, and input parameters into an
                auditable record that cannot be overwritten.
              </div>

              <div className="space-y-2">
                <label htmlFor="version-name-input" className="text-xs font-bold text-slate-700 block">
                  Version Name
                </label>
                <input
                  id="version-name-input"
                  type="text"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="e.g. Q2 Ward Committee Approved Draft"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63]"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="version-notes-input" className="text-xs font-bold text-slate-700 block">
                  Version Change Log / Notes
                </label>
                <textarea
                  id="version-notes-input"
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  rows={3}
                  placeholder="Summarize changes or council amendments..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63]"
                />
              </div>

              <Button
                variant="primary"
                onClick={handleSaveVersion}
                disabled={!versionName.trim() || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Saving Snapshot...' : 'Create Immutable Version'}
              </Button>
            </div>
          )}

          {/* TAB 3: FORWARD HAND-OFF */}
          {activeTab === 'forward' && (
            <div className="space-y-4">
              {forwardResult ? (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3 text-xs text-emerald-950">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Municipal Hand-off Recorded
                  </div>
                  <p>
                    Plan status set to <strong>Forwarded</strong>. A permanent timestamp and hand-off
                    log have been recorded for auditability.
                  </p>

                  <div className="space-y-1.5 pt-2">
                    <span className="font-semibold text-slate-700 block">Read-Only Digital Share Link:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={
                          typeof window !== 'undefined'
                            ? `${window.location.origin}${forwardResult.shareUrl}`
                            : forwardResult.shareUrl
                        }
                        className="flex-1 p-2 bg-white border border-slate-200 rounded-lg font-mono text-[11px]"
                      />
                      <Button variant="outline" size="sm" onClick={handleCopyLink} className="bg-white">
                        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <a
                      href={forwardResult.mailtoLink}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#0F5C63] text-white rounded-lg text-xs font-bold hover:bg-[#0c4b51] transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Open Prefilled Mailto Link
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 leading-relaxed">
                    <span className="font-bold">Inter-Agency Hand-off:</span> Records a verified
                    hand-off event with timestamp, recipient role, and attached evidence dossier.
                    Creates a permanent share link and a prefilled departmental mailto message.
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="recipient-select" className="text-xs font-bold text-slate-700 block">
                      Target Municipal Recipient
                    </label>
                    <select
                      id="recipient-select"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63] bg-white cursor-pointer"
                    >
                      {RECIPIENT_PRESETS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="custom-recipient-input" className="text-xs font-semibold text-slate-600 block">
                      Or Custom Recipient / Officer Name:
                    </label>
                    <input
                      id="custom-recipient-input"
                      type="text"
                      value={customRecipient}
                      onChange={(e) => setCustomRecipient(e.target.value)}
                      placeholder="e.g. Executive Engineer (Zone 2)"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="forward-memo-input" className="text-xs font-bold text-slate-700 block">
                      Hand-off Memo &amp; Instructions
                    </label>
                    <textarea
                      id="forward-memo-input"
                      value={forwardNotes}
                      onChange={(e) => setForwardNotes(e.target.value)}
                      rows={3}
                      placeholder="Specify budget allocation timelines, implementation steps, or inspection directives..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63]"
                    />
                  </div>

                  <Button
                    variant="primary"
                    onClick={handleForward}
                    disabled={isSubmitting}
                    icon={<Send className="w-3.5 h-3.5" />}
                    className="w-full"
                  >
                    {isSubmitting ? 'Recording Hand-off...' : 'Record Hand-off & Generate Link'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={resetPlan}
            className="text-xs text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset Plan
          </button>

          <div className="flex items-center gap-2">
            <Link
              href="/plans"
              onClick={closeDrawer}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1"
            >
              View All Plans
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (!stepCompleteness.step1) {
                  closeDrawer();
                } else {
                  setActiveTab('forward');
                }
              }}
              className="text-xs"
            >
              {!stepCompleteness.step1 ? 'Allocate Zones First' : 'Proceed to Forward →'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
