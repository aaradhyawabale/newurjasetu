"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { OptimizeResult, ModelCard } from '@/api/contract';
import { TruthChip } from '@/components/ui/TruthChip';
import { ShieldCheck, Users, Thermometer, Compass, Download, GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface PortfolioSummaryProps {
  result: OptimizeResult | null;
  modelCard: ModelCard | null;
  onCompareScenarios?: () => void;
  onExportPlan?: () => void;
  className?: string;
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  result,
  modelCard,
  onCompareScenarios,
  onExportPlan,
  className = '',
}) => {
  if (!result) return null;

  const { totals } = result;

  return (
    <section
      aria-label="Portfolio Summary of Climate Plan"
      className={`bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Metric tiles row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
          {/* Tile 1: Zones Chosen */}
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                <Compass className="w-3 h-3 text-[#0F5C63]" />
                Priority Zones
              </span>
              <TruthChip type="Modelled" compact />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-[#14212B] tabular-nums">
                {totals.zones}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                zones ({totals.area_ha} ha)
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block truncate mt-0.5">
              Greening allocated
            </span>
          </div>

          {/* Tile 2: People Covered */}
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                <Users className="w-3 h-3 text-sky-600" />
                People Benefiting
              </span>
              <TruthChip type="Modelled" compact />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-[#14212B] tabular-nums">
                {totals.people_covered.toLocaleString('en-IN')}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block truncate mt-0.5">
              High-burden ward residents [Modelled]
            </span>
          </div>

          {/* Tile 3: Cooling Range + Cross-validation Error next to it! */}
          <div className="p-2.5 bg-sky-50/50 rounded-lg border border-sky-200">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-medium text-slate-700 flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-sky-600" />
                Est. Surface Cooling
              </span>
              <TruthChip type="Modelled" compact />
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold font-mono text-sky-900 tabular-nums">
                -{totals.cooling_mid.toFixed(1)}°C
              </span>
              <span className="text-[11px] font-mono text-slate-600">
                (-{totals.cooling_high.toFixed(1)} to -{totals.cooling_low.toFixed(1)}°C)
              </span>
            </div>
            <div className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-1">
              <span>Model CV RMSE:</span>
              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                ±{modelCard?.cv_rmse_c ?? 0.91}°C
              </span>
            </div>
          </div>

          {/* Tile 4: Robustness % */}
          <div className="p-2.5 bg-emerald-50/40 rounded-lg border border-emerald-200">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-medium text-slate-700 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Plan Robustness
              </span>
              <TruthChip type="Modelled" compact />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-900 tabular-nums">
                {totals.robustness}%
              </span>
              <span className="text-xs text-emerald-700">consensus</span>
            </div>
            <span className="text-[10px] text-slate-500 block truncate mt-0.5">
              Across 30 bootstrap seeds
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex sm:flex-col lg:flex-row items-center gap-2 shrink-0">
          {onCompareScenarios && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCompareScenarios}
              icon={<GitCompare className="w-3.5 h-3.5" />}
              className="text-xs w-full sm:w-auto"
            >
              Compare Scenarios
            </Button>
          )}

          {onExportPlan && (
            <Button
              variant="primary"
              size="sm"
              onClick={onExportPlan}
              icon={<Download className="w-3.5 h-3.5" />}
              className="text-xs w-full sm:w-auto"
            >
              Export Municipal Plan
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};
