"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, ArrowRight, CheckCircle2 } from 'lucide-react';
import { OptimizeResult, ModelCard } from '@/api/contract';
import { TruthChip } from '@/components/ui/TruthChip';
import { Button } from '@/components/ui/Button';

export interface ScenarioCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarioA: {
    name: string;
    budgetHa: number;
    result: OptimizeResult | null;
  };
  scenarioB: {
    name: string;
    budgetHa: number;
    result: OptimizeResult | null;
  };
  modelCard: ModelCard | null;
}

export const ScenarioCompareModal: React.FC<ScenarioCompareModalProps> = ({
  isOpen,
  onClose,
  scenarioA,
  scenarioB,
  modelCard,
}) => {
  if (!isOpen) return null;

  const a = scenarioA.result?.totals;
  const b = scenarioB.result?.totals;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 sm:p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h2 id="compare-modal-title" className="text-xl font-bold text-[#14212B]">
              Side-by-Side Scenario Comparison
            </h2>
            <p className="text-xs text-slate-500">
              Evaluate cooling outcomes and people protected between two budget allocations
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison Table */}
        <div className="py-4">
          <div className="grid grid-cols-3 gap-3 pb-3 border-b border-slate-100 text-xs font-semibold text-slate-500">
            <div>Planning Metric</div>
            <div className="text-right font-bold text-[#0F5C63]">
              {scenarioA.name} ({scenarioA.budgetHa} ha)
            </div>
            <div className="text-right font-bold text-amber-700">
              {scenarioB.name} ({scenarioB.budgetHa} ha)
            </div>
          </div>

          <div className="divide-y divide-slate-100 text-sm">
            {/* Row 1: Budget */}
            <div className="grid grid-cols-3 gap-3 py-3 items-center">
              <div>
                <span className="font-medium text-slate-800 block">Greening Budget</span>
                <span className="text-[11px] text-slate-400">Total land target</span>
              </div>
              <div className="text-right font-mono font-bold text-slate-800 tabular-nums">
                {scenarioA.budgetHa} ha
              </div>
              <div className="text-right font-mono font-bold text-slate-800 tabular-nums">
                {scenarioB.budgetHa} ha
              </div>
            </div>

            {/* Row 2: Priority Zones */}
            <div className="grid grid-cols-3 gap-3 py-3 items-center">
              <div>
                <span className="font-medium text-slate-800 block">Zones Allocated</span>
                <span className="text-[11px] text-slate-400">250m grid units</span>
              </div>
              <div className="text-right font-mono font-bold text-slate-800 tabular-nums">
                {a?.zones ?? 'N/A'}
              </div>
              <div className="text-right font-mono font-bold text-slate-800 tabular-nums">
                {b?.zones ?? 'N/A'}
              </div>
            </div>

            {/* Row 3: People Covered */}
            <div className="grid grid-cols-3 gap-3 py-3 items-center bg-slate-50/60 -mx-2 px-2 rounded-lg">
              <div>
                <span className="font-semibold text-slate-900 block">People Benefiting</span>
                <TruthChip type="Modelled" compact />
              </div>
              <div className="text-right font-mono font-bold text-[#0F5C63] tabular-nums text-base">
                {a?.people_covered !== undefined ? a.people_covered.toLocaleString('en-IN') : 'N/A'}
              </div>
              <div className="text-right font-mono font-bold text-amber-800 tabular-nums text-base">
                {b?.people_covered !== undefined ? b.people_covered.toLocaleString('en-IN') : 'N/A'}
              </div>
            </div>

            {/* Row 4: Estimated Cooling */}
            <div className="grid grid-cols-3 gap-3 py-3 items-center">
              <div>
                <span className="font-medium text-slate-800 block">Est. Surface Cooling</span>
                <TruthChip type="Modelled" compact />
              </div>
              <div className="text-right font-mono font-bold text-slate-800 tabular-nums">
                {a?.cooling_mid !== undefined ? `-${a.cooling_mid.toFixed(1)}°C` : 'N/A'}
                <span className="block text-[11px] font-normal text-slate-500">
                  {a?.cooling_low !== undefined && a?.cooling_high !== undefined
                    ? `(-${a.cooling_high.toFixed(1)} to -${a.cooling_low.toFixed(1)}°C)`
                    : ''}
                </span>
              </div>
              <div className="text-right font-mono font-bold text-slate-800 tabular-nums">
                {b?.cooling_mid !== undefined ? `-${b.cooling_mid.toFixed(1)}°C` : 'N/A'}
                <span className="block text-[11px] font-normal text-slate-500">
                  {b?.cooling_low !== undefined && b?.cooling_high !== undefined
                    ? `(-${b.cooling_high.toFixed(1)} to -${b.cooling_low.toFixed(1)}°C)`
                    : ''}
                </span>
              </div>
            </div>

            {/* Row 5: Ensemble Robustness */}
            <div className="grid grid-cols-3 gap-3 py-3 items-center">
              <div>
                <span className="font-medium text-slate-800 block">Plan Robustness</span>
                <span className="text-[11px] text-slate-400">30 bootstrap runs</span>
              </div>
              <div className="text-right font-mono font-bold text-slate-800 tabular-nums">
                {a?.robustness ?? 'N/A'}%
              </div>
              <div className="text-right font-mono font-bold text-slate-800 tabular-nums">
                {b?.robustness ?? 'N/A'}%
              </div>
            </div>
          </div>

          {/* Key Takeaway */}
          {a && b && (
            <div className="mt-4 p-3 bg-[#0F5C63]/5 border border-[#0F5C63]/20 rounded-xl text-xs text-slate-700 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#0F5C63] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#0F5C63]">Marginal Gain Analysis:</strong> Increasing
                budget from {scenarioA.budgetHa} ha to {scenarioB.budgetHa} ha yields an
                additional{' '}
                <span className="font-mono font-bold tabular-nums">
                  {Math.abs((b.people_covered || 0) - (a.people_covered || 0)).toLocaleString()}
                </span>{' '}
                citizens protected with a marginal surface cooling enhancement of{' '}
                <span className="font-mono font-bold tabular-nums">
                  {Math.abs(Math.round(((b.cooling_mid || 0) - (a.cooling_mid || 0)) * 10) / 10)}°C
                </span>
                .
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Comparison
          </Button>
        </div>
      </div>
    </div>
  );
};
