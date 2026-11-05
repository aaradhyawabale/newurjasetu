"use client";

import React from "react";

interface PresetChipProps {
  label: string;
  sublabel?: string;
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const PresetChip: React.FC<PresetChipProps> = ({
  label,
  sublabel,
  isActive,
  onClick,
  icon,
  disabled = false,
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 ${
        isActive
          ? "bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-950/40"
          : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${className}`}
    >
      <div className="flex items-center gap-1.5 w-full">
        {icon && (
          <span
            className={`shrink-0 ${
              isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-300"
            }`}
          >
            {icon}
          </span>
        )}
        <span className="text-xs font-bold tracking-tight">{label}</span>
      </div>
      {sublabel && (
        <span
          className={`text-[11px] font-mono mt-0.5 ${
            isActive ? "text-emerald-300/80" : "text-slate-400"
          }`}
        >
          {sublabel}
        </span>
      )}
    </button>
  );
};
