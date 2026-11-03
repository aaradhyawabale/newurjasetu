# UrjaSetu — Central Spatial Dataset Registry
## Catalog of Ingested Datasets, Verification Status & Data Gap Roadmap

### 1. Registry Architecture
The UrjaSetu Dataset Registry (`src/server/intervention-engine/dataset-registry.ts`) serves as the single authoritative source of truth for all geospatial layers, satellite rasters, and municipal administrative records ingested by the platform.

### 2. Registered Datasets Catalog

| ID | Dataset Name | Issuing Organization | Verification Status | Geometry / CRS | Available | Known Limitations |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `ds-landsat-9-tirs2` | Landsat 9 TIRS-2 Level-2 Surface Temperature (ST_B10) | USGS / NASA | `VERIFIED_OFFICIAL` | 30m Grid / `EPSG:32643` | Yes | 100m native thermal resolution resampled to 30m; measures skin temperature, not ambient air temperature. |
| `ds-sentinel-2b-msi` | Sentinel-2B MSI Level-2A BOA Reflectance (B04, B08, SCL) | ESA / Copernicus | `VERIFIED_OFFICIAL` | 30m Target / `EPSG:32643` | Yes | Spectral reflectance index; does not equate to canopy cover percentage. |
| `ds-pmc-candidate-boundary` | PMC Candidate Study Area Boundary | Research / OpenStreetMap | `RESEARCH_DERIVED` | MultiPolygon / `EPSG:4326` | Yes | Synthesized research boundary; not a statutory CTSO cadastral demarcation. |
| `ds-pmc-official-gardens` | PMC Municipal Garden Dept Official Register of Parks | PMC Garden Dept | `VERIFIED_OFFICIAL` | Point (81 records) / `EPSG:4326` | Yes | Point centroids; parcel polygon boundaries require CTSO survey. |
| `ds-pmc-official-hospitals` | PMC Health Dept Official Register of Government Hospitals | PMC Health Dept | `VERIFIED_OFFICIAL` | Point (50 records) / `EPSG:4326` | Yes | Facility entrance points; net usable rooftop area requires architectural audit. |
| `ds-msedcl-pune-grid` | MSEDCL High-Tension Substation Infrastructure Cadastre | MSEDCL Pune Circle | `VERIFIED_PUBLIC_DISCLOSURE` | Point (6 records) / `EPSG:4326` | Yes | Spatial proximity indicates layout feasibility; spare transformer headroom requires utility load-flow studies. |
| `ds-osm-pune-ev-stations` | OpenStreetMap Planet Pune Electric Vehicle Infrastructure | OSM Contributors | `VERIFIED_OPENSTREETMAP` | Point (13 records) / `EPSG:4326` | Yes | Crowdsourced attributes; requires on-site electrical panel audit. |
| `ds-osm-pune-highways` | OpenStreetMap Planet Pune Major Highway Network | OSM Contributors | `VERIFIED_OPENSTREETMAP` | LineString (10 corridors) / `EPSG:4326` | Yes | 1D centerlines; statutory Right-of-Way boundaries require PMC DP sheets. |
| `ds-copernicus-dem-30m` | Copernicus Global Digital Elevation Model (GLO-30) | ESA | `VERIFIED_OFFICIAL` | 30m Grid / `EPSG:4326` | Yes | Regional terrain surface elevation; does not capture building heights. |
| `ds-nasa-power-solar` | NASA POWER Photovoltaic Surface Solar Climatology | NASA | `VERIFIED_OFFICIAL` | Regional Baseline / `EPSG:4326` | Yes | Climatological mean; does not model urban building horizon shading. |

### 3. Verification Status Definitions

- `VERIFIED_OFFICIAL`: Direct municipal, government, or space agency dataset with verified publication credentials (PMC Health Dept, PMC Garden Dept, USGS, ESA).
- `VERIFIED_PUBLIC_DISCLOSURE`: Official utility or regulatory disclosure published under statutory framework (MSEDCL substation disclosure).
- `VERIFIED_OPENSTREETMAP`: Spatial entity verified against OpenStreetMap planet data with valid entity IDs (OSM ways, nodes, relations).
- `RESEARCH_DERIVED`: Synthesized boundary or research mask produced for spatial analysis scoping.
- `UNVERIFIED`: Dataset lacking official provenance or ground verification.

### 4. Critical Missing Datasets Roadmap

The following datasets have been audited as critical data gaps for municipal implementation:

#### A. PMC Municipal Right-of-Way (ROW) & Underground Utility Cadastre
- **Issuing Agency**: PMC Road Department / City Engineer
- **Priority**: `VERY_HIGH`
- **Status**: `UNAVAILABLE_PENDING_MUNICIPAL_SHARING`
- **Planning Impact**: Mandates on-site ASCE 38-02 Quality Level B Ground Penetrating Radar (GPR) scanning before any tree-basin or canopy excavation.

#### B. MSEDCL Distribution Transformer (DT) SCADA Headroom & Feeder Asset Map
- **Issuing Agency**: MSEDCL Urban Infrastructure Circle
- **Priority**: `VERY_HIGH`
- **Status**: `UNAVAILABLE_PENDING_UTILITY_CLEARANCE`
- **Planning Impact**: Requires individual site-specific interconnection studies and reverse power flow calculations for EV charging hubs.

#### C. PMC Property Tax & Building Structural Cadastre
- **Issuing Agency**: PMC Assessment & Tax Collection Department
- **Priority**: `HIGH`
- **Status**: `UNAVAILABLE_PENDING_GOVERNMENT_MOU`
- **Planning Impact**: Prevents automatic structural qualification of roof slabs without on-site non-destructive testing (NDT).

#### D. Local Ambient Weather Sensor AWS Network
- **Issuing Agency**: IMD Pune / PMC Environment Department
- **Priority**: `MEDIUM`
- **Status**: `PROPOSED_INTEGRATION`
- **Planning Impact**: Required to continuously correlate satellite skin LST with ambient 2m air temperatures and human physiological heat stress (UTCI).
