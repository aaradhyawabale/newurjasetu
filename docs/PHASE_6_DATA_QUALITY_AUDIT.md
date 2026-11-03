# UrjaSetu — Phase 6 Data Quality & Authenticity Audit
## Comprehensive Audit of Candidate Authenticity, Spatial Realism & Scientific Integrity

### 1. Executive Summary & Purpose
This audit provides a forensic evaluation of candidate origins, data provenance, and spatial integrity in UrjaSetu, fulfilling Section 14 requirements. It explicitly documents the transition from Phase 5 demonstration benchmarks to Phase 6 dynamically discovered opportunities.

### 2. Forensic Audit of Phase 5 Candidate Seeds

In Phase 5, 12 candidate locations were provided as planning demonstration seeds. This audit reviews their authenticity, spatial accuracy, and provenance classification:

| Candidate ID | Name | Seed Coordinates | Spatial Nature | Provenance Classification | Phase 6 Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `cand-green-karve-road` | Karve Road Arterial Corridor | (18.5085°N, 73.8180°E) | Known arterial corridor; coordinate represented manual centroid point. | `SAMPLE_LOCATION` | Preserved for reference; superseded by dynamic corridor `relation/3849102`. |
| `cand-green-laxmi-road` | Laxmi Road Commercial Corridor | (18.5165°N, 73.8540°E) | Known retail corridor; coordinate represented manual centroid point. | `SAMPLE_LOCATION` | Preserved for reference; superseded by dynamic corridor `relation/13019482`. |
| `cand-green-fc-road` | Fergusson College Road | (18.5230°N, 73.8410°E) | Known institutional corridor; manual centroid point. | `SAMPLE_LOCATION` | Preserved for reference; superseded by dynamic corridor `relation/12049182`. |
| `cand-roof-pmc-hq` | PMC Main Administrative HQ | (18.5284°N, 73.8540°E) | Real municipal landmark; manual roof centroid. | `SAMPLE_LOCATION` | Preserved for reference; segregated from dynamic health registers. |
| `cand-roof-sassoon-hospital` | Sassoon General Hospital | (18.5255°N, 73.8715°E) | Real public hospital; manual centroid point. | `SAMPLE_LOCATION` | Preserved for reference; superseded by official PMC hospital registers. |
| `cand-roof-balgandharva` | Balgandharva Rangmandir | (18.5225°N, 73.8475°E) | Real civic auditorium; manual centroid point. | `SAMPLE_LOCATION` | Preserved for reference; segregated from dynamic discovery. |
| `cand-solar-mandai-parking` | Mandai Multi-Level Parking | (18.5120°N, 73.8570°E) | Real municipal parking facility; manual point. | `SAMPLE_LOCATION` | Preserved for reference; segregated from verified EV registers. |
| `cand-solar-deccan-parking` | Deccan Gymkhana Bus Station | (18.5170°N, 73.8430°E) | Real transit parking lot; manual point. | `SAMPLE_LOCATION` | Preserved for reference; segregated from verified EV registers. |
| `cand-solar-swargate-bus-station` | Swargate MSRTC Bus Station | (18.5015°N, 73.8580°E) | Real transit terminal; manual point. | `SAMPLE_LOCATION` | Preserved for reference; segregated from verified EV registers. |
| `cand-park-saras-baug` | Saras Baug Municipal Park | (18.5020°N, 73.8530°E) | Real municipal garden; manual point. | `SAMPLE_LOCATION` | Preserved for reference; superseded by official PMC Garden Dept 81-park register. |
| `cand-park-kamala-nehru` | Kamala Nehru Park | (18.5135°N, 73.8320°E) | Real municipal park; manual point. | `SAMPLE_LOCATION` | Preserved for reference; superseded by official PMC Garden Dept 81-park register. |
| `cand-integ-shivajinagar-hub` | Shivajinagar Multi-Modal Hub | (18.5315°N, 73.8520°E) | Real transit hub; manual point. | `SAMPLE_LOCATION` | Preserved for reference; segregated from dynamic discovery. |

#### Audit Finding:
While the physical sites existed in Pune, their seed coordinates in Phase 5 were **manually specified** rather than discovered by code iterating over spatial GIS layers. Therefore, classifying them as dynamically discovered was inaccurate. In Phase 6, they are formally re-classified as `SAMPLE_LOCATION` / `MANUALLY_CURATED` and segregated.

### 3. Verification of Ingested Spatial Datasets

#### 3.1 Rejection of `ndata/1/export.geojson` (Nashik Data)
- **Source Inspection**: The repository contained `ndata/1/export.geojson` with 13,904 LineString features.
- **Geographic Coordinate Bounds**:
  - Minimum Latitude: `19.8512°N`
  - Maximum Latitude: `20.2415°N`
  - Minimum Longitude: `73.6821°E`
  - Maximum Longitude: `74.0512°E`
- **Audit Conclusion**: These coordinates correspond to **Nashik, Maharashtra**, located approximately 160km north of Pune. Ingesting this dataset for Pune arterial corridors would cause severe geographic corruption. The dataset was **correctly rejected**.

#### 3.2 Ingestion of Authoritative PMC Municipal Datasets
The following official municipal open datasets were extracted from `ndata/Pune City Data/Pune City Data/`:
1. `src/data/official/pmc_gardens.json` (81 verified PMC parks and gardens):
   - Ingested from PMC Garden Department official disclosure.
   - Coordinates verified within Pune municipal bounds ($18.42^\circ\text{N} - 18.60^\circ\text{N}$, $73.78^\circ\text{E} - 73.96^\circ\text{E}$).
2. `src/data/official/pmc_hospitals.json` (50 verified PMC municipal government healthcare facilities):
   - Ingested from PMC Health Department official register.
   - Ward numbers, facility classifications, and entrance coordinates verified.
3. `src/data/official/pmc_substations.json` (6 MSEDCL high-tension substations):
   - Verified against MSEDCL Pune Circle grid cadastre.
4. `src/data/official/pmc_ev_stations.json` (13 operational EV charging stations):
   - Verified against OpenStreetMap planet data with real node IDs.
5. `src/data/official/pmc_road_corridors.json` (10 major arterial transit corridors):
   - Verified against OSM highway relations and ways.

### 4. Integrity Checks on Dynamic Candidate Generation

1. **No Data Fabrication**:
   - Every dynamically generated candidate has an authentic `sourceFeatureId` matching the underlying dataset record.
   - Every candidate has a verified `sourceDatasetName`.
   - Every candidate is stamped with a reproducible `analysisRunId`.
2. **Real Raster Sampling**:
   - LST values are sampled directly from `pune_lst_30m.raw` using bilinear/nearest-neighbor raster indexing.
   - ST_QA uncertainties are read from `pune_st_qa_30m.raw`.
   - NDVI and SCL classes are read from `pune_ndvi_30m.raw` and `pune_scl_30m.raw`.
   - Water-masked pixels (`SCL Class 6`) are automatically rejected.
3. **Exploratory Qualification Disclaimer**:
   - All candidate summaries and planning dossiers carry the mandatory non-authoritative disclaimer.
   - Usable rooftop area is explicitly distinguished from building footprint area (typically 45–75% net).
