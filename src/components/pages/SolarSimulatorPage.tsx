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
import { getPosition, getISTDate, calculateShadowGeometry, PanelSpec, ObstacleSpec } from '@/lib/suncalc';
import { Cell, SolarModelCard, Site } from '@/api/contract';
import { getCells, getSolarModelCard, getSites } from '@/api/client';
import { ToolPageHeader } from '@/components/ui/ToolPageHeader';
import { Tabs, Slider } from '@/components/ui/FormControls';
import { TruthChip } from '@/components/ui/TruthChip';
import { Skeleton, ErrorState } from '@/components/ui/FeedbackStates';
import { MapView } from '@/components/map/MapView';
import { useAppSearchParams, AppLink } from '@/lib/nav';
import { usePlan } from '@/context/PlanContext';
import {
  Sun,
  Layers,
  Clock,
  Compass,
  AlertTriangle,
  Info,
  Calendar,
  Zap,
  PlusCircle,
  Check,
  ArrowRight,
} from 'lucide-react';

const SEASONS = [
  { name: 'Pre-monsoon Peak', day: 110, label: 'Apr 20' },
  { name: 'Summer Solstice', day: 172, label: 'Jun 21' },
  { name: 'Autumn Equinox', day: 266, label: 'Sep 23' },
  { name: 'Winter Solstice', day: 355, label: 'Dec 21' },
];

export const SolarSimulatorPage: React.FC = () => {
  const [searchParams] = useAppSearchParams();
  const initialCellId = searchParams.get('cell');

  const { addItem, plan } = usePlan();
  const addedShadingIds = plan.sections.shading.map((item) => item.id);
  const addedInfraIds = plan.sections.infrastructure.map((item) => item.id);

  const [activeTab, setActiveTab] = useState<'shadow' | 'penalty'>('shadow');
  const [cells, setCells] = useState<Cell[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [solarCard, setSolarCard] = useState<SolarModelCard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // TAB 1: Shadow Simulator State
  const [selectedSiteId, setSelectedSiteId] = useState<string>('SITE-01');
  const [dayOfYear, setDayOfYear] = useState<number>(110); // Mid-April (pre-monsoon peak)
  const [hourOfDay, setHourOfDay] = useState<number>(13.5); // 1:30 PM IST
  const [panelTilt, setPanelTilt] = useState<number>(18); // Pune latitude ~18.5°
  const [panelAzimuth, setPanelAzimuth] = useState<number>(180); // True South
  const [obstacleHeight, setObstacleHeight] = useState<number>(12); // meters
  const [obstacleWidth, setObstacleWidth] = useState<number>(20); // meters
  const [obstacleDistance, setObstacleDistance] = useState<number>(8); // meters from panel
  const [obstacleBearing, setObstacleBearing] = useState<number>(180); // bearing from panel (180 = South)

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

  // TAB 1 CALCULATIONS: Sun position and shadow geometry via deterministic IST getISTDate & SunCalc
  const simDate = useMemo(() => {
    const d = new Date(Date.UTC(2026, 0, dayOfYear));
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    return getISTDate(2026, month, day, hour, minutes);
  }, [dayOfYear, hour, minutes]);

  const siteLat = selectedSite ? selectedSite.lat : 18.5204;
  const siteLng = selectedSite ? selectedSite.lng : 73.8567;

  // SunCalc returns altitude and azimuth in degrees
  const sunPos = useMemo(() => getPosition(simDate, siteLat, siteLng), [simDate, siteLat, siteLng]);
  const altitudeDeg = Math.round(sunPos.altitude * 10) / 10;
  const compassAzimuth = Math.round(sunPos.azimuth);

  // Analytical 2D shadow geometry
  const shadowGeom = useMemo(() => {
    const panel: PanelSpec = {
      lengthM: 6,
      widthM: 10,
      tiltDeg: panelTilt,
      azimuthDeg: panelAzimuth,
    };
    const obstacle: ObstacleSpec = {
      heightM: obstacleHeight,
      widthM: obstacleWidth,
      distanceM: obstacleDistance,
      bearingDeg: obstacleBearing,
    };
    return calculateShadowGeometry(panel, obstacle, sunPos);
  }, [panelTilt, panelAzimuth, obstacleWidth, obstacleHeight, obstacleDistance, obstacleBearing, sunPos]);

  const isSunUp = !shadowGeom.isNight;
  const shadowLengthMeters = Math.round(shadowGeom.shadowLengthM * 10) / 10;
  const shadedPercent = Math.round(shadowGeom.shadedFractionPct);

  // Compute hourly shadow length for the day (6 AM to 6 PM IST)
  const hourlyData = useMemo(() => {
    const list: Array<{
      hour: number;
      altitude: number;
      shadedPercent: number;
      isShaded: boolean;
      isSunUp: boolean;
      label: string;
    }> = [];
    const d = new Date(Date.UTC(2026, 0, dayOfYear));
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();

    for (let h = 6; h <= 18; h++) {
      const t = getISTDate(2026, month, day, h, 0);
      const pos = getPosition(t, siteLat, siteLng);
      const panel: PanelSpec = { lengthM: 6, widthM: 10, tiltDeg: panelTilt, azimuthDeg: panelAzimuth };
      const obs: ObstacleSpec = { heightM: obstacleHeight, widthM: obstacleWidth, distanceM: obstacleDistance, bearingDeg: obstacleBearing };
      const geom = calculateShadowGeometry(panel, obs, pos);
      const sp = Math.round(geom.shadedFractionPct);
      list.push({
        hour: h,
        altitude: Math.max(0, Math.round(pos.altitude * 10) / 10),
        shadedPercent: sp,
        isShaded: sp > 10,
        isSunUp: !geom.isNight,
        label: `${h}:00`,
      });
    }
    return list;
  }, [dayOfYear, siteLat, siteLng, panelTilt, panelAzimuth, obstacleWidth, obstacleHeight, obstacleDistance, obstacleBearing]);

  const sunlitHours = hourlyData.filter((d) => d.isSunUp && d.shadedPercent < 15).length;
  const heavilyShadedHours = hourlyData.filter((d) => d.isSunUp && d.shadedPercent >= 20).length;
  const totalSunUpHours = hourlyData.filter((d) => d.isSunUp).length || 1;
  const geometricSolarAccess = Math.round((sunlitHours / totalSunUpHours) * 100);

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

              {/* Season quick-picks */}
              <div>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <span className="text-[11px] font-semibold text-slate-500 mr-1">Seasons:</span>
                  {SEASONS.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setDayOfYear(s.day)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        dayOfYear === s.day
                          ? 'bg-[#0F5C63] text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {s.name} ({s.label})
                    </button>
                  ))}
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
                    truth="Input"
                    onChange={setDayOfYear}
                    helpText="Day 110 = Peak pre-monsoon heat window"
                  />
                </div>
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
                  truth="Input"
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
                    truth="Input"
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
                    truth="Input"
                    onChange={setObstacleWidth}
                  />
                </div>
              </div>

              {/* Obstacle Distance and Bearing */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <Slider
                    id="obs-dist-slider"
                    label="Obstacle Distance"
                    value={obstacleDistance}
                    min={2}
                    max={25}
                    step={1}
                    unit="m"
                    truth="Input"
                    onChange={setObstacleDistance}
                  />
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <Slider
                    id="obs-bearing-slider"
                    label="Obstacle Bearing"
                    value={obstacleBearing}
                    min={0}
                    max={350}
                    step={10}
                    unit="°"
                    truth="Input"
                    onChange={setObstacleBearing}
                    helpText="180° = South of panel"
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
                    truth="Input"
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
                    truth="Input"
                    onChange={setPanelAzimuth}
                    helpText="180° = True South"
                  />
                </div>
              </div>
            </div>

            {/* Visualizer (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Ephemeris Summary Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-white border border-slate-200 rounded-xl shadow-xs text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Sun Solar Altitude</span>
                  <span className="text-base font-bold font-mono text-slate-800 tabular-nums">
                    {isSunUp ? `${altitudeDeg}°` : 'Night (< 0°)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Solar Azimuth</span>
                  <span className="text-base font-bold font-mono text-slate-800 tabular-nums">
                    {compassAzimuth}°
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Shadow Length</span>
                  <span className="text-base font-bold font-mono text-slate-800 tabular-nums">
                    {isSunUp ? `${shadowLengthMeters}m` : '0m'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Panel Shading</span>
                  <span className={`text-base font-bold font-mono tabular-nums ${shadedPercent > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {shadedPercent}%
                  </span>
                </div>
              </div>

              {/* Interactive SVG Rooftop & Shadow Canvas */}
              <div data-tour="solar-simulator" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col items-center justify-center relative overflow-hidden">
                <div className="w-full flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="font-semibold text-slate-700">
                    Analytical 2D Plan View (Top-Down Rooftop Plane)
                  </span>
                  <span className="font-mono text-[11px]">North is Up (↑ 0°) · Scale: 1m = 4px</span>
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

                  {/* Distance rings: 5m (r=20), 10m (r=40), 15m (r=60), 20m (r=80) */}
                  <circle cx="0" cy="0" r="20" fill="none" stroke="#E2E8F0" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="40" fill="none" stroke="#E2E8F0" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="60" fill="none" stroke="#E2E8F0" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="80" fill="none" stroke="#E2E8F0" strokeWidth="0.8" />

                  {/* Scale labels */}
                  <text x="22" y="-4" fontSize="7" fill="#CBD5E1">5m</text>
                  <text x="42" y="-4" fontSize="7" fill="#CBD5E1">10m</text>
                  <text x="62" y="-4" fontSize="7" fill="#CBD5E1">15m</text>
                  <text x="82" y="-4" fontSize="7" fill="#CBD5E1">20m</text>

                  {/* 1. Analytical Shadow Polygon */}
                  {isSunUp && shadowGeom.shadowPolygon.length >= 3 && (
                    <polygon
                      points={shadowGeom.shadowPolygon
                        .map((pt) => `${Math.round(pt.x * 4)},${Math.round(-pt.y * 4)}`)
                        .join(' ')}
                      fill="#1E293B"
                      fillOpacity="0.35"
                    />
                  )}

                  {/* 2. Obstacle Polygon */}
                  {shadowGeom.obstaclePolygon.length >= 3 && (
                    <polygon
                      points={shadowGeom.obstaclePolygon
                        .map((pt) => `${Math.round(pt.x * 4)},${Math.round(-pt.y * 4)}`)
                        .join(' ')}
                      fill="#64748B"
                      stroke="#334155"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* 3. Panel Polygon */}
                  {shadowGeom.panelPolygon.length >= 3 && (
                    <polygon
                      points={shadowGeom.panelPolygon
                        .map((pt) => `${Math.round(pt.x * 4)},${Math.round(-pt.y * 4)}`)
                        .join(' ')}
                      fill={shadedPercent > 10 ? '#D97706' : '#0284C7'}
                      stroke={shadedPercent > 10 ? '#B45309' : '#0369A1'}
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Panel Label */}
                  <text x="0" y="2" textAnchor="middle" fontSize="7" fill="#FFFFFF" fontWeight="bold">
                    PV Array
                  </text>

                  {/* Obstacle Label */}
                  {(() => {
                    const bRad = (obstacleBearing * Math.PI) / 180;
                    const ox = obstacleDistance * Math.sin(bRad) * 4;
                    const oy = -obstacleDistance * Math.cos(bRad) * 4;
                    return (
                      <text x={ox} y={oy + 2} textAnchor="middle" fontSize="7" fill="#FFFFFF" fontWeight="bold">
                        {obstacleHeight}m Wall
                      </text>
                    );
                  })()}

                  {/* Sun ray direction indicator */}
                  {isSunUp && (
                    (() => {
                      const sunAzRad = (compassAzimuth * Math.PI) / 180;
                      const sx = Math.sin(sunAzRad) * 95;
                      const sy = -Math.cos(sunAzRad) * 95;
                      return (
                        <g transform={`translate(${sx}, ${sy})`}>
                          <circle cx="0" cy="0" r="7" fill="#F59E0B" />
                          <circle cx="0" cy="0" r="11" fill="#F59E0B" opacity="0.25" />
                          <text x="0" y="14" textAnchor="middle" fontSize="7" fill="#B45309" fontWeight="bold">
                            Sun
                          </text>
                        </g>
                      );
                    })()
                  )}
                </svg>

                {!isSunUp && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                    <div className="bg-white/95 rounded-xl px-4 py-2.5 text-center shadow-lg border border-slate-200">
                      <span className="text-xs font-bold text-slate-800 block">Sun Below Horizon (Night)</span>
                      <span className="text-[11px] text-slate-500 font-mono">Solar altitude is &lt; 0° IST</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Shaded-Hours Chart for the Day */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Hourly Solar Access Timeline (6:00 AM to 6:00 PM IST)
                  </span>
                  <div className="flex items-center gap-3 text-[11px] text-slate-600">
                    <span className="font-semibold text-emerald-700">
                      {sunlitHours}h Sunlit
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-amber-700">
                      {heavilyShadedHours}h Shaded (&gt;20%)
                    </span>
                    <span>·</span>
                    <span className="font-bold text-[#0F5C63]">
                      {geometricSolarAccess}% Solar Access
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-13 gap-1 text-center">
                  {hourlyData.map((d) => (
                    <div key={d.hour} className="flex flex-col items-center gap-1">
                      <div
                        className={`w-full h-12 rounded-md flex flex-col justify-end p-0.5 text-[9px] font-mono ${
                          !d.isSunUp
                            ? 'bg-slate-100 text-slate-400'
                            : d.shadedPercent >= 20
                            ? 'bg-amber-400 text-slate-900 font-bold'
                            : 'bg-emerald-500 text-white font-bold'
                        }`}
                        title={`${d.label}: Altitude ${d.altitude}°, ${
                          !d.isSunUp ? 'Below horizon' : `${d.shadedPercent}% shaded`
                        }`}
                      >
                        <span className="truncate">{d.isSunUp ? `${d.altitude}°` : '-'}</span>
                      </div>
                      <span className="text-[9px] text-slate-500">{d.hour}h</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                      Sunlit (&lt;15% shade)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />
                      Obstructed (&ge;20% shade)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const isAdded = addedShadingIds.includes(selectedSite.id);
                        if (!isAdded) {
                          addItem({
                            id: selectedSite.id,
                            title: `Solar Shade - ${selectedSite.name}`,
                            subtitle: `${geometricSolarAccess}% solar access · ${selectedSite.ward}`,
                            section: 'shading',
                            metadata: {
                              site: selectedSite.name,
                              ward: selectedSite.ward,
                              solarAccess: geometricSolarAccess,
                              obstacleHeight,
                              obstacleDistance,
                            },
                          });
                        }
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-[#0F5C63] text-white hover:bg-[#0B484E] transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      {addedShadingIds.includes(selectedSite.id) ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>In Plan</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Add Site to Plan</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('penalty')}
                      className="px-2.5 py-1 text-xs font-semibold text-[#0F5C63] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>See heat exposure for this site</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: SOLAR HEAT PENALTY ===================== */}
      {activeTab === 'penalty' && (
        <div data-tour="solar-penalty-tab" className="space-y-6">
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
                  Empirical gamma is derived from two plants over about 34 days; may include effects
                  beyond cell temperature; compare, do not over-interpret. Standard panel datasheets
                  test modules inside climate-controlled laminar wind tunnels at Standard Test Conditions (STC 25°C).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
              <div data-tour="solar-gamma" className="p-2.5 bg-sky-50 rounded-lg">
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
                  fitBounds={true}
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
              <div data-tour="solar-alpha-slider" className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                <Slider
                  id="alpha-slider"
                  label="Thermal Transfer Coefficient (Alpha)"
                  value={alpha}
                  min={0.2}
                  max={0.8}
                  step={0.05}
                  unit="α"
                  truth="Input"
                  onChange={setAlpha}
                  helpText="Indicative guidance, not measured: 0.2 = well-ventilated mount, 0.8 = unventilated asphalt roof"
                />
              </div>

              {/* Active Selected Cell Output Loss Highlight */}
              {activePenaltyCell && (
                <div data-tour="solar-derate-curve" className="p-3 bg-sky-50/60 border border-sky-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {activePenaltyCell.ward} - {activePenaltyCell.locality || activePenaltyCell.ward} ({activePenaltyCell.id})
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
                    <strong>+{activePenaltyCell.heat_excess_celsius}°C</strong> over cooler rural reference boundary at 30.2°C.
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
                    const isAdded = addedInfraIds.includes(c.id);
                    const loc = c.locality || c.ward;

                    return (
                      <div
                        key={c.id}
                        className={`w-full p-2 rounded-lg border text-left text-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#0F5C63]/10 border-[#0F5C63]'
                            : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedPenaltyCellId(c.id)}
                          className="flex-1 text-left cursor-pointer"
                        >
                          <div className="font-bold text-slate-900">
                            #{idx + 1} {c.ward} - {loc}
                          </div>
                          <div className="text-slate-500 text-[10px] font-mono">{c.id} · Approx. centroid</div>
                        </button>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="font-mono text-rose-700 font-bold block">
                              -{pen.mid}% PV loss
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              +{c.heat_excess_celsius}°C
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              addItem({
                                id: c.id,
                                title: `Solar Cooling - ${c.ward} (${loc})`,
                                subtitle: `-${pen.mid}% thermal derating · +${c.heat_excess_celsius}°C heat`,
                                section: 'infrastructure',
                                metadata: {
                                  cellId: c.id,
                                  ward: c.ward,
                                  locality: loc,
                                  heat_excess_celsius: c.heat_excess_celsius,
                                  penalty_mid: pen.mid,
                                },
                              });
                            }}
                            disabled={isAdded}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              isAdded
                                ? 'bg-emerald-100 text-emerald-800 cursor-default'
                                : 'bg-[#0F5C63] text-white hover:bg-[#0B484E]'
                            }`}
                            title={isAdded ? 'Already in Plan' : 'Add to municipal plan'}
                          >
                            {isAdded ? <Check className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Methodological Limits Notice */}
      <div
        data-tour="solar-limits"
        className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <div>
          <span className="font-semibold text-slate-700">Solar Analysis Boundaries:</span>{' '}
          Calculations estimate percentage photovoltaic efficiency loss relative to baseline. Absolute energy generation (kWh) requires site-specific panel tilt, orientation, inverter sizing, and clipping factors.
        </div>
        <AppLink to="/method" className="text-[#0F5C63] hover:underline font-semibold whitespace-nowrap">
          Read Method Card &rarr;
        </AppLink>
      </div>
    </main>
  );
};
