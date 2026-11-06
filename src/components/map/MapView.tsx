"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MapView Component
 * High-performance MapLibre GL 4.7 map layer rendering 250m cells around Pune, India.
 * Preserves the project's MapLibre GL engine with GPU-accelerated GeoJSON rendering.
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Cell } from '../../api/contract';
import { Layers, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { TruthChip } from '../ui/TruthChip';

export type MapLayerType = 'burden' | 'lst' | 'ndvi' | 'population' | 'selected' | 'loss';

export interface MapViewProps {
  cells: Cell[];
  selectedIds?: string[];
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
    unit: '°C (Landsat 9)',
    min: '32°C',
    max: '46°C+',
    colors: ['#FDE68A', '#F59E0B', '#EA580C', '#DC2626'],
    truth: 'Measured',
  },
  ndvi: {
    label: 'Vegetation Index (NDVI)',
    unit: 'Ratio (Sentinel-2)',
    min: '0.05 (Sparse)',
    max: '0.65+ (Dense)',
    colors: ['#FEF3C7', '#A7F3D0', '#34D399', '#059669'],
    truth: 'Measured',
  },
  population: {
    label: 'Demographic Headcount',
    unit: 'Residents / 250m cell',
    min: '1,000',
    max: '16,000+',
    colors: ['#E0E7FF', '#818CF8', '#4F46E5', '#312E81'],
    truth: 'Assumed',
  },
  loss: {
    label: 'Verified Green Loss',
    unit: 'Hectares (2019–2026)',
    min: 'Stable (0 ha)',
    max: 'Severe (2.5 ha)',
    colors: ['#E2E8F0', '#FECDD3', '#F43F5E', '#9F1239'],
    truth: 'Measured',
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
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>(activeLayer);

  // Sync internal layer with prop if controlled externally
  useEffect(() => {
    setCurrentLayer(activeLayer);
  }, [activeLayer]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Lookup map for fast click resolution
  const cellsMap = useMemo(() => {
    const map = new Map<string, Cell>();
    cells.forEach((c) => map.set(c.id, c));
    return map;
  }, [cells]);

  // Convert cells into GeoJSON FeatureCollection
  const geojson = useMemo(() => {
    const dLat = 0.00113;
    const dLng = 0.00118;

    const features = cells.map((cell) => {
      const [lng, lat] = cell.centroid || [73.8567, 18.5204];
      const isSelected = selectedSet.has(cell.id) ? 1 : 0;

      return {
        type: 'Feature' as const,
        id: cell.id,
        properties: {
          id: cell.id,
          ward: cell.ward,
          burden: cell.burden ?? 0,
          lst_mean: cell.lst_mean ?? 0,
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
  }, [cells, selectedSet]);

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

    // Add attribution
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    let fallbackStage = 0; // 0 = Positron, 1 = OSM raster, 2 = Blank

    map.on('error', (e) => {
      // Check if error is related to style / tile loading
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

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Compute data-driven quantiles (5 classes) and min/max for active layer
  const { quantiles, dataMin, dataMax } = useMemo(() => {
    if (!cells.length) {
      return { quantiles: [0, 1, 2, 3, 4], dataMin: '0', dataMax: '1' };
    }

    const extractVal = (c: Cell): number => {
      if (currentLayer === 'lst') return c.lst_mean ?? 0;
      if (currentLayer === 'ndvi') return c.ndvi ?? 0;
      if (currentLayer === 'population') return c.population ?? 0;
      if (currentLayer === 'loss') return c.loss_ha ?? 0;
      return c.burden ?? 0;
    };

    const vals = cells.map(extractVal).filter((v) => !isNaN(v)).sort((a, b) => a - b);
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

    // 1. Update or create Source
    const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(geojson);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
      });
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

    // 2. Add or update Fill Layer
    if (!map.getLayer(fillLayerId)) {
      map.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': colorExpr,
          'fill-opacity': 0.82,
        },
      });

      // Hover and Click events
      if (interactive) {
        map.on('click', fillLayerId, (e) => {
          if (e.features && e.features[0]) {
            const cellId = String(e.features[0].id || e.features[0].properties?.id);
            const found = cellsMap.get(cellId);
            if (found && onSelect) {
              onSelect(found);
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
    }

    // 3. Add Line Layer for crisp cell boundaries
    if (!map.getLayer(lineLayerId)) {
      map.addLayer({
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
      });
    } else {
      map.setPaintProperty(lineLayerId, 'line-color', [
        'case',
        ['==', ['get', 'isSelected'], 1],
        '#0A3E43',
        'rgba(255, 255, 255, 0.4)',
      ]);
      map.setPaintProperty(lineLayerId, 'line-width', [
        'case',
        ['==', ['get', 'isSelected'], 1],
        2.0,
        0.5,
      ]);
    }

    // Fit bounds if requested
    if (fitBounds && cells.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      cells.forEach((c) => {
        if (c.centroid) bounds.extend(c.centroid);
      });
      map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 800 });
    }
  }, [geojson, currentLayer, mapLoaded, interactive, fitBounds, cellsMap, onSelect]);

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
              type="button"
              onClick={() => handleLayerSelect(layer)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                currentLayer === layer
                  ? 'bg-[#0F5C63] text-white font-semibold shadow-xs'
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

      {/* Zoom / Navigation Controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 bg-white/95 backdrop-blur-md p-1 rounded-lg border border-slate-200 shadow-md">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition-colors border-t border-slate-100"
          title="Reset View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Dynamic Layer Legend Box */}
      <div className="absolute bottom-3 right-3 z-20 bg-white/95 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-200 shadow-md max-w-xs text-xs space-y-1">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-slate-800">{config.label}</span>
          <TruthChip provenance={config.truth} size="sm" />
        </div>
        <div className="w-full h-2 rounded overflow-hidden flex border border-slate-200">
          {(FIVE_CLASS_PALETTES[currentLayer as keyof typeof FIVE_CLASS_PALETTES] || config.colors).map((c, i) => (
            <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 font-mono">
          <span>{dataMin}</span>
          <span>{dataMax}</span>
        </div>
      </div>
    </div>
  );
};
