"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info, HelpCircle } from 'lucide-react';
import { TruthChip } from './TruthChip';
import { AppLink } from '../../lib/nav';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 text-xs text-slate-500 mb-3 ${className}`}>
      <AppLink to="/" className="hover:text-[#0F5C63] transition-colors">
        Home
      </AppLink>
      {items.map((item, idx) => (
        <React.Fragment key={item.label}>
          <span className="text-slate-300" aria-hidden="true">/</span>
          {item.to ? (
            <AppLink to={item.to} className="hover:text-[#0F5C63] transition-colors">
              {item.label}
            </AppLink>
          ) : (
            <span className="text-[#14212B] font-medium" aria-current="page">
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export interface ToolPageHeaderProps {
  title: string;
  purpose: string;
  steps: [string, string, string]; // Exactly 3-step guide
  dataUsed: Array<{ label: string; type: 'Measured' | 'Modelled' | 'Assumed' }>;
  breadcrumbItems?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export const ToolPageHeader: React.FC<ToolPageHeaderProps> = ({
  title,
  purpose,
  steps,
  dataUsed,
  breadcrumbItems,
  actions,
}) => {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="mb-6 bg-white border border-[#E5E7EB] rounded-xl p-4 sm:p-6 shadow-xs">
      {breadcrumbItems && <Breadcrumb items={breadcrumbItems} />}

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14212B]">
            {title}
          </h1>
          <p className="mt-1 text-sm sm:text-base text-slate-600 leading-relaxed">
            {purpose}
          </p>
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>

      {/* Provenance chips + collapsible guidance toggle */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            Data used:
          </span>
          {dataUsed.map((item) => (
            <TruthChip key={item.label} type={item.type} label={item.label} compact />
          ))}
        </div>

        <button
          onClick={() => setGuideOpen(!guideOpen)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0F5C63] hover:text-[#0A3E43] transition-colors cursor-pointer"
          aria-expanded={guideOpen}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>{guideOpen ? 'Hide 3-Step Guide' : 'How to use (3 steps)'}</span>
          {guideOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Collapsible 3-step guide */}
      {guideOpen && (
        <div className="mt-4 p-3.5 bg-[#FAFAF7] border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-[#0F5C63] text-white flex items-center justify-center font-bold shrink-0 text-[11px]">
              1
            </span>
            <p className="text-slate-700 leading-normal">{steps[0]}</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-[#0F5C63] text-white flex items-center justify-center font-bold shrink-0 text-[11px]">
              2
            </span>
            <p className="text-slate-700 leading-normal">{steps[1]}</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-[#0F5C63] text-white flex items-center justify-center font-bold shrink-0 text-[11px]">
              3
            </span>
            <p className="text-slate-700 leading-normal">{steps[2]}</p>
          </div>
        </div>
      )}
    </div>
  );
};
