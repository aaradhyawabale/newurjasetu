# UrjaSetu Project Brief: Climate Intelligence & Heat Budget Planner

> **Document Type:** Executive Technical Brief & Chat Handover  
> **Jurisdiction:** Pune Municipal Corporation (PMC), Maharashtra, India  

---

## 1. What UrjaSetu Is (In Three Sentences)

UrjaSetu is an open civic-tech platform that identifies where Pune Municipal Corporation (PMC) should invest limited greening budgets to maximize urban cooling. Combining 30m Landsat-9 thermal radiometry with 10m Sentinel-2 optical imagery across 8,303 spatial cells (250m resolution), it replaces arbitrary indices with a gradient-boosted tree model predicting local cooling returns. Planners set an unbuilt planting budget in hectares, and a Monte Carlo knapsack optimizer allocates priority zones with spatial-block uncertainty bounds, transparent provenance tags, and zero invented cost figures.

---

## 2. The Problem and Users

* **The Problem:** Rapid urbanization in Pune has exacerbated microclimatic urban heat islands (UHI), driving land surface temperatures (LST) above 44°C during pre-monsoon heat waves. Greening funds are constrained and historically allocated using intuition or opaque composite scores. Planners lacked an empirical tool to forecast thermodynamic cooling before spending municipal capital.
* **Primary Users:**
  1. **Town Planners (PMC):** Allocating urban forestry budgets under the Pune Climate Action Plan.
  2. **Ward Officers & Prabhags:** Reviewing local thermal burden and defending neighborhood intervention dossiers.
  3. **SDG 13 Evaluators:** Auditing whether public investments deliver verifiable, equitable cooling outcomes.
  4. **Clean Energy Engineers:** Evaluating how localized heat island spikes degrade rooftop PV efficiency across wards.

---

## 3. Main Product: Heat Intelligence + Budget Planner

The core workflow (`/heat-planner`) guides users through a 4-step decision pipeline:

1. **Explore Baseline Heat Stress:** Users inspect an interactive map of Pune discretised into 8,303 uniform 250m cells (6.25 ha each). A layer switcher toggles between Heat Burden (population × thermal excess), Surface Temperature (LST, Landsat-9), Vegetation Index (NDVI, Sentinel-2), and Solar Heat Penalty.
2. **Define Municipal Scenario:** Users set an available planting budget in hectares (default: **25.0 ha**, presets: 5, 10, 25, 40 ha) and select a target vegetation index (NDVI: **0.50** light to **0.75** dense forest). The optimizer can run city-wide across all 23 PMC administrative wards or filter to a specific ward.
3. **Run Knapsack Optimization:** Clicking *"Run Optimization"* executes a greedy knapsack packing algorithm across 8,303 cells in under 50ms. Candidate cells are ranked by cooling benefit per hectare. Monte Carlo resampling across a 30-member ensemble evaluates selection stability (0–100% robustness frequency).
4. **Inspect Portfolio & Zone Dossier:** The summary bar reports total zones allocated, exact hectares packed (**24.69 ha** for a 25 ha budget), citizens protected (**14,489**), and mean cooling (**-13.28°C**, P10–P90 spread: **-13.03°C to -13.55°C**). Clicking any cell opens the *Zone Evidence Drawer*, displaying raw sensor observations, spatial block uncertainty, satellite acquisition dates, and a button to export a signed 2-page PDF committee dossier.
5. **Compare Scenarios:** Users can toggle *Scenario B* (e.g., 40.0 ha vs 25.0 ha) to inspect side-by-side marginal cooling returns and additional population covered.

---

## 4. AI & Quantitative Components in Plain English

* **The Core Cooling Model:** A gradient-boosted regression tree pipeline trained on 100m grid aggregations. It predicts LST from 6 features: `ndvi`, `ndbi` (built-up), `ndwi` (water), `built_frac` (impervious surface from OSM), `elevation` (Copernicus DEM), and `dist_to_water`.
* **Validation & Metrics:** Evaluated using **5-Fold Spatial-Block CV** with 136 spatial blocks (~2.0 km size) to prevent autocorrelation leakage: **RMSE = 0.91°C**, **MAE = 0.61°C**, **R² = 0.70**. On a held-out temporal scene (2024-04-24): **RMSE = 0.96°C**.
* **Diagnostic Quality Gate:** An unconstrained diagnostic model tests whether d(LST)/d(NDVI) is empirically negative. **95.9% of Pune cells** (7,962 of 8,302) exhibit negative temperature response without monotone constraints. If this gate fails (<80%), all cooling predictions are nulled out.
* **30-Member Ensemble:** 30 spatial-block bootstrap models compute 10th (P10) and 90th (P90) percentile bounds, isolating model variance from systematic error (CV RMSE = ±0.91°C).
* **Counterfactual Estimator:** Replaces current NDVI with target NDVI over unbuilt surface while holding built footprint, elevation, and water proximity constant.
* **Climate Copilot:** Assistant powered by Google Gemini (with offline deterministic GIS fallback). Using tool calling (`run_optimization`, `get_zone`), it cites verified model statistics without hallucinating unobserved attributes.

---

## 5. Supporting Climate Tools

1. **Green Loss Watch (`/green-loss`):** Monitors multi-temporal Sentinel-2 pre-monsoon composites (2019 vs 2026) across 8,303 cells. Flags parcels where NDVI dropped >= 0.10 while NDBI increased (2,449 cells flagged, 6,904.85 ha loss) with a 1-click ward restoration filter.
2. **Intervention Scenarios (`/interventions`):** Evaluates multi-criteria alternatives (Forestry, Cool Roofs, Solar Canopies) for 24 real civic sites in Pune.
3. **Green Cover Plan (`/green-cover`):** Focuses on green corridors and park upgrades, allowing planners to assemble an intervention basket under a hectare budget.
4. **Infrastructure Upgrades (`/infrastructure`):** Screens critical public facilities (hospitals, bus depots) against heat vulnerability with structural and shade readiness checklists.
5. **Solar & Shadow Simulator (`/solar`):** Combines browser 3D shadow simulation (`SunCalc`) with an empirical PV heat derating model and adjustable thermal coupling (α = 0.2–0.8).
6. **Method & Quality Gate (`/method`):** Public transparency page exposing complete model cards, sensor dates, empirical vs datasheet derating, gate logs, and safeguards.

---

## 6. Data Sources and Acquisition Dates

* **USGS / NASA Landsat 9:** TIRS-2 Band 10 surface temperature; primary: **2023-04-22 05:27 UTC**; held-out: **2024-04-24 05:27 UTC**.
* **Copernicus Sentinel-2B:** Level-2A BOA reflectance Bands B04 & B08; primary: **2023-04-24 05:32 UTC**; Green Loss composites: Mar–May 2019 & Mar–May 2026.
* **OpenStreetMap (OSM):** Vector building footprints and roads for impervious surface fractions.
* **WorldPop / Census of India:** 100m ambient resident population downscaled to 2022 projections.
* **PMC Administrative Data:** 23 official municipal ward boundaries and municipal ward-office centroids.
* **Gandikota Solar SCADA Dataset:** Generation and module temperature records (34 days: **2020-05-15 to 2020-06-17**) from two utility solar plants in Andhra Pradesh.

---

## 7. The Measured / Modelled / Assumed System

Every variable in the UI, API, and PDF dossier carries an explicit provenance tag:

* **[Measured]:** Direct instrument readings from calibrated sensors (Landsat-9 LST mean, Sentinel-2 NDVI, observation counts).
* **[Modelled]:** Derived from mathematical models or GIS transforms (cooling prediction, spatial CV RMSE, knapsack allocation, solar derating penalty, greenable hectares).
* **[Assumed]:** External parameters, user inputs, or proxy estimates (budget slider values, 2022 ambient population, nearest-office ward assignment, solar thermal coupling coefficient α = 0.5).

---

## 8. Honest Scientific Limitations

1. **LST is NOT Air Temperature:** Radiometric surface skin temperature from satellite thermal infrared sensors does not equal 2m ambient air temperature or human physiological heat stress (WBGT).
2. **NDVI is NOT 3D Canopy Cover:** Sentinel-2 NDVI measures spectral chlorophyll reflectance, not 3D tree crown volume or physical shading.
3. **No Rupee or Cost Invented:** The platform operates strictly in hectares. No fabricated rupee-per-hectare figures are used.
4. **No Absolute Solar Generation for Pune:** The empirical solar penalty model derives from Andhra Pradesh utility data. It models *relative percentage efficiency derating* only; it never predicts absolute kWh or CO2 savings for Pune rooftops.
5. **Centroid Ward Assignment:** 250m cells are assigned to wards based on nearest administrative centroid, not micro-cadastral parcel boundaries.

---

## 9. Feature Implementation Status Matrix

| Module / Feature | Implemented | Partial | Demo / Mock | Missing / Gaps | Verification Evidence |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **8,303 Grid Discretization** | **Yes** | — | — | — | Complete UTM 43N Pune coverage in `public/data/priority/cells.json`. |
| **Cooling Optimizer (Knapsack)** | **Yes** | — | — | — | Sub-50ms greedy packing in `src/server/priority/optimizer.ts`. |
| **Spatial-Block CV Model** | **Yes** | — | — | — | 136 blocks, RMSE=0.91°C, R²=0.70 documented in `model_card.json`. |
| **Unconstrained Diagnostic Gate** | **Yes** | — | — | — | Verified: 95.9% negative response rate; cooling nulls out on failure. |
| **Zone PDF Dossier Export** | **Yes** | — | — | — | 2-page PDF via `pdf-lib` with exact coordinates and disclaimers. |
| **Green Loss Watch** | **Yes** | — | — | — | Multi-temporal 2019 vs 2026 Sentinel-2 composite across 8,303 cells. |
| **Green Loss Field Validation** | — | — | — | **Missing** | 45-cell visual review set generated; field survey pending ("Not yet validated"). |
| **Empirical Solar Derating** | **Yes** | — | — | — | γ = -0.533%/°C from Gandikota SCADA; relative penalty only. |
| **Alpha Thermal Coupling** | **Yes** | — | — | — | User slider (0.2–0.8, default 0.5) scaling heat excess to module derating. |
| **AI Copilot (Gemini)** | **Yes** | — | — | — | Cloud Gemini integration with real function calling + local GIS fallback. |
| **Interventions & Green Cover** | — | **Partial** | Fallback | — | 24 authentic candidate sites; secondary costs use mock fallback if offline. |
| **Multi-City Siting Extension** | — | **Partial** | — | — | Pune complete; PCMC and Nashik boundaries exist in GIS without 250m heat cells. |
