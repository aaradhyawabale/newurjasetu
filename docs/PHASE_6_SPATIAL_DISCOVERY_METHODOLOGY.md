# UrjaSetu — Phase 6 Spatial Discovery Methodology
## Mathematical, Remote-Sensing & Geospatial Screening Protocols

### 1. Spatial Discovery Workflow

The Dynamic Spatial Discovery Engine processes real municipal and OpenStreetMap geographic features to generate evidence-backed urban intervention opportunities.

```
                    [Feature Iteration (Road / Hospital / EV / Garden)]
                                            |
                                            v
                         [Geographic Reprojection (WGS84 -> UTM43N)]
                                            |
                                            v
                           [Sub-Microsecond Raster Cell Probe]
                                 queryHeatPoint(lng, lat)
                                            |
                    +-----------------------+-----------------------+
                    |                                               |
         [Grid Boundary Check]                             [SCL Classification]
       Is (col, row) inside grid?                      Is pixel SCL Class 6 (Water)?
       Is LST non-null / valid?                                     |
                    |                                               |
             No -> [REJECT]                                  Yes -> [REJECT]
                    |
                    v
       [Thermal Hotspot Screening]
       LST >= minThermalStressLST (e.g. 40.0°C)
                    |
             No -> [REJECT]
                    |
                    v
       [Vegetation Deficit Screening]
       NDVI <= maxNdviThreshold (e.g. 0.35)
                    |
             No -> [REJECT]
                    |
                    v
       [Infrastructure Proximity Calculation]
       - Nearest Road Centerline (Geodesic Distance)
       - Nearest High-Tension Substation (MSEDCL Cadastre)
                    |
                    v
       [Evidence Ledger & Constraint Synthesis]
       - Attach Landsat 9 LST + USGS ST_QA uncertainty
       - Attach Sentinel-2B NDVI + SCL Class
       - Attach Source Feature ID & Dataset Name
       - Attach Mandatory Site Survey Checklist
                    |
                    v
       [Stamp AnalysisRun Record & Add to Candidate Pool]
```

### 2. Remote-Sensing Raster Specifications

#### 2.1 Landsat 9 TIRS-2 Band 10 Surface Temperature
- **Acquisition Timestamp**: `2024-05-18 05:27:39 UTC`
- **Native Spatial Resolution**: 100m (resampled to 30m USGS delivery grid via cubic convolution)
- **Target Coordinate Reference System (CRS)**: `EPSG:32643` (WGS 84 / UTM Zone 43N)
- **Pixel Transform**: Origin `(366105.0, 2059365.0)`, Pixel size `30.0m x -30.0m`
- **Grid Dimensions**: `1012 cols x 871 rows` (881,452 total cells; 577,304 within candidate boundary)
- **Calibration Equation**:
  $$\text{LST (°C)} = \text{DN} \times 0.00341802 - 124.15$$
- **Uncertainty Tracking**: USGS Collection 2 ST_QA band values tracked per pixel ($\text{mean uncertainty} = \pm 2.16\,\text{K}$).

#### 2.2 Sentinel-2B MSI Level-2A Bottom-of-Atmosphere (BOA) Reflectance
- **Acquisition Timestamp**: `2024-05-18 05:36:49 UTC` (~48h baseline alignment)
- **Native Optical Resolution**: 10m (B04 Red, B08 NIR)
- **Scene Classification Layer (SCL)**: 20m native resolution, transferred to 10m via nearest-neighbor block replication:
  $$\text{SCL}_{10m}(r, c) = \text{SCL}_{20m}(\lfloor r/2 \rfloor, \lfloor c/2 \rfloor)$$
- **Target 30m Grid Aggregation**:
  $$4 \times 4 \text{ native 10m matrix area-weighted mean over each 30m target cell.}$$
- **Negative Reflectance Handling**: Preserves negative BOA reflectance values without synthetic zero-clipping; tracked in quality diagnostics (`b04NegativeReflectancePixels: 2,362,281`).

### 3. Category-Specific Screening Criteria

#### 3.1 Category 1: Urban Greening Corridors (`URBAN_GREENING_CORRIDOR`)
- **Source Feature Layer**: `src/data/official/pmc_road_corridors.json` (10 major arterial transit spines)
- **Selection Criteria**:
  - Located within candidate study boundary
  - LST $\ge 40.0^\circ\text{C}$ (surface thermal exposure)
  - Carriageway width $\ge 12.0\,\text{m}$ (sufficient right-of-way for roadside tree planting)
  - Non-water SCL classification
- **Synthesized Constraints**:
  - Subsurface utility duct crowding (telecom, gas, water conduits)
  - IRC:103-2012 pedestrian walkway effective clear width ($\ge 1.8\,\text{m}$)
- **Mandatory Site Surveys**:
  - ASCE 38-02 Quality Level B Ground Penetrating Radar (GPR) scan
  - Pedestrian level-of-service and curb width audit

#### 3.2 Category 2: Cool Roof Opportunities (`COOL_ROOF_FEASIBILITY`)
- **Source Feature Layer**: `src/data/official/pmc_hospitals.json` (50 official municipal healthcare facilities)
- **Selection Criteria**:
  - Located within candidate study boundary
  - LST $\ge 41.0^\circ\text{C}$
  - Municipal government ownership (facilitates public sector retrofit programs)
  - Non-water SCL classification
- **Synthesized Constraints**:
  - 24/7 occupied healthcare facility safety (ultra-low VOC, non-toxic coatings)
  - Structural slab integrity and membrane adhesion (IS 516 / ASTM D4541)
- **Mandatory Site Surveys**:
  - Ultrasonic pulse velocity and moisture thermography audit
  - Net unencumbered rooftop survey (usable area $\ne$ footprint area)

#### 3.3 Category 3: Solar Canopy & EV Co-Location (`SOLAR_CANOPY_EV_COLOCATION`)
- **Source Feature Layer**: `src/data/official/pmc_ev_stations.json` (13 verified operational EV charging sites)
- **Selection Criteria**:
  - Located within candidate study boundary
  - Observed LST $\ge 40.0^\circ\text{C}$
  - Proximity to mapped MSEDCL high-tension substation ($\le 3,000\,\text{m}$)
  - Surface parking or charging bay footprint available
- **Synthesized Constraints**:
  - Distribution transformer headroom availability (MSEDCL interconnection)
  - Canopy wind load uplift rating (IS 875 Part 3, Pune $V_b = 39\,\text{m/s}$)
- **Mandatory Site Surveys**:
  - MSEDCL grid interconnection and reverse power flow study
  - Geotechnical soil bearing capacity test for structural canopy foundations

#### 3.4 Category 4: Green Space Improvement (`GREEN_SPACE_ENHANCEMENT`)
- **Source Feature Layer**: `src/data/official/pmc_gardens.json` (81 official municipal parks and gardens)
- **Selection Criteria**:
  - Located within candidate study boundary
  - LST $\ge 40.0^\circ\text{C}$ indicating thermal microclimate stress or unshaded lawn sections
  - NDVI $\le 0.45$ indicating canopy infill opportunity
- **Synthesized Constraints**:
  - Non-potable water supply availability for tree sapling establishment
  - Underground utility line demarcation within park premises
- **Mandatory Site Surveys**:
  - Native soil permeability and percolation test
  - Arboricultural tree health and open canopy gap survey

#### 3.5 Category 5: Integrated Civic Facility Upgrades (`INTEGRATED_FACILITY_UPGRADE`)
- **Source Feature Layer**: Multi-facility civic hubs combining high-volume health facilities, public transit frontage, and parking assets.
- **Selection Criteria**:
  - Multi-intervention suitability combining cool roofs, solar shade canopies, and micro-greening buffers.
  - Footprint $\ge 2,000\,\text{m}^2$.

### 4. Reproducibility & Audit Trail

Every candidate discovered through this methodology is stamped with:
1. `sourceFeatureId`: The authoritative entity identifier from the source municipal or OSM register (e.g. `pmc-hosp-04`, `node/9411828530`, `relation/3849102`).
2. `sourceDatasetName`: The full name of the ingested dataset.
3. `analysisRunId`: The unique run identifier (e.g. `RUN-DISCOVERY-2026-11-01T09-50-39`).
4. `evidenceLedger`: Structured evidence items classifying every satellite observation, deterministic metric, technical standard, and unverified data requirement.
