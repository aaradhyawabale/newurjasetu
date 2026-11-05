"use client";

import React, { useState } from "react";
import { Info, HelpCircle } from "lucide-react";

export type GlossaryKey =
  | "lst"
  | "ndvi"
  | "ndbi"
  | "heat_burden"
  | "cooling_effect"
  | "derating"
  | "ensemble"
  | "surface_vs_air"
  | "greenable_ha"
  | "smart_fit";

interface GlossaryDefinition {
  title: string;
  term: string;
  scientificDefinition: string;
  provenance: "Measured" | "Modelled" | "Assumed";
  practicalMeaning: string;
  cautionNotice?: string;
}

export const GLOSSARY_DICTIONARY: Record<GlossaryKey, GlossaryDefinition> = {
  lst: {
    title: "Land Surface Temperature (LST)",
    term: "LST",
    scientificDefinition: "Thermal radiometric skin temperature observed by Landsat-9 TIRS-2 sensor at ~100m resampled to 250m.",
    provenance: "Measured",
    practicalMeaning: "The direct temperature of roofs, roads, and soil when illuminated by direct sun.",
    cautionNotice: "Surface temperature is not ambient air temperature. Ambient 2m air temp is typically 4°C to 8°C lower during daytime peaks."
  },
  ndvi: {
    title: "Normalized Difference Vegetation Index (NDVI)",
    term: "NDVI",
    scientificDefinition: "(NIR - Red) / (NIR + Red) reflectance index derived from Sentinel-2 MSI satellite imagery.",
    provenance: "Measured",
    practicalMeaning: "Measures green photosynthetic canopy density. Values <0.15 indicate bare rock or asphalt; >0.6 indicate dense forest/canopy.",
  },
  ndbi: {
    title: "Normalized Difference Built-up Index (NDBI)",
    term: "NDBI",
    scientificDefinition: "(SWIR - NIR) / (SWIR + NIR) index identifying impervious built-up urban morphology from satellite.",
    provenance: "Measured",
    practicalMeaning: "Pinpoints concrete, paved ground, and roof density that absorb and trap solar thermal radiation.",
  },
  heat_burden: {
    title: "Heat Stress / Heat Burden Index",
    term: "Heat Burden",
    scientificDefinition: "Dimensionless composite index integrating satellite LST excess above regional baseline, residential population density, and vegetation deficit.",
    provenance: "Modelled",
    practicalMeaning: "Prioritizes municipal wards where high physical surface heat directly collides with concentrated human habitation.",
  },
  cooling_effect: {
    title: "Modelled Cooling Benefit (°C)",
    term: "Cooling Range",
    scientificDefinition: "Thermodynamic microclimate cooling modelled through LightGBM gradient boosting trained on Landsat-9 surface heat and canopy density.",
    provenance: "Modelled",
    practicalMeaning: "The expected reduction in peak surface temperature (°C) if the designated area is transformed with shade trees.",
    cautionNotice: "Results reflect daytime surface skin cooling; localized microclimate impacts depend on tree species canopy height and irrigation."
  },
  derating: {
    title: "Solar Heat Penalty / PV Thermal Derating",
    term: "Solar Derating",
    scientificDefinition: "Temperature-dependent percentage drop in crystalline photovoltaic conversion efficiency above standard test conditions (25°C).",
    provenance: "Modelled",
    practicalMeaning: "Extreme urban heat reduces solar panel energy yield by 2% to 6% during peak afternoon hours.",
  },
  ensemble: {
    title: "Bootstrap Monte Carlo Ensemble (30 Runs)",
    term: "Ensemble Bounds",
    scientificDefinition: "30-run physical parameter perturbation generating p10 (conservative 10th percentile), mean, and p90 (optimistic 90th percentile) bounds.",
    provenance: "Modelled",
    practicalMeaning: "Provides honest confidence intervals so municipal engineers understand the risk bounds of cooling forecasts.",
  },
  surface_vs_air: {
    title: "Surface vs Air Temperature Distinction",
    term: "Surface vs Air Temp",
    scientificDefinition: "Satellite sensors observe radiometric surface skin heat; weather stations observe ambient air at 2m height.",
    provenance: "Assumed",
    practicalMeaning: "Asphalt surfaces can reach 50°C while ambient air is 38°C. Both contribute to heat stress, but surface heat drives localized radiant load.",
    cautionNotice: "Never present satellite LST as official ambient meteorological weather temperature."
  },
  greenable_ha: {
    title: "Greenable Area (Hectares)",
    term: "Greenable Area",
    scientificDefinition: "Open ground, median corridors, setbacks, and institutional grounds suitable for canopy planting without demolishing buildings.",
    provenance: "Measured",
    practicalMeaning: "The actual physical open space within a 250m cell available for planting trees or pocket parks.",
  },
  smart_fit: {
    title: "Smart-Fit Multi-Criteria Siting",
    term: "Smart-Fit Siting",
    scientificDefinition: "Spatial multi-criteria decision analysis evaluating setbacks, power substations, arterial roads, water buffers, and terrain slope.",
    provenance: "Modelled",
    practicalMeaning: "Automated spatial compliance engine checking whether a proposed civic site satisfies state UDCPR 2020 municipal planning norms.",
  }
};

interface GlossaryTooltipProps {
  glossaryKey: GlossaryKey;
  children?: React.ReactNode;
  showIcon?: boolean;
  className?: string;
}

export const GlossaryTooltip: React.FC<GlossaryTooltipProps> = ({
  glossaryKey,
  children,
  showIcon = true,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const entry = GLOSSARY_DICTIONARY[glossaryKey];

  if (!entry) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className="relative inline-flex items-center gap-1 group">
      <span
        tabIndex={0}
        role="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          } else if (e.key === "Escape") {
            setIsOpen(false);
          }
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className={`cursor-help border-b border-dotted border-slate-400 hover:border-emerald-400 text-inherit transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded-xs px-0.5 ${className}`}
      >
        {children || entry.term}
        {showIcon && (
          <HelpCircle className="inline-block w-3.5 h-3.5 ml-1 text-slate-400 hover:text-emerald-400 align-text-bottom transition-colors" />
        )}
      </span>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl text-left pointer-events-auto backdrop-blur-md"
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-100 tracking-tight">
              {entry.title}
            </span>
            <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {entry.provenance}
            </span>
          </div>

          <p className="text-xs text-slate-300 mb-1.5 leading-relaxed">
            {entry.practicalMeaning}
          </p>

          <p className="text-[11px] text-slate-400 leading-tight font-mono bg-slate-950/60 p-1.5 rounded border border-slate-800/80 mb-1.5">
            <span className="text-emerald-400 font-semibold">Technical: </span>
            {entry.scientificDefinition}
          </p>

          {entry.cautionNotice && (
            <div className="text-[11px] text-amber-300 bg-amber-950/40 p-1.5 rounded border border-amber-800/50 leading-tight">
              <span className="font-bold text-amber-400">Caution: </span>
              {entry.cautionNotice}
            </div>
          )}
        </div>
      )}
    </span>
  );
};
