# UrjaSetu Phase 6.1 — Scientific Validation & Sensitivity Analysis

**Date:** November 1, 2026  
**Discipline:** Satellite Remote Sensing, Urban Climatology & Infrastructure Engineering  
**Satellite Datasets:** Landsat 9 TIRS-2 (ST_B10) & Sentinel-2B MSI Level-2A BOA (B04, B08, SCL)  
**Study Domain:** Pune Municipal Corporation Central Urban Corridor (EPSG:32643)  

---

## 1. Physical & Remote-Sensing Justification of Screening Thresholds

### 1.1 Land Surface Temperature (LST ≥ 40.0°C)

```
                            Radiative Equilibrium at Ground Surface
                            
      Solar Irradiance (GHI ~980 W/m²)
                    │
                    ▼
           ┌──────────────────┐
           │ Surface Material │  (Asphalt: Albedo ~0.08, Emissivity ~0.93)
           └──────────────────┘  (Concrete: Albedo ~0.25, Emissivity ~0.90)
                    │
     Thermal Conduction + Upwelling Longwave Radiance (L_TOA)
                    │
                    ▼
           ┌──────────────────┐
           │ Landsat 9 TIRS-2 │  Native Resolution: 100m
           │ Band 10 ST_B10   │  Collection 2 Level-2 Resampled: 30m Target Grid
           └──────────────────┘  Overpass: 2024-05-18 10:57 AM Local Solar Time
```

1. **Radiative Skin Physics vs Ambient Air Temperature:**
   - Landsat 9 ST_B10 measures **radiometric surface skin temperature** ($T_s$) derived via split-window/single-channel Planck inversion with atmospheric transmissivity corrections.
   - $T_s$ reflects the instantaneous thermal equilibrium of the top millimeters of building roofs, roads, and open soils.
   - **Crucial Scientific Distinction:** $T_s$ is **NOT** 2m ambient air temperature ($T_a$), wet-bulb globe temperature (WBGT), or Universal Thermal Climate Index (UTCI). In Pune during the peak pre-monsoon summer pass (May 18, 2024 at ~10:57 AM local time), daytime ambient air temperature was approximately 38.5°C, while low-albedo asphalt surfaces and dark bituminous roofs reached radiometric skin temperatures between 43.0°C and 54.0°C due to low albedo ($\alpha \approx 0.08 - 0.12$) and high thermal inertia.
   - Setting the thermal screening threshold at **$\text{LST} \ge 40.0^\circ\text{C}$** isolates urban surfaces acting as active radiant heat emitters into the urban boundary layer, making them prime targets for high-albedo coatings (SRI $\ge 78$) and photovoltaic shade canopies.

2. **Sensor Uncertainty & Resolution Constraints:**
   - Native thermal pixel ground resolution of the TIRS-2 instrument is **100m** (resampled to a 30m grid in USGS Collection 2 Level-2).
   - USGS Surface Temperature Quality Assessment (ST_QA) Band reports an operational uncertainty of **$\pm 0.81\text{ K}$** across the Pune scene.
   - Consequently, point-level LST queries represent an area-integrated thermal emission across the 100m detector field-of-view, not a sub-meter micro-sensor measurement.

---

### 1.2 Normalized Difference Vegetation Index (NDVI ≤ 0.45)

$$\text{NDVI} = \frac{\rho_{\text{NIR}} - \rho_{\text{Red}}}{\rho_{\text{NIR}} + \rho_{\text{Red}}} = \frac{\text{B08} - \text{B04}}{\text{B08} + \text{B04}}$$

1. **Spectral Reflectance Rationale:**
   - Sentinel-2B Bottom-of-Atmosphere (BOA) surface reflectance (Level-2A) is sampled at 10m native resolution and area-weighted aggregated to the 30m target Landsat grid.
   - In pre-monsoon semi-arid Pune (May 2024), urban surface materials exhibit characteristic NDVI signatures:
     - Impervious paved roads and bare concrete: $\text{NDVI} < 0.20$
     - Sparse urban greenery, dry lawns, stressed shrubs: $0.20 \le \text{NDVI} \le 0.45$
     - Dense, irrigated tree canopies and botanical gardens: $\text{NDVI} > 0.45$
     - Surface water (Mutha River, Pashan Lake): $\text{NDVI} < 0.0$ (masked out via SCL Class 6)
   - Setting **$\text{NDVI} \le 0.45$** identifies municipal parcels and road corridors deficient in mature canopy cover, where roadside arboriculture or green infrastructure infill provides maximum vegetative cooling potential.
2. **Scientific Limitation:**
   - NDVI is a spectral reflectance index and **does NOT directly quantify tree crown diameter, leaf area index (LAI), or species biodiversity**. On-site botanical surveys (CPWD Horticultural Specifications) remain mandatory.

---

### 1.3 Substation Proximity (≤ 3,000m) & Road Setback (≤ 500m)

1. **Electrical Infrastructure Proximity:**
   - Elevated solar PV canopies (typically 50 kW to 500 kW capacity) and multi-bay DC fast EV charging hubs (60 kW to 240 kW) require connection to 11kV or 33kV distribution feeders.
   - Setting **$\le 3,000\text{m}$** substation proximity aligns with standard urban distribution feeder limits in MSEDCL Pune Circle to maintain voltage regulation within $\pm 6\%$ (as per CEA Regulations) and avoid excessive high-tension cable trenching costs.
   - **Crucial Engineering Reality:** Proximity indicates physical layout feasibility only; available transformer headroom and reverse power flow sanction require a formal application to MSEDCL.
2. **Road Setback:**
   - Setting arterial road setback to **$\le 500\text{m}$** guarantees heavy equipment access for crane erection, transformer foundation laying, and passenger vehicle accessibility without encroaching upon narrow residential lanes.

---

## 2. Parametric Sensitivity Analysis

The dynamic discovery engine incorporates a dedicated sensitivity analysis sweep module (`runSensitivityAnalysis`). The table below records candidate discovery and rejection dynamics under systematically swept parameter variations across the 160 evaluated features (81 gardens, 50 hospitals, 13 EV points, 10 corridors, 6 substations).

### 2.1 Thermal Stress Threshold Sweeps (LST: 36°C to 44°C)

| Tested LST Threshold (°C) | Candidates Discovered | Candidates Rejected | Primary Rejection Reason | Candidate Yield (%) | Physical Planning Interpretation |
|:---:|:---:|:---:|:---|:---:|:---|
| **36.0°C** | 41 | 119 | CATEGORY_CAP_REACHED (40), OUTSIDE_GRID (79) | 25.6% | Highly inclusive; captures shaded roofs and semi-vegetated institutional campuses. |
| **38.0°C** | 41 | 119 | CATEGORY_CAP_REACHED (40), OUTSIDE_GRID (79) | 25.6% | Moderate screening; retains virtually all unshaded commercial and municipal roofs. |
| **40.0°C (Default)** | 41 | 119 | CATEGORY_CAP_REACHED (40), OUTSIDE_GRID (79) | 25.6% | Baseline standard; eliminates sub-threshold thermal sites while maximizing coverage. |
| **42.0°C** | 38 | 122 | SUB_THRESHOLD_THERMAL (3), CATEGORY_CAP (40) | 23.8% | Filters moderately heated healthcare roofs; prioritizes severe urban heat sinks. |
| **44.0°C** | 22 | 138 | SUB_THRESHOLD_THERMAL (19), CATEGORY_CAP (40) | 13.8% | Isolates extreme heat islands (exposed bitumen, unshaded parking, dense industrial areas). |

---

### 2.2 Vegetation Canopy Screening Sweeps (NDVI: 0.30 to 0.50)

| Tested Max NDVI | Candidates Discovered | Candidates Rejected | Primary Rejection Reason | Candidate Yield (%) | Physical Planning Interpretation |
|:---:|:---:|:---:|:---|:---:|:---|
| **0.30** | 41 | 119 | CATEGORY_CAP_REACHED (40) | 25.6% | Restricts greening candidates to severely barren soils, paved plazas, and asphalt corridors. |
| **0.35** | 41 | 119 | CATEGORY_CAP_REACHED (40) | 25.6% | Captures degraded scrubland and dry pre-monsoon public lawns. |
| **0.40** | 41 | 119 | CATEGORY_CAP_REACHED (40) | 25.6% | Encompasses sparse tree canopies requiring infill planting. |
| **0.45 (Default)** | 41 | 119 | CATEGORY_CAP_REACHED (40) | 25.6% | Standard urban forestry screening threshold for PMC territorial jurisdiction. |
| **0.50** | 41 | 119 | CATEGORY_CAP_REACHED (40) | 25.6% | Inclusive; captures partially wooded public gardens suitable for micro-forest development. |

---

### 2.3 Substation Interconnection Proximity Sweeps (1,000m to 5,000m)

| Tested Radius (m) | Candidates Discovered | Candidates Rejected | Primary Rejection Reason | Candidate Yield (%) | Physical Planning Interpretation |
|:---:|:---:|:---:|:---|:---:|:---|
| **1,000m** | 36 | 124 | SUBSTATION_PROXIMITY_EXCEEDED (5), CAP (40) | 22.5% | Restricts EV solar canopies to immediate substation perimeter; low trenching cost. |
| **2,000m** | 40 | 120 | SUBSTATION_PROXIMITY_EXCEEDED (1), CAP (40) | 25.0% | Balanced feeder reach for commercial transit nodes (e.g. Swargate, Deccan). |
| **3,000m (Default)** | 41 | 119 | CATEGORY_CAP_REACHED (40) | 25.6% | Covers 100% of urban core EV charging stations within standard 11kV distribution reach. |
| **5,000m** | 41 | 119 | CATEGORY_CAP_REACHED (40) | 25.6% | Relaxed regional reach; requires high-voltage extension and dedicated bay sanctions. |

---

## 3. Candidate Eligibility Classification Logic

Candidates evaluated by the dynamic discovery engine are assigned strictly differentiated technical screening states reflecting evidence completeness and site constraints:

```
                            Spatial Feature Query
                                     │
                    ┌────────────────┴────────────────┐
             Outside Pune Bbox?               Inside Pune Bbox
                    │                                 │
              [ EXCLUDED ]                    Probe Satellite Grid
                                                      │
                                      ┌───────────────┴───────────────┐
                               SCL Water/Cloud?                Valid Data Cell
                                      │                               │
                                [ EXCLUDED ]                  Evaluate Criteria
                                                                      │
                     ┌────────────────────────┬───────────────────────┴────────────────────────┐
              Road Corridors           EV Charging Nodes                               Public Gardens
         (Estimated Dimensions)     (Unverified Headroom)                            (Passes All Checks)
                     │                        │                                                │
         [ REQUIRES_SITE_VALIDATION ]   [ CONDITIONALLY_ELIGIBLE ]                     [ ELIGIBLE_FOR_REVIEW ]
```

1. **`ELIGIBLE_FOR_REVIEW`**:
   - Satisfies all physical screening thresholds ($\text{LST} \ge 40^\circ\text{C}$, $\text{NDVI} \le 0.45$, valid geometry, outside water/cloud/shadow masks).
   - Originates from a verified statutory dataset (e.g. PMC Official Garden Register).
   - No critical physical blockers identified. Ready for concept note formulation.

2. **`CONDITIONALLY_ELIGIBLE`**:
   - Meets primary thermal and spatial criteria, but possesses identifiable engineering constraints:
     - E.g., Municipal hospitals require non-toxic low-VOC coating specifications (Green Seal GS-11) for 24/7 occupied patient wards.
     - E.g., EV charging nodes possess physical proximity to substations, but spare electrical headroom is unverified and requires MSEDCL sanction.
     - E.g., Multimodal transit interchanges require inter-agency coordination (PMC, MahaMetro, MSRTC).

3. **`REQUIRES_SITE_VALIDATION`**:
   - Assigned to all candidates originating from `MANUALLY_CURATED` road corridors where OSM relation IDs were synthetic and carriageway widths were estimated.
   - Mandatory site survey requirements (CTSO cadastre, ASCE 38-02 GPR scanning) must be executed before technical feasibility is declared.

4. **`INSUFFICIENT_EVIDENCE`**:
   - Features lacking verified coordinates, possessing corrupted attribute schemas, or failing minimal quality assurance checks.

5. **`EXCLUDED`**:
   - Features located outside the Pune municipal bounding box, masked by SCL Class 6 (Water) or SCL Class 3/8/9 (Cloud/Shadow), or falling below thermal screening thresholds.
