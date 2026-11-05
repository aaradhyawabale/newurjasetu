"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Eye, Sliders, CheckSquare, GitCompare } from 'lucide-react';

export interface ProgressStripProps {
  currentStep: number; // 1, 2, 3, 4
  onStepClick: (step: number) => void;
  className?: string;
}

export const ProgressStrip: React.FC<ProgressStripProps> = ({
  currentStep,
  onStepClick,
  className = '',
}) => {
  const steps = [
    { number: 1, title: 'See the heat', desc: 'Identify hot, crowded wards', icon: Eye },
    { number: 2, title: 'Set a budget', desc: 'Configure greening target', icon: Sliders },
    { number: 3, title: 'Review the plan', desc: 'Inspect zone evidence', icon: CheckSquare },
    { number: 4, title: 'Compare & export', desc: 'Scenario analysis & dossier', icon: GitCompare },
  ];

  return (
    <nav
      aria-label="Planning Progress Stepper"
      className={`bg-white border border-slate-200 rounded-xl p-2 sm:p-2.5 shadow-xs overflow-x-auto ${className}`}
    >
      <ol className="flex items-center min-w-[580px] sm:min-w-0 justify-between gap-2">
        {steps.map((s, idx) => {
          const isActive = currentStep === s.number;
          const isPassed = currentStep > s.number;
          const Icon = s.icon;

          return (
            <li key={s.number} className="flex-1 flex items-center">
              <button
                onClick={() => onStepClick(s.number)}
                className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0F5C63]/10 text-[#0F5C63] font-semibold ring-1 ring-[#0F5C63]/30'
                    : isPassed
                    ? 'text-slate-800 hover:bg-slate-50'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isActive
                      ? 'bg-[#0F5C63] text-white'
                      : isPassed
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isPassed ? '✓' : s.number}
                </div>
                <div className="min-w-0">
                  <span className="text-xs block truncate leading-tight">
                    {s.title}
                  </span>
                  <span className="text-[10px] text-slate-500 hidden sm:block truncate">
                    {s.desc}
                  </span>
                </div>
              </button>

              {idx < steps.length - 1 && (
                <div className="w-4 h-0.5 bg-slate-200 mx-1 shrink-0" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
