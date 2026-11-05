"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TruthChip } from './TruthChip';
import { TruthLabel } from '../../api/contract';

export interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  truth?: TruthLabel;
  truthLabel?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  helpText?: string;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  truth,
  truthLabel,
  onChange,
  disabled = false,
  helpText,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-xs font-semibold text-[#14212B] flex items-center gap-1.5"
        >
          <span>{label}</span>
          {truth && <TruthChip type={truth} label={truthLabel} compact />}
        </label>
        <span className="text-xs font-mono font-bold text-[#0F5C63] bg-[#0F5C63]/10 px-2 py-0.5 rounded tabular-nums">
          {value} {unit}
        </span>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0F5C63] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63] disabled:opacity-50 disabled:cursor-not-allowed"
      />

      <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono tabular-nums">
        <span>
          {min} {unit}
        </span>
        {helpText && <span className="text-slate-500 font-sans">{helpText}</span>}
        <span>
          {max} {unit}
        </span>
      </div>
    </div>
  );
};

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
  size = 'md',
}) => {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
            } ${
              isActive
                ? 'bg-white text-[#14212B] shadow-xs font-semibold'
                : 'text-slate-600 hover:text-[#14212B] hover:bg-white/50'
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full tabular-nums ${
                  isActive ? 'bg-slate-100 text-slate-800' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
