# Geospatial Data Sources & Compliance — UrjaSetu

## 1. Overview
UrjaSetu ingests open geospatial data from four public sources to substantiate its multi-criteria infrastructure siting assessments. All spatial calculations and exports strictly comply with open access terms, rate-limiting guidelines, and attribution mandates.

| Provider | Purpose | Endpoints / Protocol | Rate Limits & Throttling | Attribution Mandate |
| :--- | :--- | :--- | :--- | :--- |
| **OpenStreetMap via Overpass API** | Mapped physical features (roads, buildings, waterways, railways, amenities) | `https://overpass-api.de/api/interpreter` (backup: `https://overpass.kumi.systems/api/interpreter`) | Bounded `around:` queries, 25s timeout, DB caching with 24h TTL | `© OpenStreetMap contributors` |
| **OpenStreetMap Nominatim** | Forward geocoding and reverse geocoding | `https://nominatim.openstreetmap.org` | Max 1 req/sec strict queue, 72h DB cache, descriptive User-Agent | `© OpenStreetMap contributors` |
| **Open-Meteo Elevation API** | Digital Elevation Model (Copernicus DEM 90m/30m) & 3x3 slope gradient | `https://api.open-meteo.com/v1/elevation` | Non-commercial open access, batch query, 72h DB cache | Copernicus DEM / Open-Meteo |
| **Open-Meteo Historical Archive** | ERA5-Land climate reanalysis (daily precipitation) | `https://archive-api.open-meteo.com/v1/archive` | Non-commercial open access, 72h DB cache | ECMWF ERA5-Land / Open-Meteo |
| **NASA POWER Agroclimatology** | Global Horizontal Irradiance (GHI) from CERES & MERRA-2 | `https://power.larc.nasa.gov/api/temporal/climatology/point` | Public scientific API, 72h DB cache | NASA POWER Project |

---

## 2. OpenStreetMap Terms & Tile Policy Compliance
1. **Attribution**: The attribution string `© OpenStreetMap contributors` is prominently displayed:
   - On the interactive MapLibre map viewport (bottom-left attribution control).
   - Embedded directly in exported map PNG canvas images.
   - Printed on the generated PDF reports.
2. **Tile Usage Policy**:
   - The default configuration uses raster OSM tiles for local development.
   - For high-volume production deployments, direct querying of public `tile.openstreetmap.org` servers is prohibited per OSM's Tile Usage Policy. Production environments must configure `NEXT_PUBLIC_MAP_STYLE` pointing to a commercial vector provider (e.g., MapTiler, Stadia Maps, Protomaps) or self-hosted tiles.
3. **Overpass Query Boundaries**:
   - Every Overpass query uses a strict bounding radius `(around:R, lat, lng)` and explicit 25-second server timeout `[timeout:25]`.
   - Results are hashed and cached in the local database (`ProviderCache` table) with a 24-hour TTL.
   - If Overpass returns HTTP 429 (Too Many Requests) or HTTP 504 (Gateway Timeout), the system attempts an automatic fallback to the secondary mirror before returning a clear, user-facing error message. No fake or fabricated data is ever returned.

---

## 3. Coordinate Reference System (CRS) & Metric Accuracy
- **Storage and Display**: All geographic coordinates and GeoJSON geometries are stored in standard **WGS84 (EPSG:4326)** longitude and latitude.
- **Metric Calculations**: All distance, surface area, buffer, and oriented footprint calculations use **Turf.js geodesic spherical algorithms** (`turf.distance`, `turf.area`, `turf.destination`).
- **Orientation**: Bearing is calculated clockwise from North (0° = North, 90° = East).

---

## 4. Known OSM Coverage Limitations & Data Density Heuristics
Because OpenStreetMap is volunteered geographic information (VGI), mapping completeness varies significantly between urban metropolitan cores and rural or developing areas.
To protect against false-positive suitability assessments:
- The engine calculates a **Coverage Density Indicator** (`mapped features / search area km²`).
- If feature density falls below **3.0 features/km²**, the system automatically flags a warning in the **Data Gaps** section of the report:
  > *"Low OpenStreetMap feature density (< 3.0 features/km²) in this zone. Some physical infrastructure may be unmapped. On-site verification is strongly advised."*
