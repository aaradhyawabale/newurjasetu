import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-stone-50 rounded-panel border border-dashed border-stone-300 ${className}`}
    >
      <div className="p-3 bg-white rounded-full border border-stone-200 text-stone-500 shadow-sm mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-stone-900">{title}</h4>
      <p className="mt-1 text-xs text-stone-500 max-w-xs leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-btn transition-colors shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
