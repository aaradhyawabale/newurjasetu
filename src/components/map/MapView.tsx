"use client";

import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createFootprintPolygon } from "@/server/gis/geometry";

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
  onMapClick,
  onMapLoaded,
  className = "",
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

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

      if (onMapLoaded) {
        onMapLoaded(() => {
          if (!mapRef.current) return null;
          try {
            return mapRef.current.getCanvas().toDataURL("image/png");
          } catch (e) {
            console.error("Canvas export error", e);
            return null;
          }
        });
      }
    });

    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      onMapClick(lat, lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update center when props change (if needed)
  useEffect(() => {
    if (!mapRef.current) return;
    // Don't auto-fly if user is just clicking, fly only if major shift
  }, [centerLat, centerLng]);

  // Update Pin Marker and Footprint Polygon when placement changes
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

    // 1. Update Pin Marker
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "urjasetu-pin-marker";
      el.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); cursor:pointer;">
          <div style="background-color: #1F6F54; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; font-family: monospace; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap; margin-bottom: 2px; border: 1px solid #144937;">
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

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
