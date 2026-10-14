"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sun,
  Moon,
  Clock,
  Compass,
  Building2,
  AlertTriangle,
  Plus,
  Trash2,
  X,
  ShieldAlert,
  Info,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  SolarPlacementInput,
  SolarShadingResult,
  HypotheticalBuilding,
  ShadingScenarioConfig,
} from "@/server/solar/types";
import { calculateSolarPosition } from "@/server/solar/solar-position";

interface ShadowSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  placement: {
    id?: string;
    lat: number;
    lng: number;
    lengthM: number;
    widthM: number;
    bearingDeg: number;
    params?: Record<string, any>;
  };
  onApplyMapOverlay: (shadingData: {
    shadowPolygons?: any[];
    hypotheticalBuildings?: any[];
    shadedFootprintOverlap?: any;
    sunAzimuthDeg?: number;
    sunElevationDeg?: number;
  } | null) => void;
}

export const ShadowSimulatorModal: React.FC<ShadowSimulatorModalProps> = ({
  isOpen,
  onClose,
  placement,
  onApplyMapOverlay,
}) => {
  // Simulation date & time state
  // Default to Summer Solstice noon IST (June 21, 2026 12:00 IST = 06:30 UTC)
  const [selectedDate, setSelectedDate] = useState("2026-06-21");
  const [timeHour, setTimeHour] = useState(12);
  const [timeMinute, setTimeMinute] = useState(0);
  const [timezoneOffsetMinutes] = useState(330); // IST UTC+5:30

  // Scenario config state
  const [includeExisting, setIncludeExisting] = useState(true);
  const [defaultUnknownHeight, setDefaultUnknownHeight] = useState<number | undefined>(6.0);
  const [hypotheticalBuildings, setHypotheticalBuildings] = useState<HypotheticalBuilding[]>([]);
  const [modifiedHeights, setModifiedHeights] = useState<Record<string, number>>({});

  // Adding hypothetical building form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBldgName, setNewBldgName] = useState("Proposed Future Tower");
  const [newBldgHeight, setNewBldgHeight] = useState(30);
  const [newBldgLength, setNewBldgLength] = useState(40);
  const [newBldgWidth, setNewBldgWidth] = useState(30);
  const [newBldgOffsetM, setNewBldgOffsetM] = useState(80);
  const [newBldgBearing, setNewBldgBearing] = useState(180); // South of solar array

  // API execution state
  const [isLoading, setIsLoading] = useState(false);
  const [shadingResult, setShadingResult] = useState<SolarShadingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "scenarios" | "obstructions" | "disclaimers">("overview");

  // Calculate live preview of solar position
  const previewDateTime = useMemo(() => {
    const d = new Date(`${selectedDate}T${String(timeHour).padStart(2, "0")}:${String(timeMinute).padStart(2, "0")}:00Z`);
    // Adjust for UTC offset: e.g. IST +5:30 means local 12:00 is 06:30 UTC
    return new Date(d.getTime() - timezoneOffsetMinutes * 60000);
  }, [selectedDate, timeHour, timeMinute, timezoneOffsetMinutes]);

  const liveSolarPos = useMemo(() => {
    return calculateSolarPosition(placement.lat, placement.lng, previewDateTime, timezoneOffsetMinutes);
  }, [placement.lat, placement.lng, previewDateTime, timezoneOffsetMinutes]);

  // Run simulation against backend API
  const runSimulation = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/solar/shading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placementId: placement.id,
          solarPlacement: {
            lat: placement.lat,
            lng: placement.lng,
            lengthM: placement.lengthM,
            widthM: placement.widthM,
            bearingDeg: placement.bearingDeg,
            panelTiltDeg: placement.params?.panelTiltDeg ?? 22,
          },
          simulationTime: {
            isoDate: previewDateTime.toISOString(),
            timezoneOffsetMinutes,
          },
          scenarioConfig: {
            includeExistingBuildings: includeExisting,
            defaultUnknownBuildingHeightM: defaultUnknownHeight,
            hypotheticalBuildings,
            modifiedExistingBuildingHeights: modifiedHeights,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to execute shading simulation");
      }

      setShadingResult(data.data.shading);

      // Auto update map overlay with shadows
      onApplyMapOverlay({
        shadowPolygons: data.data.shading.allShadowPolygons,
        shadedFootprintOverlap: data.data.shading.shadedFootprintOverlap,
        hypotheticalBuildings: hypotheticalBuildings.map((hb) => ({
          type: "Feature",
          properties: { name: hb.name, heightM: hb.heightM, status: hb.status },
          geometry: {
            type: "Point",
            coordinates: [hb.lng, hb.lat],
          },
        })),
        sunAzimuthDeg: data.data.shading.solarPosition.azimuthDeg,
        sunElevationDeg: data.data.shading.solarPosition.elevationDeg,
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Simulation error");
    } finally {
      setIsLoading(false);
    }
  };

  // Run on open and when time or hypothetical buildings change
  useEffect(() => {
    if (isOpen) {
      runSimulation();
    }
  }, [isOpen, selectedDate, timeHour, timeMinute, hypotheticalBuildings, includeExisting, defaultUnknownHeight]);

  // Clean up map overlays on close
  const handleClose = () => {
    onApplyMapOverlay(null);
    onClose();
  };

  // Add hypothetical building helper
  const handleAddHypothetical = () => {
    // Offset lat/lng from solar center
    const dLat = (newBldgOffsetM * Math.cos((newBldgBearing * Math.PI) / 180)) / 111320;
    const dLng =
      (newBldgOffsetM * Math.sin((newBldgBearing * Math.PI) / 180)) /
      (111320 * Math.cos((placement.lat * Math.PI) / 180));

    const newHb: HypotheticalBuilding = {
      id: `hypo-${Date.now()}`,
      name: newBldgName,
      lat: placement.lat + dLat,
      lng: placement.lng + dLng,
      lengthM: newBldgLength,
      widthM: newBldgWidth,
      bearingDeg: newBldgBearing,
      heightM: newBldgHeight,
      status: "hypothetical_proposal",
      notes: `User-defined future structure: ${newBldgHeight}m tall located ${newBldgOffsetM}m away at bearing ${newBldgBearing}°.`,
    };

    setHypotheticalBuildings([...hypotheticalBuildings, newHb]);
    setShowAddForm(false);
  };

  const handleRemoveHypothetical = (id: string) => {
    setHypotheticalBuildings(hypotheticalBuildings.filter((hb) => hb.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-linear-to-r from-amber-50 to-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-300 flex items-center justify-center text-amber-700">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">
                  Shadow-of-the-Future
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-amber-100 text-amber-800 border border-amber-200">
                  Solar Shading Simulator
                </span>
              </div>
              <p className="text-xs text-stone-600">
                Future-aware 3D geometric solar obstruction simulation & what-if built environment modeling
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-6 gap-2">
          {[
            { id: "overview", label: "Solar Position & Exposure", icon: Sun },
            { id: "scenarios", label: `Future What-If Scenarios (${hypotheticalBuildings.length})`, icon: Building2 },
            { id: "obstructions", label: `Obstructing Buildings (${shadingResult?.obstructingBuildings.length ?? 0})`, icon: Layers },
            { id: "disclaimers", label: "Model Assumptions & Caveats", icon: Info },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-amber-600 text-amber-900 bg-white shadow-xs rounded-t"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-amber-600" : "text-stone-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Time Controls Bar (Always Accessible) */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-stone-500" />
                <span className="text-xs font-semibold text-stone-700">Simulation Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2 py-1 text-xs border border-stone-300 rounded bg-white text-stone-800 font-mono shadow-xs"
                />
              </div>

              {/* Solstice / Equinox Shortcuts */}
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-stone-600 text-[10px] font-mono">Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate("2026-06-21");
                    setTimeHour(12);
                    setTimeMinute(0);
                  }}
                  className="px-2 py-0.5 rounded bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
                >
                  Summer Solstice (Jun 21)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate("2026-12-21");
                    setTimeHour(12);
                    setTimeMinute(0);
                  }}
                  className="px-2 py-0.5 rounded bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
                >
                  Winter Solstice (Dec 21)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate("2026-03-20");
                    setTimeHour(12);
                    setTimeMinute(0);
                  }}
                  className="px-2 py-0.5 rounded bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
                >
                  Equinox (Mar 20)
                </button>
              </div>
            </div>

            {/* Time Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-medium text-stone-800">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Time of Day:</span>
                  <span className="font-mono font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {String(timeHour).padStart(2, "0")}:{String(timeMinute).padStart(2, "0")} IST
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono text-stone-600">
                  <span>Sun Azimuth: <strong>{liveSolarPos.azimuthDeg}°</strong></span>
                  <span>Sun Elevation: <strong>{liveSolarPos.elevationDeg}°</strong></span>
                  <span className={`px-1.5 py-0.2 rounded font-sans font-bold text-[10px] ${liveSolarPos.isDaylight ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"}`}>
                    {liveSolarPos.isDaylight ? "Daylight" : "Night"}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="6"
                max="18"
                step="0.5"
                value={timeHour + timeMinute / 60}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const h = Math.floor(val);
                  const m = Math.round((val - h) * 60);
                  setTimeHour(h);
                  setTimeMinute(m);
                }}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-stone-600">
                <span>06:00 (Sunrise)</span>
                <span>09:00 (Morning)</span>
                <span>12:00 (Solar Noon)</span>
                <span>15:00 (Afternoon)</span>
                <span>18:00 (Sunset)</span>
              </div>
            </div>
          </div>

          {/* TAB 1: OVERVIEW & EXPOSURE METRICS */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Solar Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Baseline Card */}
                <div className="p-4 rounded-xl border border-stone-200 bg-white shadow-xs space-y-2">
                  <div className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider">
                    Current Baseline
                  </div>
                  <div className="text-2xl font-black text-stone-900 font-mono">
                    {shadingResult?.baseline.unshadedPercentage ?? "--"}%
                    <span className="text-xs font-normal text-stone-500 ml-1">unshaded</span>
                  </div>
                  <div className="text-xs text-stone-600 space-y-1">
                    <div>Shaded Area: <strong>{shadingResult?.baseline.shadedAreaM2 ?? 0} m²</strong> ({shadingResult?.baseline.shadedPercentage ?? 0}%)</div>
                    <div>Obstructing Buildings: <strong>{shadingResult?.baseline.obstructingBuildingsCount ?? 0}</strong></div>
                  </div>
                </div>

                {/* Scenario Card */}
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs space-y-2">
                  <div className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider flex items-center justify-between">
                    <span>Future Scenario</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-950 font-mono">
                    {shadingResult?.scenario.unshadedPercentage ?? "--"}%
                    <span className="text-xs font-normal text-amber-700 ml-1">unshaded</span>
                  </div>
                  <div className="text-xs text-amber-900 space-y-1">
                    <div>Shaded Area: <strong>{shadingResult?.scenario.shadedAreaM2 ?? 0} m²</strong> ({shadingResult?.scenario.shadedPercentage ?? 0}%)</div>
                    <div>Obstructing Buildings: <strong>{shadingResult?.scenario.obstructingBuildingsCount ?? 0}</strong></div>
                  </div>
                </div>

                {/* Delta Impact Card */}
                <div className={`p-4 rounded-xl border shadow-xs space-y-2 ${
                  (shadingResult?.delta.deltaShadedAreaM2 ?? 0) > 0
                    ? "border-red-200 bg-red-50/50"
                    : "border-emerald-200 bg-emerald-50/50"
                }`}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-600">
                    Potential Exposure Delta (Δ)
                  </div>
                  <div className="text-2xl font-black font-mono">
                    {(shadingResult?.delta.deltaShadedPercentage ?? 0) > 0 ? (
                      <span className="text-red-700">+{shadingResult?.delta.deltaShadedPercentage}% loss</span>
                    ) : (
                      <span className="text-emerald-700">0.0% loss</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-700 leading-snug">
                    {shadingResult?.delta.summaryText ?? "Evaluating geometry..."}
                  </p>
                </div>
              </div>

              {/* Astronomical Sun Position Breakdown */}
              <div className="p-4 rounded-xl border border-stone-200 bg-white space-y-3">
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-stone-500" />
                  <span>Astronomical Solar Ephemeris (NOAA Solar Algorithm)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-stone-50 border border-stone-100">
                    <span className="text-[10px] text-stone-600 font-mono block">Sun Azimuth (Clockwise from North)</span>
                    <span className="text-sm font-bold font-mono text-stone-800">{shadingResult?.solarPosition.azimuthDeg}°</span>
                  </div>
                  <div className="p-2.5 rounded bg-stone-50 border border-stone-100">
                    <span className="text-[10px] text-stone-600 font-mono block">Sun Elevation (Above Horizon)</span>
                    <span className="text-sm font-bold font-mono text-stone-800">{shadingResult?.solarPosition.elevationDeg}°</span>
                  </div>
                  <div className="p-2.5 rounded bg-stone-50 border border-stone-100">
                    <span className="text-[10px] text-stone-600 font-mono block">Solar Declination</span>
                    <span className="text-sm font-bold font-mono text-stone-800">{shadingResult?.solarPosition.declinationDeg}°</span>
                  </div>
                  <div className="p-2.5 rounded bg-stone-50 border border-stone-100">
                    <span className="text-[10px] text-stone-600 font-mono block">Equation of Time</span>
                    <span className="text-sm font-bold font-mono text-stone-800">{shadingResult?.solarPosition.equationOfTimeMinutes} min</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FUTURE WHAT-IF SCENARIOS */}
          {activeTab === "scenarios" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Hypothetical Proposed Structures</h3>
                  <p className="text-xs text-stone-500">
                    Simulate how hypothetical high-rises or future developments on adjacent plots would impact solar yield.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Hypothetical Tower</span>
                </button>
              </div>

              {/* Add Hypothetical Form */}
              {showAddForm && (
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                    <span className="text-xs font-bold text-amber-900">Define Hypothetical Structure</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-mono font-bold">
                      Hypothetical Planning Model
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-stone-700 block mb-1">Structure Label</label>
                      <input
                        type="text"
                        value={newBldgName}
                        onChange={(e) => setNewBldgName(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-stone-300 rounded bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-stone-700 block mb-1">Height (meters)</label>
                      <input
                        type="number"
                        min="5"
                        max="200"
                        value={newBldgHeight}
                        onChange={(e) => setNewBldgHeight(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-stone-300 rounded bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-stone-700 block mb-1">Distance from Solar Array (m)</label>
                      <input
                        type="number"
                        min="10"
                        max="500"
                        value={newBldgOffsetM}
                        onChange={(e) => setNewBldgOffsetM(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-stone-300 rounded bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-stone-700 block mb-1">Bearing from Solar Array (°)</label>
                      <input
                        type="number"
                        min="0"
                        max="359"
                        value={newBldgBearing}
                        onChange={(e) => setNewBldgBearing(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-stone-300 rounded bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-stone-700 block mb-1">Footprint Length (m)</label>
                      <input
                        type="number"
                        min="10"
                        max="200"
                        value={newBldgLength}
                        onChange={(e) => setNewBldgLength(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-stone-300 rounded bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-stone-700 block mb-1">Footprint Width (m)</label>
                      <input
                        type="number"
                        min="10"
                        max="200"
                        value={newBldgWidth}
                        onChange={(e) => setNewBldgWidth(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-stone-300 rounded bg-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 rounded text-xs text-stone-600 hover:bg-stone-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddHypothetical}
                      className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                    >
                      Insert Hypothetical Tower
                    </button>
                  </div>
                </div>
              )}

              {/* List of Hypothetical Buildings */}
              {hypotheticalBuildings.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-stone-200 rounded-xl bg-stone-50/50">
                  <Building2 className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-stone-700">No hypothetical structures added yet</p>
                  <p className="text-[11px] text-stone-500 max-w-sm mx-auto mt-1">
                    Click &quot;Add Hypothetical Tower&quot; above to simulate the impact of future tall buildings on this solar installation.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {hypotheticalBuildings.map((hb) => (
                    <div
                      key={hb.id}
                      className="p-3 bg-white border border-stone-200 rounded-lg flex items-center justify-between shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-900">{hb.name}</span>
                            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase rounded bg-purple-100 text-purple-800">
                              Hypothetical
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-500 font-mono">
                            Height: {hb.heightM}m | Footprint: {hb.lengthM}m × {hb.widthM}m
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveHypothetical(hb.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Baseline Building Assumptions Toggle */}
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                <span className="text-xs font-bold text-stone-900 block">Existing Mapped Buildings Settings</span>
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-stone-800 block">Include OpenStreetMap Mapped Footprints</span>
                    <span className="text-[11px] text-stone-500">
                      Simulates shadows from existing buildings retrieved from authoritative Overpass API data.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeExisting}
                    onChange={(e) => setIncludeExisting(e.target.checked)}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-stone-200">
                  <div>
                    <span className="font-semibold text-stone-800 block">Default Height for Buildings Without Height Tags</span>
                    <span className="text-[11px] text-stone-500">
                      Explicit planning proxy applied only to buildings where both height and levels are absent in OSM.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={defaultUnknownHeight ?? 0}
                      onChange={(e) => setDefaultUnknownHeight(Number(e.target.value) || undefined)}
                      className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-white font-mono text-center"
                    />
                    <span className="text-xs text-stone-500">m</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OBSTRUCTING BUILDINGS */}
          {activeTab === "obstructions" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    Obstructing Buildings ({shadingResult?.obstructingBuildings.length ?? 0})
                  </h3>
                  <p className="text-xs text-stone-500">
                    Every building whose cast shadow physically intersects the proposed solar array footprint at this hour.
                  </p>
                </div>
              </div>

              {/* Height Provenance Summary Card */}
              <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-stone-500 block">Direct Measured Heights</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {shadingResult?.provenanceSummary.measuredCount ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 block">Inferred from Storeys</span>
                  <span className="font-mono font-bold text-blue-700">
                    {shadingResult?.provenanceSummary.inferredCount ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 block">Default Assumptions</span>
                  <span className="font-mono font-bold text-amber-700">
                    {shadingResult?.provenanceSummary.defaultAssumedCount ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 block">Hypothetical Proposals</span>
                  <span className="font-mono font-bold text-purple-700">
                    {shadingResult?.provenanceSummary.hypotheticalCount ?? 0}
                  </span>
                </div>
              </div>

              {/* Obstructing Buildings List */}
              {shadingResult?.obstructingBuildings.length === 0 ? (
                <div className="p-8 text-center border border-emerald-200 rounded-xl bg-emerald-50/50">
                  <Sun className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-emerald-900">Zero Shading Obstructions</p>
                  <p className="text-[11px] text-emerald-700 mt-1">
                    At this simulated date and time, the proposed solar installation footprint receives 100% direct unshaded sunlight.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shadingResult?.obstructingBuildings.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-white border border-stone-200 rounded-lg flex flex-col gap-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-900">{b.name}</span>
                          <span
                            className={`px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase rounded ${
                              b.heightProvenance === "measured"
                                ? "bg-emerald-100 text-emerald-800"
                                : b.heightProvenance === "inferred_from_levels"
                                ? "bg-blue-100 text-blue-800"
                                : b.heightProvenance === "hypothetical_user"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {b.heightProvenance}
                          </span>
                        </div>
                        <span className="text-xs font-bold font-mono text-red-600">
                          Shades {b.overlapAreaM2} m²
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Height: <strong>{b.heightM}m</strong></span>
                        <span>Distance: <strong>{b.distanceToSolarM}m</strong></span>
                        {b.levels && <span>Storeys: <strong>{b.levels}</strong></span>}
                        <span>Source: <strong>{b.source}</strong></span>
                      </div>
                      <p className="text-[10px] text-stone-500 italic bg-stone-50 p-1.5 rounded">
                        {b.obstructionNotes}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DISCLAIMERS & LIMITATIONS */}
          {activeTab === "disclaimers" && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  <span>Important Epistemic Governance & Simulation Disclaimers</span>
                </div>
                <p className="text-xs text-amber-950 leading-relaxed">
                  In compliance with Smart India Hackathon jury requirements and urban planning integrity rules,
                  this module models geometric beam obstruction rather than claiming unsubstantiated annual energy losses.
                </p>
              </div>

              <div className="space-y-2">
                {shadingResult?.limitations.map((lim, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex items-start gap-2 text-xs text-stone-700"
                  >
                    <span className="font-bold font-mono text-amber-700 mt-0.5">•</span>
                    <span>{lim}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="text-[11px] text-stone-500 font-mono">
            Location: {placement.lat.toFixed(4)}°N, {placement.lng.toFixed(4)}°E | Array: {placement.lengthM}m × {placement.widthM}m
          </div>
          <div className="flex items-center gap-3">
            {isLoading && (
              <span className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Simulating ray-tracing...</span>
              </span>
            )}
            <button
              onClick={handleClose}
              className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              Done & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
