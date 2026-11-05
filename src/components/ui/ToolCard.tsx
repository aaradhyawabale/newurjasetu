/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { AppLink } from '../../lib/nav';

export interface ToolCardProps {
  to: string;
  userGoalTitle: string;
  toolName: string;
  description: string;
  icon: React.ReactNode;
  tags?: string[];
  badge?: string;
}

export const ToolCard: React.FC<ToolCardProps> = ({
  to,
  userGoalTitle,
  toolName,
  description,
  icon,
  tags,
  badge,
}) => {
  return (
    <AppLink
      to={to}
      className="group block p-6 bg-white rounded-xl border border-[#E5E7EB] hover:border-[#0F5C63]/50 hover:shadow-md transition-all duration-150 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#0F5C63]/10 text-[#0F5C63] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            {icon}
          </div>
          <div className="flex items-center gap-2">
            {badge && (
              <span className="text-[11px] font-medium text-[#0F5C63] bg-[#0F5C63]/10 px-2 py-0.5 rounded">
                {badge}
              </span>
            )}
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#0F5C63] transition-colors" />
          </div>
        </div>

        <span className="text-xs font-semibold uppercase tracking-wider text-[#0F5C63] block mb-1">
          {toolName}
        </span>
        <h3 className="text-lg font-bold text-[#14212B] group-hover:text-[#0F5C63] transition-colors mb-2">
          {userGoalTitle}
        </h3>
        <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
          {description}
        </p>
      </div>

      {tags && tags.length > 0 && (
        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
          {tags.map((tag, idx) => (
            <React.Fragment key={tag}>
              <span>{tag}</span>
              {idx < tags.length - 1 && <span aria-hidden="true">·</span>}
            </React.Fragment>
          ))}
        </div>
      )}
    </AppLink>
  );
};

export interface SectionHeaderProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  centered?: boolean;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  kicker,
  title,
  subtitle,
  action,
  className = '',
  centered = false,
}) => {
  return (
    <div
      className={`flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 ${
        centered ? 'text-center items-center' : ''
      } ${className}`}
    >
      <div className={centered ? 'max-w-2xl mx-auto' : 'max-w-2xl'}>
        {kicker && (
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0F5C63] block mb-1.5">
            {kicker}
          </span>
        )}
        <h2 className="text-2xl sm:text-3xl font-bold text-[#14212B] tracking-tight text-balance">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-base text-slate-600 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
