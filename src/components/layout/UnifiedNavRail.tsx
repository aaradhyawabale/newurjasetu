"use client";

import React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Flame,
  Leaf,
  Compass,
  Sun,
  Zap,
  FileText,
  BookOpen,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Layers
} from "lucide-react";

export type NavMode =
  | "overview"
  | "heat_priority"
  | "green_loss"
  | "siting"
  | "shadow_sim"
  | "solar_reality"
  | "reports";

interface NavItem {
  id: NavMode | "methodology";
  label: string;
  category: "Climate Intelligence" | "Urban Planning" | "Governance";
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isExternalLink?: boolean;
  href?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "City Overview",
    category: "Climate Intelligence",
    icon: LayoutDashboard,
  },
  {
    id: "heat_priority",
    label: "Heat & Cooling Optimizer",
    category: "Climate Intelligence",
    icon: Flame,
    badge: "250m",
  },
  {
    id: "green_loss",
    label: "Green Loss Watch",
    category: "Climate Intelligence",
    icon: Leaf,
    badge: "2019-26",
  },
  {
    id: "siting",
    label: "Siting Studio (11 Types)",
    category: "Urban Planning",
    icon: Compass,
    badge: "Smart-Fit",
  },
  {
    id: "shadow_sim",
    label: "Shadow Simulator (3D)",
    category: "Urban Planning",
    icon: Sun,
  },
  {
    id: "solar_reality",
    label: "Solar Reality & Penalty",
    category: "Urban Planning",
    icon: Zap,
  },
  {
    id: "reports",
    label: "Evidence & Dossiers",
    category: "Governance",
    icon: FileText,
  },
  {
    id: "methodology",
    label: "Methodology & Models",
    category: "Governance",
    icon: BookOpen,
    isExternalLink: true,
    href: "/method",
  },
];

interface UnifiedNavRailProps {
  currentMode: NavMode;
  onSelectMode: (mode: NavMode) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenCopilot: () => void;
}

export const UnifiedNavRail: React.FC<UnifiedNavRailProps> = ({
  currentMode,
  onSelectMode,
  isCollapsed,
  onToggleCollapse,
  onOpenCopilot,
}) => {
  return (
    <aside
      className={`h-full bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 transition-all duration-200 z-30 select-none ${
        isCollapsed ? "w-16" : "w-64"
      }`}
      aria-label="Main Navigation"
    >
      {/* Top: Brand Header */}
      <div>
        <div className="h-14 px-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-extrabold text-sm shadow-md shrink-0">
              US
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="text-sm font-extrabold tracking-tight text-slate-100 leading-tight">
                  UrjaSetu
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-semibold leading-tight">
                  Municipal Decision System
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation List */}
        <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentMode === item.id;

            if (item.isExternalLink && item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-all ${
                    isCollapsed ? "justify-center" : ""
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectMode(item.id as NavMode)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isActive
                    ? "bg-emerald-950/90 text-emerald-300 border border-emerald-600/60 shadow-xs"
                    : "text-slate-300 hover:text-slate-100 hover:bg-slate-800/80"
                } ${isCollapsed ? "justify-center" : ""}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-emerald-400" : "text-slate-400"
                  }`}
                />
                {!isCollapsed && (
                  <div className="flex items-center justify-between w-full truncate">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 ml-2 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom: AI Copilot Button */}
      <div className="p-2 border-t border-slate-800">
        <button
          type="button"
          onClick={onOpenCopilot}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/60 text-emerald-300 text-xs font-bold transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
            isCollapsed ? "justify-center" : ""
          }`}
          title="Open AI Decision Copilot (⌘J)"
        >
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          {!isCollapsed && (
            <div className="flex items-center justify-between w-full">
              <span>AI Advisor</span>
              <kbd className="text-[11px] font-mono px-1.5 py-0.5 bg-emerald-900/80 rounded border border-emerald-700/60 text-emerald-200">
                ⌘J
              </kbd>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
