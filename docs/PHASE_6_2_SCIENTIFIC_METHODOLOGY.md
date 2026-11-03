# UrjaSetu Phase 6.2 — Scientific & Geospatial Methodology Manual

**Document ID:** `DOC-URJASETU-6.2-SCI-01`  
**Status:** Approved & Machine-Integrated  
**Date:** November 2026  
**Target Region:** Pune Metropolitan Region, Maharashtra, India  
**Target Analysis Grid:** EPSG:32643 (UTM Zone 43N), 30.0m Cell Size, 1012 × 871 Grid Dimensions  

---

## 1. Executive Summary & Scientific Principles

UrjaSetu operates as an evidence-based decision-support platform for urban cooling, renewable energy siting, and sustainable urban infrastructure. To maintain scientific defensibility before municipal engineers, urban planners, and regulatory bodies, the platform enforces three cardinal scientific principles:

1. **Physical Reality Principle**: Satellite observations represent instantaneous physical states (e.g. radiometric skin temperature, surface spectral reflectance) at sensor overpass; they must never be conflated with human physiological thermal comfort or ambient air temperature.
2. **Transparent Screening Principle**: Exploratory spatial discovery must operate via transparent, deterministic thresholds and explicit constraint checklists. Unsupported arbitrary numerical scoring formulas (e.g., synthetic weighted composite scores) are strictly prohibited.
3. **Evidence Ledger Principle**: Every spatial candidate must maintain a traceable, tamper-evident ledger recording the exact source dataset, sensor overpass timestamp, retrieval uncertainty, and missing on-site engineering surveys.

---

## 2. Satellite Remote Sensing Formulations

### 2.1 Thermal Infrared Radiometry (Landsat 9 TIRS-2)
- **Sensor**: Thermal Infrared Sensor 2 (TIRS-2), Band 10 (ST_B10).
- **Scene Identifier**: `LC09_L2SP_147047_20230422_02_T1`.
- **Acquisition Timestamp**: `2023-04-22T05:27:39.760219Z` (~10:57 AM IST).
- **Delivered Resolution**: 30.0m (USGS Collection 2 Level-2 product, resampled from 100m native detector via cubic convolution).
- **Calibration Equation**:

$$\text{LST}_{\text{Celsius}} = \text{DN} \times 0.00341802 - 124.15$$

$$\text{LST}_{\text{Kelvin}} = \text{DN} \times 0.00341802 + 149.0$$

- **Observed Thermal Statistics (577,304 Study Pixels)**:
  - Minimum LST: $25.76^\circ\text{C}$
  - 10th Percentile (P10): $41.30^\circ\text{C}$
  - Median LST: $45.86^\circ\text{C}$
  - Mean LST: $46.28^\circ\text{C}$
  - Standard Deviation: $4.35^\circ\text{C}$
  - 90th Percentile (P90): $52.38^\circ\text{C}$
  - Maximum LST: $61.41^\circ\text{C}$

### 2.2 Surface Temperature Uncertainty (ST_QA)
- **USGS Uncertainty Assessment**: The Surface Temperature Quality Assessment band (`pune_st_qa_30m.tif`) records per-pixel thermal uncertainty scaled by $0.01\text{ K}$.
- **Field Distribution**:
  - Mean Uncertainty: $2.16\text{ K}$
  - Median Uncertainty: $2.10\text{ K}$
  - Range: $1.51\text{ K}$ to $62.75\text{ K}$ (highest uncertainty occurs at water-land boundaries and cloud fringes).
- **Refutation of Uniform $\pm 0.81\text{ K}$ Claim**: Legacy documentation cited $\pm 0.81\text{ K}$, which misapplied laboratory-level sensor noise benchmarks. UrjaSetu Phase 6.2 incorporates actual per-pixel uncertainty values with a study area baseline mean of $2.16\text{ K}$.

### 2.3 Multispectral Reflectance & Vegetation (Sentinel-2B MSI)
- **Sensor**: MultiSpectral Instrument (MSI), Level-2A Bottom-Of-Atmosphere (BOA) Reflectance.
- **Scene Identifier**: `S2B_MSIL2A_20230424T052649_N0510_R105_T43QCA_20240831T130916`.
- **Acquisition Timestamp**: `2023-04-24T05:26:49.024Z` (~10:56 AM IST; ~48-hour baseline offset from Landsat 9).
- **Bands & Rescaling**:
  - Band 4 (Red, 665 nm, native 10m)
  - Band 8 (NIR, 842 nm, native 10m)
  - Scene Classification Layer (SCL, native 20m)

$$\rho_{\lambda} = \frac{\text{DN} - 1000}{10000}$$

$$\text{NDVI} = \frac{\rho_{\text{NIR}} - \rho_{\text{Red}}}{\rho_{\text{NIR}} + \rho_{\text{Red}}} = \frac{\text{B08} - \text{B04}}{\text{B08} + \text{B04}}$$

- **Target Grid Aggregation**: Native 10m optical pixels are mapped to the 30m Landsat grid using exact fractional polygon area weighting.
- **Observed Terrestrial NDVI Statistics**:
  - Valid Pixels: 518,651 ($89.84\%$ of candidate boundary)
  - Minimum: $-0.7316$
  - Mean: $0.5144$
  - Median: $0.5070$
  - Standard Deviation: $0.2302$
  - Maximum: $1.0000$

---

## 3. Phenomenological Boundaries & Disclosures

| Parameter | What the Parameter Establishes | What the Parameter CANNOT Establish |
| :--- | :--- | :--- |
| **Landsat 9 LST** | Instantaneous radiometric skin temperature of the uppermost surface element at ~10:57 AM solar time under clear skies. | 2m ambient air temperature, indoor wet-bulb temperature, pedestrian physiological thermal stress, or diurnal heat wave dynamics. |
| **Sentinel-2 NDVI** | Relative green canopy photosynthetic activity and chlorophyll absorption index [-1.0, 1.0]. | Absolute tree canopy volume, 3D shading coverage, tree species, under-canopy pedestrian microclimate, or root zone health. |
| **Substation Proximity** | Geodesic distance (meters) to a mapped MSEDCL high-voltage substation switchyard node. | Feeder topology, distribution transformer spare headroom, reverse power hosting capacity, or contractual grid tie clearance. |
| **Hospital / Garden Point** | Geographic coordinates of main public gate, reception portal, or gazetted centroid. | Building parcel boundaries, usable flat rooftop area, roof structural live/dead load capacity, or property ownership cadastre. |

---

## 4. Transparent Screening vs. Weighted Scoring

UrjaSetu rejects artificial composite scoring formulas (e.g. `Score = 0.4 * LST + 0.3 * NDVI + 0.3 * Proximity`). Such formulas create a false illusion of scientific precision and obscure the real engineering blockers.

Instead, UrjaSetu employs a transparent, two-stage evaluation methodology:
1. **Configurable Exploratory Screening**:
   - `minThermalStressLST`: User-configurable threshold (default: $40.0^\circ\text{C}$).
   - `maxVegetationNDVI`: User-configurable threshold (default: $0.45$).
   - `maxRoadDistanceM`: Infrastructure accessibility limit (default: $500\text{ m}$).
   - `maxSubstationDistanceM`: Electrical connection screening limit (default: $3000\text{ m}$).
2. **Differentiated Eligibility Classification**:
   - `ELIGIBLE_FOR_REVIEW`: Feature satisfies screening parameters with complete spatial and provenance records.
   - `CONDITIONALLY_ELIGIBLE`: Candidate demonstrates high thermal opportunity but is constrained by unverified external infrastructure (e.g., unassessed MSEDCL substation headroom).
   - `REQUIRES_SITE_VALIDATION`: Candidate originates from point geometries or requires mandatory structural / underground utility scanning (e.g., curated corridors, civic hospital roofs).
   - `INSUFFICIENT_EVIDENCE`: Feature records lack critical spatial coordinates or authoritative attributes.
   - `EXCLUDED`: Feature falls outside candidate boundary or is masked by water/cloud pixels.

---

## 5. Sensitivity Analysis Protocol

To ensure reproducible policy evaluation, UrjaSetu provides programmatic sensitivity sweeping across screening parameters:
- Every run records:
  - Dataset version hashes.
  - Parameter varied and test values.
  - Evaluated, accepted, and rejected candidate counts.
  - Categorized rejection reasons (`SUB_THRESHOLD_THERMAL_EXPOSURE`, `HIGH_VEGETATION_DENSITY`, `EXCEEDS_GRID_PROXIMITY_LIMIT`, `WATER_MASKED`, etc.).
  - ISO 8601 execution timestamp.
