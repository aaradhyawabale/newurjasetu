"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Slider } from '@/components/ui/FormControls';
import { Button } from '@/components/ui/Button';
import { TruthChip } from '@/components/ui/TruthChip';
import { PUNE_WARDS } from '@/api/mock/data';
import { Filter, Play, Plus, Trash2 } from 'lucide-react';

export interface ScenarioPanelProps {
  budgetHa: number;
  onBudgetChange: (val: number) => void;
  targetNdvi: number;
  onTargetNdviChange: (val: number) => void;
  selectedWard: string;
  onWardChange: (ward: string) => void;
  onRunOptimization: () => void;
  isOptimizing: boolean;
  hasScenarioB: boolean;
  onToggleScenarioB: () => void;
  budgetHaB?: number;
  onBudgetBChange?: (val: number) => void;
  className?: string;
}

export const ScenarioPanel: React.FC<ScenarioPanelProps> = ({
  budgetHa,
  onBudgetChange,
  targetNdvi,
  onTargetNdviChange,
  selectedWard,
  onWardChange,
  onRunOptimization,
  isOptimizing,
  hasScenarioB,
  onToggleScenarioB,
  budgetHaB = 40,
  onBudgetBChange,
  className = '',
}) => {
  return (
    <aside
      aria-label="Scenario Configuration Panel"
      className={`bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-6 ${className}`}
    >
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-base font-bold text-[#14212B]">
              Optimization Parameters
            </h2>
            <p className="text-xs text-slate-500">
              Set municipal constraints &amp; run greedy benefit allocation
            </p>
          </div>
          <TruthChip type="Assumed" label="Policy Inputs" compact />
        </div>

        <div className="space-y-5">
          {/* Slider 1: Budget in Hectares */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <Slider
              id="budget-ha-slider"
              label="Greening Budget Target"
              value={budgetHa}
              min={5}
              max={60}
              step={1}
              unit="ha"
              truth="Input"
              onChange={onBudgetChange}
              helpText="Min 5 ha / Max 60 ha"
            />
          </div>

          {/* Slider 2: Target NDVI */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <Slider
              id="target-ndvi-slider"
              label="Target vegetation index (NDVI)"
              value={targetNdvi}
              min={0.3}
              max={0.7}
              step={0.05}
              unit="NDVI"
              truth="Input"
              onChange={onTargetNdviChange}
              helpText="Indicative guidance: 0.45 dense shrubs, 0.65 dense vegetation"
            />
          </div>

          {/* Filter: Municipal Ward Filter */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="ward-select"
                className="text-xs font-semibold text-[#14212B] flex items-center gap-1.5"
              >
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Geographic Scope</span>
              </label>
              <TruthChip type="Assumed" label="Centroid" compact />
            </div>

            <select
              id="ward-select"
              value={selectedWard}
              onChange={(e) => onWardChange(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63] cursor-pointer"
            >
              <option value="">All Pune Wards (City-wide portfolio)</option>
              {PUNE_WARDS.map((w) => (
                <option key={w} value={w}>
                  {w} Ward
                </option>
              ))}
            </select>
          </div>

          {/* Scenario B Configuration (if toggled) */}
          {hasScenarioB && (
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">
                  Scenario B: Alternative Budget
                </span>
                <button
                  onClick={onToggleScenarioB}
                  className="text-amber-800 hover:text-red-600 transition-colors p-1"
                  title="Remove Scenario B"
                  aria-label="Remove Scenario B"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {onBudgetBChange && (
                <Slider
                  id="budget-b-slider"
                  label="Alternative Budget (Scenario B)"
                  value={budgetHaB}
                  min={5}
                  max={60}
                  step={1}
                  unit="ha"
                  truth="Input"
                  onChange={onBudgetBChange}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <Button
          variant="primary"
          onClick={onRunOptimization}
          disabled={isOptimizing}
          icon={<Play className="w-4 h-4 fill-current" />}
          className="w-full"
        >
          {isOptimizing ? 'Running Ensemble (30 seeds)...' : 'Run Budget Optimizer'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onToggleScenarioB}
          icon={hasScenarioB ? <Trash2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          className="w-full bg-white text-xs"
        >
          {hasScenarioB ? 'Hide Scenario B Comparison' : 'Add Scenario B for Comparison'}
        </Button>
      </div>
    </aside>
  );
};
