# UrjaSetu Phase 3: Satellite Data Preprocessing & Heat Engine Implementation Guide

## Executive Summary
This document provides the definitive architectural, mathematical, and operational reference for the Phase 3 implementation in UrjaSetu. The implementation integrates calibrated Landsat 9 thermal infrared observations and Sentinel-2 optical observations across the Pune Municipal Corporation candidate boundary (PMC candidate) without full scene downloads, synthetic value injections, or unverified physical assumptions.

---

## 1. Input Datasets & Provenance

### 1.1 Landsat 9 (Thermal Infrared)
* **Scene ID**: `LC09_L2SP_147047_20230422_02_T1`
* **Acquisition Timestamp**: `2023-04-22T05:27:39.760219Z`
* **Collection**: USGS Landsat Collection 2 Level-2 Surface Temperature (L2SP)
* **Access Method**: Microsoft Planetary Computer Cloud-Optimized GeoTIFF (COG) via GDAL `/vsicurl/` with SAS Token authentication
* **Spatial Resolution**:
  * Native sensor resolution: **100m** (TIRS-2)
  * Delivered raster grid: **30m** (cubic convolution resampled by USGS processing pipeline)
* **Calibration Equation**:
  $$\text{LST (°C)} = \text{DN} \times 0.00341802 - 124.15$$
  $$\text{LST (K)} = \text{DN} \times 0.00341802 + 149.0$$
* **Pixel Policy**:
  * `DN = 0`: Treated strictly as NoData / Fill.
  * `DN 1–292`: Preserved as a distinct diagnostic anomaly class (scaled equivalent $< 150\text{ K}$). In this scene, count is exactly **0**.
  * `DN 293–65535`: Nominal valid observation range. In this scene, **577,304** candidate pixels were nominal valid (100% of non-fill thermal data).

### 1.2 Sentinel-2B (Optical Multispectral & SCL)
* **Granule ID**: `S2B_MSIL2A_20230424T052649_N0510_R105_T43QCA_20240831T130916`
* **Acquisition Timestamp**: `2023-04-24T05:26:49.024Z` (~48 hours temporal proximity to Landsat 9)
* **Baseline**: `N0510`
* **Access Method**: AWS Element84 Public S3 COG repository (`sentinel-cogs.s3.us-west-2.amazonaws.com`) via GDAL `/vsicurl/`
* **Calibration Equation**:
  $$\text{Reflectance} = \frac{\text{DN} + \text{BOA\_ADD\_OFFSET}}{\text{QUANTIFICATION\_VALUE}} = \frac{\text{DN} - 1000}{10000.0}$$
* **Negative Reflectance Policy**:
  * Reflectance values $< 0$ are preserved in calibration and tracked in diagnostic logs (**2,362,281** B04 pixels; **129,770** B08 pixels).
  * No synthetic zero-clipping or silent epsilon flooring is applied.

---

## 2. Mathematical Alignments & 4x4 Area-Weighted Aggregation

### 2.1 Coordinate Reference System & Spatial Window
* **CRS**: `EPSG:32643` (WGS 84 / UTM Zone 43N)
* **Target Grid**: 30m cell size, Affine Transform `[366105.0, 30.0, 0.0, 2059365.0, 0.0, -30.0]`
* **Dimensions**: Width = 1,012 pixels, Height = 871 pixels (Total: 881,452 cells)
* **Candidate Bounding Mask**: Derived from PMC Prabhag ward polygons; non-authoritative candidate boundary covering **577,304** pixels (~519.57 km²).

### 2.2 SCL Shared-Origin Block Mapping (20m to 10m)
Because Sentinel-2 10m and 20m grids share the exact same tile origin `(300000.0, 2100000.0)` in `EPSG:32643`:
$$\text{SCL}_{10m}(r, c) = \text{SCL}_{20m}\left(\lfloor r / 2 \rfloor, \lfloor c / 2 \rfloor\right)$$
This integer block replication preserves categorical purity without synthesizing non-existent categorical classes.

### 2.3 4x4 Subpixel Overlap Matrix (10m to 30m)
Due to a 5m phase offset between the Landsat 30m pixel edges and Sentinel-2 10m pixel edges, each 30m target cell intersects a $4 \times 4$ cluster of 10m source cells with exact geometric weights:
$$W = \begin{bmatrix}
25 & 50 & 50 & 25 \\
50 & 100 & 100 & 50 \\
50 & 100 & 100 & 50 \\
25 & 50 & 50 & 25
\end{bmatrix} \text{ m}^2$$
Total target cell area:
$$\sum_{i=1}^4 \sum_{j=1}^4 W_{i,j} = 4(25) + 8(50) + 4(100) = 100 + 400 + 400 = 900 \text{ m}^2$$

### 2.4 Aggregated NDVI Equation
$$\text{NDVI}_{30m} = \frac{\sum_{k \in \text{valid}} W_k \cdot \text{NDVI}_{10m, k}}{\sum_{k \in \text{valid}} W_k}$$
Where a source pixel $k$ is valid if:
1. Valid DN in B04 and B08
2. Terrestrial SCL (Class 4 Vegetation or Class 5 Bare Soil)
3. Non-negative reflectance ($\rho_{B04} \ge 0, \rho_{B08} \ge 0$)
4. Denominator $(\rho_{B08} + \rho_{B04}) > 10^{-4}$

---

## 3. Delivered Scientific Raster Inventory (`public/data/heat/`)

| Filename | Data Type | Dimensions | Compression | Description |
| :--- | :--- | :--- | :--- | :--- |
| `pune_lst_raw_dn_30m.tif` | UInt16 | $1012 \times 871$ | LZW | Raw ST_B10 DNs (DN 0 = NoData) |
| `pune_lst_30m.tif` | Float32 | $1012 \times 871$ | LZW | Calibrated LST in °C |
| `pune_lst_statistical_mask_30m.tif` | UInt8 | $1012 \times 871$ | LZW | Quality mask (0=Fill, 1=Anomaly, 2=Nominal) |
| `pune_st_qa_30m.tif` | Int16 | $1012 \times 871$ | LZW | Surface Temperature Uncertainty (0.01 K) |
| `pune_ndvi_10m.tif` | Float32 | $3037 \times 2614$ | LZW | Native 10m valid terrestrial NDVI |
| `pune_ndvi_30m.tif` | Float32 | $1012 \times 871$ | LZW | Exact area-weighted aggregated NDVI |
| `pune_ndvi_valid_fraction_30m.tif` | Float32 (3-band) | $1012 \times 871$ | LZW | Band 1: Coverage, Band 2: Validity, Band 3: Footprint |
| `pune_scl_30m.tif` | UInt8 | $1012 \times 871$ | LZW | Categorical SCL nearest-neighbour |
| `pune_qa_diagnostics.json` | JSON | 3,451 bytes | - | Comprehensive statistical audit & diagnostics |
| `pune_provenance_manifest.json` | JSON | 3,301 bytes | - | Provenance & metadata contract |

---

## 4. Software Architecture & API Integration

1. **`src/server/heat-engine/types.ts`**: TypeScript definitions enforcing strict data contracts and provenance tags.
2. **`src/server/heat-engine/loader.ts`**: High-performance diagnostics loader, WGS84-to-UTM43N projection conversion, and point evaluation.
3. **`src/server/heat-engine/ai-adapter.ts`**: AI context generator that labels each field as `VERIFIED_INPUT`, `DETERMINISTIC_RESULT`, `AI_INTERPRETATION`, or `UNVERIFIED_ASSUMPTION`.
4. **`src/app/api/heat/route.ts`**:
   * `GET`: Returns scene metadata, candidate boundary stats, distributions, and AI context.
   * `POST`: Evaluates point coordinates `[lng, lat]` and returns localized LST, NDVI, SCL class, and uncertainty metrics.
5. **`src/components/map/HeatLayerControl.tsx`**: Interactive frontend map widget with layer toggles, color ramps, scientific disclosures, and point inspection.
