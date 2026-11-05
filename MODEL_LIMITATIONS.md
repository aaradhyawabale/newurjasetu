# URJASETU: Scientific Limitations, Boundary Conditions & Assumptions

**Audit Date:** 2026-11-05  
**Auditor Roles:** Climate Modelling Researcher, Remote Sensing Specialist, Statistical Auditor.  
**Mandate:** Explicit disclosure of all physical, temporal, spatial, and mathematical boundaries to prevent misinterpretation in municipal policy and legal proceedings.

---

## 1. Physical & Remote Sensing Limitations

### 1.1. Radiometric Surface Temperature ($LST$) $\ne$ Ambient Air Temperature ($T_{\text{air}}$)
- **Physical Reality:** Landsat-9 TIRS-2 Band 10 measures thermal infrared photons emitted by the skin surface (asphalt, concrete, rooftop sheets, bare soil, grass). 
- **Municipal Context:** Skin temperature during pre-monsoon summer afternoons in Pune frequently reaches $42^\circ\text{C} - 48^\circ\text{C}$, whereas 2-meter ambient air temperature is typically $36^\circ\text{C} - 40^\circ\text{C}$.
- **Warning to Planners:** UrjaSetu cooling predictions represent radiometric surface skin cooling. They do **not** represent human wet-bulb globe temperature (WBGT) or direct physiological heat stress without microclimatic CFD coupling.

### 1.2. Spectral $NDVI$ $\ne$ 3D Canopy Cover or Shade Volume
- **Physical Reality:** Sentinel-2 $NDVI$ measures the ratio of near-infrared reflectance to red absorption, reflecting chlorophyll density.
- **Municipal Context:** A shallow turf lawn and a mature 15-meter Neem or Banyan tree canopy may both exhibit an $NDVI$ of ~0.60. However, the mature tree casts wide 3D shadows and blocks incoming solar radiation, whereas grass provides minimal shading.
- **Limitation:** UrjaSetu treats $NDVI$ as an empirical greenness index and does not resolve 3D tree crown volume or leaf area index (LAI).

### 1.3. Diurnal & Nocturnal Heat Island Dynamics
- **Observation Window:** Landsat 9 overpass occurs at ~10:45 AM local solar time under clear skies.
- **Limitation:** The model does not capture nocturnal urban heat retention (where dense concrete releases stored thermal energy between 8:00 PM and 2:00 AM).

---

## 2. Solar Photovoltaic Derating Limitations

### 2.1. Utility SCADA Proxy vs. Urban Rooftop Microclimate
- **Training Origin:** Trained on 34 days (May 15 – June 17, 2020) from two utility-scale ground-mount solar plants in Gandikota, Andhra Pradesh, India.
- **Limitation:** While the thermal derating slope ($-0.533\%/^\circ\text{C}$) reflects fundamental silicon physics, urban rooftop installations in Pune experience distinct convective boundary layer turbulence, building parapet aerodynamic drag, and local soiling from traffic emissions.

### 2.2. Prohibition of Absolute kWh Generation Claims
- **Policy Enforcement:** UrjaSetu strictly outputs **relative percentage efficiency penalties** (e.g. $-2.1\%$ to $-3.2\%$ relative output reduction).
- **Rationale:** Absolute energy generation ($\text{kWh}$) requires knowing site-specific inverter clipping thresholds, DC-to-AC ratios, string configurations, panel tilt angles, and azimuthal orientations, which are unmeasured across 250m grid cells. Fabricating absolute kWh would violate scientific integrity.

---

## 3. Mathematical & Algorithmic Limitations

### 3.1. Knapsack Heuristic Approximation
- **Limitation:** The greedy benefit-per-hectare sort is an approximation for the NP-hard 0-1 Knapsack problem. Under tight hectare budgets, it can diverge from the provably global optimum by 10%–16% due to non-fractional land parcel boundaries.
- **Communication:** Must be described as an "efficient heuristic ranking," not an "absolute global mathematical optimum."

### 3.2. Spatial Scale Discretization (250m Grid Window)
- **Aggregation:** Features are aggregated into $250 \times 250\text{ m}$ (6.25 hectare) cells.
- **Limitation:** Sub-parcel microclimates (e.g., a tiny shaded courtyard, a single water fountain, or a single building shadow) are averaged out across the cell area.

---
