"use client";

import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import { createFootprintPolygon, calculateDistanceMeters } from "@/server/gis/geometry";
import { ConflictingFeature } from "@/server/analysis-engine/validation";
import { StandardizedGeoFeature } from "@/server/providers/types";

export interface StudyAreaBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

interface MapViewProps {
  centerLat: number;
  centerLng: number;
  zoom?: number;
  activeType: string;
  placement?: {
    lat: number;
    lng: number;
    lengthM: number;
    widthM: number;
    bearingDeg: number;
  } | null;
  studyArea?: StudyAreaBounds | null;
  conflicts?: ConflictingFeature[];
  analyzedFeatures?: StandardizedGeoFeature[];
  searchRings?: {
    centerLat: number;
    centerLng: number;
    r1M: number;
    r2M: number;
  } | null;
  onMapClick: (lat: number, lng: number) => void;
  onMapLoaded?: (exportFn: () => string | null) => void;
  className?: string;
}

export const MapView: React.FC<MapViewProps> = ({
  centerLat,
  centerLng,
  zoom = 14,
  activeType,
  placement,
  studyArea,
  conflicts = [],
  analyzedFeatures = [],
  searchRings = null,
  onMapClick,
  onMapLoaded,
  className = "",
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const placementRef = useRef(placement);
  const activeTypeRef = useRef(activeType);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showAnalyzedOverlay, setShowAnalyzedOverlay] = useState(true);

  // Keep refs updated to avoid stale closures inside MapLibre event listeners
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    placementRef.current = placement;
    activeTypeRef.current = activeType;
  }, [placement, activeType]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE;
    const defaultRasterStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        "osm-tiles": {
          type: "raster",
          tiles: [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
      },
      layers: [
        {
          id: "osm-tiles-layer",
          type: "raster",
          source: "osm-tiles",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl && styleUrl.trim() !== "" ? styleUrl : defaultRasterStyle,
      center: [centerLng, centerLat],
      zoom: zoom,
      preserveDrawingBuffer: true, // Crucial for Map PNG export
      attributionControl: false,
    });

    // Add navigation controls (zoom & pitch/compass)
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-left");

    // Add attribution control in bottom-left
    map.addControl(
      new maplibregl.AttributionControl({
        compact: false,
        customAttribution: "© OpenStreetMap contributors | MapLibre",
      }),
      "bottom-left"
    );

    map.on("load", () => {
      mapRef.current = map;
      setIsLoaded(true);

      // Add study-area geojson source and layers
      map.addSource("study-area-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "study-area-fill",
        type: "fill",
        source: "study-area-source",
        paint: {
          "fill-color": "#0284c7",
          "fill-opacity": 0.12,
        },
      });

      map.addLayer({
        id: "study-area-line",
        type: "line",
        source: "study-area-source",
        paint: {
          "line-color": "#0284c7",
          "line-width": 2,
          "line-dasharray": [4, 2],
        },
      });

      // Add search rings geojson source and layer (R1 & R2 geodesic circles)
      map.addSource("search-rings-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "search-rings-line",
        type: "line",
        source: "search-rings-source",
        paint: {
          "line-color": "#0f766e",
          "line-width": 1.5,
          "line-dasharray": [3, 3],
          "line-opacity": 0.65,
        },
      });

      // Add analyzed OSM evidence features geojson source and layers
      map.addSource("analyzed-features-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "analyzed-features-fill",
        type: "fill",
        source: "analyzed-features-source",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": [
            "match",
            ["get", "category"],
            "waterway",
            "#0284c7",
            "power_grid",
            "#7c3aed",
            "green_space",
            "#16a34a",
            "industrial_hazard",
            "#ea580c",
            "#475569",
          ],
          "fill-opacity": 0.16,
        },
      });

      map.addLayer({
        id: "analyzed-features-line",
        type: "line",
        source: "analyzed-features-source",
        paint: {
          "line-color": [
            "match",
            ["get", "category"],
            "road",
            "#2563eb",
            "waterway",
            "#0284c7",
            "power_grid",
            "#7c3aed",
            "railway",
            "#4f46e5",
            "#475569",
          ],
          "line-width": 1.75,
          "line-opacity": 0.7,
        },
      });

      map.addLayer({
        id: "analyzed-features-point",
        type: "circle",
        source: "analyzed-features-source",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 4,
          "circle-color": [
            "match",
            ["get", "category"],
            "power_grid",
            "#7c3aed",
            "transit",
            "#0284c7",
            "amenity_healthcare",
            "#059669",
            "amenity_education",
            "#2563eb",
            "#475569",
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.85,
        },
      });

      // Add footprint geojson source and layers
      map.addSource("footprint-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      // Fill layer
      map.addLayer({
        id: "footprint-fill",
        type: "fill",
        source: "footprint-source",
        paint: {
          "fill-color": "#1F6F54",
          "fill-opacity": 0.25,
        },
      });

      // Border line layer
      map.addLayer({
        id: "footprint-line",
        type: "line",
        source: "footprint-source",
        paint: {
          "line-color": "#1F6F54",
          "line-width": 2.5,
          "line-dasharray": [2, 1],
        },
      });

      // Add conflict features geojson source and layers (polygons, lines, points)
      map.addSource("conflict-features-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "conflict-features-fill",
        type: "fill",
        source: "conflict-features-source",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": [
            "match",
            ["get", "severity"],
            "critical",
            "#dc2626",
            "#d97706",
          ],
          "fill-opacity": 0.35,
        },
      });

      map.addLayer({
        id: "conflict-features-line",
        type: "line",
        source: "conflict-features-source",
        paint: {
          "line-color": [
            "match",
            ["get", "severity"],
            "critical",
            "#dc2626",
            "#d97706",
          ],
          "line-width": 3,
        },
      });

      map.addLayer({
        id: "conflict-features-point",
        type: "circle",
        source: "conflict-features-source",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 6,
          "circle-color": [
            "match",
            ["get", "severity"],
            "critical",
            "#dc2626",
            "#d97706",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      if (onMapLoaded) {
        onMapLoaded(() => {
          if (!mapRef.current) return null;
          try {
            const glCanvas = mapRef.current.getCanvas();
            const outCanvas = document.createElement("canvas");
            outCanvas.width = glCanvas.width;
            outCanvas.height = glCanvas.height;
            const ctx = outCanvas.getContext("2d");
            if (!ctx) return glCanvas.toDataURL("image/png");

            // 1. Draw the WebGL map canvas
            ctx.drawImage(glCanvas, 0, 0);

            // 2. Draw the placed pin marker & label onto the exported canvas if present
            const currentPlacement = placementRef.current;
            const currentLabel = activeTypeRef.current;
            if (currentPlacement) {
              const screenPt = mapRef.current.project([
                currentPlacement.lng,
                currentPlacement.lat,
              ]);
              const dpr = window.devicePixelRatio || 1;
              const px = screenPt.x * dpr;
              const py = screenPt.y * dpr;

              // Draw pin circle
              ctx.save();
              ctx.beginPath();
              ctx.arc(px, py, 8 * dpr, 0, Math.PI * 2);
              ctx.fillStyle = "#1F6F54";
              ctx.fill();
              ctx.lineWidth = 2 * dpr;
              ctx.strokeStyle = "#ffffff";
              ctx.stroke();

              // Draw label badge above pin
              ctx.font = `bold ${11 * dpr}px monospace`;
              const textWidth = ctx.measureText(currentLabel).width;
              const padX = 6 * dpr;
              const padY = 4 * dpr;
              const boxW = textWidth + padX * 2;
              const boxH = 18 * dpr;
              const boxX = px - boxW / 2;
              const boxY = py - 14 * dpr - boxH;

              ctx.fillStyle = "#1F6F54";
              ctx.fillRect(boxX, boxY, boxW, boxH);
              ctx.fillStyle = "#ffffff";
              ctx.textBaseline = "middle";
              ctx.fillText(currentLabel, boxX + padX, boxY + boxH / 2);
              ctx.restore();
            }

            // 3. Stamp required OpenStreetMap + MapLibre attribution bar at bottom-right
            const dpr = window.devicePixelRatio || 1;
            const attrText = "© OpenStreetMap contributors | MapLibre GL | UrjaSetu";
            ctx.save();
            ctx.font = `${11 * dpr}px sans-serif`;
            const attrMetrics = ctx.measureText(attrText);
            const attrW = attrMetrics.width + 16 * dpr;
            const attrH = 22 * dpr;
            const attrX = outCanvas.width - attrW - 8 * dpr;
            const attrY = outCanvas.height - attrH - 8 * dpr;

            ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
            ctx.fillRect(attrX, attrY, attrW, attrH);
            ctx.fillStyle = "#292524";
            ctx.textBaseline = "middle";
            ctx.fillText(attrText, attrX + 8 * dpr, attrY + attrH / 2);
            ctx.restore();

            return outCanvas.toDataURL("image/png");
          } catch (e) {
            console.error("Canvas export error", e);
            return null;
          }
        });
      }
    });

    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      onMapClickRef.current(lat, lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update camera center when centerLat/centerLng props change (e.g. from Geocoder search or scenario switch)
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const currentCenter = mapRef.current.getCenter();
    const shiftMeters = calculateDistanceMeters(
      currentCenter.lat,
      currentCenter.lng,
      centerLat,
      centerLng
    );
    if (shiftMeters > 50) {
      mapRef.current.flyTo({
        center: [centerLng, centerLat],
        zoom: Math.max(mapRef.current.getZoom(), 14),
        essential: true,
      });
    }
  }, [centerLat, centerLng, isLoaded]);

  // Update Study Area bounding box polygon
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const source = mapRef.current.getSource("study-area-source") as maplibregl.GeoJSONSource;
    if (!source) return;

    if (!studyArea) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const { swLat, swLng, neLat, neLng } = studyArea;
    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [swLng, swLat],
                [neLng, swLat],
                [neLng, neLat],
                [swLng, neLat],
                [swLng, swLat],
              ],
            ],
          },
        },
      ],
    });
  }, [studyArea, isLoaded]);

  // Update Analyzed OSM Evidence Features & Geodesic Search Rings on Map
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const analyzedSource = mapRef.current.getSource(
      "analyzed-features-source"
    ) as maplibregl.GeoJSONSource;
    const ringsSource = mapRef.current.getSource(
      "search-rings-source"
    ) as maplibregl.GeoJSONSource;

    if (analyzedSource) {
      if (!showAnalyzedOverlay || !analyzedFeatures || analyzedFeatures.length === 0) {
        analyzedSource.setData({ type: "FeatureCollection", features: [] });
      } else {
        const features = analyzedFeatures.map((f) => ({
          type: "Feature" as const,
          properties: {
            id: f.id,
            category: f.category,
            subCategory: f.subCategory,
            label: f.label,
          },
          geometry: f.geometry,
        }));
        analyzedSource.setData({
          type: "FeatureCollection",
          features,
        });
      }
    }

    if (ringsSource) {
      if (!showAnalyzedOverlay || !searchRings) {
        ringsSource.setData({ type: "FeatureCollection", features: [] });
      } else {
        try {
          const r1Circle = turf.circle(
            [searchRings.centerLng, searchRings.centerLat],
            searchRings.r1M / 1000,
            { steps: 64, units: "kilometers" }
          );
          const r2Circle = turf.circle(
            [searchRings.centerLng, searchRings.centerLat],
            searchRings.r2M / 1000,
            { steps: 64, units: "kilometers" }
          );
          ringsSource.setData({
            type: "FeatureCollection",
            features: [r1Circle as any, r2Circle as any],
          });
        } catch {
          ringsSource.setData({ type: "FeatureCollection", features: [] });
        }
      }
    }
  }, [analyzedFeatures, searchRings, showAnalyzedOverlay, isLoaded]);

  // Update Conflicting OSM Feature Overlays on Map
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const source = mapRef.current.getSource(
      "conflict-features-source"
    ) as maplibregl.GeoJSONSource;
    if (!source) return;

    const geoFeatures = (conflicts || [])
      .filter((c) => Boolean(c.geometry))
      .map((c) => ({
        type: "Feature" as const,
        properties: {
          id: c.id,
          label: c.label,
          severity: c.severity,
          category: c.category,
        },
        geometry: c.geometry!,
      }));

    source.setData({
      type: "FeatureCollection",
      features: geoFeatures,
    });
  }, [conflicts, isLoaded]);

  // Update Pin Marker and Footprint Polygon when placement or activeType changes
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    if (!placement) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      const source = mapRef.current.getSource("footprint-source") as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }

    // 1. Update Pin Marker & Label
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "urjasetu-pin-marker";
      el.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); cursor:pointer;">
          <div class="urjasetu-pin-label" style="background-color: #1F6F54; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; font-family: monospace; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap; margin-bottom: 2px; border: 1px solid #144937;">
            ${activeType}
          </div>
          <svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.37258 0 0 5.37258 0 12C0 19.5 12 32 12 32C12 32 24 19.5 24 12C24 5.37258 18.6274 0 12 0Z" fill="#1F6F54"/>
            <circle cx="12" cy="12" r="5" fill="white"/>
          </svg>
        </div>
      `;

      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([placement.lng, placement.lat])
        .addTo(mapRef.current);
    } else {
      markerRef.current.setLngLat([placement.lng, placement.lat]);
      const labelEl = markerRef.current.getElement().querySelector(".urjasetu-pin-label");
      if (labelEl) {
        labelEl.textContent = activeType;
      }
    }

    // 2. Generate and update Footprint Rectangle Polygon
    try {
      const poly = createFootprintPolygon(
        placement.lat,
        placement.lng,
        placement.lengthM,
        placement.widthM,
        placement.bearingDeg
      );

      const source = mapRef.current.getSource("footprint-source") as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features: [poly as any],
        });
      }
    } catch (err) {
      console.warn("[Footprint Update Error]", err);
    }
  }, [placement, activeType, isLoaded]);

  const mappedConflictCount = (conflicts || []).filter((c) => Boolean(c.geometry)).length;
  const analyzedCount = (analyzedFeatures || []).length;

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full" />
      {(mappedConflictCount > 0 || analyzedCount > 0) && (
        <div className="absolute bottom-8 right-3 z-20 bg-white/95 backdrop-blur-xs border border-stone-200 rounded-panel px-3 py-1.5 shadow-md flex items-center flex-wrap gap-3 text-[11px] font-mono text-stone-700">
          {mappedConflictCount > 0 && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-red-600 inline-block" />
                <span>Critical Conflict</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                <span>Setback Warning</span>
              </span>
              <span className="text-stone-400">({mappedConflictCount} conflicts)</span>
            </>
          )}
          {analyzedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAnalyzedOverlay((prev) => !prev)}
              className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
                showAnalyzedOverlay
                  ? "bg-teal-50 border-teal-300 text-teal-800 font-semibold"
                  : "bg-stone-100 border-stone-200 text-stone-500"
              }`}
              title="Toggle display of the exact OpenStreetMap features and R1/R2 search rings used by the backend suitability engine"
            >
              {showAnalyzedOverlay ? "Hide" : "Show"} Analyzed OSM Evidence ({analyzedCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
};
