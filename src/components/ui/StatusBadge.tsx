import React from "react";

export type StatusType =
  | "pass"
  | "warn"
  | "fail"
  | "optimal"
  | "acceptable"
  | "suboptimal"
  | "constrained"
  | "unknown"
  | "unavailable"
  | "neutral";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className = "",
}) => {
  const getStyle = () => {
    switch (status) {
      case "pass":
      case "optimal":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "warn":
      case "acceptable":
      case "suboptimal":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "fail":
      case "constrained":
        return "bg-red-50 text-red-800 border-red-200";
      case "unknown":
      case "unavailable":
      case "neutral":
      default:
        return "bg-stone-100 text-stone-700 border-stone-200";
    }
  };

  const text = label || status.toUpperCase();

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider font-semibold border ${getStyle()} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          status === "pass" || status === "optimal"
            ? "bg-emerald-600"
            : status === "warn" || status === "acceptable" || status === "suboptimal"
            ? "bg-amber-600"
            : status === "fail" || status === "constrained"
            ? "bg-red-600"
            : "bg-stone-500"
        }`}
      />
      {text}
    </span>
  );
};
