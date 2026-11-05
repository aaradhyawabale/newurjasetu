"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SolarSimulatorPage: Solar & Shadow Simulator
 * 1. Geometric Shadow Simulator using SunCalc in browser
 * 2. Solar Heat Degradation Penalty model
 */

import React, { useState, useEffect, useMemo } from 'react';
import { getPosition } from '@/lib/suncalc';
import { Cell, SolarModelCard, Site } from '@/api/contract';
import { getCells, getSolarModelCard, getSites } from '@/api/client';
import { ToolPageHeader } from '@/components/ui/ToolPageHeader';
import { Tabs, Slider } from '@/components/ui/FormControls';
import { TruthChip } from '@/components/ui/TruthChip';
import { Skeleton, ErrorState } from '@/components/ui/FeedbackStates';
import { MapView } from '@/components/map/MapView';
import { useAppSearchParams } from '@/lib/nav';
import {
  Sun,
  Layers,
  Clock,
  Compass,
  AlertTriangle,
  Info,
  Calendar,
  Zap,
} from 'lucide-react';

export const SolarSimulatorPage: React.FC = () => {
  const [searchParams] = useAppSearchParams();
  const initialCellId = searchParams.get('cell');

  const [activeTab, setActiveTab] = useState<'shadow' | 'penalty'>('shadow');
  const [cells, setCells] = useState<Cell[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [solarCard, setSolarCard] = useState<SolarModelCard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // TAB 1: Shadow Simulator State
  const [selectedSiteId, setSelectedSiteId] = useState<string>('SITE-01');
  const [dayOfYear, setDayOfYear] = useState<number>(110); // Mid-April (pre-monsoon peak)
  const [hourOfDay, setHourOfDay] = useState<number>(13.5); // 1:30 PM
  const [panelTilt, setPanelTilt] = useState<number>(18); // Pune latitude ~18.5°
  const [panelAzimuth, setPanelAzimuth] = useState<number>(180); // True South
  const [obstacleHeight, setObstacleHeight] = useState<number>(12); // meters
  const [obstacleWidth, setObstacleWidth] = useState<number>(20); // meters

  // TAB 2: Solar Heat Penalty State
  // Alpha slider: Assumed heat transfer coefficient (min 0.2, max 0.8, default 0.5)
  const [alpha, setAlpha] = useState<number>(0.5);
  const [selectedPenaltyCellId, setSelectedPenaltyCellId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [c, s, card] = await Promise.all([
          getCells(),
          getSites(),
          getSolarModelCard(),
        ]);
        setCells(c);
        setSites(s);
        setSolarCard(card);

        if (initialCellId) {
          setSelectedPenaltyCellId(initialCellId);
          setActiveTab('penalty');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load solar data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [initialCellId]);

  const selectedSite = sites.find((s) => s.id === selectedSiteId) || sites[0];

  const hour = Math.floor(hourOfDay);
  const minutes = Math.round((hourOfDay - hour) * 60);

  // TAB 1 CALCULATIONS: Sun position and shadow geometry via SunCalc
  const simDate = useMemo(() => {
    const d = new Date(2026, 0, 1);
    d.setDate(dayOfYear);
    d.setHours(hour, minutes, 0, 0);
    return d;
  }, [dayOfYear, hour, minutes]);

  const siteLat = selectedSite ? selectedSite.lat : 18.5204;
  const siteLng = selectedSite ? selectedSite.lng : 73.8567;

  // SunCalc v2 returns altitude and azimuth in degrees
  const sunPos = getPosition(simDate, siteLat, siteLng);
  const altitudeDeg = Math.round(sunPos.altitude * 10) / 10;
  const compassAzimuth = Math.round(sunPos.azimuth);

  const isSunUp = sunPos.altitude > 2; // > 2 degrees above horizon
  const altitudeRad = (sunPos.altitude * Math.PI) / 180;
  const shadowLengthMeters = isSunUp
    ? Math.min(100, Math.round((obstacleHeight / Math.tan(altitudeRad)) * 10) / 10)
    : 0;

  // Compute hourly shadow length for the day (6 AM to 6 PM)
  const hourlyData = useMemo(() => {
    const list: Array<{ hour: number; altitude: number; isShaded: boolean; label: string }> = [];
    for (let h = 6; h <= 18; h++) {
      const d = new Date(simDate);
      d.setHours(h, 0, 0, 0);
      const pos = getPosition(d, siteLat, siteLng);
      const alt = pos.altitude;
      const altRad = (alt * Math.PI) / 180;
      const len = alt > 3 ? obstacleHeight / Math.tan(altRad) : 999;
      const shaded = alt > 0 && len > 15;
      list.push({
        hour: h,
        altitude: Math.max(0, Math.round(alt)),
        isShaded: shaded,
        label: `${h}:00`,
      });
    }
    return list;
  }, [simDate, obstacleHeight, siteLat, siteLng]);

  if (loading) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[520px] w-full" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </main>
    );
  }

  // TAB 2 CALCULATIONS: Solar Heat Penalty
  // Ranking MUST strictly depend on heat_excess_celsius, NOT on alpha!
  const rankedPenaltyCells = [...cells].sort(
    (a, b) => b.heat_excess_celsius - a.heat_excess_celsius
  );

  const activePenaltyCell =
    cells.find((c) => c.id === selectedPenaltyCellId) || rankedPenaltyCells[0];

  const empiricalGamma = solarCard?.gamma_pct_per_c ?? -0.42;
  const datasheetGamma = solarCard?.datasheet_gamma_pct_per_c ?? -0.38;

  // Compute thermal degradation penalty range using alpha and gamma
  // Penalty % = heat_excess_celsius * alpha * abs(gamma)
  const getCellPenalty = (cell: Cell, userAlpha: number) => {
    const mid = Math.round(cell.heat_excess_celsius * userAlpha * Math.abs(empiricalGamma) * 10) / 10;
    const low = Math.round(mid * 0.85 * 10) / 10;
    const high = Math.round(mid * 1.15 * 10) / 10;
    return { mid, low, high };
  };

  const activeCellPenalty = getCellPenalty(activePenaltyCell, alpha);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
      <ToolPageHeader
        title="Solar & Shadow Simulator"
        purpose="Model geometric rooftop shadow footprints throughout the year, and compute solar PV thermal degradation penalties induced by excessive urban surface heat."
        steps={[
          'Use the Shadow Simulator to test seasonal sun angles and obstacle obstruction over rooftop PV arrays.',
          'Switch to Solar Heat Penalty to view rooftop thermal efficiency loss across Pune’s hottest wards.',
          'Adjust the assumed thermal transfer factor (alpha) to evaluate sensitivity without altering ward rankings.',
        ]}
        dataUsed={[
          { label: 'SunCalc Geometric Ephemeris', type: 'Measured' },
          { label: 'Empirical Thermal Derating (Gamma)', type: 'Modelled' },
          { label: 'Heat Transfer Coefficient (Alpha)', type: 'Assumed' },
        ]}
        breadcrumbItems={[{ label: 'Solar & Shadow Simulator' }]}
      />

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'shadow', label: '1. Geometric Shadow Simulator' },
          { id: 'penalty', label: '2. Solar Heat Penalty (Urban Heat Derating)' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as 'shadow' | 'penalty')}
      />

      {/* ===================== TAB 1: SHADOW SIMULATOR ===================== */}
      {activeTab === 'shadow' && (
        <div className="space-y-6">
          {/* Label banner */}
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Geometric Simulation Only:</span> Ray-tracing
              computations reflect direct astronomical sun position calculated in browser via
              SunCalc. Diffuse atmospheric scattering and cloud transmittance are not included.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Controls (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-[#14212B]">
                    Simulation Parameters
                  </h2>
                  <span className="text-xs text-slate-500">
                    Calculated for Pune latitude (~18.52° N)
                  </span>
                </div>
                <TruthChip type="Assumed" compact />
              </div>

              {/* Site selector */}
              <div>
                <label htmlFor="solar-site" className="text-xs font-semibold text-slate-700 block mb-1">
                  Reference Rooftop Site:
                </label>
                <select
                  id="solar-site"
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63] cursor-pointer"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.ward})
                    </option>
                  ))}
                </select>
              </div>

              {/* Day of year slider */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <Slider
                  id="day-slider"
                  label={`Calendar Date: ${simDate.toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                  })}`}
                  value={dayOfYear}
                  min={1}
                  max={365}
                  step={1}
                  unit="day"
                  onChange={setDayOfYear}
                  helpText="Day 110 = Peak pre-monsoon heat window"
                />
              </div>

              {/* Time of day slider */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <Slider
                  id="hour-slider"
                  label={`Time of Day: ${String(hour).padStart(2, '0')}:${String(
                    minutes
                  ).padStart(2, '0')}`}
                  value={hourOfDay}
                  min={6}
                  max={18}
                  step={0.5}
                  unit="hrs"
                  onChange={setHourOfDay}
                  helpText="Local Solar Time (IST)"
                />
              </div>

              {/* Obstacle Height and Width */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <Slider
                    id="obs-height-slider"
                    label="Obstacle Height"
                    value={obstacleHeight}
                    min={3}
                    max={30}
                    step={1}
                    unit="m"
                    onChange={setObstacleHeight}
                  />
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <Slider
                    id="obs-width-slider"
                    label="Obstacle Width"
                    value={obstacleWidth}
                    min={5}
                    max={40}
                    step={1}
                    unit="m"
                    onChange={setObstacleWidth}
                  />
                </div>
              </div>

              {/* Panel Tilt & Azimuth */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <Slider
                    id="panel-tilt-slider"
                    label="Panel Tilt"
                    value={panelTilt}
                    min={0}
                    max={45}
                    step={1}
                    unit="°"
                    onChange={setPanelTilt}
                  />
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <Slider
                    id="panel-azimuth-slider"
                    label="Azimuth"
                    value={panelAzimuth}
                    min={90}
                    max={270}
                    step={5}
                    unit="°"
                    onChange={setPanelAzimuth}
                    helpText="180° = True South"
                  />
                </div>
              </div>
            </div>

            {/* Visualizer (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Ephemeris Summary Banner */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-xs text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Sun Solar Altitude</span>
                  <span className="text-base font-bold font-mono text-slate-800 tabular-nums">
                    {isSunUp ? `${altitudeDeg}° above horizon` : 'Below horizon (Night)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Solar Azimuth</span>
                  <span className="text-base font-bold font-mono text-slate-800 tabular-nums">
                    {compassAzimuth}° (Bearing)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Projected Shadow</span>
                  <span className="text-base font-bold font-mono text-[#0F5C63] tabular-nums">
                    {isSunUp ? `${shadowLengthMeters} meters` : '0 m'}
                  </span>
                </div>
              </div>

              {/* Interactive SVG Rooftop & Shadow Canvas */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col items-center justify-center relative overflow-hidden">
                <div className="w-full flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="font-semibold text-slate-700">
                    2D Plan View (Top-Down Rooftop Plane)
                  </span>
                  <span className="font-mono text-[11px]">North is Up (↑ 0°)</span>
                </div>

                <svg
                  viewBox="-120 -120 240 240"
                  className="w-full max-w-[440px] h-[340px] bg-slate-50 rounded-xl border border-slate-200"
                >
                  {/* Grid lines */}
                  <line x1="-120" y1="0" x2="120" y2="0" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1="-120" x2="0" y2="120" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />

                  {/* Cardinal directions */}
                  <text x="0" y="-105" textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="bold">N</text>
                  <text x="105" y="4" textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="bold">E</text>
                  <text x="0" y="112" textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="bold">S</text>
                  <text x="-105" y="4" textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="bold">W</text>

                  {/* 10m, 20m, 30m distance rings */}
                  <circle cx="0" cy="0" r="30" fill="none" stroke="#E2E8F0" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="60" fill="none" stroke="#E2E8F0" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="90" fill="none" stroke="#E2E8F0" strokeWidth="0.8" />

                  {/* Obstacle at center: width and depth */}
                  {(() => {
                    const w = obstacleWidth * 1.8;
                    const h = 18; // depth on roof

                    // Sun ray angle in SVG coords:
                    // compassAzimuth: 0=North(y-), 90=East(x+), 180=South(y+), 270=West(x-)
                    // Sun vector:
                    const sunAngleRad = (compassAzimuth - 90) * (Math.PI / 180);
                    // Shadow projects in opposite direction:
                    const shadowAngleRad = sunAngleRad + Math.PI;

                    const sl = Math.min(100, shadowLengthMeters * 1.5);
                    const dx = Math.cos(shadowAngleRad) * sl;
                    const dy = Math.sin(shadowAngleRad) * sl;

                    // Obstacle 4 corners
                    const x1 = -w / 2;
                    const y1 = -h / 2;
                    const x2 = w / 2;
                    const y2 = -h / 2;
                    const x3 = w / 2;
                    const y3 = h / 2;
                    const x4 = -w / 2;
                    const y4 = h / 2;

                    // Shadow polygon vertices
                    const sp1 = `${x1},${y1}`;
                    const sp2 = `${x2},${y2}`;
                    const sp3 = `${x2 + dx},${y2 + dy}`;
                    const sp4 = `${x1 + dx},${y1 + dy}`;

                    return (
                      <>
                        {/* Shadow Polygon */}
                        {isSunUp && sl > 1 && (
                          <polygon
                            points={`${sp1} ${sp2} ${sp3} ${sp4}`}
                            fill="#14212B"
                            opacity="0.32"
                          />
                        )}

                        {/* Obstacle Body */}
                        <rect
                          x={x1}
                          y={y1}
                          width={w}
                          height={h}
                          fill="#475569"
                          stroke="#1E293B"
                          strokeWidth="1.5"
                          rx="2"
                        />
                        <text
                          x="0"
                          y="3"
                          textAnchor="middle"
                          fontSize="8"
                          fill="#FFFFFF"
                          fontWeight="bold"
                        >
                          Building Obstacle ({obstacleHeight}m)
                        </text>

                        {/* Sun vector indicator */}
                        {isSunUp && (
                          <g transform={`translate(${Math.cos(sunAngleRad) * 90}, ${Math.sin(sunAngleRad) * 90})`}>
                            <circle cx="0" cy="0" r="8" fill="#F59E0B" />
                            <circle cx="0" cy="0" r="12" fill="#F59E0B" opacity="0.25" />
                          </g>
                        )}
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* Shaded-Hours Chart for the Day */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-xs font-bold text-slate-800 block mb-2">
                  Hourly Solar Access Timeline (6:00 AM to 6:00 PM)
                </span>
                <div className="grid grid-cols-13 gap-1 text-center">
                  {hourlyData.map((d) => (
                    <div key={d.hour} className="flex flex-col items-center gap-1">
                      <div
                        className={`w-full h-12 rounded-md flex flex-col justify-end p-0.5 text-[9px] font-mono ${
                          d.altitude === 0
                            ? 'bg-slate-100 text-slate-400'
                            : d.isShaded
                            ? 'bg-amber-400 text-slate-900 font-bold'
                            : 'bg-emerald-500 text-white font-bold'
                        }`}
                        title={`${d.label}: Altitude ${d.altitude}°, ${
                          d.isShaded ? 'Shaded by obstacle' : 'Full solar exposure'
                        }`}
                      >
                        <span className="truncate">{d.altitude}°</span>
                      </div>
                      <span className="text-[9px] text-slate-500">{d.hour}h</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                    Unobstructed Sunlight
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />
                    Shaded by Obstacle
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: SOLAR HEAT PENALTY ===================== */}
      {activeTab === 'penalty' && (
        <div className="space-y-6">
          {/* Transparent Model Calibration Card */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#14212B]">
                    Urban Heat Island Derating: Gamma Comparison
                  </h2>
                  <TruthChip type="Modelled" label="Gamma (-0.42 %/°C)" compact />
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Data-derived gamma reflects real-world microclimate convective airflow and urban
                  rooftop heat traps, whereas standard panel datasheets test modules inside
                  climate-controlled laminar wind tunnels at Standard Test Conditions (STC 25°C).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="p-2.5 bg-sky-50 rounded-lg">
                <span className="text-slate-500 block text-[11px]">Data-Derived Gamma</span>
                <span className="text-lg font-bold font-mono text-sky-900 tabular-nums">
                  {empiricalGamma} %/°C
                </span>
                <span className="text-[10px] text-slate-500 block font-mono">
                  95% CI: [{solarCard?.gamma_ci_low}, {solarCard?.gamma_ci_high}]
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block text-[11px]">Datasheet Standard Spec</span>
                <span className="text-lg font-bold font-mono text-slate-800 tabular-nums">
                  {datasheetGamma} %/°C
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  STC (25°C standard test)
                </span>
              </div>

              <div className="p-2.5 bg-amber-50 rounded-lg">
                <span className="text-slate-500 block text-[11px]">Assumed Alpha Parameter</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold font-mono text-amber-900 tabular-nums">
                    α = {alpha}
                  </span>
                  <TruthChip type="Assumed" compact />
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Surface-to-module transfer factor
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Map Column (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="h-[480px] rounded-xl overflow-hidden border border-slate-200">
                <MapView
                  cells={cells}
                  activeLayer="lst"
                  onSelect={(cell) => setSelectedPenaltyCellId(cell.id)}
                  height="100%"
                />
              </div>
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>
                  Map ranked by satellite <strong>surface heat excess (°C)</strong>. Note:
                  Ranking is completely invariant to the alpha slider.
                </span>
                <TruthChip type="Measured" label="Surface Temp" compact />
              </div>
            </div>

            {/* Slider & Ranked List (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
              <div>
                <h3 className="text-base font-bold text-[#14212B]">
                  Thermal Derating Sensitivity
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adjust alpha to observe scenario output-loss ranges across hot wards.
                </p>
              </div>

              {/* Alpha Slider */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                <Slider
                  id="alpha-slider"
                  label="Thermal Transfer Coefficient (Alpha)"
                  value={alpha}
                  min={0.2}
                  max={0.8}
                  step={0.05}
                  unit="α"
                  truth="Assumed"
                  onChange={setAlpha}
                  helpText="0.2 = well-ventilated mount, 0.8 = unventilated asphalt roof"
                />
              </div>

              {/* Active Selected Cell Output Loss Highlight */}
              {activePenaltyCell && (
                <div className="p-3 bg-sky-50/60 border border-sky-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      Zone {activePenaltyCell.id} ({activePenaltyCell.ward})
                    </span>
                    <TruthChip type="Modelled" label="Output Loss" compact />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-rose-700 tabular-nums">
                      -{activeCellPenalty.mid}%
                    </span>
                    <span className="text-slate-600 font-mono text-xs">
                      (range: -{activeCellPenalty.low}% to -{activeCellPenalty.high}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Due to measured surface heat excess of{' '}
                    <strong>+{activePenaltyCell.heat_excess_celsius}°C</strong> over rural baseline.
                    (No kWh claims made).
                  </p>
                </div>
              )}

              {/* Ranked Cells by Surface Heat Excess */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-2">
                  Hottest Monitored Zones (Ranked by Heat Excess):
                </span>
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {rankedPenaltyCells.slice(0, 10).map((c, idx) => {
                    const pen = getCellPenalty(c, alpha);
                    const isSelected = c.id === activePenaltyCell.id;

                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedPenaltyCellId(c.id)}
                        className={`w-full p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#0F5C63]/10 border-[#0F5C63] font-semibold'
                            : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <span className="font-bold text-slate-900 mr-2">
                            #{idx + 1} {c.id}
                          </span>
                          <span className="text-slate-500 text-[11px]">{c.ward}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-rose-700 font-bold block">
                            -{pen.mid}% PV loss
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            +{c.heat_excess_celsius}°C heat
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
