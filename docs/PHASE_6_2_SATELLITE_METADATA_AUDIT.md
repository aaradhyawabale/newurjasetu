# UrjaSetu Phase 6.2 — Satellite Metadata Audit & Reconciliation Report

**Document ID:** `DOC-URJASETU-6.2-SAT-01`  
**Status:** Approved & Machine-Reconciled  
**Date:** November 2026  
**Target Region:** Pune Metropolitan Region, Maharashtra, India  
**Target Coordinate Reference System:** EPSG:32643 (WGS 84 / UTM Zone 43N)

---

## 1. Executive Summary & Forensic Findings

During Phase 6.1 and prior implementation sprints, two significant discrepancies were identified across documentation, API code comments, and UI presentation layers:
1. **Acquisition Date Contradiction**: Several components in `src/server/intervention-engine/` (including `dataset-registry.ts`, `dynamic-discovery-engine.ts`, and `candidate-generator.ts`) asserted that Landsat 9 and Sentinel-2 data were acquired on `2024-05-18`. Conversely, underlying raster pipeline manifests in `public/data/heat/pune_qa_diagnostics.json` recorded an acquisition date of `2023-04-22`.
2. **Thermal Uncertainty Misattribution**: Multiple documents and UI tooltips claimed a uniform uncertainty of `±0.81 K` for Landsat 9 LST measurements.

### Forensic Conclusion
- **Verified Landsat 9 Scene**: `LC09_L2SP_147047_20230422_02_T1` acquired at **2023-04-22T05:27:39.760219Z** (approx. 10:57 AM IST). The `2024-05-18` citation was an unverified textual artifact introduced during Phase 6 drafting; the actual GeoTIFFs and binary rasters (`.raw`) residing in the repository originate from April 22, 2023.
- **Verified Sentinel-2B Scene**: `S2B_MSIL2A_20230424T052649_N0510_R105_T43QCA_20240831T130916` acquired at **2023-04-24T05:26:49.024Z** (approx. 10:56 AM IST), approximately 48 hours after the Landsat 9 scene. This provides an aligned pre-monsoon dry season baseline.
- **Surface Temperature Uncertainty (ST_QA)**: The `±0.81 K` figure in legacy documentation was an erroneous borrowing from USGS pre-launch laboratory calibration benchmarks. In field conditions across Pune's candidate boundary, the USGS Surface Temperature Quality Assessment band (`pune_st_qa_30m.tif`) reveals a per-pixel uncertainty distribution with a **mean of 2.16 K**, a **median of 2.10 K**, and a range between **1.51 K and 62.75 K**.

---

## 2. Reconciled Scene Specifications

| Parameter | Landsat 9 TIRS-2 | Sentinel-2B MSI |
| :--- | :--- | :--- |
| **Product Identifier** | `LC09_L2SP_147047_20230422_02_T1` | `S2B_MSIL2A_20230424T052649_N0510_R105_T43QCA_20240831T130916` |
| **Platform** | Landsat 9 | Sentinel-2B |
| **Sensor** | TIRS-2 (Thermal Infrared Sensor 2) | MSI (MultiSpectral Instrument) |
| **Processing Level** | Collection 2 Level-2 Surface Temperature | Level-2A Bottom-Of-Atmosphere (BOA) Surface Reflectance |
| **Issuing Authority** | USGS / NASA | ESA / Copernicus Programme |
| **Acquisition Timestamp (UTC)** | `2023-04-22T05:27:39.760219Z` | `2023-04-24T05:26:49.024Z` |
| **Local Solar Time (IST)** | 10:57:39 AM IST | 10:56:49 AM IST |
| **Native Sensor Resolution** | 100 meters (thermal) | 10 meters (B04 Red, B08 NIR); 20 meters (SCL) |
| **Delivered Grid Resolution** | 30 meters (cubic convolution by USGS) | 30 meters (exact area-weighted polygon aggregation) |
| **Target Grid CRS** | EPSG:32643 (UTM Zone 43N) | EPSG:32643 (UTM Zone 43N) |
| **Grid Extent [W, H]** | 1012 × 871 pixels | 1012 × 871 pixels |
| **Grid Affine Transform** | `[366105.0, 30.0, 0.0, 2059365.0, 0.0, -30.0]` | `[366105.0, 30.0, 0.0, 2059365.0, 0.0, -30.0]` |

---

## 3. Radiometric Calibration & Rescaling Formulas

### 3.1 Landsat 9 Land Surface Temperature
Landsat Collection 2 Level-2 Surface Temperature is delivered in 16-bit unsigned integers (DN). The physical conversion to degrees Celsius is governed by USGS EROS specifications:

$$\text{LST}_{\text{Kelvin}} = \text{DN} \times 0.00341802 + 149.0$$

$$\text{LST}_{\text{Celsius}} = \text{DN} \times 0.00341802 - 124.15$$

- **Scale Factor**: `0.00341802`
- **Offset (Celsius)**: `-124.15`
- **NoData Value**: `0` (or `-9999.0` in calibrated float raster)

### 3.2 Sentinel-2B Surface Reflectance & NDVI
Sentinel-2 Level-2A Bottom-of-Atmosphere (BOA) surface reflectance is scaled by ESA as:

$$\rho = \frac{\text{DN} - 1000}{10000}$$

$$\text{NDVI} = \frac{\rho_{\text{NIR}} - \rho_{\text{Red}}}{\rho_{\text{NIR}} + \rho_{\text{Red}}} = \frac{\text{B08} - \text{B04}}{\text{B08} + \text{B04}}$$

In `pune_ndvi_30m.tif`, native 10m pixels are resampled onto the 30m target Landsat grid using exact fractional polygon area weighting, maintaining rigorous spatial alignment without interpolation artifacts.

---

## 4. Empirical Statistical Distribution (PMC Candidate Extent)

Within the 577,304 valid terrestrial pixels ($519.57\text{ km}^2$) bounded by the candidate study area:

### 4.1 Calibrated LST (°C)
- **Minimum**: $25.76^\circ\text{C}$ (water bodies and shaded valleys)
- **10th Percentile (P10)**: $41.30^\circ\text{C}$
- **Median**: $45.86^\circ\text{C}$
- **Mean**: $46.28^\circ\text{C}$
- **Standard Deviation**: $4.35^\circ\text{C}$
- **90th Percentile (P90)**: $52.38^\circ\text{C}$
- **Maximum**: $61.41^\circ\text{C}$ (dense asphalt, industrial metal roofing, bare dry soils)

### 4.2 Thermal Uncertainty (ST_QA in Kelvin)
- **Mean Uncertainty**: $2.16\text{ K}$
- **Median Uncertainty**: $2.10\text{ K}$
- **Minimum Uncertainty**: $1.51\text{ K}$
- **Maximum Uncertainty**: $62.75\text{ K}$ (primarily along boundary pixels and mixed water bodies)
- **Clear Sky Coverage**: $99.98\%$ ($577,208$ pixels)
- **Cloud / Cloud Shadow**: $<0.02\%$ ($107$ pixels)

### 4.3 Normalized Difference Vegetation Index (NDVI)
- **Minimum**: $-0.7316$
- **Mean**: $0.5144$
- **Median**: $0.5070$
- **Standard Deviation**: $0.2302$
- **Maximum**: $1.0000$

---

## 5. Scientific & Phenomenological Boundaries

To maintain engineering and legal defensibility, all UI components, copilot advisories, and municipal reports must uphold the following boundaries:

1. **Radiometric Surface Skin Temperature ($T_{\text{skin}}$) vs. Ambient Air Temperature ($T_{\text{air}}$)**:
   - Satellite LST measures the radiometric emission from the uppermost surface layer (roofs, roads, tree tops, soil) at ~10:57 AM local solar time.
   - It is **not** 2-meter air temperature ($T_{\text{air}}$), nor does it equate to Wet-Bulb Globe Temperature (WBGT), Universal Thermal Climate Index (UTCI), or pedestrian physiological comfort.
   - Surface temperatures on dark asphalt or tin roofs frequently exceed $55^\circ\text{C}$ even when air temperature is $38^\circ\text{C}$.

2. **NDVI Scope**:
   - NDVI indicates photosynthetic activity and chlorophyll absorption.
   - It **cannot** establish canopy height, vertical vegetation stratification, volumetric shade, tree health species, or total green cover percentage without high-resolution LiDAR or stereoscopic photogrammetry.

---

## 6. Audit Sign-off & Manifest Integration
This audit has been incorporated into the project codebase:
- Machine-readable manifest: `src/data/satellite_manifest.json`
- Raster diagnostics: `public/data/heat/pune_qa_diagnostics.json`
- Metadata registry: `src/server/intervention-engine/dataset-registry.ts`
