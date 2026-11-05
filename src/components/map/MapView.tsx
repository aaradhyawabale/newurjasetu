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

const DEFAULT_RASTER_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto-tiles': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'carto-layer',
      type: 'raster',
      source: 'carto-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
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
    label: 'Canopy Density (NDVI)',
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

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const [initLat, initLng] = center;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DEFAULT_RASTER_STYLE,
      center: [initLng, initLat],
      zoom: zoom,
      attributionControl: false,
      interactive: interactive,
    });

    map.on('load', () => {
      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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

    // Dynamic fill color expression based on currentLayer and selection
    let colorExpr: any;
    if (currentLayer === 'lst') {
      colorExpr = [
        'case',
        ['==', ['get', 'isSelected'], 1],
        '#0F5C63',
        [
          'interpolate',
          ['linear'],
          ['get', 'lst_mean'],
          32, '#FDE68A',
          36, '#F59E0B',
          40, '#EA580C',
          44, '#DC2626',
        ],
      ];
    } else if (currentLayer === 'ndvi') {
      colorExpr = [
        'case',
        ['==', ['get', 'isSelected'], 1],
        '#0F5C63',
        [
          'interpolate',
          ['linear'],
          ['get', 'ndvi'],
          0.05, '#FEF3C7',
          0.20, '#A7F3D0',
          0.40, '#34D399',
          0.65, '#059669',
        ],
      ];
    } else if (currentLayer === 'population') {
      colorExpr = [
        'case',
        ['==', ['get', 'isSelected'], 1],
        '#0F5C63',
        [
          'interpolate',
          ['linear'],
          ['get', 'population'],
          1000, '#E0E7FF',
          5000, '#818CF8',
          10000, '#4F46E5',
          16000, '#312E81',
        ],
      ];
    } else if (currentLayer === 'loss') {
      colorExpr = [
        'case',
        ['==', ['get', 'isSelected'], 1],
        '#0F5C63',
        ['<=', ['get', 'loss_ha'], 0],
        '#E2E8F0',
        [
          'interpolate',
          ['linear'],
          ['get', 'loss_ha'],
          0.1, '#FECDD3',
          1.0, '#F43F5E',
          2.5, '#9F1239',
        ],
      ];
    } else if (currentLayer === 'selected') {
      colorExpr = [
        'case',
        ['==', ['get', 'isSelected'], 1],
        '#0F5C63',
        '#E2E8F0',
      ];
    } else {
      // Default: 'burden'
      colorExpr = [
        'case',
        ['==', ['get', 'isSelected'], 1],
        '#0F5C63',
        [
          'interpolate',
          ['linear'],
          ['get', 'burden'],
          0, '#FEF3C7',
          200, '#FCD34D',
          450, '#F5A524',
          700, '#EA580C',
          950, '#D64530',
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
          {config.colors.map((c, i) => (
            <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>{config.min}</span>
          <span>{config.max}</span>
        </div>
      </div>
    </div>
  );
};
