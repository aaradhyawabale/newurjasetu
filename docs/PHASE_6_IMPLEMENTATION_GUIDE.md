# UrjaSetu — Phase 6 Implementation Guide
## Dynamic Spatial Opportunity Discovery, Real-Data Integration & Municipal Planning Intelligence

### 1. Executive Summary
Phase 6 transforms UrjaSetu from a system relying on predefined demonstration coordinates into a genuinely dynamic, data-driven urban opportunity discovery platform. All intervention candidates in the default planning workspace are discovered dynamically through spatial and satellite screening of official municipal registers (Pune Municipal Corporation) and OpenStreetMap road networks.

### 2. Architecture Overview

```
                                  [Authoritative Spatial Datasets]
                           +-----------------------------------------------+
                           | - PMC Official Gardens Register (81 assets)   |
                           | - PMC Government Hospitals Register (50 assets|
                           | - MSEDCL High-Tension Substations (6 assets)  |
                           | - OSM Planet Pune EV Infrastructure (13 sites)|
                           | - OSM Arterial Road Corridors (10 spines)     |
                           +-----------------------------------------------+
                                                  |
                                                  v
[Satellite Raster Memory Probing] ---> [Dynamic Spatial Discovery Engine]
 - Landsat 9 TIRS-2 LST (30m grid)      - Multi-criteria screening
 - Sentinel-2B MSI NDVI (30m grid)      - Thermal hotspot filtering (LST >= 40°C)
 - Sentinel-2B SCL Water Mask (Class 6) - Vegetation deficit filtering
                                        - Substation & road proximity analysis
                                        - Rejection audit logging
                                                  |
                                                  v
                                     [Candidate Provenance Engine]
                                                  |
                     +----------------------------+----------------------------+
                     |                                                         |
                     v                                                         v
        [DATASET_DERIVED Candidates]                             [SAMPLE_LOCATION Landmarks]
     - Dynamically discovered from files                       - 12 curated Phase 5 reference sites
     - Anchored to real sourceFeatureId                        - Strictly segregated in reference mode
     - Stamped with analysisRunId                              - Preserved for baseline reproducibility
                     |                                                         |
                     +----------------------------+----------------------------+
                                                  |
                                                  v
                                   [REST APIs & Client Workspace]
                           +-----------------------------------------------+
                           | GET /api/interventions                        |
                           | GET & POST /api/interventions/candidates      |
                           | GET /api/interventions/datasets               |
                           | InterventionPlanningWorkspace (UI)            |
                           | Gemini Copilot Intent 8 Fallback              |
                           +-----------------------------------------------+
```

### 3. Ingested Datasets

| Dataset File | Entity Count | Source Organization | Geometry / Coordinate System | Intended Planning Use |
| :--- | :--- | :--- | :--- | :--- |
| `src/data/official/pmc_gardens.json` | 81 | PMC Garden Department | Point (WGS 84, Lat/Lng) | Green space canopy infill, rainwater harvesting |
| `src/data/official/pmc_hospitals.json` | 50 | PMC Health Department | Point (WGS 84, Lat/Lng) | Cool roof retrofit feasibility |
| `src/data/official/pmc_substations.json` | 6 | MSEDCL Pune Circle | Point (WGS 84, Lat/Lng) | Electrical interconnection distance |
| `src/data/official/pmc_ev_stations.json` | 13 | OpenStreetMap Contributors | Point (WGS 84, Lat/Lng) | Solar shade canopy co-location |
| `src/data/official/pmc_road_corridors.json` | 10 | OpenStreetMap Highway Network | LineString / MultiLineString | Urban shading & greening corridors |

### 4. Candidate Provenance Classification

UrjaSetu enforces a strict four-tier provenance taxonomy:
1. `DATASET_DERIVED`: Discovered dynamically through spatial screening of authoritative municipal/OSM layers. All default candidates in Phase 6 have this classification.
2. `SAMPLE_LOCATION`: Historical Phase 5 demonstration landmarks preserved strictly for reference. Never mixed with dynamic discoveries.
3. `MANUALLY_CURATED`: Specifically curated for demonstration or benchmark studies.
4. `INSUFFICIENT_PROVENANCE`: Features lacking authoritative source IDs.

### 5. Reproducible Analysis Runs (`AnalysisRun`)

Every execution of `runDynamicSpatialDiscovery()` generates an immutable `AnalysisRun` record containing:
- `analysisId`: Unique identifier (e.g., `RUN-DISCOVERY-2026-11-01T09-50-39`)
- `executionTimestamp`: ISO 8601 execution time
- `studyAreaId`: `pune-pmc`
- `parameters`: Thermal hotspot thresholds, vegetation deficit ceilings, candidate limits
- `featuresEvaluated`: Total municipal assets processed
- `candidatesDiscovered`: Count of candidates meeting all spatial and raster criteria
- `candidatesRejected`: Count of features excluded
- `rejectionReasonsSummary`: Audit tally across exclusion reasons:
  - `SUB_THRESHOLD_THERMAL_EXPOSURE`: LST below target hotspot threshold
  - `HIGH_EXISTING_CANOPY_NDVI`: NDVI already elevated, indicating existing dense vegetation
  - `SCL_WATER_MASKED`: Pixel identified as open water body under Sentinel-2 SCL
  - `OUTSIDE_GRID_OR_NODATA`: Feature lies outside calibrated 30m raster grid
  - `CATEGORY_CAP_REACHED`: Category allocation cap satisfied

### 6. API Interface Reference

#### `GET /api/interventions`
Returns:
- `datasetDerivedTotal`: Count of dynamically discovered candidates
- `curatedSampleTotal`: Count of curated reference landmarks
- `latestAnalysisRun`: Active `AnalysisRun` record
- `datasetRegistrySummary`: Summary of registered datasets and data gaps

#### `GET /api/interventions/candidates`
Query Parameters:
- `provenanceType`: `'DATASET_DERIVED' | 'SAMPLE_LOCATION'`
- `includeSamples`: `'true' | 'false'`
- `category`: Filter by `InterventionCategoryId`
- `status`: Filter by `CandidateStatus`
- `q`: Free-text search string
- `format`: `'geojson'` or default JSON

#### `POST /api/interventions/candidates`
Executes an on-demand dynamic spatial discovery run.
Body (optional):
```json
{
  "studyAreaId": "pune-pmc",
  "minThermalStressLST": 40.0,
  "maxCandidatesPerCategory": 15
}
```

#### `GET /api/interventions/datasets`
Returns the full Dataset Registry (`DATASET_REGISTRY`) and the Missing Datasets Roadmap.

### 7. Governance Principles
1. **Zero Fabricated Benefits**: UrjaSetu never simulates unverified air cooling degrees (e.g. "planting 50 trees will reduce temperature by 3°C") or financial ROI without microclimate CFD and energy bills.
2. **Exploratory Status**: Candidate eligibility is an exploratory planning classification, not formal municipal sanction or budget allocation.
3. **Net Usable Area**: Building footprint area does not equal usable rooftop area (typically 45–75% net after HVAC, parapets, and stairwells).
4. **Mandatory Site Surveys**: Structural slab NDT, underground utility GPR, and MSEDCL transformer headroom clearances are mandatory before municipal tendering.
