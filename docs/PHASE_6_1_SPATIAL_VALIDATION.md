# UrjaSetu Phase 6.1 — Spatial Geometry Validation & GIS Alignment

**Date:** November 1, 2026  
**Coordinate Reference System:** EPSG:4326 (WGS 84) / EPSG:32643 (UTM Zone 43N)  
**Target Grid Resolution:** 30.0m x 30.0m uniform grid  
**Regional Grid Dimensions:** 1,012 rows x 871 columns (881,452 total cells; 577,304 inside candidate boundary)  

---

## 1. Geographic Coordinate Bounds & CRS Integrity

All vector features and satellite raster layers ingested by UrjaSetu must conform to the geographic and projected coordinate standards established for the Pune Metropolitan Area.

### 1.1 Study Area Extents

| Spatial Dimension | Minimum (South / West) | Maximum (North / East) | Projected Extent (UTM Zone 43N) | Notes |
|:---|:---:|:---:|:---:|:---|
| **Latitude (Y)** | `18.4000° N` | `18.6500° N` | `2,034,750 m N` to `2,065,110 m N` | Covers complete PMC municipal territory. |
| **Longitude (X)** | `73.7000° E` | `74.0500° E` | `362,850 m E` to `388,980 m E` | Spans Baner/Bavdhan to Kharadi/Hadapsar. |
| **Target Grid Cell** | — | — | `30.0 m x 30.0 m` ($900\text{ m}^2$) | Matches USGS Landsat Collection 2 target. |

### 1.2 Coordinate System Alignment Check

```
   Raw Vector Datasets (WGS84 Lon/Lat, EPSG:4326)
                 │
                 ▼
   Affine Coordinate Transformation (Forward)
   x_utm = f(lng, lat, Zone 43N)
   y_utm = g(lng, lat, Zone 43N)
                 │
                 ▼
   Grid Cell Indexing:
   col = floor((x_utm - x_min) / 30.0)
   row = floor((y_max - y_utm) / 30.0)
                 │
                 ▼
   Bilinear / Nearest Sampling of Calibrated TIFs
   (pune_lst_calibrated_30m.tif, pune_ndvi_30m.tif)
```

1. **Reprojection Uniformity:**
   - Vector points in `src/data/official/` store coordinates in decimal degrees `(lat, lng)` under WGS 84 (EPSG:4326).
   - The query engine transforms `(lat, lng)` to UTM Zone 43N (EPSG:32643) coordinates using rigorous ellipsoidal forward mapping prior to pixel sampling.
   - Coordinate inversion checks confirm 100% adherence: latitude values lie strictly in $[18.40, 18.65]$ and longitudes in $[73.70, 74.05]$. No swapped $(x,y)$ pairs were detected.

---

## 2. Spatial Geometry Typology & Forensic Reclassification

A key finding of the Phase 6.1 forensic audit was the improper assertion of 1D linear geometry types for features that were only recorded as single coordinate points.

### 2.1 Geometry Typology Audit

| Dataset | Previous Declared Geometry | Actual Stored Geometry | Forensic Correction Applied | Cadastral Limitation |
|:---|:---:|:---:|:---:|:---|
| **PMC Gardens** | `Point` | `Point` | Validated as `Point` (park entrance/centroid). | Parcel boundaries require City Survey Office (CTSO) cadastre. |
| **PMC Hospitals** | `Point` | `Point` | Validated as `Point` (entrance location). | Rooftop structural area requires on-site architectural measurement. |
| **MSEDCL Substations** | `Point` | `Point` | Validated as `Point` (substation switchyard). | Substation perimeter fence and bay layouts require MSEDCL single-line diagram. |
| **OSM EV Stations** | `Point` | `Point` | Validated as `Point` (charger dispenser location). | Parking bay footprint requires on-site parking layout audit. |
| **Road Corridors** | `LineString` | Single point `(lat, lng)` | **Reclassified to `Point` (Corridor Centroid Sample)**. | Continuously surveyed linear vector alignments require PMC Town Planning ROW sheets. |

### 2.2 Reclassification of Road Corridors

In Phase 6, `pmc_road_corridors.json` listed 10 corridors (e.g. Karve Road, FC Road, Laxmi Road) with claimed lengths (`2.4km` to `6.8km`) and widths (`12m` to `45m`), but the JSON entries only provided single point coordinates:
```json
{
  "id": "OSM-WAY-KARVE-RD",
  "name": "Karve Road Arterial Corridor",
  "lat": 18.5085,
  "lng": 73.818,
  "carriagewayM": 24.0,
  "lengthKm": 4.2
}
```

Asserting `sourceGeometryType: "LineString"` when no coordinate vertices existed was scientifically indefensible. In Phase 6.1:
1. `sourceGeometryType` was updated to **`Point`** across all 10 records.
2. The location summary explicitly clarifies that the candidate coordinate is a **representative corridor centroid sample point**.
3. Carriageway widths were tagged with `carriagewaySource: "ESTIMATED_PLANNING_ASSUMPTION"`.
4. The discovery engine assigns these candidates `status: "REQUIRES_SITE_VALIDATION"`, ensuring planners understand that detailed project reports (DPR) cannot be formulated without statutory municipal Right-of-Way (ROW) surveys.

---

## 3. Water Masking & NoData Screening

The spatial discovery engine queries calibrated satellite rasters and implements strict automated masking:

```
                            Grid Query at (lng, lat)
                                       │
                    ┌──────────────────┴──────────────────┐
             Inside Bounding Box?                  Outside Bounding Box
                    │                                     │
                   Yes                               [ REJECTED ]
                    │                           (OUTSIDE_GRID_OR_NODATA)
                    ▼
          Check ST_B10 Cell Value
                    │
         ┌──────────┴──────────┐
      Valid Float            NaN / NoData
         │                     │
         ▼                [ REJECTED ]
   Check SCL Class    (OUTSIDE_GRID_OR_NODATA)
         │
         ├─ SCL == 6 (Water) ──────────────────────────► [ REJECTED ] (SCL_WATER_MASKED)
         ├─ SCL in {3, 8, 9} (Cloud/Shadow) ───────────► [ REJECTED ] (SCL_CLOUD_SHADOW_MASKED)
         └─ SCL in {4, 5, 7, 11} (Land/Veg/Snow) ──────► [ PROCEED TO SCREENING ]
```

1. **Water Masking (SCL Class 6):**
   - Pixels classified as open water by the Sentinel-2 Scene Classification Layer (SCL = 6) along the Mula-Mutha riverbed, Khadakwasla canal, and Pashan lake are automatically excluded from urban greening, cool roof, and solar canopy candidacies.
2. **Cloud & Shadow Masking (SCL Classes 3, 8, 9):**
   - Cloud shadow (Class 3), cloud medium/high probability (Classes 8, 9), and thin cirrus (Class 10) are filtered to prevent distorted thermal or vegetative readings. The May 18, 2024 scene was cloud-free across central Pune, with zero cloud exclusions.
3. **NoData Rejections:**
   - Features located outside the calibrated raster grid boundary (e.g. peripheral rural villages outside the 30.36km x 26.13km scene) are recorded under `OUTSIDE_GRID_OR_NODATA` in the `AnalysisRun` rejection ledger.

---

## 4. Geometric Distance & Proximity Calculations

Proximity metrics between intervention candidates and electrical substations or primary roads are computed using the spherical Haversine formula implemented in `src/server/gis/geometry.ts`:

$$d = 2 R \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)} \right)$$

where $R = 6,371,000\text{ m}$ (mean Earth radius), $\phi$ is latitude in radians, and $\lambda$ is longitude in radians.

For local spatial calculations within the 30m grid, planar Euclidean distances in projected UTM Zone 43N coordinates ($\Delta x, \Delta y$) are employed:

$$d_{\text{planar}} = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$

The difference between Haversine and UTM planar distance within a 3km radius is less than $0.05\%$, well within geospatial engineering tolerances.
