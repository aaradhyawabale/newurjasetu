# Extending UrjaSetu — Developer Guide

## 1. How to Add a New Infrastructure Type
Adding a new infrastructure discipline (e.g., *Data Center*, *Electric Vehicle Charging Depot*, *Waste Treatment Plant*) requires **zero modifications to the core analysis engine**. The system is completely registry-driven.

### Step 1: Declare the Type in `src/config/infra-types.ts`
1. Add the type name to the `InfrastructureTypeId` union:
   ```ts
   export type InfrastructureTypeId =
     | "Hospital"
     // ...
     | "EV Charging Depot";
   ```
2. Add the complete configuration object to `INFRASTRUCTURE_TYPES`:
   ```ts
   "EV Charging Depot": {
     id: "EV Charging Depot",
     label: "EV Charging Depot",
     category: "Transport",
     description: "Fleet and commercial electric vehicle charging hub requiring high grid substation capacity.",
     icon: "Zap",
     defaultLengthM: 80,
     defaultWidthM: 50,
     minAreaM2: 1500,
     maxAreaM2: 25000,
     searchRadiusR1M: 800,
     searchRadiusR2M: 2000,
     parameters: [
       {
         id: "chargerCount",
         label: "Fast DC Chargers Count",
         type: "number",
         unit: "bays",
         defaultValue: 24,
         min: 4,
         max: 200,
         helperText: "Number of 150kW+ ultra-fast charging bays.",
       },
     ],
     criteria: [
       {
         id: "grid_substation_proximity",
         label: "Substation Grid Proximity",
         weight: 0.35,
         unit: "m",
         benchmark: "Distance < 500m to power lines/substation (NEEDS VERIFICATION)",
         description: "Minimizes dedicated medium-voltage transformer conduit runs.",
         sourceProvider: "overpass",
       },
       {
         id: "arterial_access",
         label: "Highway Transit Interconnection",
         weight: 0.35,
         unit: "m",
         benchmark: "Immediate arterial road frontage (NEEDS VERIFICATION)",
         description: "Direct highway connectivity for fleet ingress.",
         sourceProvider: "overpass",
       },
       {
         id: "osm_coverage",
         label: "OSM Data Density Confidence",
         weight: 0.15,
         unit: "pts/km²",
         benchmark: "Baseline features check (NEEDS VERIFICATION)",
         description: "Volunteered geographic data confidence.",
         sourceProvider: "osm-coverage",
       },
     ],
   }
   ```
3. Update `ToolSidebar.tsx` to include the tool icon and button.

---

## 2. How to Add a New Geospatial Data Provider
All external data providers reside in `src/server/providers/`.
To add a new provider (e.g., a regional municipal WFS/WMS layer, Copernicus soil moisture, or Sentinel satellite data):
1. Create `src/server/providers/my-provider.ts`.
2. Define the provider class with cache key generation using `generateCacheKey` and `getCachedResponse` from `src/server/providers/cache.ts`:
   ```ts
   import { generateCacheKey, getCachedResponse, setCachedResponse } from "./cache";

   export class SentinelProvider {
     async getSoilMoisture(lat: number, lng: number): Promise<number> {
       const key = generateCacheKey("sentinel_moisture", { lat, lng });
       const cached = await getCachedResponse<number>(key);
       if (cached !== null) return cached;

       // Fetch from external service
       const res = await fetch(`https://api.my-geo-service.com?lat=${lat}&lon=${lng}`);
       const data = await res.json();
       const val = data.moistureIndex;

       await setCachedResponse(key, val, 24); // 24-hr TTL
       return val;
     }
   }
   ```
3. Inject the provider call in `src/server/analysis-engine/engine.ts` inside the criterion evaluation switch block.

---

## 3. How to Configure Custom Vector Basemap Tiles
To switch from OpenStreetMap raster tiles to a hosted vector tile provider (such as MapTiler or Mapbox):
1. In `.env`, set:
   ```env
   NEXT_PUBLIC_MAP_STYLE="https://api.maptiler.com/maps/streets-v2/style.json?key=YOUR_MAPTILER_KEY"
   ```
2. The `MapView` component automatically detects `process.env.NEXT_PUBLIC_MAP_STYLE` and loads the vector style specification.
