"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MapView Component
 * High-performance MapLibre GL 4.7 map layer rendering 250m cells around Pune, India.
 * Implements keyless basemap chain (OpenFreeMap Positron -> OSM Raster -> Blank canvas),
 * data layers inserted BELOW label symbol layers for readable place names,
 * data-driven legends with zero-artifact filtering, and two-way ranked selection.
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Cell } from '../../api/contract';
import { Layers, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { TruthChip } from '../ui/TruthChip';

export type MapLayerType = 'burden' | 'lst' | 'ndvi' | 'population' | 'selected' | 'loss';

export interface RankedZoneMeta {
  id: string;
  rank: number;
  label?: string;
}

export interface MapViewProps {
  cells: Cell[];
  selectedIds?: string[];
  highlightedCellId?: string | null;
  rankedZones?: RankedZoneMeta[];
  activeLayer?: MapLayerType;
  onSelect?: (cell: Cell) => void;
  fitBounds?: boolean;
  height?: string;
  interactive?: boolean;
  className?: string;
  showLayerControl?: boolean;
  onLayerChange?: (layer: MapLayerType) => void;
  center?: [number, number]; // [lat, lng]
  zoom?: number;
}

// Basemap style URLs: OpenFreeMap Positron (vector/json) by default, or env override
const POSITRON_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
  (typeof window !== 'undefined' && (window as any).VITE_MAP_STYLE_URL) ||
  'https://tiles.openfreemap.org/styles/positron';

const OSM_FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const BLANK_FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'blank-background',
      type: 'background',
      paint: {
        'background-color': '#f8fafc',
      },
    },
  ],
};

const FIVE_CLASS_PALETTES = {
  burden: ['#FEF3C7', '#FCD34D', '#F5A524', '#EA580C', '#B91C1C'],
  lst: ['#FEF08A', '#FBBF24', '#F97316', '#DC2626', '#991B1B'],
  ndvi: ['#FEF3C7', '#D1FAE5', '#6EE7B7', '#10B981', '#047857'],
  population: ['#EEF2FF', '#C7D2FE', '#818CF8', '#4F46E5', '#312E81'],
  loss: ['#E2E8F0', '#FECDD3', '#FB7185', '#E11D48', '#881337'],
};

const LAYER_CONFIGS: Record<
  MapLayerType,
  { label: string; unit: string; min: string; max: string; colors: string[]; truth: 'Measured' | 'Modelled' | 'Assumed' }
> = {
  burden: {
    label: 'Population Heat Burden',
    unit: 'Index (0–950)',
    min: 'Low (0)',
    max: 'Severe (950+)',
    colors: ['#FEF3C7', '#FCD34D', '#F5A524', '#EA580C', '#D64530'],
    truth: 'Modelled',
  },
  lst: {
    label: 'Land Surface Temp (LST)',
    unit: '°C (Landsat 8/9 & Sentinel-2)',
    min: '29.0°C',
    max: '55.0°C+',
    colors: ['#FEF08A', '#FBBF24', '#F97316', '#DC2626', '#991B1B'],
    truth: 'Measured',
  },
  ndvi: {
    label: 'Vegetation Index (NDVI)',
    unit: 'Ratio (Sentinel-2)',
    min: '0.05 (Sparse)',
    max: '0.65+ (Dense)',
    colors: ['#FEF3C7', '#D1FAE5', '#6EE7B7', '#10B981', '#047857'],
    truth: 'Measured',
  },
  population: {
    label: 'Demographic Headcount',
    unit: 'Residents / 250m cell',
    min: '1,000',
    max: '16,000+',
    colors: ['#EEF2FF', '#C7D2FE', '#818CF8', '#4F46E5', '#312E81'],
    truth: 'Assumed',
  },
  loss: {
    label: 'Verified Vegetation Loss',
    unit: 'Hectares (2019–2026)',
    min: 'Stable (0 ha)',
    max: 'Severe (2.5 ha)',
    colors: ['#E2E8F0', '#FECDD3', '#FB7185', '#E11D48', '#881337'],
    truth: 'Modelled',
  },
  selected: {
    label: 'Optimized Portfolio',
    unit: 'Selected Parcels',
    min: 'Candidate',
    max: 'Prioritized (#1)',
    colors: ['#E2E8F0', '#0F5C63'],
    truth: 'Modelled',
  },
};

export const MapView: React.FC<MapViewProps> = ({
  cells,
  selectedIds = [],
  highlightedCellId = null,
  rankedZones = [],
  activeLayer = 'burden',
  onSelect,
  fitBounds = false,
  height = '100%',
  interactive = true,
  className = '',
  showLayerControl = true,
  onLayerChange,
  center = [18.5204, 73.8567],
  zoom = 12,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>(activeLayer);

  useEffect(() => {
    setCurrentLayer(activeLayer);
  }, [activeLayer]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Lookup map for fast click and selection resolution
  const cellsMap = useMemo(() => {
    const map = new Map<string, Cell>();
    cells.forEach((c) => map.set(c.id, c));
    return map;
  }, [cells]);

  const rankedMap = useMemo(() => {
    const map = new Map<string, RankedZoneMeta>();
    rankedZones.forEach((rz) => map.set(rz.id, rz));
    return map;
  }, [rankedZones]);

  // Convert cells into GeoJSON FeatureCollection
  const geojson = useMemo(() => {
    const dLat = 0.00113;
    const dLng = 0.00118;

    const features = cells.map((cell) => {
      const [lng, lat] = cell.centroid || [73.8567, 18.5204];
      const isSelected = selectedSet.has(cell.id) || cell.id === highlightedCellId ? 1 : 0;
      const rankMeta = rankedMap.get(cell.id);

      return {
        type: 'Feature' as const,
        id: cell.id,
        properties: {
          id: cell.id,
          ward: cell.ward,
          locality: cell.locality || cell.ward,
          rank: rankMeta ? rankMeta.rank : null,
          burden: cell.burden ?? 0,
          lst_mean: cell.lst_mean !== null && cell.lst_mean !== undefined ? cell.lst_mean : 0,
          ndvi: cell.ndvi ?? 0,
          population: cell.population ?? 0,
          greenable_ha: cell.greenable_ha ?? 0,
          cooling_mean: cell.cooling_mean ?? 0,
          loss_ha: cell.loss_ha ?? 0,
          isSelected,
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [lng - dLng, lat - dLat],
              [lng + dLng, lat - dLat],
              [lng + dLng, lat + dLat],
              [lng - dLng, lat + dLat],
              [lng - dLng, lat - dLat],
            ],
          ],
        },
      };
    });

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [cells, selectedSet, highlightedCellId, rankedMap]);

  // Top zones label GeoJSON FeatureCollection (for readable labels with text halo)
  const topZonesGeojson = useMemo(() => {
    const features: any[] = [];
    rankedZones.forEach((rz) => {
      const cell = cellsMap.get(rz.id);
      if (cell && cell.centroid) {
        const [lng, lat] = cell.centroid;
        const loc = cell.locality || cell.ward;
        const label = `#${rz.rank} ${cell.ward} - ${loc}`;
        features.push({
          type: 'Feature',
          properties: {
            id: cell.id,
            rank: rz.rank,
            label,
          },
          geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
        });
      }
    });
    return {
      type: 'FeatureCollection',
      features,
    };
  }, [rankedZones, cellsMap]);

  const [webglError, setWebglError] = useState<string | null>(null);

  // Initialize MapLibre GL Map with OpenFreeMap and fallback chain
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    if (typeof (maplibregl as any).supported === 'function' && !(maplibregl as any).supported()) {
      setWebglError('WebGL is disabled or unsupported in this browser environment.');
      return;
    }

    const [initLat, initLng] = center;
    let map: maplibregl.Map;

    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: POSITRON_STYLE_URL,
        center: [initLng, initLat],
        zoom: zoom,
        attributionControl: false,
        interactive: interactive,
      });
    } catch (err: any) {
      console.warn('MapLibre GL Map creation failed:', err);
      setWebglError(err?.message || 'Basemap unavailable');
      return;
    }

    // Add visible attribution
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    let fallbackStage = 0; // 0 = Positron, 1 = OSM raster, 2 = Blank

    map.on('error', (e) => {
      if (fallbackStage === 0) {
        console.warn('Positron style failed to load, switching to OSM raster fallback:', e);
        fallbackStage = 1;
        try {
          map.setStyle(OSM_FALLBACK_STYLE);
        } catch {
          fallbackStage = 2;
          map.setStyle(BLANK_FALLBACK_STYLE);
        }
      } else if (fallbackStage === 1) {
        console.warn('OSM fallback failed, using blank canvas with notice:', e);
        fallbackStage = 2;
        try {
          map.setStyle(BLANK_FALLBACK_STYLE);
        } catch {
          // ignore
        }
      }
    });

    map.on('load', () => {
      setMapLoaded(true);
    });

    map.on('styledata', () => {
      setMapLoaded(true);
    });

    mapRef.current = map;
    if (typeof window !== 'undefined') {
      (window as any).__urjasetu_map = map;
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Compute data-driven quantiles (5 classes) and min/max for active layer
  // STRICT SCIENTIFIC RULE: Filter out missing/null/undefined values; LST <= 0 must not corrupt min to 0.0°C!
  const { quantiles, dataMin, dataMax } = useMemo(() => {
    if (!cells.length) {
      return { quantiles: [0, 1, 2, 3, 4], dataMin: '0', dataMax: '1' };
    }

    const extractVal = (c: Cell): number | null => {
      if (currentLayer === 'lst') {
        const v = c.lst_mean;
        return v !== null && v !== undefined && !isNaN(v) && v > 0 ? v : null;
      }
      if (currentLayer === 'ndvi') {
        const v = c.ndvi;
        return v !== null && v !== undefined && !isNaN(v) ? v : null;
      }
      if (currentLayer === 'population') {
        const v = c.population;
        return v !== null && v !== undefined && !isNaN(v) && v >= 0 ? v : null;
      }
      if (currentLayer === 'loss') {
        const v = c.loss_ha;
        return v !== null && v !== undefined && !isNaN(v) && v > 0 ? v : null;
      }
      const v = c.burden;
      return v !== null && v !== undefined && !isNaN(v) ? v : null;
    };

    const vals = cells
      .map(extractVal)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    if (!vals.length) return { quantiles: [0, 1, 2, 3, 4], dataMin: '0', dataMax: '1' };

    const minVal = vals[0];
    const maxVal = vals[vals.length - 1];

    // Compute 5 quantile break points: q0, q20, q40, q60, q80, q100
    const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))];
    const q0 = minVal;
    const q1 = q(0.2);
    const q2 = q(0.4);
    const q3 = q(0.6);
    const q4 = q(0.8);

    let formatMin = `${minVal}`;
    let formatMax = `${maxVal}`;

    if (currentLayer === 'lst') {
      formatMin = `${minVal.toFixed(1)}°C`;
      formatMax = `${maxVal.toFixed(1)}°C`;
    } else if (currentLayer === 'ndvi') {
      formatMin = `${minVal.toFixed(2)}`;
      formatMax = `${maxVal.toFixed(2)}`;
    } else if (currentLayer === 'population') {
      formatMin = minVal.toLocaleString('en-IN');
      formatMax = maxVal.toLocaleString('en-IN');
    } else if (currentLayer === 'loss') {
      formatMin = `${minVal.toFixed(1)} ha`;
      formatMax = `${maxVal.toFixed(1)} ha`;
    } else if (currentLayer === 'burden') {
      formatMin = `${Math.round(minVal)}`;
      formatMax = `${Math.round(maxVal)}`;
    }

    return {
      quantiles: [q0, q1, q2, q3, q4],
      dataMin: formatMin,
      dataMax: formatMax,
    };
  }, [cells, currentLayer]);

  // Update GeoJSON Source & Layers when map loads or data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const sourceId = 'cells-source';
    const fillLayerId = 'cells-fill';
    const lineLayerId = 'cells-line';
    const highlightLayerId = 'cells-highlight';
    const labelsSourceId = 'top-zones-labels-source';
    const labelsLayerId = 'top-zones-labels-layer';

    // 1. Update or create Cells GeoJSON Source
    const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(geojson);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
      });
    }

    // Update or create Top Zones Labels Source
    const existingLabelsSource = map.getSource(labelsSourceId) as maplibregl.GeoJSONSource | undefined;
    if (existingLabelsSource) {
      existingLabelsSource.setData(topZonesGeojson as any);
    } else {
      map.addSource(labelsSourceId, {
        type: 'geojson',
        data: topZonesGeojson as any,
      });
    }

    // Find the first symbol layer in the basemap style so data layers are inserted BELOW it
    const styleLayers = map.getStyle().layers;
    let firstSymbolId: string | undefined;
    if (styleLayers) {
      for (const layer of styleLayers) {
        if (layer.type === 'symbol') {
          firstSymbolId = layer.id;
          break;
        }
      }
    }

    // Dynamic fill color expression based on currentLayer and quantile classes
    let colorExpr: any;
    if (currentLayer === 'selected') {
      colorExpr = [
        'case',
        ['==', ['get', 'isSelected'], 1],
        '#0F5C63',
        '#E2E8F0',
      ];
    } else {
      const field =
        currentLayer === 'lst' ? 'lst_mean' :
        currentLayer === 'ndvi' ? 'ndvi' :
        currentLayer === 'population' ? 'population' :
        currentLayer === 'loss' ? 'loss_ha' : 'burden';

      const palette = FIVE_CLASS_PALETTES[currentLayer as keyof typeof FIVE_CLASS_PALETTES] || FIVE_CLASS_PALETTES.burden;
      const [q0, q1, q2, q3, q4] = quantiles;

      colorExpr = [
        'case',
        ['==', ['get', 'isSelected'], 1],
        '#0F5C63',
        [
          'interpolate',
          ['linear'],
          ['get', field],
          q0, palette[0],
          q1, palette[1],
          q2, palette[2],
          q3, palette[3],
          q4, palette[4],
        ],
      ];
    }

    // 2. Add or update Fill Layer (Opacity 0.75, inserted BELOW first symbol layer)
    if (!map.getLayer(fillLayerId)) {
      map.addLayer(
        {
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': colorExpr,
            'fill-opacity': 0.75,
          },
        },
        firstSymbolId
      );

      // Click & Hover events
      if (interactive) {
        map.on('click', fillLayerId, (e) => {
          if (e.features && e.features[0]) {
            const cellId = String(e.features[0].id || e.features[0].properties?.id);
            const found = cellsMap.get(cellId);
            if (found) {
              onSelect?.(found);
              displayPopupForCell(found);
            }
          }
        });

        map.on('mouseenter', fillLayerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', fillLayerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    } else {
      map.setPaintProperty(fillLayerId, 'fill-color', colorExpr);
      map.setPaintProperty(fillLayerId, 'fill-opacity', 0.75);
    }

    // 3. Add Line Layer for grid boundary definition
    if (!map.getLayer(lineLayerId)) {
      map.addLayer(
        {
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'isSelected'], 1],
              '#0A3E43',
              'rgba(255, 255, 255, 0.4)',
            ],
            'line-width': [
              'case',
              ['==', ['get', 'isSelected'], 1],
              2.0,
              0.5,
            ],
          },
        },
        firstSymbolId
      );
    }

    // 4. Highlight Line Layer for prominent selected boundary
    if (!map.getLayer(highlightLayerId)) {
      map.addLayer(
        {
          id: highlightLayerId,
          type: 'line',
          source: sourceId,
          filter: ['==', ['get', 'isSelected'], 1],
          paint: {
            'line-color': '#06B6D4',
            'line-width': 3.5,
            'line-opacity': 0.95,
          },
        },
        firstSymbolId
      );
    }

    // 5. Add permanent readable labels with text halo for top zones
    if (!map.getLayer(labelsLayerId)) {
      map.addLayer({
        id: labelsLayerId,
        type: 'symbol',
        source: labelsSourceId,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#0F172A',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 2.0,
        },
      });
    }

    // Fit bounds on initial load if requested
    if (fitBounds && cells.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      cells.forEach((c) => {
        if (c.centroid) bounds.extend(c.centroid);
      });
      map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 800 });
    }
  }, [geojson, topZonesGeojson, currentLayer, mapLoaded, interactive, fitBounds, cellsMap, onSelect]);

  // Display popup with readable labels and honest data metrics
  const displayPopupForCell = useCallback((cell: Cell) => {
    const map = mapRef.current;
    if (!map) return;

    if (popupRef.current) {
      popupRef.current.remove();
    }

    const rankMeta = rankedMap.get(cell.id);
    const rankPrefix = rankMeta ? `#${rankMeta.rank} ` : '';
    const loc = cell.locality || cell.ward;

    const htmlContent = `
      <div style="font-family: inherit; padding: 4px 6px; min-width: 190px;">
        <div style="font-weight: 700; font-size: 13px; color: #0F5C63; line-height: 1.2;">
          ${rankPrefix}${cell.ward} - ${loc}
        </div>
        <div style="font-size: 10px; color: #64748B; font-family: monospace; margin-top: 2px;">
          ${cell.id} · Approx. ward centroid
        </div>
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #E2E8F0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px;">
          <div>Surface Temp: <strong style="font-family: monospace;">${cell.lst_mean !== null ? `${cell.lst_mean}°C` : 'Not available'}</strong></div>
          <div>NDVI: <strong style="font-family: monospace;">${cell.ndvi !== null ? cell.ndvi : 'Not available'}</strong></div>
          <div>Population: <strong style="font-family: monospace;">${cell.population !== null ? cell.population.toLocaleString('en-IN') : 'Not available'}</strong></div>
          <div>Greenable: <strong style="font-family: monospace;">${cell.greenable_ha !== null ? `${cell.greenable_ha} ha` : 'Not available'}</strong></div>
        </div>
      </div>
    `;

    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 12 })
      .setLngLat(cell.centroid)
      .setHTML(htmlContent)
      .addTo(map);

    popupRef.current = popup;
  }, [rankedMap]);

  // Two-way Selection: When highlightedCellId changes (from ranked list click), fly to cell and show popup
  useEffect(() => {
    if (!highlightedCellId || !mapRef.current) return;
    const targetCell = cellsMap.get(highlightedCellId);
    if (targetCell && targetCell.centroid) {
      mapRef.current.flyTo({
        center: targetCell.centroid,
        zoom: Math.max(mapRef.current.getZoom(), 13.8),
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        duration: 700,
      });
      displayPopupForCell(targetCell);
    }
  }, [highlightedCellId, cellsMap, displayPopupForCell]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleResetView = () => {
    mapRef.current?.flyTo({ center: [center[1], center[0]], zoom, duration: 600 });
  };

  const handleLayerSelect = (layer: MapLayerType) => {
    setCurrentLayer(layer);
    onLayerChange?.(layer);
  };

  const config = LAYER_CONFIGS[currentLayer];

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm ${className}`}
      style={{ height }}
    >
      {/* MapLibre Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/90 z-10 p-6 text-center">
          <div className="max-w-md bg-white border border-slate-200 rounded-xl p-4 shadow-md space-y-1">
            <span className="font-semibold text-xs text-slate-800 block">Basemap unavailable</span>
            <span className="text-[11px] text-slate-500 block leading-tight">
              Rendering data layers directly (software rasterizer mode).
            </span>
          </div>
        </div>
      )}

      {/* Layer Switcher Pill */}
      {showLayerControl && (
        <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1 bg-white/95 backdrop-blur-md p-1.5 rounded-lg border border-slate-200 shadow-md">
          {(['burden', 'lst', 'ndvi', 'population', 'loss'] as MapLayerType[]).map((layer) => (
            <button
              key={layer}
              onClick={() => handleLayerSelect(layer)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                currentLayer === layer
                  ? 'bg-[#0F5C63] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {layer === 'burden' ? 'Heat Burden' :
               layer === 'lst' ? 'Surface Temp' :
               layer === 'ndvi' ? 'Vegetation' :
               layer === 'population' ? 'Population' : 'Green Loss'}
            </button>
          ))}
        </div>
      )}

      {/* Dynamic Data-Driven Quantile Legend */}
      <div className="absolute bottom-4 right-4 z-20 bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-md text-xs space-y-2 min-w-[210px]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-slate-800 text-[11px]">{config.label}</span>
          <TruthChip type={config.truth} compact />
        </div>

        {/* Quantile Color Palette Bar */}
        <div className="h-2.5 w-full rounded-sm flex overflow-hidden border border-slate-200">
          {(FIVE_CLASS_PALETTES[currentLayer as keyof typeof FIVE_CLASS_PALETTES] || FIVE_CLASS_PALETTES.burden).map(
            (c, i) => (
              <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
            )
          )}
        </div>

        {/* Dynamic Data-Driven Min & Max */}
        <div className="flex justify-between text-[11px] font-mono text-slate-600 pt-0.5">
          <span>{dataMin}</span>
          <span>{dataMax}</span>
        </div>
      </div>

      {/* Zoom and Reset Controls */}
      {interactive && (
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 bg-white/95 backdrop-blur-md p-1 rounded-lg border border-slate-200 shadow-md">
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-md transition-colors cursor-pointer"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-md transition-colors cursor-pointer"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-md transition-colors cursor-pointer border-t border-slate-100"
            title="Reset to Pune View"
            aria-label="Reset View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
