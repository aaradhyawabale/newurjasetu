# URJASETU: Data Quality & Data Provenance Audit

**Audit Date:** 2026-11-05  
**Auditor Roles:** Principal Geospatial Data Scientist, Climate Data Auditor, Remote Sensing Specialist.  
**Scope:** Forensic evaluation of all geospatial rasters, vector geometries, solar telemetry, and administrative registers in the repository.

---

## 1. Forensic Dataset Inventory

| Dataset Name | Genuinely Present | Documented Origin | Reproducible Pipeline | Spatial & Temporal Resolution | Provenance Tag | Scientific Suitability & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Landsat 9 TIRS-2 C2 L2 LST** | Yes (`data/pipeline_output/dataset_manifest.json`) | USGS / NASA EarthData via Planetary Computer STAC | Yes (`scripts/pipeline/build_dataset.py`) | 100m native thermal, resampled to 30m; overpass 2023-04-22 | **Measured** | Suitable for radiometric skin temperature; NOT ambient air temperature. |
| **Sentinel-2B MSI L2A BOA** | Yes (`public/data/priority/green_loss.json`) | ESA Copernicus via Planetary Computer STAC | Yes (`scripts/pipeline/green_loss.py`) | 10m native optical; March–May 2019 & 2026 composites | **Measured** | Suitable for bi-temporal NDVI/NDBI change detection; cloud-screened (<20%). |
| **Copernicus GLO-30 DEM** | Yes (elevation & slope features) | ESA Copernicus 30m Global DEM | Yes | 30m native elevation; Pune domain (540m–690m AMSL) | **Measured** | Suitable for thermal lapse rate and terrain slope calculation. |
| **Copernicus GHS-POP / WorldPop** | Yes (`population` field in cells) | WorldPop / Census of India 2011 projections | Yes | 100m ambient population, scaled to 250m cells (6.25 ha) | **Modelled** | Correctly tagged as Modelled (ambient dasymetric disaggregation). |
| **Kaggle Solar SCADA Telemetry** | Yes (`data/external/solar/`) | Gandikota Solar Plants 1 & 2 SCADA records | Yes (`scripts/pipeline/solar_temp_model.py`) | 15-minute intervals, 34 calendar days (May 15–June 17, 2020) | **Measured** | Suitable for thermal derating curves; NOT Pune-specific (documented). |
| **PMC Ward Administrative Register** | Yes (23 authentic wards) | Pune Municipal Corporation (PMC) statutory boundaries | Yes | Vector administrative boundaries (EPSG:4326) | **Measured** | Authentic administrative polygons covering Pune municipal limits. |
| **OpenStreetMap Infrastructure** | Yes (streets, water, buildings) | OpenStreetMap Contributors (ODbL) | Yes (Overpass API provider) | Vector polylines & polygons | **Measured** | Suitable for distance-to-water and road hierarchy verification. |
| **250m Priority Cells Grid** | Yes (`public/data/priority/cells.json`) | UrjaSetu Spatial Discretization Pipeline | Yes | 250m regular grid (6.25 ha/cell, 42 active cells in core) | **Mixed** (Cell-level provenance map) | Provenance explicitly distinguished for every attribute. |

---

## 2. Forensic Quality Checks

### 2.1. Coordinate Reference System (CRS) & Geometry Integrity
- **Display & Storage CRS:** WGS84 (`EPSG:4326`) decimal degrees.
- **Internal Calculation CRS:** Projected metric UTM Zone 43N (`EPSG:32643`) or geodesic Haversine / Vincenty equations (`computeDistanceMeters`).
- **Audit Result:** PASSED. All centroids fall within authentic Pune municipal bounding box:
  $$\text{Longitude: } [73.731787, 74.018537] \quad \text{Latitude: } [18.385364, 18.621772]$$
  Zero inverted, null, or out-of-bounds coordinates detected.

### 2.2. Missing Values & Null Handling
- **Policy:** Missing, cloud-masked, or unmeasured attributes must **never** be replaced with synthetic zeroes.
- **Verification:**
  - `cooling_mean`, `cooling_p10`, `cooling_p90` are nullable when the physical direction check fails.
  - In `cells.json`, cell 22 has `heat_excess_celsius: null` and `solar_penalty_mean: null` because its surface temperature was below the city baseline. The system leaves them as `null` and the UI shows "Not available".
- **Audit Result:** PASSED. Zero fabricated fallback values detected.

### 2.3. Temporal Alignment & Phenology Matching
- **Seasonality:** Pre-monsoon summer (March–May) is consistently maintained across both Landsat (LST) and Sentinel-2 (NDVI/NDBI) to prevent false vegetation loss flags caused by monsoon-induced post-harvest cycles.
- **Audit Result:** PASSED. Scene dates verified in manifest:
  - 2019 baseline scenes: March 15, April 4, April 24, May 14, 2019.
  - 2026 monitoring scenes: March 12, April 1, April 21, May 11, 2026.

### 2.4. Provenance Classification Enforcement
The platform enforces a strict epistemic taxonomy across all APIs, JSON manifests, and frontend components:
```json
{
  "id": "Assumed",
  "centroid": "Modelled",
  "ward": "Measured",
  "population": "Modelled",
  "lst_mean": "Measured",
  "lst_std": "Modelled",
  "n_obs": "Measured",
  "ndvi": "Measured",
  "built_frac": "Modelled",
  "greenable_ha": "Modelled",
  "burden": "Modelled",
  "cooling_mean": "Modelled",
  "cooling_p10": "Modelled",
  "cooling_p90": "Modelled"
}
```
*Audit Finding:* Never are assumed parameters (such as a target NDVI threshold of 0.65 or a budget of 40 ha) presented as measured observations.

---
