/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TruthChip: Transparent attribution tag for every displayed number.
 * Conveys data provenance: Measured vs Modelled vs Assumed.
 * Differ by both icon AND color for accessibility.
 */

import React from 'react';
import { Satellite, Cpu, AlertCircle, Sliders } from 'lucide-react';
import { TruthLabel } from '../../api/contract';

export interface TruthChipProps {
  type?: TruthLabel;
  provenance?: TruthLabel;
  label?: string;
  className?: string;
  compact?: boolean;
  size?: 'sm' | 'md';
}

export const TruthChip: React.FC<TruthChipProps> = ({
  type,
  provenance,
  label,
  className = '',
  compact = false,
  size,
}) => {
  const actualType = (type || provenance || 'Modelled') as TruthLabel;
  const config = {
    Measured: {
      text: 'Measured',
      tooltip: label ? `${label} — Direct satellite observation or civic registry` : 'Direct satellite observation or civic municipal registry',
      icon: Satellite,
      bg: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    },
    Modelled: {
      text: 'Modelled',
      tooltip: label ? `${label} — AI ensemble prediction with uncertainty bounds` : 'AI ensemble prediction (shown with uncertainty bounds)',
      icon: Cpu,
      bg: 'bg-sky-50 text-sky-900 border-sky-300',
    },
    Assumed: {
      text: 'Assumed',
      tooltip: label ? `${label} — Configured planning parameter or engineering assumption` : 'Configured planning parameter / engineering assumption',
      icon: AlertCircle,
      bg: 'bg-amber-50 text-amber-900 border-amber-300',
    },
    Input: {
      text: 'Input',
      tooltip: label ? `${label} — User-controlled policy or scenario constraint` : 'User-controlled policy or scenario constraint',
      icon: Sliders,
      bg: 'bg-slate-100 text-slate-800 border-slate-300',
    },
  }[actualType] || {
    text: actualType,
    tooltip: label || '',
    icon: AlertCircle,
    bg: 'bg-stone-50 text-stone-900 border-stone-300',
  };

  const Icon = config.icon;

  if (compact || size === 'sm') {
    return (
      <span
        title={config.tooltip}
        aria-label={`${actualType} metric: ${config.tooltip}`}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border tabular-nums ${config.bg} ${className}`}
      >
        <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>{config.text}</span>
      </span>
    );
  }

  return (
    <span
      title={config.tooltip}
      aria-label={`${type} metric: ${config.tooltip}`}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border tabular-nums ${config.bg} ${className}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{config.text}</span>
    </span>
  );
};
