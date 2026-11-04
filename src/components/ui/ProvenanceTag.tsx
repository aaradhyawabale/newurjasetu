import React from "react";

export type ProvenanceClassification = "Measured" | "Modelled" | "Assumed";

interface ProvenanceTagProps {
  type: ProvenanceClassification;
  className?: string;
  showBrackets?: boolean;
}

/**
 * Standardized Provenance Badge for UrjaSetu.
 * Tags every displayed scientific, geospatial, or engineering metric as
 * Measured, Modelled, or Assumed.
 */
export const ProvenanceTag: React.FC<ProvenanceTagProps> = ({
  type,
  className = "",
  showBrackets = true,
}) => {
  const colorMap: Record<ProvenanceClassification, string> = {
    Measured:
      "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    Modelled:
      "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
    Assumed:
      "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  };

  const descriptions: Record<ProvenanceClassification, string> = {
    Measured:
      "Measured: Direct physical observation from calibrated satellite instrument, ground sensor, or official municipal master register.",
    Modelled:
      "Modelled: Computed deterministically via physical, spatial, astronomical, or geodesic algorithms.",
    Assumed:
      "Assumed: Indicative planning parameter, preliminary dimension, or exploratory screening threshold requiring field validation.",
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border uppercase tracking-wider select-none align-middle transition-colors ${colorMap[type]} ${className}`}
      title={descriptions[type]}
    >
      {showBrackets ? `[${type}]` : type}
    </span>
  );
};
