"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  FolderKanban,
  FileText,
  History,
  Download,
  LogOut,
  ChevronDown,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  MapPin,
  Sparkles,
  GitCompare,
} from "lucide-react";

interface Scenario {
  id: string;
  name: string;
}

interface TopBarProps {
  locationLabel: string;
  selectedPointName: string;
  scenarios: Scenario[];
  currentScenarioId: string;
  onSelectScenario: (id: string) => void;
  onCreateScenario: (name: string) => void;
  onRenameScenario: (id: string, name: string) => void;
  onDeleteScenario: (id: string) => void;
  onAnalyzeClick: () => void;
  onPdfClick: () => void;
  onHistoryClick: () => void;
  onExportMapClick: () => void;
  onExportGeoJsonClick: () => void;
  onSearchSelectLocation: (lat: number, lng: number, label: string) => void;
  onSignOut: () => void;
  onCompareClick?: () => void;
  userName?: string | null;
  historyCount: number;
  isAnalyzing: boolean;
  hasActivePlacement: boolean;
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  locationLabel,
  selectedPointName,
  scenarios,
  currentScenarioId,
  onSelectScenario,
  onCreateScenario,
  onRenameScenario,
  onDeleteScenario,
  onAnalyzeClick,
  onPdfClick,
  onHistoryClick,
  onExportMapClick,
  onExportGeoJsonClick,
  onSearchSelectLocation,
  onSignOut,
  onCompareClick,
  userName,
  historyCount,
  isAnalyzing,
  hasActivePlacement,
  className = "",
}) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Scenario dropdown state
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Keyboard shortcut listener (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced search query
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowSearchDropdown(true);
        }
      } catch (err) {
        console.warn("Geocode error", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const currentScenario = scenarios.find((s) => s.id === currentScenarioId) || scenarios[0];

  return (
    <header
      className={`h-14 bg-white border-b border-stone-200 px-4 flex items-center justify-between select-none z-30 shrink-0 ${className}`}
    >
      {/* Left: Brand & Geocoder Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-md bg-emerald-700 flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-xs">
            U
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-stone-900 leading-none">
              UrjaSetu
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-700 font-semibold leading-none mt-0.5">
              GIS Siting
            </span>
          </div>
        </div>

        {/* Search Field */}
        <div className="relative flex-1">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchDropdown(true);
              }}
              placeholder={locationLabel || "Search location or address... (⌘K)"}
              className="w-full pl-8 pr-14 py-1.5 text-xs bg-stone-100 hover:bg-stone-100/80 focus:bg-white text-stone-900 rounded-panel border border-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 transition-all font-mono"
            />
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 text-emerald-700 animate-spin absolute right-2.5" />
            ) : (
              <kbd className="absolute right-2.5 px-1.5 py-0.5 text-[9px] font-mono bg-stone-200/70 text-stone-500 rounded border border-stone-300 pointer-events-none">
                ⌘K
              </kbd>
            )}
          </div>

          {/* Search Dropdown Results */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-stone-200 rounded-panel shadow-xl py-1 z-50 max-h-60 overflow-y-auto">
              {searchResults.map((res) => (
                <button
                  key={res.placeId}
                  type="button"
                  onClick={() => {
                    onSearchSelectLocation(res.lat, res.lng, res.displayName);
                    setShowSearchDropdown(false);
                    setSearchQuery("");
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-stone-50 flex items-start gap-2 text-xs text-stone-800 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                  <span className="truncate">{res.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center: Selected Point Name & Scenario Dropdown */}
      <div className="flex items-center gap-3">
        {/* Selected Point Name pill */}
        {selectedPointName && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 rounded-md border border-stone-200 text-xs text-stone-700 max-w-[200px] truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
            <span className="truncate font-mono text-[11px]">{selectedPointName}</span>
          </div>
        )}

        {/* Data Provenance & Study Area Mode Badge */}
        {(() => {
          const isPune =
            (currentScenario?.name?.toLowerCase().includes("pune") ||
              locationLabel?.toLowerCase().includes("pune")) ??
            false;
          return (
            <div
              title={
                isPune
                  ? "Pune Study Area: Powered by verified OpenStreetMap EV snapshot (13 verified chargers, 4 candidate hubs, 90m DEM, NASA POWER GHI)."
                  : "Live Provider Mode: Queries live geospatial providers with fallback caching."
              }
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-btn text-[11px] font-mono border transition-all ${
                isPune
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-stone-50 text-stone-700 border-stone-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPune ? "bg-emerald-600 animate-pulse" : "bg-blue-600"
                }`}
              />
              <span className="font-medium">
                {isPune ? "Pune EV Study Area" : "Live Provider Mode"}
              </span>
            </div>
          );
        })()}

        {/* Scenario Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowScenarioMenu(!showScenarioMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-btn border border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50 text-xs font-medium text-stone-800 transition-colors"
          >
            <FolderKanban className="w-3.5 h-3.5 text-stone-500" />
            <span className="max-w-[120px] truncate">
              {currentScenario ? currentScenario.name : "Untitled scenario"}
            </span>
            <ChevronDown className="w-3 h-3 text-stone-400" />
          </button>

          {showScenarioMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-stone-200 rounded-panel shadow-xl py-1 z-50">
              <div className="px-3 py-1.5 border-b border-stone-100 text-[10px] font-mono uppercase tracking-wider text-stone-400 font-semibold">
                Scenarios
              </div>
              <div className="max-h-48 overflow-y-auto">
                {scenarios.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => {
                      onSelectScenario(sc.id);
                      setShowScenarioMenu(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-stone-50 ${
                      sc.id === currentScenarioId ? "font-semibold text-emerald-800 bg-emerald-50/50" : "text-stone-700"
                    }`}
                  >
                    <span className="truncate">{sc.name}</span>
                    {sc.id === currentScenarioId && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              <div className="border-t border-stone-100 mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const name = prompt("Enter scenario name:", "New Scenario");
                    if (name && name.trim()) onCreateScenario(name.trim());
                    setShowScenarioMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 text-stone-500" />
                  <span>Create new scenario</span>
                </button>
                {currentScenario && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextName = prompt("Rename scenario:", currentScenario.name);
                      if (nextName && nextName.trim() && nextName.trim() !== currentScenario.name) {
                        onRenameScenario(currentScenario.id, nextName.trim());
                      }
                      setShowScenarioMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-stone-500" />
                    <span>Rename current scenario</span>
                  </button>
                )}
                {currentScenario && scenarios.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete scenario "${currentScenario.name}"?`)) {
                        onDeleteScenario(currentScenario.id);
                      }
                      setShowScenarioMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete current scenario</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Compare Candidates Simulator Button */}
        {onCompareClick && (
          <button
            type="button"
            onClick={onCompareClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-btn border border-stone-200 hover:border-emerald-700/50 bg-white hover:bg-emerald-50/50 text-xs font-semibold text-stone-700 hover:text-emerald-800 transition-colors shadow-2xs"
            title="Open Scenario Simulator & Candidate Comparison"
          >
            <GitCompare className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline">Compare</span>
          </button>
        )}
      </div>

      {/* Right: Actions, Exports & Profile */}
      <div className="flex items-center gap-2">
        {/* Primary Analyze Button */}
        <button
          type="button"
          onClick={onAnalyzeClick}
          disabled={!hasActivePlacement || isAnalyzing}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-btn text-xs font-semibold text-white shadow-xs transition-all ${
            !hasActivePlacement
              ? "bg-stone-300 cursor-not-allowed opacity-70"
              : isAnalyzing
              ? "bg-emerald-800 cursor-wait"
              : "bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900"
          }`}
          title={!hasActivePlacement ? "Place a pin on the map first" : "Run multi-criteria siting analysis"}
        >
          {isAnalyzing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>{isAnalyzing ? "Analyzing..." : "Analyze"}</span>
        </button>

        {/* PDF Button */}
        <button
          type="button"
          onClick={onPdfClick}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-btn border border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50 text-xs font-medium text-stone-700 transition-colors"
          title="Download Analysis PDF Report"
        >
          <FileText className="w-3.5 h-3.5 text-stone-500" />
          <span className="hidden sm:inline">PDF</span>
        </button>

        {/* History Icon Button */}
        <button
          type="button"
          onClick={onHistoryClick}
          className="relative p-2 rounded-btn border border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50 text-stone-600 transition-colors"
          title="View Analysis History"
          aria-label="History"
        >
          <History className="w-4 h-4 text-stone-600" />
          {historyCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1 min-w-4 h-4 rounded-full bg-emerald-700 text-white font-mono text-[9px] font-bold flex items-center justify-center">
              {historyCount}
            </span>
          )}
        </button>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="p-2 rounded-btn border border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50 text-stone-600 transition-colors"
            title="Export Options"
            aria-label="Export"
          >
            <Download className="w-4 h-4 text-stone-600" />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-stone-200 rounded-panel shadow-xl py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  onExportMapClick();
                  setShowExportMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between"
              >
                <span>Export Map image</span>
                <span className="font-mono text-[10px] text-stone-400">PNG</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onExportGeoJsonClick();
                  setShowExportMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-50 flex items-center justify-between"
              >
                <span>Export Placements</span>
                <span className="font-mono text-[10px] text-stone-400">GeoJSON</span>
              </button>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative ml-1">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center font-bold text-xs text-stone-700 transition-colors"
            title={userName || "Account"}
            aria-label="User account"
          >
            {(userName || "U").charAt(0).toUpperCase()}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-stone-200 rounded-panel shadow-xl py-1 z-50">
              <div className="px-3 py-1.5 border-b border-stone-100 text-xs font-medium text-stone-900 truncate">
                {userName || "Signed In"}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onSignOut();
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
