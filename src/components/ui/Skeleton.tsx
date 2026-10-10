import React from "react";

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div
      className={`animate-pulse bg-stone-200/70 rounded ${className}`}
      aria-hidden="true"
    />
  );
};
