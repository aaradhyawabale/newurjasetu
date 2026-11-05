/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TruthChip } from './TruthChip';
import { TruthLabel } from '../../api/contract';

export interface StatTileProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  truth: TruthLabel;
  truthCustomLabel?: string;
  range?: string | null;
  subtext?: string;
  icon?: React.ReactNode;
  className?: string;
  highlight?: boolean;
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  unit,
  truth,
  truthCustomLabel,
  range,
  subtext,
  icon,
  className = '',
  highlight = false,
}) => {
  const isAvailable = value !== null && value !== undefined && value !== '';

  return (
    <div
      className={`p-4 rounded-xl border bg-white flex flex-col justify-between transition-colors ${
        highlight
          ? 'border-[#0F5C63]/40 bg-[#0F5C63]/5 shadow-xs'
          : 'border-[#E5E7EB]'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-600 line-clamp-1">{label}</span>
        <TruthChip type={truth} label={truthCustomLabel} compact />
      </div>

      <div className="my-1 flex items-baseline gap-1.5">
        {icon && <span className="text-slate-400 mr-1 shrink-0">{icon}</span>}
        {isAvailable ? (
          <>
            <span className="text-2xl font-bold tracking-tight text-[#14212B] tabular-nums">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {unit && <span className="text-xs font-medium text-slate-500">{unit}</span>}
          </>
        ) : (
          <span className="text-sm font-medium text-slate-400 italic">Not available</span>
        )}
      </div>

      {(range || subtext) && (
        <div className="mt-1 pt-1.5 border-t border-slate-100 flex flex-col gap-0.5 text-[11px] text-slate-500">
          {range && (
            <span className="tabular-nums font-mono text-[11px] text-slate-600">
              Range: {range}
            </span>
          )}
          {subtext && <span className="line-clamp-1 text-slate-500">{subtext}</span>}
        </div>
      )}
    </div>
  );
};
