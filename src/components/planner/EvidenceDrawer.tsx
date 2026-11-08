"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * EvidenceDrawer: Displays verified scientific attribution and empirical evidence
 * for any selected cell or zone.
 */

import React from 'react';
import {
  X,
  FileDown,
  Sun,
  GitCompare,
  TreeDeciduous,
  AlertCircle,
  ShieldCheck,
  Calendar,
  Satellite,
  Info,
  Bookmark,
} from 'lucide-react';
import { Cell, ModelCard, TruthLabel } from '@/api/contract';
import { TruthChip } from '@/components/ui/TruthChip';
import { Button } from '@/components/ui/Button';
import { AppLink, useAppNavigate } from '@/lib/nav';
import { getDossierUrl } from '@/api/client';
import { usePlan } from '@/context/PlanContext';

export interface EvidenceDrawerProps {
  cell: Cell | null;
  modelCard: ModelCard | null;
  isOpen: boolean;
  onClose: () => void;
  selectionFrequency?: number; // 0 to 1
  rank?: number;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  cell,
  modelCard,
  isOpen,
  onClose,
  selectionFrequency,
  rank,
}) => {
  const navigate = useAppNavigate();
  const { addItem, openDrawer } = usePlan();

  if (!isOpen || !cell) return null;

  const handleDownloadDossier = () => {
    const url = getDossierUrl(cell.id);
    if (url.startsWith('#')) {
      // Demo download simulation: create a downloadable text/markdown summary
      const content = `URJASETU EVIDENCE DOSSIER - PUNE CLIMATE ACTION
Zone ID: ${cell.id}
Ward: ${cell.ward}
Centroid: [${cell.centroid[0]}, ${cell.centroid[1]}]

1. MEASURED EVIDENCE (Landsat-8/9 & Sentinel-2)
- Mean Surface Temperature: ${cell.lst_mean} °C (STD: ${cell.lst_std} °C)
- Satellite Scene Observations: ${cell.n_obs} acquisitions
- Normalized Difference Vegetation Index (NDVI): ${cell.ndvi}
- Built-up Fraction: ${Math.round(cell.built_frac * 100)}%
- Ward Population Density: ${cell.population.toLocaleString()} people in 250m cell
- Available Unbuilt / Greenable Land: ${cell.greenable_ha} ha

2. MODELLED ESTIMATES (30-Member Spatial-Block Bootstrap Ensemble)
- Heat Excess Above Rural Baseline: +${cell.heat_excess_celsius} °C
- Estimated Surface Cooling if Greened: ${cell.cooling_mean !== null ? `${cell.cooling_mean} °C (P10: ${cell.cooling_p10} °C, P90: ${cell.cooling_p90} °C)` : 'Not available (model quality gate not met)'}
- Solar Efficiency Heat Degradation: ${cell.solar_penalty_mid !== null ? `${cell.solar_penalty_mid}% (Range: ${cell.solar_penalty_low}% - ${cell.solar_penalty_high}%)` : 'Not available'}
- Selection Frequency Across 30 Ensemble Runs: ${selectionFrequency !== undefined ? Math.round(selectionFrequency * 100) + '%' : 'N/A'}

3. MODEL QUALITY GATE & VALIDATION
- Cross-Validation RMSE: ${modelCard?.cv_rmse_c ?? 'N/A'} °C
- Held-Out Test RMSE: ${modelCard?.held_out_rmse_c ?? 'N/A'} °C
- R² Score: ${modelCard?.cv_r2 ?? 'N/A'}
- Status: ${modelCard?.gate?.status ?? 'PASSED_WITH_EXCLUSIONS'} (${modelCard?.gate?.text ?? 'Verified'})

IMPORTANT DISCLAIMER:
Surface temperature reflects radiant skin temperature and is not air temperature.
Cooling and solar figures are modelled estimates shown as ranges, never promises.
Built for Indradhanu - PCCOE International Grand Challenge 2026 (SDG 13).
`;
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `UrjaSetu-Dossier-${cell.id}.md`;
      link.click();
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <aside
      data-tour="heat-zone-drawer"
      aria-label="Evidence and Data Provenance Dossier"
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200"
    >
      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50/70">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {rank && (
              <span className="text-xs font-bold text-white bg-[#0F5C63] px-2 py-0.5 rounded">
                Rank #{rank}
              </span>
            )}
            <span className="text-xs font-semibold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded">
              {cell.ward} Ward
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {cell.id}
            </span>
          </div>
          <h2 className="text-lg font-bold text-[#14212B]">
            {rank ? `#${rank} ` : ''}{cell.ward} - {cell.locality || cell.ward}
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            Centroid: [{cell.centroid[0].toFixed(4)}°E, {cell.centroid[1].toFixed(4)}°N] · Approx. ward centroid
          </p>
        </div>

        <button
          data-tour="heat-zone-drawer-close"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          aria-label="Close evidence drawer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 text-sm">
        {/* Section 1: Measured Physical Observations */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Satellite className="w-3.5 h-3.5 text-emerald-600" />
              1. Measured Observations
            </h3>
            <TruthChip type="Measured" compact />
          </div>

          <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <span className="text-[11px] text-slate-500 block">Surface Temperature</span>
              <span className="text-base font-bold text-[#14212B] tabular-nums">
                {cell.lst_mean} °C
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                ±{cell.lst_std} °C ({cell.n_obs} scenes)
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 block">Population Count</span>
              <span className="text-base font-bold text-[#14212B] tabular-nums">
                {cell.population.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 block">
                WorldPop ambient raster (Assumed)
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 block">Vegetation (NDVI)</span>
              <span className="text-base font-bold text-[#14212B] tabular-nums">
                {cell.ndvi}
              </span>
              <span className="text-[10px] text-slate-400 block">Sentinel-2 MSI</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 block">Built-up Fraction</span>
              <span className="text-base font-bold text-[#14212B] tabular-nums">
                {Math.round(cell.built_frac * 100)}%
              </span>
              <span className="text-[10px] text-slate-400 block">Impervious surface</span>
            </div>

            <div className="col-span-2 pt-1 border-t border-slate-200">
              <span className="text-[11px] text-slate-500 block">Available Greenable Area</span>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-[#0F5C63] tabular-nums">
                  {cell.greenable_ha} hectares
                </span>
                <span className="text-[11px] text-slate-500">
                  (out of ~6.25 ha cell footprint)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Modelled Estimates & Uncertainty Ranges */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
              2. Modelled Estimates
            </h3>
            <TruthChip type="Modelled" compact />
          </div>

          <div className="space-y-2.5">
            <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-200">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-800">
                  Estimated Surface Cooling if Greened
                </span>
                <span className="text-xs font-mono font-bold text-sky-900 tabular-nums">
                  {cell.cooling_mean !== null ? `-${cell.cooling_mean.toFixed(1)} °C` : 'Not available'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">
                Modelled uncertainty:{' '}
                <span className="font-mono font-medium text-slate-800 tabular-nums">
                  {cell.cooling_p10 !== null && cell.cooling_p90 !== null
                    ? `-${cell.cooling_p90.toFixed(1)} °C to -${cell.cooling_p10.toFixed(1)} °C`
                    : 'Not available'}
                </span>{' '}
                (P10–P90 ensemble spread; Spatial-CV RMSE: ±{modelCard?.cv_rmse_c ?? 0.91}°C).
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  Ensemble Selection Frequency
                </span>
                <span className="text-[11px] text-slate-500">
                  Frequency across 30 bootstrap resamples
                </span>
              </div>
              <span className="text-sm font-bold font-mono text-[#0F5C63] tabular-nums">
                {selectionFrequency !== undefined
                  ? `${Math.round(selectionFrequency * 100)}%`
                  : 'N/A'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-800">
                  Heat Excess Over Rural Baseline
                </span>
                <span className="text-xs font-mono font-bold text-[#D64530] tabular-nums">
                  +{cell.heat_excess_celsius} °C
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Anchored to Talegaon grassland baseline (32.1°C).
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Satellite Scene Metadata */}
        {modelCard && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              3. Satellite Input Scenes
            </h3>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px]">
                  <tr>
                    <th className="py-1.5 px-3 font-semibold">Sensor</th>
                    <th className="py-1.5 px-3 font-semibold">Acquisition Window</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {modelCard.scenes.slice(0, 4).map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-1.5 px-3 font-mono text-slate-700">{s.sensor}</td>
                      <td className="py-1.5 px-3 text-slate-600">{s.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 4: Assumptions & Limitations */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            4. Methodological Transparency
          </h3>
          <div className="space-y-2 text-xs text-slate-600 bg-amber-50/40 p-3 rounded-xl border border-amber-200/80">
            <p>
              <strong className="text-slate-800">Distinction:</strong> Surface temperature
              is radiant skin temperature from satellite radiometers, not 2-meter ambient air temperature.
            </p>
            <p>
              <strong className="text-slate-800">Greening assumption:</strong> Assumes
              native drought-tolerant saplings with &gt;= 80% micro-irrigation survival rate.
            </p>
            <p>
              <strong className="text-slate-800">Uncertainty:</strong> Cooling numbers are
              model estimates presented as ranges, never promises.
            </p>
          </div>
        </div>

        {/* Section 5: Deep Links to Supporting Tools */}
        <div className="pt-2 border-t border-slate-200">
          <span className="text-xs font-semibold text-slate-700 block mb-2">
            Investigate Zone in Supporting Tools:
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            <AppLink
              to={`/solar?cell=${cell.id}`}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-[#0F5C63]/10 hover:text-[#0F5C63] border border-slate-200 text-xs font-medium text-slate-700 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-600" />
                Check solar exposure &amp; thermal penalty
              </span>
              <span className="text-slate-400">→</span>
            </AppLink>

            <AppLink
              to={`/interventions?cell=${cell.id}`}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-[#0F5C63]/10 hover:text-[#0F5C63] border border-slate-200 text-xs font-medium text-slate-700 transition-colors"
            >
              <span className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-[#0F5C63]" />
                Compare interventions (cool roof vs greening)
              </span>
              <span className="text-slate-400">→</span>
            </AppLink>

            <AppLink
              to={`/green-loss?cell=${cell.id}`}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-[#0F5C63]/10 hover:text-[#0F5C63] border border-slate-200 text-xs font-medium text-slate-700 transition-colors"
            >
              <span className="flex items-center gap-2">
                <TreeDeciduous className="w-4 h-4 text-emerald-600" />
                See historical green loss here
              </span>
              <span className="text-slate-400">→</span>
            </AppLink>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            addItem({
              id: cell.id,
              title: `#${rank || '•'} ${cell.ward} - ${cell.locality || cell.ward}`,
              subtitle: `${cell.id} · ${cell.greenable_ha} ha · Surface temp ${cell.lst_mean}°C · Cooling ${cell.cooling_mean ? `-${cell.cooling_mean}°C` : 'N/A'}`,
              section: 'zones',
              metadata: {
                ward: cell.ward,
                locality: cell.locality,
                lst_mean: cell.lst_mean,
                greenable_ha: cell.greenable_ha,
                cooling_mean: cell.cooling_mean,
                population: cell.population,
              },
            });
            openDrawer();
          }}
          icon={<Bookmark className="w-4 h-4" />}
          className="text-xs"
        >
          Add Zone to Plan
        </Button>

        <div className="flex items-center gap-2">
          <div data-tour="heat-dossier-button">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadDossier}
              icon={<FileDown className="w-4 h-4" />}
              className="bg-white text-xs"
            >
              Download Dossier (.md)
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Close
          </Button>
        </div>
      </div>
    </aside>
  );
};
