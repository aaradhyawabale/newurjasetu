# UrjaSetu Phase 6.1 — Forensic Dataset Verification & Integrity Audit

**Date of Forensic Execution:** November 1, 2026  
**Audit Standard:** Comprehensive Spatial Data Integrity, Statutory Provenance & Cadastral Reality Verification  
**Geographic Domain:** Pune Municipal Corporation (PMC), Maharashtra, India (WGS84 / UTM Zone 43N — EPSG:32643)  
**Auditor Mode:** Autonomous Senior Remote Sensing & Municipal Geospatial Engineering Audit  

---

## 1. Executive Summary

Phase 6 reported the introduction of dynamic spatial opportunity discovery across five municipal and infrastructure datasets in `src/data/official/`. An independent forensic investigation was conducted in Phase 6.1 to verify the authenticity, provenance, geometric fidelity, and attribution of every ingested record against raw source files in `ndata/` and OpenStreetMap extracts.

### Critical Findings & Remediation Summary

1. **PMC Municipal Gardens (`pmc_gardens.json`)**:
   - **Source:** `ndata/Pune City Data/Pune City Data/Pune Parks and Gardens/Gardens with Locations.csv`
   - **Audit Outcome:** Authenticated. The CSV contains 85 total rows (1 title, 1 header, 81 data rows, 1 blank row, 1 explanatory footnote). All 81 data rows possess valid coordinate pairs `(lat,long)` within the Pune municipal boundary `[18.450°N to 18.595°N, 73.780°E to 73.960°E]`.
   - **Remediation:** Preserved all 81 features. Formally classified as `VERIFIED_OFFICIAL` with `Point` geometry and operational status `OPERATIONAL_STATUTORY_DISCLOSURE`. Added CTSO cadastral boundary disclaimers.

2. **PMC Government Hospitals (`pmc_hospitals.json`)**:
   - **Source:** `ndata/Pune City Data/Pune City Data/Pune Healthcare - Hospitals and Clinics/Pune - Ward-wise Government Hospitals.csv`
   - **Audit Outcome:** Authenticated. Exactly 50 government healthcare facilities (maternity homes, dispensaries, dawakhana) with explicit latitude and longitude coordinates. 100% pass geographic bounding box checks.
   - **Remediation:** Formally classified as `VERIFIED_OFFICIAL` with `Point` entrance coordinates and operational status `OPERATIONAL_STATUTORY_DISCLOSURE`. Mandated pull-off tensile testing and non-toxic VOC certification for occupied patient wards.

3. **MSEDCL High-Tension Substations (`pmc_substations.json`)**:
   - **Source:** `ndata/data/geo/pune_msedcl_grid.geojson`
   - **Audit Outcome:** Authenticated static locations from CEA/MSEDCL public disclosures (6 major substations: Shivajinagar, Aundh, Kharadi, Hadapsar, Kothrud, Katraj).
   - **Critical Vulnerability Remedied:** Previous documentation risked conflating nameplate transformation capacity (e.g. 100 MVA, 25 MVA) with available spare interconnect headroom. In real grid operation, substation capacity indicates total transformer rating, whereas available headroom is dynamic, proprietary, and requires formal MSEDCL load-flow sanction.
   - **Remediation:** Reclassified `capacityMva` explicitly as `nameplateCapacityMva`; set `availableHeadroomMva = null` with explicit status `UNVERIFIED_REQUIRES_MSEDCL_SANCTION`. Classified dataset as `VERIFIED_PUBLIC_DISCLOSURE`.

4. **OpenStreetMap EV Charging Stations (`pmc_ev_stations.json`)**:
   - **Source:** OpenStreetMap Overpass API extract verified against `src/data/pune-snapshot.json` (13 charging stations).
   - **Critical Vulnerability Remedied:** Default placeholder attributes were previously injected where source OSM tags lacked information. Specifically, Node `10844985580` (Viman Nagar) had synthetic default attributes injected (`operator: "Independent"`, `capacity: 2`, `socketType: "CCS2 (30kW)"`), and Node `763446417` had placeholder operator `"Private Host"`. Static OSM data cannot verify live charger availability or operational uptime.
   - **Remediation:** Sanitized all placeholder defaults; reverted unknown operator, capacity, and socket fields to `null`. Added explicit operational flag `operationalStatus: "MAPPED_IN_OSM"` and `telemetryVerified: false`, documenting that real-time charger status requires live OCPP/CPO telemetry.

5. **Arterial Highway Corridors (`pmc_road_corridors.json`) — MAJOR FORENSIC RECLASSIFICATION**:
   - **Stated Source:** OpenStreetMap Highway Network (Pune City Extract)
   - **Actual Forensic Finding:** Fictitious/synthetic relation and way IDs were previously assigned (e.g., `relation/4910293`, `relation/5910294`, `relation/6910295`, `relation/7910296` following an obvious incrementing synthetic sequence). Features possessed single point coordinates rather than continuous LineString vectors. Carriageway widths (`12m`, `18m`, `24m`, `30m`, `36m`, `45m`) and lengths were manual planning approximations, not surveyed geometries.
   - **Remediation:** Quarantined and reclassified dataset from `VERIFIED_OPENSTREETMAP` to `MANUALLY_CURATED`. Reclassified geometry from `LineString` to `Point` (representative corridor sample centroid). Flagged source as `UNVERIFIED_SYNTHETIC_OSM_ID`, with carriageway widths marked as `ESTIMATED_PLANNING_ASSUMPTION`. Mandated `REQUIRES_SITE_VALIDATION` for all candidates derived from this dataset, explicitly barring premature DPR formulation without statutory CTSO and PMC Town Planning Right-of-Way (ROW) demarcation.

---

## 2. Dataset-by-Dataset Forensic Verification Matrix

| Dataset Identifier | Stated Source | Verified Source | Record Count | Geometry Type | Verified Status | Operational Status | Remediation Summary |
|:---|:---|:---|:---:|:---:|:---:|:---:|:---|
| `pmc_gardens.json` | PMC Municipal Garden Dept | `Gardens with Locations.csv` | 81 | Point | `VERIFIED_OFFICIAL` | `OPERATIONAL_STATUTORY_DISCLOSURE` | 81 valid coordinate rows preserved; entrance centroids classified; cadastral boundary disclaimers added. |
| `pmc_hospitals.json` | PMC Health Department | `Pune - Ward-wise Government Hospitals.csv` | 50 | Point | `VERIFIED_OFFICIAL` | `OPERATIONAL_STATUTORY_DISCLOSURE` | 50 government hospitals verified; building footprint vs roof slab disclaimers applied; VOC restrictions documented. |
| `pmc_substations.json` | MSEDCL Pune Grid Cadastre | `pune_msedcl_grid.geojson` | 6 | Point | `VERIFIED_PUBLIC_DISCLOSURE` | `OPERATIONAL_STATUTORY_DISCLOSURE` | Nameplate capacity (MVA) separated from unverified headroom; formal MSEDCL load-flow sanction mandated. |
| `pmc_ev_stations.json` | OpenStreetMap EV Infrastructure | Overpass extract in `pune-snapshot.json` | 13 | Point | `VERIFIED_OPENSTREETMAP` | `MAPPED_IN_OSM` | Injected placeholder defaults (capacity=2, operator=Independent) stripped to `null`; live OCPP telemetry requirement documented. |
| `pmc_road_corridors.json` | OSM Highway Network | Curated planning reference based on Pune CMP | 10 | Point | `MANUALLY_CURATED` | `OPERATIONAL_STATUS_UNVERIFIED` | Reclassified from verified OSM to `MANUALLY_CURATED`; synthetic relation IDs flagged; widths marked as estimates; candidate status set to `REQUIRES_SITE_VALIDATION`. |

---

## 3. Detailed Forensic Dataset Profiles

### 3.1 PMC Municipal Gardens (`src/data/official/pmc_gardens.json`)

- **Dataset Identifier:** `pmc-official-gardens-2022`
- **Source File Ingested:** `ndata/Pune City Data/Pune City Data/Pune Parks and Gardens/Gardens with Locations.csv`
- **Source Verification:**
  - Raw CSV line count: 85 lines.
  - Line 1: `List of Gardens with Lat Longs,,,,,,` (Document Title)
  - Line 2: `Sr No,Facility Type/Category,Name of Facility,Address,"Location(lat,long)",Prabhag Name,Ward Name` (Header)
  - Lines 3–83: Data records (81 valid geocoded entries).
  - Line 84: Blank delimiter line.
  - Line 85: Footnote: `Note- subject to change with addition/ deletion of facilities. Source- http://wfms.punecorporation.org/`
- **Spatial Validation:**
  - 81 of 81 records contain parsable coordinate strings formatted as `"(lat,long)"`.
  - Latitudes span: `18.4520°N` to `18.5880°N` (within PMC municipal bounding box).
  - Longitudes span: `73.7820°E` to `73.9550°E` (within PMC municipal bounding box).
  - No coordinate inversion (lat/lng swap) detected.
- **Provenance & Governance Action:**
  - Verification Status: `VERIFIED_OFFICIAL`
  - Operational Status: `OPERATIONAL_STATUTORY_DISCLOSURE`
  - Geometry: `Point` (park entrance/centroid).
  - Limitation: Centroid representation; park perimeter requires City Survey Office (CTSO) cadastre.

---

### 3.2 PMC Government Hospitals (`src/data/official/pmc_hospitals.json`)

- **Dataset Identifier:** `pmc-official-hospitals-2021`
- **Source File Ingested:** `ndata/Pune City Data/Pune City Data/Pune Healthcare - Hospitals and Clinics/Pune - Ward-wise Government Hospitals.csv`
- **Source Verification:**
  - Raw CSV line count: 51 lines (1 header + 50 data records).
  - Header: `City Name,Ward No,Ward Name,Name of healthcare facility,Type of facility,Latitude,Longitude`
  - 50 municipal healthcare facilities including maternity homes (Sutar, Sanjay Gandhi, Rajiv Gandhi), dispensaries, and general clinics.
- **Spatial Validation:**
  - 50 of 50 records possess valid floating-point latitudes and longitudes.
  - Latitudes span: `18.4614°N` to `18.5780°N`.
  - Longitudes span: `73.7959°E` to `73.9272°E`.
  - All 50 coordinates fall strictly within the Pune urban study corridor.
- **Provenance & Governance Action:**
  - Verification Status: `VERIFIED_OFFICIAL`
  - Operational Status: `OPERATIONAL_STATUTORY_DISCLOSURE`
  - Geometry: `Point` (facility entrance/centroid).
  - Limitation: Point feature coordinates; building footprint does NOT equal usable roof slab area. Waterproofing membrane adhesion (ASTM D4541), concrete slab integrity (IS 516), and low-VOC coating compliance (Green Seal GS-11) are mandatory before execution.

---

### 3.3 MSEDCL High-Tension Substations (`src/data/official/pmc_substations.json`)

- **Dataset Identifier:** `msedcl-pune-substations`
- **Source File Ingested:** `ndata/data/geo/pune_msedcl_grid.geojson`
- **Source Verification:**
  - Contains exactly 6 major high-tension distribution substations:
    1. `SUB_PUNE_01`: Shivajinagar 132/33kV EHV (100 MVA, MSETCL/MSEDCL) — `[18.5320°N, 73.8505°E]`
    2. `SUB_PUNE_02`: Aundh 33/11kV (25 MVA, MSEDCL Pune Circle) — `[18.5590°N, 73.8050°E]`
    3. `SUB_PUNE_03`: Kharadi 132/33kV EHV (80 MVA, MSETCL/MSEDCL) — `[18.5490°N, 73.9480°E]`
    4. `SUB_PUNE_04`: Hadapsar 132/33kV EHV (100 MVA, MSETCL/MSEDCL) — `[18.5020°N, 73.9310°E]`
    5. `SUB_PUNE_05`: Kothrud 33/11kV (31.5 MVA, MSEDCL Pune Circle) — `[18.5080°N, 73.8150°E]`
    6. `SUB_PUNE_06`: Katraj 33/11kV (25 MVA, MSEDCL Pune Circle) — `[18.4520°N, 73.8550°E]`
- **Technical Clarification on Headroom:**
  - Capacity values in source GeoJSON (`100`, `25`, `80`, `100`, `31.5`, `25` MVA) represent static nameplate transformation capacity.
  - Nameplate capacity is NOT spare available headroom. Actual available connection capacity is dynamic and subject to base load, peak demand curves, and feeder loading.
- **Provenance & Governance Action:**
  - Verification Status: `VERIFIED_PUBLIC_DISCLOSURE`
  - Operational Status: `OPERATIONAL_STATUTORY_DISCLOSURE`
  - `capacityMva` explicit as `nameplateCapacityMva`.
  - `availableHeadroomMva` explicitly set to `null` with status `UNVERIFIED_REQUIRES_MSEDCL_SANCTION`.

---

### 3.4 OpenStreetMap EV Charging Stations (`src/data/official/pmc_ev_stations.json`)

- **Dataset Identifier:** `osm-pune-ev-stations`
- **Source File Ingested:** `src/data/pune-snapshot.json` (`existingEvStations` block extracted from Overpass API)
- **Source Verification:**
  - Exactly 13 EV charging nodes across central Pune.
  - Verified genuine OSM node IDs: `9411828530`, `10097434142`, `10097434143`, `10097434144`, `10097460085`, `10250046452`, `11005778506`, `11217502924`, `12458871181`, `12473454969`, `12334310661`, `763446417`, `10844985580`.
- **Default-Value Injection Remediation:**
  - **Node `10844985580` (Viman Nagar):** Previously injected with placeholder values (`operator: "Independent"`, `capacity: 2`, `socketType: "CCS2 (30kW)"`, `brand: "Commercial Host"`). Stripped all placeholders to `null`.
  - **Node `763446417` (Cummins College Area):** Previously had placeholder `operator: "Private Host"` and `brand: "Community Charger"`. Stripped to `null`.
- **Operational Status Segregation:**
  - Set `operationalStatus: "MAPPED_IN_OSM"` for all 13 nodes.
  - Set `telemetryVerified: false` for all 13 nodes.
  - Real-time operational uptime, bay occupancy, and socket functionality require live OCPP/CPO telemetry and cannot be asserted from static GIS data.

---

### 3.5 Arterial Road Corridors (`src/data/official/pmc_road_corridors.json`)

- **Dataset Identifier:** `osm-pune-arterial-corridors`
- **Previous Stated Source:** OpenStreetMap Highway Network
- **Forensic Investigation Findings:**
  - The 10 entries reference relation and way IDs:
    - `relation/3849102` (Karve Road)
    - `relation/2891041` (Laxmi Road)
    - `way/24810291` (FC Road)
    - `way/39019281` (JM Road)
    - `way/48192019` (Bajirao Road)
    - `way/58192039` (Shivaji Road)
    - `relation/4910293` (Sinhagad Road)
    - `relation/5910294` (Satara Road)
    - `relation/6910295` (Ganeshkhind Road)
    - `relation/7910296` (Old Mumbai-Pune Highway)
  - **Forensic Flaw:** Relations `4910293` through `7910296` represent synthetic sequentially incremented placeholder keys.
  - **Geometric Flaw:** The file contained single point latitude/longitude coordinates (`lat: 18.5085, lng: 73.8180`), NOT continuous line strings or multi-point centerline alignments.
  - **Attribution Flaw:** Carriageway widths (`12m`, `18m`, `24m`, `30m`, `36m`, `45m`) and lengths (`2.4km` to `6.8km`) were manual planning approximations, not extracted from OSM `width`/`lanes` tags or cadastral sheets.
- **Forensic Governance Remediation:**
  - Reclassified dataset provenance to `MANUALLY_CURATED`.
  - Reclassified source status to `UNVERIFIED_SYNTHETIC_OSM_ID`.
  - Reclassified geometry type from `LineString` to `Point` (representative corridor sample centroid).
  - Explicitly marked `carriagewaySource: "ESTIMATED_PLANNING_ASSUMPTION"` and `lengthSource: "ESTIMATED_CORRIDOR_EXTENT"`.
  - In `dynamic-discovery-engine.ts`, all candidates derived from this dataset are assigned `status: "REQUIRES_SITE_VALIDATION"` with `evidenceCompleteness: "PRELIMINARY"`.
  - Barred from claiming verified linear canopy geometry or surveyed Right-of-Way (ROW) without statutory CTSO and PMC Road Department ground surveys.

---

## 4. Remediation Verification

All forensic remediations have been verified programmatically in the test suite `tests/unit/dataset-forensic-audit.test.ts`:
- Zero placeholder defaults (`operator: "Independent"`, `capacity: 2`) remain.
- All 81 gardens and 50 hospitals pass strict bounding box validation.
- All 6 substations distinguish nameplate capacity from unverified available headroom.
- All 10 road corridors are classified as `MANUALLY_CURATED` sample points.
- TypeScript strict compilation passed with zero errors (`tsc --noEmit`).
