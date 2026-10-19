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
  linearStartPoint?: { lat: number; lng: number } | null;
  conflicts?: ConflictingFeature[];
  analyzedFeatures?: StandardizedGeoFeature[];
  searchRings?: {
    centerLat: number;
    centerLng: number;
    r1M: number;
    r2M: number;
  } | null;
  solarShadingData?: {
    shadowPolygons?: any[];
    hypotheticalBuildings?: any[];
    shadedFootprintOverlap?: any;
    sunAzimuthDeg?: number;
    sunElevationDeg?: number;
  } | null;
  onMapClick: (lat: number, lng: number) => void;
  onPlacementChange?: (updated: {
    lat: number;
    lng: number;
    lengthM: number;
    widthM: number;
    bearingDeg: number;
  }) => void;
  onMapLoaded?: (exportFn: () => string | null) => void;
  className?: string;
  activeCity?: "pune" | "pcmc" | "nashik";
  bridgeApproachData?: any | null;
}

export const MapView: React.FC<MapViewProps> = ({
  centerLat,
  centerLng,
  zoom = 14,
  activeType,
  placement,
  studyArea,
  linearStartPoint = null,
  conflicts = [],
  analyzedFeatures = [],
  searchRings = null,
  solarShadingData = null,
  bridgeApproachData = null,
  onMapClick,
  onPlacementChange,
  onMapLoaded,
  className = "",
  activeCity,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const onPlacementChangeRef = useRef(onPlacementChange);
  const placementRef = useRef(placement);
  const activeTypeRef = useRef(activeType);
  const linearStartPointRef = useRef(linearStartPoint);
  const linearStartMarkerRef = useRef<maplibregl.Marker | null>(null);
  const dragTooltipRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showAnalyzedOverlay, setShowAnalyzedOverlay] = useState(true);

  // Interactive perimeter resize/rotate control handles
  const handlesRef = useRef<{
    front: maplibregl.Marker | null;
    back: maplibregl.Marker | null;
    left: maplibregl.Marker | null;
    right: maplibregl.Marker | null;
    c1: maplibregl.Marker | null;
    c2: maplibregl.Marker | null;
    c3: maplibregl.Marker | null;
    c4: maplibregl.Marker | null;
    rotate: maplibregl.Marker | null;
  }>({
    front: null,
    back: null,
    left: null,
    right: null,
    c1: null,
    c2: null,
    c3: null,
    c4: null,
    rotate: null,
  });

  // Keep refs updated to avoid stale closures inside MapLibre event listeners
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onPlacementChangeRef.current = onPlacementChange;
  }, [onPlacementChange]);

  useEffect(() => {
    placementRef.current = placement;
    activeTypeRef.current = activeType;
  }, [placement, activeType]);

  useEffect(() => {
    linearStartPointRef.current = linearStartPoint;
  }, [linearStartPoint]);

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

      // Add linear span preview source and layers (for 2-click bridge / corridor placement)
      map.addSource("linear-preview-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "linear-preview-fill",
        type: "fill",
        source: "linear-preview-source",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": "#1F6F54",
          "fill-opacity": 0.25,
        },
      });

      map.addLayer({
        id: "linear-preview-line",
        type: "line",
        source: "linear-preview-source",
        paint: {
          "line-color": "#1F6F54",
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });

      // Add PMC candidate municipal boundary source and unobtrusive styling layers
      map.addSource("pmc-boundary-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "pmc-boundary-fill",
        type: "fill",
        source: "pmc-boundary-source",
        paint: {
          "fill-color": "#0284c7",
          "fill-opacity": 0.04,
        },
      });

      map.addLayer({
        id: "pmc-boundary-line",
        type: "line",
        source: "pmc-boundary-source",
        paint: {
          "line-color": "#0284c7",
          "line-width": 1.75,
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

      // Add Solar Shading Cast Shadows GeoJSON source and layers
      map.addSource("solar-shadows-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "solar-shadows-fill",
        type: "fill",
        source: "solar-shadows-source",
        paint: {
          "fill-color": "#0f172a",
          "fill-opacity": 0.35,
        },
      });

      map.addLayer({
        id: "solar-shadows-line",
        type: "line",
        source: "solar-shadows-source",
        paint: {
          "line-color": "#334155",
          "line-width": 1.5,
          "line-dasharray": [2, 2],
        },
      });

      // Add Solar Hypothetical Proposed Buildings GeoJSON source and layers
      map.addSource("solar-hypothetical-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "solar-hypothetical-fill",
        type: "fill",
        source: "solar-hypothetical-source",
        paint: {
          "fill-color": "#9333ea",
          "fill-opacity": 0.25,
        },
      });

      map.addLayer({
        id: "solar-hypothetical-line",
        type: "line",
        source: "solar-hypothetical-source",
        paint: {
          "line-color": "#7e22ce",
          "line-width": 2,
          "line-dasharray": [4, 2],
        },
      });

      // Add Solar Shaded Array Overlap GeoJSON source and layers
      map.addSource("solar-shaded-overlap-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "solar-shaded-overlap-fill",
        type: "fill",
        source: "solar-shaded-overlap-source",
        paint: {
          "fill-color": "#ef4444",
          "fill-opacity": 0.55,
        },
      });

      map.addLayer({
        id: "solar-shaded-overlap-line",
        type: "line",
        source: "solar-shaded-overlap-source",
        paint: {
          "line-color": "#b91c1c",
          "line-width": 2,
        },
      });

      // Add Bridge Approach Corridors GeoJSON source and layers
      map.addSource("bridge-approaches-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "bridge-approaches-line",
        type: "line",
        source: "bridge-approaches-source",
        paint: {
          "line-color": "#ea580c",
          "line-width": 4,
          "line-dasharray": [3, 2],
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

    // Cursor tooltip element for live measurement badge
    const previewTooltipEl = document.createElement("div");
    previewTooltipEl.className =
      "urjasetu-preview-tooltip pointer-events-none fixed z-50 hidden px-2 py-1 bg-stone-900/90 text-white font-mono text-[11px] rounded shadow-md";
    document.body.appendChild(previewTooltipEl);

    // Hover tooltip element for Analyzed OSM Evidence & Conflict Features
    const featureTooltipEl = document.createElement("div");
    featureTooltipEl.className =
      "urjasetu-feature-tooltip pointer-events-none fixed z-50 hidden px-2.5 py-1.5 bg-stone-900/95 text-white font-mono text-xs rounded shadow-xl border border-stone-700 backdrop-blur-xs tracking-tight max-w-xs";
    document.body.appendChild(featureTooltipEl);

    const interactiveLayers = [
      "analyzed-features-fill",
      "analyzed-features-line",
      "analyzed-features-point",
      "conflict-features-fill",
      "conflict-features-line",
      "conflict-features-point",
    ];

    const onFeatureMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (linearStartPointRef.current) {
        featureTooltipEl.style.display = "none";
        return;
      }
      const feat = e.features?.[0];
      if (!feat || !feat.properties) {
        featureTooltipEl.style.display = "none";
        return;
      }
      map.getCanvas().style.cursor = "pointer";
      const props = feat.properties;
      const cat = (props.category || "feature").toString().replace(/_/g, " ");
      const sub = props.subCategory ? ` · ${props.subCategory}` : "";
      const label = props.label || props.name || props.id || "OSM Feature";
      const severity = props.severity ? ` [${String(props.severity).toUpperCase()}]` : "";

      featureTooltipEl.innerHTML = `
        <div class="text-[10px] text-teal-400 font-bold uppercase tracking-wider">${cat}${sub}${severity}</div>
        <div class="text-xs text-stone-100 font-medium truncate">${label}</div>
      `;
      featureTooltipEl.style.display = "block";
      featureTooltipEl.style.left = `${e.originalEvent.clientX + 14}px`;
      featureTooltipEl.style.top = `${e.originalEvent.clientY - 20}px`;
    };

    const onFeatureMouseLeave = () => {
      map.getCanvas().style.cursor = "";
      featureTooltipEl.style.display = "none";
    };

    interactiveLayers.forEach((layerId) => {
      map.on("mousemove", layerId, onFeatureMouseMove);
      map.on("mouseleave", layerId, onFeatureMouseLeave);
    });

    map.on("mousemove", (e) => {
      const startPt = linearStartPointRef.current;
      if (!startPt || !mapRef.current) {
        previewTooltipEl.style.display = "none";
        return;
      }

      const { lng, lat } = e.lngLat;
      const distM = Math.max(10, Math.round(calculateDistanceMeters(startPt.lat, startPt.lng, lat, lng)));
      let b = turf.bearing(turf.point([startPt.lng, startPt.lat]), turf.point([lng, lat]));
      const bearingDeg = Math.round(((b % 360) + 360) % 360);
      const mid = turf.midpoint(turf.point([startPt.lng, startPt.lat]), turf.point([lng, lat]));
      const midLat = mid.geometry.coordinates[1];
      const midLng = mid.geometry.coordinates[0];

      const currentType = activeTypeRef.current;
      const isBridge = currentType === "Bridge";
      const widthM = placementRef.current?.widthM || (isBridge ? 20 : 15);

      try {
        const poly = createFootprintPolygon(midLat, midLng, distM, widthM, bearingDeg);
        const centerLine = turf.lineString([
          [startPt.lng, startPt.lat],
          [lng, lat],
        ]);

        const source = mapRef.current.getSource("linear-preview-source") as maplibregl.GeoJSONSource;
        if (source) {
          source.setData({
            type: "FeatureCollection",
            features: [poly as any, centerLine as any],
          });
        }

        previewTooltipEl.style.display = "block";
        previewTooltipEl.style.left = `${e.originalEvent.clientX + 14}px`;
        previewTooltipEl.style.top = `${e.originalEvent.clientY - 14}px`;
        previewTooltipEl.textContent = `${currentType} Span: ${distM}m | ${bearingDeg}° (Click endpoint to place)`;
      } catch {
        // ignore
      }
    });

    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      previewTooltipEl.style.display = "none";
      featureTooltipEl.style.display = "none";
      onMapClickRef.current(lat, lng);
    });

    return () => {
      interactiveLayers.forEach((layerId) => {
        if (mapRef.current) {
          mapRef.current.off("mousemove", layerId, onFeatureMouseMove);
          mapRef.current.off("mouseleave", layerId, onFeatureMouseLeave);
        }
      });
      if (featureTooltipEl.parentNode) {
        featureTooltipEl.parentNode.removeChild(featureTooltipEl);
      }
      if (previewTooltipEl.parentNode) {
        previewTooltipEl.parentNode.removeChild(previewTooltipEl);
      }
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

  // Update Linear / Bridge Start Marker on Map
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    if (!linearStartPoint) {
      if (linearStartMarkerRef.current) {
        linearStartMarkerRef.current.remove();
        linearStartMarkerRef.current = null;
      }
      const source = mapRef.current.getSource("linear-preview-source") as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }

    if (!linearStartMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "urjasetu-linear-start-marker";
      el.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); pointer-events:none;">
          <div style="background-color: #1F6F54; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; font-family: monospace; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap; margin-bottom: 2px; border: 1px solid white;">
            ${activeType} Start
          </div>
          <div style="width: 16px; height: 16px; border-radius: 50%; background: #1F6F54; border: 3px solid white; box-shadow: 0 0 10px #1F6F54;"></div>
        </div>
      `;
      linearStartMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([linearStartPoint.lng, linearStartPoint.lat])
        .addTo(mapRef.current);
    } else {
      linearStartMarkerRef.current.setLngLat([linearStartPoint.lng, linearStartPoint.lat]);
    }
  }, [linearStartPoint, activeType, isLoaded]);

  // Update PMC candidate municipal boundary on map
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const boundarySource = mapRef.current.getSource("pmc-boundary-source") as maplibregl.GeoJSONSource;
    if (!boundarySource) return;

    // Show PMC candidate boundary when actively viewing Pune or when coordinates fall within Pune bounding region
    const isPune =
      activeCity === "pune" ||
      (!activeCity &&
        centerLat >= 18.35 &&
        centerLat <= 18.63 &&
        centerLng >= 73.65 &&
        centerLng <= 74.05);

    if (isPune) {
      fetch("/api/boundaries?city=pune")
        .then((res) => res.json())
        .then((data) => {
          if (data?.success && data?.data?.boundary && mapRef.current) {
            const currentSource = mapRef.current.getSource(
              "pmc-boundary-source"
            ) as maplibregl.GeoJSONSource;
            if (currentSource) {
              currentSource.setData({
                type: "FeatureCollection",
                features: [data.data.boundary],
              });
            }
          }
        })
        .catch((err) => {
          console.warn("Could not load PMC candidate boundary:", err);
        });
    } else {
      // Clear PMC boundary when viewing other cities (PCMC or Nashik)
      boundarySource.setData({ type: "FeatureCollection", features: [] });
    }
  }, [centerLat, centerLng, activeCity, isLoaded]);

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

  // Update Pin Marker, Perimeter Control Handles, and Footprint Polygon
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const cleanupHandles = () => {
      Object.keys(handlesRef.current).forEach((k) => {
        const key = k as keyof typeof handlesRef.current;
        if (handlesRef.current[key]) {
          handlesRef.current[key]!.remove();
          handlesRef.current[key] = null;
        }
      });
    };

    if (!placement) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      cleanupHandles();
      const source = mapRef.current.getSource("footprint-source") as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }

    const isBridge = activeType === "Bridge";

    // Helper to calculate geometry points for footprint and handles
    const getGeometryPoints = (
      lat: number,
      lng: number,
      lengthM: number,
      widthM: number,
      bearingDeg: number
    ) => {
      const centerPt = turf.point([lng, lat]);
      const b = ((bearingDeg % 360) + 360) % 360;
      const bPerp = (b + 90) % 360;
      const halfLenKm = lengthM / 2 / 1000;
      const halfWidKm = widthM / 2 / 1000;

      const pFront = turf.destination(centerPt, halfLenKm, b, { units: "kilometers" });
      const pBack = turf.destination(centerPt, halfLenKm, (b + 180) % 360, { units: "kilometers" });
      const pLeft = turf.destination(centerPt, halfWidKm, (bPerp + 180) % 360, { units: "kilometers" });
      const pRight = turf.destination(centerPt, halfWidKm, bPerp, { units: "kilometers" });

      const c1 = turf.destination(pFront, halfWidKm, (bPerp + 180) % 360, { units: "kilometers" });
      const c2 = turf.destination(pFront, halfWidKm, bPerp, { units: "kilometers" });
      const c3 = turf.destination(pBack, halfWidKm, bPerp, { units: "kilometers" });
      const c4 = turf.destination(pBack, halfWidKm, (bPerp + 180) % 360, { units: "kilometers" });
      const pRotate = turf.destination(pFront, 0.035, b, { units: "kilometers" });

      return { centerPt, b, bPerp, pFront, pBack, pLeft, pRight, c1, c2, c3, c4, pRotate };
    };

    const updateFootprintSource = (
      lat: number,
      lng: number,
      lengthM: number,
      widthM: number,
      bearingDeg: number
    ) => {
      if (!mapRef.current) return;
      try {
        const poly = createFootprintPolygon(lat, lng, lengthM, widthM, bearingDeg);
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
    };

    // Tooltip helper during dragging
    const showTooltip = (text: string) => {
      if (!dragTooltipRef.current) return;
      dragTooltipRef.current.style.display = "block";
      dragTooltipRef.current.textContent = text;
      dragTooltipRef.current.style.left = "50%";
      dragTooltipRef.current.style.bottom = "40px";
      dragTooltipRef.current.style.transform = "translateX(-50%)";
    };

    const hideTooltip = () => {
      if (!dragTooltipRef.current) return;
      dragTooltipRef.current.style.display = "none";
    };

    const pts = getGeometryPoints(
      placement.lat,
      placement.lng,
      placement.lengthM,
      placement.widthM,
      placement.bearingDeg
    );

    // Initial / synchronized draw of footprint polygon
    updateFootprintSource(
      placement.lat,
      placement.lng,
      placement.lengthM,
      placement.widthM,
      placement.bearingDeg
    );

    // Synchronize positions of perimeter handles
    const syncHandlePositions = (
      lat: number,
      lng: number,
      lengthM: number,
      widthM: number,
      bearingDeg: number
    ) => {
      const p = getGeometryPoints(lat, lng, lengthM, widthM, bearingDeg);
      if (handlesRef.current.front) handlesRef.current.front.setLngLat(p.pFront.geometry.coordinates as [number, number]);
      if (handlesRef.current.back) handlesRef.current.back.setLngLat(p.pBack.geometry.coordinates as [number, number]);
      if (handlesRef.current.left) handlesRef.current.left.setLngLat(p.pLeft.geometry.coordinates as [number, number]);
      if (handlesRef.current.right) handlesRef.current.right.setLngLat(p.pRight.geometry.coordinates as [number, number]);
      if (handlesRef.current.c1) handlesRef.current.c1.setLngLat(p.c1.geometry.coordinates as [number, number]);
      if (handlesRef.current.c2) handlesRef.current.c2.setLngLat(p.c2.geometry.coordinates as [number, number]);
      if (handlesRef.current.c3) handlesRef.current.c3.setLngLat(p.c3.geometry.coordinates as [number, number]);
      if (handlesRef.current.c4) handlesRef.current.c4.setLngLat(p.c4.geometry.coordinates as [number, number]);
      if (handlesRef.current.rotate) handlesRef.current.rotate.setLngLat(p.pRotate.geometry.coordinates as [number, number]);
    };

    // 1. Center Pin Marker (Draggable)
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "urjasetu-pin-marker";
      el.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); cursor:grab;">
          <div class="urjasetu-pin-label" style="background-color: #1F6F54; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; font-family: monospace; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap; margin-bottom: 2px; border: 1px solid #144937;">
            ${activeType}
          </div>
          <svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.37258 0 0 5.37258 0 12C0 19.5 12 32 12 32C12 32 24 19.5 24 12C24 5.37258 18.6274 0 12 0Z" fill="#1F6F54"/>
            <circle cx="12" cy="12" r="5" fill="white"/>
          </svg>
        </div>
      `;

      const m = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([placement.lng, placement.lat])
        .addTo(mapRef.current);

      m.on("drag", () => {
        const pos = m.getLngLat();
        const p = placementRef.current;
        if (!p) return;
        updateFootprintSource(pos.lat, pos.lng, p.lengthM, p.widthM, p.bearingDeg);
        syncHandlePositions(pos.lat, pos.lng, p.lengthM, p.widthM, p.bearingDeg);
        showTooltip(`${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)} (Move Footprint)`);
      });

      m.on("dragend", () => {
        hideTooltip();
        const pos = m.getLngLat();
        const p = placementRef.current;
        if (!p) return;
        onPlacementChangeRef.current?.({
          lat: pos.lat,
          lng: pos.lng,
          lengthM: p.lengthM,
          widthM: p.widthM,
          bearingDeg: p.bearingDeg,
        });
      });

      markerRef.current = m;
    } else {
      markerRef.current.setLngLat([placement.lng, placement.lat]);
      const labelEl = markerRef.current.getElement().querySelector(".urjasetu-pin-label");
      if (labelEl) {
        labelEl.textContent = activeType;
      }
    }

    // 2. Front Handle (End Point / Length+)
    if (!handlesRef.current.front) {
      const el = document.createElement("div");
      el.className = "urjasetu-handle urjasetu-handle-front";
      el.style.cursor = "grab";
      el.title = isBridge ? "Bridge Endpoint: drag to stretch span and align angle" : "Drag to adjust Length";
      el.innerHTML = isBridge
        ? `<div style="background:#1F6F54;color:white;padding:2px 7px;border-radius:12px;font-size:10px;font-weight:bold;font-family:monospace;box-shadow:0 2px 6px rgba(0,0,0,0.35);border:1.5px solid white;display:flex;align-items:center;gap:3px;white-space:nowrap;user-select:none;">End ⇄</div>`
        : `<div style="width:14px;height:14px;background:#ffffff;border:2.5px solid #1F6F54;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.35);user-select:none;"></div>`;

      const m = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(pts.pFront.geometry.coordinates as [number, number])
        .addTo(mapRef.current);

      m.on("drag", () => {
        const p = placementRef.current;
        if (!p) return;
        const curPts = getGeometryPoints(p.lat, p.lng, p.lengthM, p.widthM, p.bearingDeg);
        const anchorBack = curPts.pBack.geometry.coordinates;
        const pos = m.getLngLat();
        const newLen = Math.max(10, Math.round(calculateDistanceMeters(anchorBack[1], anchorBack[0], pos.lat, pos.lng)));
        let nb = turf.bearing(turf.point(anchorBack), turf.point([pos.lng, pos.lat]));
        const newBearing = Math.round(((nb % 360) + 360) % 360);
        const newMid = turf.midpoint(turf.point(anchorBack), turf.point([pos.lng, pos.lat]));
        const midLat = newMid.geometry.coordinates[1];
        const midLng = newMid.geometry.coordinates[0];

        updateFootprintSource(midLat, midLng, newLen, p.widthM, newBearing);
        markerRef.current?.setLngLat([midLng, midLat]);
        syncHandlePositions(midLat, midLng, newLen, p.widthM, newBearing);
        showTooltip(`Length: ${newLen}m | Bearing: ${newBearing}° (${isBridge ? "Bridge Span" : "Footprint"})`);
      });

      m.on("dragend", () => {
        hideTooltip();
        const p = placementRef.current;
        if (!p) return;
        const curPts = getGeometryPoints(p.lat, p.lng, p.lengthM, p.widthM, p.bearingDeg);
        const anchorBack = curPts.pBack.geometry.coordinates;
        const pos = m.getLngLat();
        const newLen = Math.max(10, Math.round(calculateDistanceMeters(anchorBack[1], anchorBack[0], pos.lat, pos.lng)));
        let nb = turf.bearing(turf.point(anchorBack), turf.point([pos.lng, pos.lat]));
        const newBearing = Math.round(((nb % 360) + 360) % 360);
        const newMid = turf.midpoint(turf.point(anchorBack), turf.point([pos.lng, pos.lat]));
        const midLat = newMid.geometry.coordinates[1];
        const midLng = newMid.geometry.coordinates[0];

        onPlacementChangeRef.current?.({
          lat: midLat,
          lng: midLng,
          lengthM: newLen,
          widthM: p.widthM,
          bearingDeg: newBearing,
        });
      });

      handlesRef.current.front = m;
    } else {
      handlesRef.current.front.setLngLat(pts.pFront.geometry.coordinates as [number, number]);
    }

    // 3. Back Handle (Start Point / Length-)
    if (!handlesRef.current.back) {
      const el = document.createElement("div");
      el.className = "urjasetu-handle urjasetu-handle-back";
      el.style.cursor = "grab";
      el.title = isBridge ? "Bridge Start Point: drag to adjust start abutment" : "Drag to adjust Length";
      el.innerHTML = isBridge
        ? `<div style="background:#1F6F54;color:white;padding:2px 7px;border-radius:12px;font-size:10px;font-weight:bold;font-family:monospace;box-shadow:0 2px 6px rgba(0,0,0,0.35);border:1.5px solid white;display:flex;align-items:center;gap:3px;white-space:nowrap;user-select:none;">Start ⇄</div>`
        : `<div style="width:14px;height:14px;background:#ffffff;border:2.5px solid #1F6F54;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.35);user-select:none;"></div>`;

      const m = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(pts.pBack.geometry.coordinates as [number, number])
        .addTo(mapRef.current);

      m.on("drag", () => {
        const p = placementRef.current;
        if (!p) return;
        const curPts = getGeometryPoints(p.lat, p.lng, p.lengthM, p.widthM, p.bearingDeg);
        const anchorFront = curPts.pFront.geometry.coordinates;
        const pos = m.getLngLat();
        const newLen = Math.max(10, Math.round(calculateDistanceMeters(pos.lat, pos.lng, anchorFront[1], anchorFront[0])));
        let nb = turf.bearing(turf.point([pos.lng, pos.lat]), turf.point(anchorFront));
        const newBearing = Math.round(((nb % 360) + 360) % 360);
        const newMid = turf.midpoint(turf.point([pos.lng, pos.lat]), turf.point(anchorFront));
        const midLat = newMid.geometry.coordinates[1];
        const midLng = newMid.geometry.coordinates[0];

        updateFootprintSource(midLat, midLng, newLen, p.widthM, newBearing);
        markerRef.current?.setLngLat([midLng, midLat]);
        syncHandlePositions(midLat, midLng, newLen, p.widthM, newBearing);
        showTooltip(`Length: ${newLen}m | Bearing: ${newBearing}° (${isBridge ? "Bridge Span" : "Footprint"})`);
      });

      m.on("dragend", () => {
        hideTooltip();
        const p = placementRef.current;
        if (!p) return;
        const curPts = getGeometryPoints(p.lat, p.lng, p.lengthM, p.widthM, p.bearingDeg);
        const anchorFront = curPts.pFront.geometry.coordinates;
        const pos = m.getLngLat();
        const newLen = Math.max(10, Math.round(calculateDistanceMeters(pos.lat, pos.lng, anchorFront[1], anchorFront[0])));
        let nb = turf.bearing(turf.point([pos.lng, pos.lat]), turf.point(anchorFront));
        const newBearing = Math.round(((nb % 360) + 360) % 360);
        const newMid = turf.midpoint(turf.point([pos.lng, pos.lat]), turf.point(anchorFront));
        const midLat = newMid.geometry.coordinates[1];
        const midLng = newMid.geometry.coordinates[0];

        onPlacementChangeRef.current?.({
          lat: midLat,
          lng: midLng,
          lengthM: newLen,
          widthM: p.widthM,
          bearingDeg: newBearing,
        });
      });

      handlesRef.current.back = m;
    } else {
      handlesRef.current.back.setLngLat(pts.pBack.geometry.coordinates as [number, number]);
    }

    // 4. Side Handles (Left & Right - Width in meters)
    const setupSideHandle = (side: "left" | "right", coord: [number, number]) => {
      if (!handlesRef.current[side]) {
        const el = document.createElement("div");
        el.className = `urjasetu-handle urjasetu-handle-${side}`;
        el.style.cursor = "ew-resize";
        el.title = "Drag to adjust Width in meters";
        el.innerHTML = `<div style="width:13px;height:13px;background:#ffffff;border:2.5px solid #0284c7;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.35);user-select:none;"></div>`;

        const m = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat(coord)
          .addTo(mapRef.current!);

        m.on("drag", () => {
          const p = placementRef.current;
          if (!p) return;
          const pos = m.getLngLat();
          const distM = calculateDistanceMeters(p.lat, p.lng, pos.lat, pos.lng);
          const newWid = Math.max(5, Math.min(1000, Math.round(distM * 2)));

          updateFootprintSource(p.lat, p.lng, p.lengthM, newWid, p.bearingDeg);
          syncHandlePositions(p.lat, p.lng, p.lengthM, newWid, p.bearingDeg);
          showTooltip(`Width: ${newWid}m (${(p.lengthM * newWid).toLocaleString()} m²)`);
        });

        m.on("dragend", () => {
          hideTooltip();
          const p = placementRef.current;
          if (!p) return;
          const pos = m.getLngLat();
          const distM = calculateDistanceMeters(p.lat, p.lng, pos.lat, pos.lng);
          const newWid = Math.max(5, Math.min(1000, Math.round(distM * 2)));

          onPlacementChangeRef.current?.({
            lat: p.lat,
            lng: p.lng,
            lengthM: p.lengthM,
            widthM: newWid,
            bearingDeg: p.bearingDeg,
          });
        });

        handlesRef.current[side] = m;
      } else {
        handlesRef.current[side]!.setLngLat(coord);
      }
    };

    setupSideHandle("left", pts.pLeft.geometry.coordinates as [number, number]);
    setupSideHandle("right", pts.pRight.geometry.coordinates as [number, number]);

    // 5. Four Corner Handles (Scale footprint dimensions proportionally)
    const corners: ("c1" | "c2" | "c3" | "c4")[] = ["c1", "c2", "c3", "c4"];
    corners.forEach((cid) => {
      const coord = pts[cid].geometry.coordinates as [number, number];
      if (!handlesRef.current[cid]) {
        const el = document.createElement("div");
        el.className = `urjasetu-handle urjasetu-handle-${cid}`;
        el.style.cursor = "nwse-resize";
        el.title = "Drag corner to scale footprint dimensions";
        el.innerHTML = `<div style="width:10px;height:10px;background:#ffffff;border:2px solid #1F6F54;border-radius:2px;box-shadow:0 1px 3px rgba(0,0,0,0.3);user-select:none;"></div>`;

        const m = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat(coord)
          .addTo(mapRef.current!);

        m.on("drag", () => {
          const p = placementRef.current;
          if (!p) return;
          const pos = m.getLngLat();
          const distM = calculateDistanceMeters(p.lat, p.lng, pos.lat, pos.lng);
          const diagM = Math.sqrt((p.lengthM / 2) ** 2 + (p.widthM / 2) ** 2);
          const scale = distM / Math.max(1, diagM);
          const newLen = Math.max(10, Math.min(2000, Math.round(p.lengthM * scale)));
          const newWid = Math.max(5, Math.min(1000, Math.round(p.widthM * scale)));

          updateFootprintSource(p.lat, p.lng, newLen, newWid, p.bearingDeg);
          syncHandlePositions(p.lat, p.lng, newLen, newWid, p.bearingDeg);
          showTooltip(`${newLen}m × ${newWid}m (${(newLen * newWid).toLocaleString()} m²)`);
        });

        m.on("dragend", () => {
          hideTooltip();
          const p = placementRef.current;
          if (!p) return;
          const pos = m.getLngLat();
          const distM = calculateDistanceMeters(p.lat, p.lng, pos.lat, pos.lng);
          const diagM = Math.sqrt((p.lengthM / 2) ** 2 + (p.widthM / 2) ** 2);
          const scale = distM / Math.max(1, diagM);
          const newLen = Math.max(10, Math.min(2000, Math.round(p.lengthM * scale)));
          const newWid = Math.max(5, Math.min(1000, Math.round(p.widthM * scale)));

          onPlacementChangeRef.current?.({
            lat: p.lat,
            lng: p.lng,
            lengthM: newLen,
            widthM: newWid,
            bearingDeg: p.bearingDeg,
          });
        });

        handlesRef.current[cid] = m;
      } else {
        handlesRef.current[cid]!.setLngLat(coord);
      }
    });

    // 6. Rotation Handle (Orient footprint angle)
    if (!handlesRef.current.rotate) {
      const el = document.createElement("div");
      el.className = "urjasetu-handle urjasetu-handle-rotate";
      el.style.cursor = "crosshair";
      el.title = "Drag to rotate bearing angle";
      el.innerHTML = `<div style="width:18px;height:18px;background:#1F6F54;color:white;border:1.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;user-select:none;">↻</div>`;

      const m = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(pts.pRotate.geometry.coordinates as [number, number])
        .addTo(mapRef.current);

      m.on("drag", () => {
        const p = placementRef.current;
        if (!p) return;
        const pos = m.getLngLat();
        let nb = turf.bearing(turf.point([p.lng, p.lat]), turf.point([pos.lng, pos.lat]));
        const newBearing = Math.round(((nb % 360) + 360) % 360);

        updateFootprintSource(p.lat, p.lng, p.lengthM, p.widthM, newBearing);
        syncHandlePositions(p.lat, p.lng, p.lengthM, p.widthM, newBearing);
        showTooltip(`Bearing: ${newBearing}°`);
      });

      m.on("dragend", () => {
        hideTooltip();
        const p = placementRef.current;
        if (!p) return;
        const pos = m.getLngLat();
        let nb = turf.bearing(turf.point([p.lng, p.lat]), turf.point([pos.lng, pos.lat]));
        const newBearing = Math.round(((nb % 360) + 360) % 360);

        onPlacementChangeRef.current?.({
          lat: p.lat,
          lng: p.lng,
          lengthM: p.lengthM,
          widthM: p.widthM,
          bearingDeg: newBearing,
        });
      });

      handlesRef.current.rotate = m;
    } else {
      handlesRef.current.rotate.setLngLat(pts.pRotate.geometry.coordinates as [number, number]);
    }
  }, [placement, activeType, isLoaded]);

  // Update Solar Shading Simulation Overlays on Map
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const shadowsSource = mapRef.current.getSource("solar-shadows-source") as maplibregl.GeoJSONSource;
    const hypoSource = mapRef.current.getSource("solar-hypothetical-source") as maplibregl.GeoJSONSource;
    const overlapSource = mapRef.current.getSource("solar-shaded-overlap-source") as maplibregl.GeoJSONSource;

    if (shadowsSource) {
      shadowsSource.setData({
        type: "FeatureCollection",
        features: (solarShadingData?.shadowPolygons as any[]) || [],
      });
    }

    if (hypoSource) {
      hypoSource.setData({
        type: "FeatureCollection",
        features: (solarShadingData?.hypotheticalBuildings as any[]) || [],
      });
    }

    if (overlapSource) {
      overlapSource.setData({
        type: "FeatureCollection",
        features: solarShadingData?.shadedFootprintOverlap ? [solarShadingData.shadedFootprintOverlap as any] : [],
      });
    }
  }, [solarShadingData, isLoaded]);

  // Update Bridge Approach Corridors on Map
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const src = mapRef.current.getSource("bridge-approaches-source") as maplibregl.GeoJSONSource;
    if (!src) return;

    const corridors =
      bridgeApproachData?.recommendedActions?.suggestion2_approachRoads?.corridorsGeoJson ||
      bridgeApproachData?.corridorsGeoJson;

    if (corridors && Array.isArray(corridors.features) && corridors.features.length > 0) {
      src.setData(corridors);
    } else {
      src.setData({ type: "FeatureCollection", features: [] });
    }
  }, [bridgeApproachData, isLoaded]);

  const mappedConflictCount = (conflicts || []).filter((c) => Boolean(c.geometry)).length;
  const analyzedCount = (analyzedFeatures || []).length;

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Drag Dimension Tooltip */}
      <div
        ref={dragTooltipRef}
        className="pointer-events-none fixed z-50 hidden px-3 py-1.5 bg-stone-900/95 text-white font-mono text-xs rounded-panel shadow-xl border border-stone-700 font-semibold backdrop-blur-xs tracking-tight"
      />

      {/* Solar Shading Floating Indicator Badge */}
      {solarShadingData?.sunAzimuthDeg !== undefined && (
        <div className="absolute top-3 left-3 z-20 bg-amber-50/95 backdrop-blur-xs border border-amber-300 rounded-panel px-3 py-1.5 shadow-md flex items-center gap-2 text-xs text-amber-900 font-mono">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span>
            Sun: Azimuth {solarShadingData.sunAzimuthDeg}°, Elevation {solarShadingData.sunElevationDeg}°
          </span>
          <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-sans font-bold">
            Shading Active
          </span>
        </div>
      )}
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
