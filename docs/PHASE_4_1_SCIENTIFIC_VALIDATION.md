# UrjaSetu Phase 4.1: Scientific Validation, Defensibility & Quality Audit Report

## 1. Executive Summary

Phase 4.1 establishes strict scientific defensibility and technical quality governance across the UrjaSetu platform. Every displayed number, engineering recommendation, and planning interpretation has been audited against authoritative international and national engineering standards (IEC, BEE ECBC, EPRI, ASHRAE, USGS, Copernicus). 

Unsupported numerical claims and arbitrary binary thresholds have been corrected. An explicit 6-category Evidence Taxonomy has been integrated into server analytics, municipal dossiers, and Gemini Copilot grounding:
1. `SATELLITE_OBSERVATION`
2. `DETERMINISTIC_CALCULATION`
3. `VERIFIED_TECHNICAL_REFERENCE`
4. `GENERAL_ENGINEERING_GUIDANCE`
5. `AI_INTERPRETATION`
6. `UNVERIFIED_REQUIRES_ADDITIONAL_DATA`

---

## 2. Issues Discovered & Corrections Applied

### 2.1 Solar Photovoltaic Thermal Derating
- **Issue Discovered**: Preliminary implementation derived actual PV efficiency loss directly from satellite Land Surface Temperature (LST).
- **Physical Reality**: Satellite LST measures the radiometric skin surface temperature of the ground at overpass (~10:57 AM local solar time). It does NOT establish operating PV cell temperature ($T_{cell}$). In photovoltaic engineering, $T_{cell}$ is a function of plane-of-array irradiance ($G_{POA}$), ambient air temperature ($T_{amb}$), wind speed ($v_{wind}$), and module mounting thermal resistance (e.g., King/Sandia or Faiman thermal formulation).
- **Corrections Implemented**:
  - Removed direct calculations of actual PV efficiency derating from satellite LST.
  - Preserved the module maximum power temperature coefficient ($\gamma_{Pmp} = -0.35\% \text{ to } -0.45\%/^\circ\text{C}$ relative to $25^\circ\text{C}$ STC) as a `VERIFIED_TECHNICAL_REFERENCE` under **IEC 61215:2021** (Terrestrial photovoltaic modules - Design qualification and type approval) and the Sandia PV Array Performance Model (SAND2004-5235).
  - Explicitly disclosed that actual derating requires on-site weather monitoring (`UNVERIFIED_REQUIRES_ADDITIONAL_DATA`).
  - Elevated mounting structures ($\ge 0.8\,\text{m}$ ground clearance) categorized as `GENERAL_ENGINEERING_GUIDANCE` to promote convective sub-panel airflow.

### 2.2 EV Charging Station Infrastructure
- **Issue Discovered**: Preliminary recommendations implied that satellite LST determines internal battery pack temperatures and charging equipment operating states.
- **Physical Reality**: Satellite LST measures ground skin radiometry, not vehicle internal lithium-ion cell temperature, battery coolant loop status, or dispenser power converter thermal conditions.
- **Corrections Implemented**:
  - Ground thermal regime reported strictly as `SATELLITE_OBSERVATION`.
  - Cited **EPRI (Electric Power Research Institute) Report 3002016335** (DC Fast Charging Infrastructure Thermal Management) and **SAE J1772 / IEC 61851-23** as `VERIFIED_TECHNICAL_REFERENCE` regarding the parasitic energy draw of Battery Thermal Management Systems (BTMS) and thermal cycling on silicon carbide / IGBT inverter modules.
  - Solar PV canopies and permeable high-albedo pavers (IGBC Non-Roof Heat Island Reduction) categorized as `GENERAL_ENGINEERING_GUIDANCE`.

### 2.3 Urban Parks & Vegetation Interventions
- **Issue Discovered**: Preliminary implementation asserted hardcoded binary priority thresholds (`LST >= 48°C`, `NDVI < 0.35`) as "High Priority Greening Zones".
- **Physical Reality**: No peer-reviewed statutory standard establishes $48^\circ\text{C}$ LST or $0.35$ NDVI as a universal regulatory boundary for urban greening priority.
- **Corrections Implemented**:
  - Removed the arbitrary binary threshold classification.
  - Siting engine now presents continuous empirical observations of site LST and 30m NDVI directly alongside Pune study area statistical distributions (terrestrial mean NDVI $0.514$, mean LST $46.3^\circ\text{C}$).
  - Recommended native broadleaf canopy species (Neem, Peepal, Tamarind) referenced against the **Central Public Works Department (CPWD) Landscape Specifications** and the **Maharashtra Urban Forestry Manual** (`GENERAL_ENGINEERING_GUIDANCE`).

### 2.4 Building Envelope & Cool Roof Standards
- **Issue Discovered**: Preliminary text cited $\text{SRI} \ge 82$ as a mandatory requirement under Maharashtra ECBC and presented an unqualified 3% HVAC energy penalty.
- **Physical Reality**:
  - Under the statutory **Energy Conservation Building Code (ECBC 2017)** issued by the Bureau of Energy Efficiency (BEE), Ministry of Power, Govt. of India (Section 4.3.1.1 and Table 4.1), cool roofs on low-sloped roofs ($\le 9.5^\circ$) in Composite/Warm climates must achieve:
    - Minimum Initial Solar Reflectance: $\ge 0.70$ (ASTM E903 / C1549)
    - Minimum Initial Thermal Emittance: $\ge 0.75$ (ASTM C1371 / E408)
    - Minimum Solar Reflectance Index: $\text{SRI} \ge 78$ (ASTM E1980)
  - $\text{SRI} \ge 82$ is an advisory voluntary green building credit under **USGBC LEED v4 BD+C** and **IGBC Green New Buildings**, not a statutory bylaw mandate.
  - The 3% rule of thumb originates from air-cooled chiller condensing unit design (ASHRAE Handbook - Fundamentals), which relates to entering ambient air dry-bulb temperature, not satellite roof skin surface temperature.
- **Corrections Implemented**:
  - Documented statutory BEE ECBC 2017 Table 4.1 minimums (Initial Reflectance $\ge 0.70$, Emittance $\ge 0.75$, $\text{SRI} \ge 78$) as `VERIFIED_TECHNICAL_REFERENCE`.
  - Clearly separated voluntary advisory targets ($\text{SRI} \ge 82$ for LEED/IGBC credits) from statutory requirements.
  - Qualified HVAC condenser efficiency degradation as an empirical rule of thumb for ambient entering air temperature, noting that satellite roof LST is skin temperature.

---

## 3. Satellite Data Quality Statistics Reconciliation

| Metric | Value | Numerator | Denominator | Spatial Scale & Mask | Physical Meaning |
|---|---|---|---|---|---|
| **Landsat Clear-Sky Ratio** | `99.98%` | 577,208 cells | 577,304 cells | Candidate boundary cells (30m); Landsat Collection 2 `QA_PIXEL` Bit 6 | Fraction of study area thermal cells free of cloud, shadow, and cirrus occlusion. |
| **Sentinel-2 Macro-Cell Observation Rate** | `89.84%` | 518,651 cells | 577,304 cells | Candidate boundary cells (30m); $\ge 1$ valid terrestrial 10m sub-pixel | Percentage of 30m target cells with valid aggregated NDVI (excludes river water, clouds, & negative reflectance). |
| **Sentinel-2 Mean Valid Footprint Fraction** | `70.20%` | $\sum \text{Area}_{valid}$ | $900\,\text{m}^2$ | Sub-pixel 10m area density within 30m target cells | Area-weighted terrestrial observation density per 30m cell across candidate boundary. |

*Resolution Reconciliation*: 89.84% represents the cell-level availability of non-null aggregated NDVI observations, whereas 70.20% represents the fine-grained area density of valid terrestrial sub-pixels within those 30m cells (the remaining 29.8% comprising water surfaces, negative reflectance, or shadow sub-pixels).

---

## 4. Raster Display & Spatial Alignment Audit

1. **Display Stretches vs Regulatory Categories**:
   - `pune_lst_overlay.png`: Normalized from $25.0^\circ\text{C}$ to $60.0^\circ\text{C}$ across 6 multi-stop RGBA gradient stops. Explicitly labeled in `HeatLayerControl.tsx` as a continuous visual display stretch, not a classified regulatory heat hazard zone.
   - `pune_ndvi_overlay.png`: Normalized from $-0.20$ to $+0.85$. Explicitly labeled as a continuous surface spectral reflectance ratio $(\text{NIR}-\text{Red})/(\text{NIR}+\text{Red})$, not tree canopy coverage.
2. **Transparency vs Candidate Boundary**:
   - The delivered raster products cover the regional study window of $1012 \times 871$ pixels ($30.36\,\text{km} \times 26.13\,\text{km}$).
   - Raster alpha transparency ($\alpha = 0$) represents fill and NoData values (Landsat fill DN=0 or missing Sentinel-2 coverage), NOT geometric clipping to the candidate boundary.
   - The candidate boundary polygon is an analytical mask for regional summary statistics.

---

## 5. Evidence Taxonomy & Transparency Contract

Every engineering recommendation is tagged with an evidence classification:
- **`SATELLITE_OBSERVATION`**: Instantaneous radiometric skin measurements from authoritative spaceborne sensors (Landsat 9 TIRS-2, Sentinel-2B MSI).
- **`DETERMINISTIC_CALCULATION`**: Exact mathematical transformations (USGS calibration equations, 4x4 matrix overlap aggregation, WGS84-to-UTM43N projection).
- **`VERIFIED_TECHNICAL_REFERENCE`**: Codified statutory codes and engineering standards (BEE ECBC 2017, IEC 61215:2021, EPRI 3002016335, ASHRAE Handbook).
- **`GENERAL_ENGINEERING_GUIDANCE`**: Established architectural and civil engineering best practices (elevated PV open racking, EV canopy shading, native tree selection).
- **`AI_INTERPRETATION`**: Synthesis generated by Gemini Cloud AI or Local GIS Rules Engine.
- **`UNVERIFIED_REQUIRES_ADDITIONAL_DATA`**: Essential engineering inputs that cannot be measured from satellite radiometry alone (on-site weather station measurements, plane-of-array irradiance, cadastral 7/12 land revenue extracts).

---

## 6. Verification & Test Evidence

### 6.1 Automated Vitest Test Suite
- **Total Test Files**: 27 passed (27 / 27)
- **Total Tests**: 233 passed (233 / 233)
- **New Scientific Validation Suite** (`tests/unit/scientific-governance-validation.test.ts`):
  - `does not calculate actual PV efficiency loss directly from satellite LST`: PASSED
  - `distinguishes EV charging ground LST from battery core operating conditions`: PASSED
  - `evaluates urban park greening without arbitrary binary priority thresholds`: PASSED
  - `cites statutory BEE ECBC 2017 Table 4.1 for cool roofs and distinguishes advisory SRI 82`: PASSED
  - `reconciles satellite data quality statistics with distinct, explicit denominators`: PASSED
  - `generates grounded Local Copilot responses reflecting statutory ECBC and PV physics`: PASSED

### 6.2 TypeScript Compilation
```bash
$ npm run typecheck
> urjasetu@0.1.0 typecheck
> tsc --noEmit
# 0 errors across entire repository
```

### 6.3 Live Endpoints Probing
- `POST /api/heat` at `(73.8567, 18.5204)`: Returns exact LST $46.0^\circ\text{C}$ ($\pm 2.11\,\text{K}$), NDVI $0.327$ ($100\%$ source coverage, $100\%$ validity), and SCL 5 (`Bare Soil / Low Vegetation`) in $< 1\,\text{ms}$.
- `GET /api/copilot?diagnostic=true`: Returns `status: "CONNECTED"` across all 5 diagnostic stages.
- `GET /data/heat/pune_lst_overlay.png` and `pune_ndvi_overlay.png`: Return HTTP 200 with exact RGBA byte lengths.

---

## 7. Remaining Scientific Limitations

1. **Instantaneous Morning Observation**: Landsat 9 and Sentinel-2 overpasses occur between 10:55 AM and 11:00 AM local solar time. Satellite data capture morning clear-sky radiative skin conditions; they do not capture late-afternoon peak temperatures ($~3:00\,\text{PM}$) or nocturnal canopy heat retention.
2. **Skin vs Ambient Air Temperature**: Radiative LST differs significantly from ambient 2m dry-bulb air temperature depending on surface albedo, thermal mass, and atmospheric turbulence. In-situ Automatic Weather Stations (AWS) are required for microclimate simulation.
3. **Spectral Reflectance vs Canopy Architecture**: NDVI measures chlorophyll absorption and near-infrared scattering; it does not measure vertical forest canopy height or Leaf Area Index (LAI).
4. **Cadastral & Right-of-Way Demarcation**: Siting analysis relies on 1D OpenStreetMap road centerlines and candidate Prabhag ward polygons. Statutory approval under Maharashtra UDCPR 2020 requires physical ground demarcation and Mahabhulekh 7/12 land revenue extracts.
