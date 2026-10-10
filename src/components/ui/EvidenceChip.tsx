import React from "react";
import { Link2 } from "lucide-react";

interface EvidenceChipProps {
  id: string;
  onClick?: (id: string) => void;
  className?: string;
}

export const EvidenceChip: React.FC<EvidenceChipProps> = ({ id, onClick, className = "" }) => {
  return (
    <button
      type="button"
      onClick={() => onClick && onClick(id)}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 transition-colors ${className}`}
      title={`View evidence record ${id}`}
    >
      <Link2 className="w-2.5 h-2.5 text-stone-500" />
      <span>{id}</span>
    </button>
  );
};
