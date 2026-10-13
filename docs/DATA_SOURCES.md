# Geospatial Data Sources, Provenance & Reliability — UrjaSetu

## 1. Provider Audit (STEP 1)

UrjaSetu ingests geospatial, topographic, meteorological, and solar-climatological evidence from five live public APIs and supports statutory reference benchmarks from authoritative Indian regulatory bodies. Every provider is wrapped in a typed adapter under `src/server/providers/` with canonical caching, in-flight request deduplication, explicit HTTP timeouts, and stale-cache fallback.

### Summary Comparison Matrix

| Provider | Data Supplied | Geographic Coverage | Spatial & Temporal Resolution | Retrieval Method | Update Frequency | Rate Limits & Quotas | Licensing & Attribution | Required Credentials |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. OpenStreetMap (Overpass API)** | Vector features: buildings, road hierarchy, bridges, waterways, railways, power grid, civic amenities, land-use | Global (`[-90, 90]`, `[-180, 180]`); completeness varies between urban cores and rural blocks | Vector geometry (~1m–10m positional accuracy); continuous community edits | `POST` Overpass QL (`[out:json][timeout:25]`) with bounded `around:R,lat,lng` (`R ∈ [50m, 5000m]`); primary + mirror failover | Continuous (minute-by-minute OSM planet diffs); cached 24h locally | ~2 concurrent queries / IP; ~10,000 queries/day on public instances | **ODbL 1.0** (`© OpenStreetMap contributors`) | None (optional custom `OVERPASS_API_URL` / `OVERPASS_BACKUP_URL`) |
| **2. OpenStreetMap (Nominatim)** | Forward place search (`geocode`) and reverse administrative address lookup (`reverseGeocode`) | Global | Point / administrative polygon centroid; continuous updates | `GET /search` & `GET /reverse` (`format=jsonv2`) with 10s `AbortController` timeout | Continuous; cached 72h locally | Strict **max 1 req/sec** (`1100ms` mutex queue enforced in `nominatim.ts`) | **ODbL 1.0** (`© OpenStreetMap contributors`) | None (`GEO_USER_AGENT` header required and configured) |
| **3. Open-Meteo Elevation API (Copernicus DEM)** | 3×3 grid (9 points, 60m step) surface elevation (`m`), Horn's 3×3 slope gradient (`%`), and aspect (`0°–360°`) | Global land surface (`-90°` to `+90°`) | **90m** horizontal (`Copernicus DEM GLO-90`, 30m in select regions); static baseline | `GET /v1/elevation` batch 9-coordinate query with 12s timeout | Static baseline DEM (2021 Copernicus release); cached 72h locally | 10,000 calls/day (non-commercial open access) | **CC BY 4.0** (Open-Meteo) / Copernicus DEM License | None |
| **4. Open-Meteo Historical Climate Archive (ERA5-Land)** | 365-day daily precipitation (`precipitation_sum` in `mm/day`) -> peak 24-hr rainfall & annual total rainfall | Global (`-90°` to `+90°`) | **0.1° × 0.1° (~9 km)** spatial grid; daily temporal resolution (5-day lag) | `GET /v1/archive` with 12s timeout | Daily (5-day reanalysis lag behind real time); cached 72h locally | 10,000 calls/day (non-commercial open access) | **CC BY 4.0** (ECMWF Copernicus ERA5-Land / Open-Meteo) | None |
| **5. NASA POWER Agroclimatology / RE** | Multi-year annual mean Global Horizontal Irradiance (`ALLSKY_SFC_SW_DWN` in `kWh/m²/day`), clear-sky GHI (`CLRSKY_SFC_SW_DWN`), and 2m ambient temperature (`T2M` in `°C`) | Global (`-85°` to `+85°` reliable solar PV agroclimatology bounds) | **0.5° × 0.625° (~50 km)** MERRA-2 / **1.0° × 1.0°** CERES SYN1deg; 20-year climatological monthly/annual mean | `GET /api/temporal/climatology/point?community=RE` with 12s timeout | Multi-year climatological baseline updated periodically by NASA LaRC; cached 72h locally | ~60 req/min burst limit per IP | **Public Domain** (NASA Langley Research Center POWER Project) | None |
| **6. Authoritative Indian Statutory Standards & Reference Datasets** | Separation setbacks, environmental buffers, and engineering design benchmarks (IRC, NBC 2016, CPCB, CPHEEO, CEA, MNRE/NIWE) | India national statutory jurisdiction | Regulatory rules (`src/server/analysis-engine/separation-rules.ts`) | Embedded deterministic rule engine + optional WMS/GeoJSON ingestion | Statutory code revisions | N/A (local execution) | Public Government Standards (GoI) | Cadastral parcel / CEA live feeder APIs require state portal credentials if connected |

---

## 2. Detailed Provider Specifications & Known Limitations

### 2.1 OpenStreetMap Overpass API (`src/server/providers/overpass.ts`)
- **Data Supplied**: Nodes and ways with geometry (`out body geom;`) for `building`, `highway`, `bridge`, `waterway`, `natural=water|wood`, `landuse`, `leisure`, `railway`, `amenity`, `power`, `public_transport`, and `military`.
- **Known Limitations**:
  - Volunteered Geographic Information (VGI) completeness varies significantly between Tier-1 cities and rural districts.
  - Secondary building attributes (`height`, `building:levels`) and power line voltages (`voltage`) are frequently untagged even when footprints are mapped.
  - Public Overpass servers reject unbounded queries or heavy regional bounding boxes with `HTTP 429` or `HTTP 504`.
- **Mitigations Implemented**:
  - Query radius is clamped strictly to `[50m, 5000m]` (`MIN_OVERPASS_RADIUS_M = 50`, `MAX_OVERPASS_RADIUS_M = 5000`).
  - Automatic failover from `overpass-api.de` to `overpass.kumi.systems`.
  - Feature density (`features / km²`) is computed for every run; if density `< 3.0 features/km²`, a coverage warning is recorded.
  - If nearby buildings within 250m lack `height` and `building:levels` tags, `normalizeOsmElement()` marks `quality.completeness = "partial"` with `missingAttributes: ["building:levels", "height"]`, and `shading_obstruction_proxy` caps its score at `68/100` (`acceptable`) with an explicit warning rather than assuming a clear horizon (`94/100`).

### 2.2 Open-Meteo Elevation & Climate Archive (`src/server/providers/open-meteo.ts`)
- **Data Supplied**:
  - **Elevation**: 9-point 3×3 stencil (`~60m` spacing) around `(lat, lng)` to compute center elevation (`m`), 2D finite-difference slope gradient (`%`), and aspect (`deg`).
  - **Climate**: 365-day daily `precipitation_sum` series (`mm`) used by Drainage infrastructure analysis.
- **Known Limitations**:
  - Copernicus GLO-90 DEM has ~90m horizontal post spacing, which smooths out micro-topography, roadside ditches, and retaining walls.
  - ERA5-Land precipitation is a ~9 km grid cell average and does not capture localized urban heat-island convective micro-bursts without local IMD rain-gauge calibration.

### 2.3 NASA POWER CERES / MERRA-2 (`src/server/providers/nasa-power.ts`)
- **Data Supplied**: `ALLSKY_SFC_SW_DWN` (All-Sky Surface Shortwave Downward Irradiance in `kWh/m²/day`), `CLRSKY_SFC_SW_DWN` (Clear-Sky GHI), and `T2M` (mean ambient temperature at 2 meters in `°C`).
- **Known Limitations**:
  - Satellite-derived irradiance (`~50 km` grid) does not resolve local horizon shading from adjacent buildings, trees, or ridge lines (which UrjaSetu evaluates separately via OSM `shading_obstruction_proxy` and DEM `slope_and_aspect`).
  - NASA POWER uses `-999` or `-99` as sentinel values for missing cells and has degraded solar PV applicability above `±85°` latitude.
- **Mitigations Implemented**:
  - Latitudes beyond `±85°` are rejected with `ProviderError("COVERAGE_LIMITATION")`.
  - Values `<= 0`, `> 15`, or equal to `-999` throw `ProviderError("MALFORMED_RESPONSE")` so sentinel values can never corrupt solar scores.

---

## 3. Standardized Data Contract (`src/server/providers/types.ts`) (STEP 2)

All geographic vector features retrieved from OpenStreetMap are normalized into `StandardizedGeoFeature` via `normalizeOsmElement()` / `normalizeOsmElements()`:

```ts
export interface StandardizedGeoFeature {
  id: string;                            // Canonical internal ID (e.g., "osm:way:102")
  sourceId: string;                      // Upstream identifier (e.g., "way/102")
  sourceName: string;                    // Provider provenance string
  category: StandardizedFeatureCategory; // "building" | "road" | "bridge" | "waterway" | "railway" | "power" | "transit" | "amenity" | "landuse" | "natural" | "restricted" | "other"
  subCategory?: string;                  // Specific OSM subtype (e.g., "primary", "substation", "hospital")
  label: string;                         // Human-readable label
  geometry: Geometry;                    // Validated GeoJSON Point, LineString, or Polygon (WGS84)
  attributes: Record<string, string | number | boolean | null>;
  rawTags: Record<string, string>;       // Preserved raw source tags
  distanceM?: number;                    // Geodesic distance from candidate site center
  retrievedAt: string;                   // ISO-8601 retrieval timestamp
  datasetTimestamp?: string;             // Upstream OSM base timestamp (osm3s.timestamp_osm_base)
  quality: DataQualityIndicator;         // { completeness: "verified" | "partial" | "sparse" | "unknown", isStale: boolean, cacheStatus, missingAttributes? }
  license: string;                       // "ODbL 1.0 — © OpenStreetMap contributors"
}
```

All scalar/grid provider responses (`ElevationResult`, `ClimateResult`, `SolarResult`, `GeocodeResult`) similarly carry `retrievedAt`, `datasetTimestamp`, `source`, `license`, `cacheStatus`, `isStale`, and `quality`.

---

## 4. Caching, Deduplication & Stale-While-Offline Reliability (`src/server/providers/cache.ts`) (STEP 3)

1. **Canonical Cache Keys (`generateCacheKey`)**:
   - Coordinates (`lat`, `lng`) are rounded to 4 decimal places (`~11m` precision) to maximize cache hits for sub-meter cursor jitters.
   - Query parameters are recursively canonicalized (object keys sorted alphabetically, string arrays sorted) before SHA-256 hashing.
2. **In-Flight Request Deduplication (`withInFlightDedup`)**:
   - Concurrent identical requests share a single in-memory `Promise`, preventing duplicate upstream HTTP requests and eliminating Prisma `ProviderCache.upsert` race conditions.
3. **Fresh vs. Stale Cache Distinction (`getCachedEntry`)**:
   - Normal reads (`allowStale: false`) return `null` once `now > expiresAt` (24h TTL for Overpass, 72h TTL for DEM/Climate/NASA POWER/Nominatim).
   - If an upstream provider fails with a network error, timeout (`AbortError` / `HTTP 504`), or rate limit (`HTTP 429`), the adapter queries `getCachedEntry(key, { allowStale: true, maxStaleHours: 168 })`.
   - If a previously cached response within 7 days exists, it is returned with `isStale: true` and `cacheStatus: "stale_fallback"`. The analysis engine flags the data source status as `"stale"`, appends a user-facing staleness warning, and reduces overall data confidence by `10%`.

---

## 5. Missing-Data Policy (`src/server/analysis-engine/engine.ts`) (STEP 4)

UrjaSetu enforces a strict **No-Fabrication / No-Favorable-Default Policy**:
- **Never Convert Missing Data to `0` or Assumed Favorable Scores**:
  - When a required provider fails or when Overpass returns `0` features across the entire search radius (`osmEmpty`), dependent criteria are marked with:
    - `computed: false`
    - `status: "unknown"`
    - `score: null`
    - `rawMetric: null`
    - `missingReason`: Explicit explanation of which provider or dataset was unavailable and why.
- **Proportional Confidence & Total Failure Guard**:
  - Uncomputed criteria are excluded from the weighted average denominator (`computedWeight`), and `overall.evidenceCompleteness` / `overall.confidence` are scaled proportionally (`computedWeight / totalConfiguredWeight`).
  - If `0` OSM features are returned, `overall.confidence` is capped at `35%`.
  - If all providers fail (`computedWeight <= 0`), the engine refuses to fabricate a score and throws `AnalysisEngineError("INSUFFICIENT_EVIDENCE", ..., 503)`.

---

## 6. Map & Backend Analysis Consistency (`src/components/map/MapView.tsx`) (STEP 5)

To guarantee that the visual map matches the backend suitability calculation:
- `runAnalysisEngine()` returns the exact `analyzedFeatures: StandardizedGeoFeature[]` (sorted by geodesic distance to the site) and `searchRings: { centerLat, centerLng, r1M, r2M }` used during Step 5 & Step 6 of the pipeline.
- `MapView.tsx` renders these exact features on the `analyzed-features-source` GeoJSON layers (color-coded by category) along with the geodesic `R1` and `R2` search radius rings (`search-rings-source`) and the conflicting feature highlights (`conflict-features-source`).
- Users can toggle the analyzed evidence layer on/off via the bottom-right **"Hide/Show Analyzed OSM Evidence (N)"** button.

---

## 7. Operational Status Summary (Deliverable Checklist)

| Component / Provider | Current Status | Configuration Required | Remaining Data Limitations |
| :--- | :--- | :--- | :--- |
| **OpenStreetMap Overpass API** | **Working out-of-the-box** (live + dual-mirror failover + 24h SQLite cache) | None (optional `OVERPASS_API_URL` for private instance) | Rural/peri-urban areas may have sparse building height (`height`/`building:levels`) or distribution voltage (`voltage`) tags; automatically detected and flagged. |
| **OpenStreetMap Nominatim** | **Working out-of-the-box** (1 req/sec throttled + 72h cache) | None (optional `GEO_USER_AGENT`) | Rate-limited to 1 req/sec on public OSM servers. |
| **Open-Meteo Copernicus DEM** | **Working out-of-the-box** (9-point 3×3 slope & aspect + 72h cache) | None | ~90m grid spacing does not capture micro-drainage or retaining walls; requires on-site total-station survey for final civil grading. |
| **Open-Meteo ERA5-Land Climate** | **Working out-of-the-box** (365-day daily rainfall + 72h cache) | None | ~9 km spatial grid resolution; localized urban storm-sewer hydraulic modeling still requires municipal IDF curves. |
| **NASA POWER CERES / MERRA-2** | **Working out-of-the-box** (GHI, Clear-Sky GHI, ambient temp + `-999` sentinel guard + 72h cache) | None | ~50 km satellite grid resolution; local horizon shading relies on OSM building/forest proxy rather than 3D LiDAR DSM. |
| **MapLibre Base Tiles** | **Working out-of-the-box** (OSM raster tiles for dev) | Set `NEXT_PUBLIC_MAP_STYLE` for high-traffic production vector tiles | Public `tile.openstreetmap.org` tiles are for development/demo use only per OSM Tile Usage Policy. |
| **Cadastral Land Ownership & Live Feeder Loading** | **Not available via public global APIs** | Requires state Bhulekh / municipal GIS WMS & DISCOM SCADA credentials | Land parcel acquisition cost, underground utility ducts, and real-time substation MVA spare capacity are explicitly listed in `limitations` and `recommendations` for statutory verification. |
