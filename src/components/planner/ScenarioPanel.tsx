"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Slider } from '@/components/ui/FormControls';
import { Button } from '@/components/ui/Button';
import { TruthChip } from '@/components/ui/TruthChip';
import { PUNE_WARDS } from '@/api/mock/data';
import { Filter, Play, Plus, Trash2, ArrowRight, Layers, PlusCircle, Check, MapPin } from 'lucide-react';
import { AppLink } from '@/lib/nav';

export interface RankedZoneItem {
  id: string;
  rank: number;
  ward: string;
  locality?: string;
  greenableHa: number;
  coolingC?: number;
  population: number;
  lstMean?: number;
}

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
  topPerWard?: boolean;
  onToggleTopPerWard?: (val: boolean) => void;
  rankedZones?: RankedZoneItem[];
  selectedZoneId?: string | null;
  onSelectZone?: (id: string) => void;
  onAddZoneToPlan?: (zone: RankedZoneItem) => void;
  addedZoneIds?: string[];
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
  topPerWard = false,
  onToggleTopPerWard,
  rankedZones = [],
  selectedZoneId,
  onSelectZone,
  onAddZoneToPlan,
  addedZoneIds = [],
}) => {
  const [activeTab, setActiveTab] = useState<'params' | 'zones'>('params');

  return (
    <aside
      aria-label="Scenario Configuration Panel"
      className={`bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-4 ${className}`}
    >
      <div>
        {/* Header with Switcher Tabs */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('params')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'params'
                  ? 'bg-white text-[#14212B] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Parameters
            </button>
            <button
              onClick={() => setActiveTab('zones')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'zones'
                  ? 'bg-white text-[#14212B] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Priority Zones</span>
              <span className="bg-[#0F5C63]/10 text-[#0F5C63] px-1.5 py-0.2 rounded-full text-[10px]">
                {rankedZones.length}
              </span>
            </button>
          </div>
          <TruthChip type="Assumed" label="Policy Inputs" compact />
        </div>

        {activeTab === 'params' ? (
          <div className="space-y-4">
            {/* Slider 1: Budget in Hectares */}
            <div data-tour="heat-budget-slider" className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
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
            <div data-tour="heat-ndvi-slider" className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
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
            <div data-tour="heat-ward-filter" className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
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
              <div data-tour="heat-compare-scenario" className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">
                    Scenario B: Alternative Budget
                  </span>
                  <button
                    onClick={onToggleScenarioB}
                    className="text-amber-800 hover:text-red-600 transition-colors p-1 cursor-pointer"
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
        ) : (
          <div className="space-y-3">
            {/* Top zones per ward toggle */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#0F5C63]" />
                Top zones per ward
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={topPerWard}
                  onChange={(e) => onToggleTopPerWard?.(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0F5C63]"></div>
              </label>
            </div>

            {/* Scrollable list of ranked zones */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {rankedZones.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No zones calculated yet. Run optimization below.
                </div>
              ) : (
                rankedZones.map((zone) => {
                  const isSelected = selectedZoneId === zone.id;
                  const isAdded = addedZoneIds.includes(zone.id);
                  const loc = zone.locality || zone.ward;
                  return (
                    <div
                      key={zone.id}
                      id={`zone-card-${zone.id}`}
                      className={`p-2.5 rounded-lg border transition-all text-xs ${
                        isSelected
                          ? 'border-[#0F5C63] bg-teal-50/50 ring-1 ring-[#0F5C63]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            <span className="bg-[#0F5C63] text-white px-1.5 py-0.2 rounded text-[10px]">
                              #{zone.rank}
                            </span>
                            <span>{zone.ward} - {loc}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {zone.id} · Approx. centroid
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectZone?.(zone.id)}
                          className="text-[#0F5C63] hover:underline p-1 flex items-center gap-0.5 text-[11px] font-semibold cursor-pointer"
                          title="Focus zone on map"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>Map</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1 py-1.5 border-y border-slate-100 my-1 text-[11px] text-slate-600">
                        <div>
                          <span className="block text-[9px] text-slate-400">Greenable</span>
                          <span className="font-semibold text-slate-800">{zone.greenableHa} ha</span>
                        </div>
                        <div>
                          <span className="block text-[9px] text-slate-400">Cooling</span>
                          <span className="font-semibold text-emerald-700">
                            {zone.coolingC !== undefined ? `${zone.coolingC > 0 ? `-${zone.coolingC}` : zone.coolingC}°C` : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[9px] text-slate-400">Population</span>
                          <span className="font-semibold text-slate-800">{zone.population.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => onSelectZone?.(zone.id)}
                          className="text-[11px] text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                          View Dossier
                        </button>
                        {onAddZoneToPlan && (
                          <button
                            type="button"
                            onClick={() => onAddZoneToPlan(zone)}
                            disabled={isAdded}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                              isAdded
                                ? 'bg-emerald-100 text-emerald-800 cursor-default'
                                : 'bg-[#0F5C63] text-white hover:bg-[#0B484E]'
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>In Plan</span>
                              </>
                            ) : (
                              <>
                                <PlusCircle className="w-3 h-3" />
                                <span>Add to Plan</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <div data-tour="heat-run-button">
          <Button
            variant="primary"
            onClick={onRunOptimization}
            disabled={isOptimizing}
            icon={<Play className="w-4 h-4 fill-current" />}
            className="w-full"
          >
            {isOptimizing ? 'Running Ensemble (30 seeds)...' : 'Run Budget Optimizer'}
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onToggleScenarioB}
          icon={hasScenarioB ? <Trash2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          className="w-full bg-white text-xs"
        >
          {hasScenarioB ? 'Hide Scenario B Comparison' : 'Add Scenario B for Comparison'}
        </Button>

        <AppLink
          to="/interventions"
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors shadow-xs"
        >
          <span>Next step: Choose interventions</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </AppLink>
      </div>
    </aside>
  );
};
