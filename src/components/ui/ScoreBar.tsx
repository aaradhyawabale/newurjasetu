import React from "react";

interface ScoreBarProps {
  score: number | null; // 0 to 100, or null when unavailable
  showLabel?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export const ScoreBar: React.FC<ScoreBarProps> = ({
  score,
  showLabel = true,
  className = "",
  size = "md",
}) => {
  const heightClass = size === "sm" ? "h-1.5" : "h-2.5";

  if (score === null || score === undefined || !Number.isFinite(score)) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`flex-1 bg-stone-200 rounded-full overflow-hidden ${heightClass}`} />
        {showLabel && (
          <span className="font-mono text-xs font-medium text-stone-400 w-9 text-right">
            N/A
          </span>
        )}
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  const getBarColor = (val: number) => {
    if (val >= 75) return "bg-emerald-600";
    if (val >= 50) return "bg-amber-600";
    return "bg-rose-600";
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex-1 bg-stone-200 rounded-full overflow-hidden ${heightClass}`}>
        <div
          className={`${heightClass} rounded-full transition-all duration-500 ease-out ${getBarColor(
            clamped
          )}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="font-mono text-xs font-semibold text-stone-800 w-9 text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
};
