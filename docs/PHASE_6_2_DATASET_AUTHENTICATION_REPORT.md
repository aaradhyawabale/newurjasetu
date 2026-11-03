# UrjaSetu Phase 6.2 — Dataset Authentication & Provenance Report

**Document ID:** `DOC-URJASETU-6.2-DATA-01`  
**Status:** Authenticated & Reconciled  
**Date:** November 2026  
**Jurisdiction:** Pune Metropolitan Area, Maharashtra, India  

---

## 1. Executive Summary

UrjaSetu maintains strict data governance policies preventing the fabrication of urban infrastructure attributes, the conflation of point coordinates with area polygons, and the misrepresentation of candidate boundaries as statutory municipal limits.

In Phase 6.2, all official datasets in `src/data/official/` were re-audited against authentic primary sources:
1. `pmc_gardens.json`: 81 records, verified from PMC Garden Department public records, classified as `VERIFIED_OFFICIAL`, geometry type `Point`.
2. `pmc_hospitals.json`: 50 records, verified from PMC Health Department public records, classified as `VERIFIED_OFFICIAL`, geometry type `Point`.
3. `pmc_substations.json`: 6 records, verified against MSEDCL public spatial assets, classified as `VERIFIED_OFFICIAL`, geometry type `Point`.
4. `pmc_ev_stations.json`: 13 records, mapped from OpenStreetMap public charging infrastructure, classified as `MAPPED_IN_OSM`, geometry type `Point`.
5. `pmc_road_corridors.json`: 10 records, field-identified urban heat corridors, classified as `MANUALLY_CURATED`, geometry type `Point`.

---

## 2. Dataset-by-Dataset Forensic Verification

### 2.1 PMC Public Gardens (`pmc_gardens.json`)
- **Count**: 81 features.
- **Geometry**: Strict GeoJSON `Point` coordinates representing main public entrance gates or gazetted park centroids.
- **Area Representation**: Points do **not** represent parcel boundaries. UrjaSetu strictly refrains from computing lawn or canopy area from point coordinates. If park acreage is absent from the municipal record, `areaHectares` is left as `null` or marked `UNVERIFIED_IN_SOURCE`.
- **Classification**: `VERIFIED_OFFICIAL`.
- **Verification Rule**: No synthetic polygon buffers (e.g., 50m circles) may be generated to calculate fake green space or tree counts.

### 2.2 PMC Hospitals & Civic Clinics (`pmc_hospitals.json`)
- **Count**: 50 features.
- **Geometry**: GeoJSON `Point` coordinates representing hospital main gates, casualty entrances, or campus reception buildings.
- **Rooftop Area Policy**: A point coordinate provides zero structural or geometric information regarding building footprint, roof slope, or slab dead-load capacity. The application explicitly flags rooftop area as `UNVERIFIED_REQUIRING_CADASTRE_SCAN` rather than multiplying arbitrary scalars.
- **Classification**: `VERIFIED_OFFICIAL`.

### 2.3 MSEDCL High-Voltage Substations (`pmc_substations.json`)
- **Count**: 6 features.
- **Attributes Verified**: `nameplateCapacityMva`, operating voltage (e.g., 132/33 kV, 22/11 kV), feeder count where published.
- **Headroom Governance**: `availableHeadroomMva` is strictly set to `null` across all records. UrjaSetu prohibits displaying synthetic zero or estimated headroom. MSEDCL substation spare capacity can only be confirmed through a formal grid connectivity application under MSEDCL distribution open access regulations.
- **Classification**: `VERIFIED_OFFICIAL`.

### 2.4 EV Charging Stations (`pmc_ev_stations.json`)
- **Count**: 13 features.
- **Provenance**: Derived from OpenStreetMap (`amenity=charging_station`).
- **Data Integrity Correction**: Previous iterations injected assumed default capacities (e.g., `2 connectors`, `60 kW`). All fabricated defaults were stripped in Phase 6.1 and remain omitted in Phase 6.2. If connector type or rating is unmapped in OSM, the field remains `null` or `UNMAPPED`.
- **Classification**: `MAPPED_IN_OSM`.

### 2.5 Urban Road Corridors (`pmc_road_corridors.json`)
- **Count**: 10 features.
- **Provenance**: Manually curated high-heat arterial corridors (e.g., Karve Road, JM Road, Sinhagad Road).
- **Geometry**: GeoJSON `Point` corridor anchor vertices.
- **Dimension Policy**: Right-of-way (ROW) and carriageway widths are recorded as indicative planning figures. UrjaSetu does not synthesize 3D corridors or compute arbitrary asphalt surface areas without verified street centerline shapefiles.
- **Classification**: `MANUALLY_CURATED`.

---

## 3. Strict Geometry Semantics Summary

| Dataset | Feat Count | Geometry Type | Area Metric Policy | Capacity Metric Policy | Legal Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `pmc_gardens.json` | 81 | `Point` | Parcel area omitted unless verified in municipal gazette | N/A | Verified Official |
| `pmc_hospitals.json` | 50 | `Point` | Rooftop area requires cadastre scan | Bed count verified; electrical load unassessed | Verified Official |
| `pmc_substations.json` | 6 | `Point` | Switchyard footprint not modeled | Nameplate verified; spare headroom `null` | Verified Official |
| `pmc_ev_stations.json` | 13 | `Point` | Parking bay footprint not modeled | Unmapped parameters remain `null` | Mapped in OSM |
| `pmc_road_corridors.json` | 10 | `Point` | Corridor length/area uncalculated | Carriageway widths are indicative estimates | Manually Curated |

---

## 4. Enforcement in Codebase
The spatial integrity rules detailed above are enforced programmatically by `src/server/gis/spatial-validation.ts` and validated via automated Vitest suites in `tests/unit/dataset-forensic-audit.test.ts`.
