# UrjaSetu Video Facts, Verified Metrics & Claim Boundaries

> **Purpose:** Canonical fact register for video voiceovers, demo scripts, jury presentations, and technical slide decks.  
> **Rule:** Every fact must have an exact verified value and cited source. Never invent numbers.  

---

## 1. Verified Fact Register

| Fact / Metric | Exact Value | Source File & Field | Verification Status | Allowed Script Wording |
| :--- | :--- | :--- | :---: | :--- |
| **Grid Cell Count** | `8,303` | `public/data/priority/cells.json` (root array length) | **VERIFIED** | "A uniform spatial grid of 8,303 250-meter cells covering the Pune Municipal Corporation." |
| **Cell Dimensions & Area** | `250m × 250m` (`6.25 hectares`) | `public/data/priority/model_card.json` (`spatial_resolution.cell_size_meters`, `cell_area_hectares`) | **VERIFIED** | "Each cell represents 6.25 hectares at 250-meter resolution." |
| **Study Area Bounds** | `[73.731787, 18.385364, 74.018537, 18.621772]` (EPSG:4326) | `scripts/pipeline/build_dataset.py` (`DEFAULT_PUNE_BBOX`), `model_card.json` | **VERIFIED** | "Bounded by Pune Municipal Corporation administrative limits in UTM Zone 43N." |
| **Landsat 9 Acquisition Date** | `2023-04-22 05:27:00 UTC` | `public/data/priority/model_card.json` (`dates.landsat9_overpass`) | **VERIFIED** | "Clear-sky Landsat 9 thermal infrared observation from 22 April 2023." |
| **Landsat 9 Sensor** | `TIRS-2 Band 10` (100m native resampled to 30m) | `public/data/priority/model_card.json` (`sources[0].name`) | **VERIFIED** | "USGS Landsat 9 Collection 2 Level 2 surface temperature from TIRS-2 Band 10." |
| **Sentinel-2B Acquisition Date** | `2023-04-24 05:32:00 UTC` | `public/data/priority/model_card.json` (`dates.sentinel2b_overpass`) | **VERIFIED** | "Copernicus Sentinel-2B multispectral pass from 24 April 2023." |
| **Sentinel-2B Sensor & Bands** | `MSI Level-2A BOA` (Bands B04 Red & B08 NIR, 10m native) | `public/data/priority/model_card.json` (`sources[1].name`) | **VERIFIED** | "10-meter bottom-of-atmosphere reflectance from Sentinel-2B Bands 4 and 8." |
| **Held-Out Validation Scene** | `2024-04-24 05:27:15 UTC` (`LC09_L2SP_147047_20240424_02_T1`) | `public/data/priority/model_card.json` (`dates.held_out_scene_date`) | **VERIFIED** | "Temporal generalizability evaluated on a held-out Landsat 9 scene from 24 April 2024." |
| **Spatial-CV RMSE** | `0.91°C` | `public/data/priority/model_card.json` (`metrics.rmse_celsius`) | **VERIFIED** | "5-fold spatial-block cross-validation RMSE of 0.91°C." |
| **Spatial-CV MAE** | `0.61°C` | `public/data/priority/model_card.json` (`metrics.mae_celsius`) | **VERIFIED** | "5-fold spatial-block cross-validation MAE of 0.61°C." |
| **Spatial-CV R² Score** | `0.70` | `public/data/priority/model_card.json` (`metrics.r2_score`) | **VERIFIED** | "Spatial cross-validation R-squared of 0.70." |
| **Spatial Blocks Count & Size** | `136 blocks`, `~2.0 km size` | `public/data/priority/model_card.json` (`metrics.spatial_blocks_count`, `metrics.spatial_block_size_km`) | **VERIFIED** | "136 independent 2-kilometer spatial blocks to eliminate spatial autocorrelation leakage." |
| **Held-Out Scene RMSE** | `0.96°C` | `public/data/priority/model_card.json` (`metrics.held_out_scene_rmse_celsius`) | **VERIFIED** | "Maintains 0.96°C RMSE on temporal held-out scenes." |
| **Bootstrap Ensemble Members** | `30` | `public/data/priority/model_card.json` (`metrics.ensemble_members`) | **VERIFIED** | "30-member spatial-block bootstrap ensemble estimating parameter uncertainty." |
| **Unconstrained Direction Gate** | `95.9% negative response` (7,962 / 8,302 cells) | `public/data/priority/model_card.json` (`direction_check.unconstrained_negative_response_pct`) | **VERIFIED** | "95.9% of cells exhibit negative LST response to vegetation increase without monotone constraints." |
| **Direction Gate Violations** | `0` (Status: `PASSED_PHYSICAL_CONSISTENCY`) | `public/data/priority/model_card.json` (`direction_check.violations_count`, `direction_check.status`) | **VERIFIED** | "Zero physical direction violations across the production ensemble." |
| **Default Demo Budget Input** | `25.0 hectares` | `src/components/pages/HeatPlannerPage.tsx` (`initialReq.budget_ha`) | **VERIFIED** | "Default municipal planning scenario specifies a 25-hectare greening budget." |
| **Default Result: Allocated Area** | `24.69 hectares` | `src/server/priority/optimizer.ts` (`optimizeInterventionBudget`) | **VERIFIED** | "Packs 24.69 unbuilt hectares strictly within the 25.0-hectare limit." |
| **Default Result: Selected Zones** | `11 zones` | `src/server/priority/optimizer.ts` (`optimizeInterventionBudget`) | **VERIFIED** | "Allocates 11 highest-efficiency priority candidate zones." |
| **Default Result: People Covered** | `14,489 citizens` | `src/server/priority/optimizer.ts` (`optimizeInterventionBudget`) | **VERIFIED** | "Directly covers 14,489 residents [Assumed ambient population]." |
| **Default Result: Mean Cooling** | `-13.28°C` | `src/server/priority/optimizer.ts` (`optimizeInterventionBudget`) | **VERIFIED** | "Delivers an average modeled surface cooling benefit of -13.28°C." |
| **Default Result: Uncertainty Range** | `-13.03°C to -13.55°C` (P10–P90) | `src/server/priority/optimizer.ts` (`optimizeInterventionBudget`) | **VERIFIED** | "10th to 90th percentile ensemble parameter spread spans -13.03°C to -13.55°C." |
| **Default Result: Robustness** | `100% selection frequency` | `src/server/priority/optimizer.ts` (`optimizeInterventionBudget`) | **VERIFIED** | "100% selection stability across all 30 Monte Carlo ensemble runs." |
| **Solar Empirical Gamma ($\gamma$)** | `-0.533 %/°C` | `public/data/priority/solar_model_card.json` (`temperature_penalty.gamma_derating_per_celsius`) | **VERIFIED** | "Empirical regression reveals utility PV derating of -0.533%/°C." |
| **Solar 90% Confidence Interval** | `[-0.744, -0.295] %/°C` | `public/data/priority/solar_model_card.json` (`temperature_penalty.gamma_confidence_interval_90`) | **VERIFIED** | "90% bootstrap confidence interval spans -0.744 to -0.295%/°C." |
| **Solar Datasheet Nominal Rating** | `-0.380 %/°C` | `public/data/priority/solar_model_card.json` (`temperature_penalty.datasheet_coefficient_per_celsius`) | **VERIFIED** | "Exceeds standard manufacturer datasheet rating of -0.380%/°C due to balance-of-system losses." |
| **Solar Thermal Coupling ($\alpha$)** | `0.50` (Range: `[0.2, 0.8]`), Status: `Assumed` | `public/data/priority/solar_model_card.json` (`temperature_penalty.coupling_factor_alpha`) | **VERIFIED** | "Assumed thermal coupling factor of alpha = 0.5 (range 0.2 to 0.8)." |
| **Solar SCADA Dataset Origin** | Gandikota, Andhra Pradesh, India (34 days: `2020-05-15 to 2020-06-17`) | `public/data/priority/solar_model_card.json` (`training_dates`, `dataset_location`) | **VERIFIED** | "Trained on 34 days of SCADA data from utility solar plants in Gandikota, Andhra Pradesh." |
| **Green Loss Baseline Season** | `March–May 2019` (4 Sentinel-2 scenes) | `public/data/priority/green_loss.json` (`metadata.seasons.baseline_season`) | **VERIFIED** | "Baseline pre-monsoon dry season from March to May 2019." |
| **Green Loss Comparison Season** | `March–May 2026` (4 Sentinel-2 scenes) | `public/data/priority/green_loss.json` (`metadata.seasons.current_season`) | **VERIFIED** | "Pre-monsoon dry season composite from March to May 2026." |
| **Green Loss Decision Rule** | $\Delta\text{NDVI} \le -0.10$ AND $\Delta\text{NDBI} > 0$ | `public/data/priority/green_loss.json` (`metadata.thresholds`) | **VERIFIED** | "Loss flagged only when NDVI drops by 0.10 or more and NDBI increases." |
| **Green Loss Flagged Parcels** | `2,449 cells` (`6,904.85 hectares`) | `public/data/priority/green_loss.json` (`metadata.total_loss_cells`, `metadata.total_loss_area_ha`) | **VERIFIED** | "Flags 2,449 parcels representing 6,904.85 hectares of vegetation loss." |
| **Green Loss Validation Status** | `"Not yet validated against high-res cadastre"` | `public/data/priority/green_loss.json`, `docs/STATUS.md` | **VERIFIED** | "Satellite-detected spectral loss; field survey ground truthing is pending." |
| **Municipal Wards Evaluated** | `23 administrative wards` | `public/data/priority/ward_summary.json` (root array length) | **VERIFIED** | "Aggregated across all 23 PMC municipal administrative wards." |

---

## 2. Claims We CAN Make (Audited & Supported)

1. **Empirical Satellite Observation:** We CAN claim direct radiometric skin temperature observations from USGS/NASA Landsat 9 TIRS-2 Band 10 and 10m Sentinel-2 optical reflectance.
2. **Leakage-Free Spatial Validation:** We CAN claim 5-fold cross-validation partitioned into 136 contiguous ~2.0 km blocks, achieving an RMSE of 0.91°C (R² = 0.70) and temporal held-out RMSE of 0.96°C.
3. **Genuine Physical Gate Pass:** We CAN claim that 95.9% of Pune cells exhibit cooling response to vegetation increase without mathematical monotone constraints, confirming thermodynamic consistency.
4. **Parameter Spread vs Systematic Error:** We CAN claim that the 30-member ensemble P10–P90 spread isolates model parameter uncertainty, while systematic observational error is bounded by the Spatial-CV RMSE (±0.91°C).
5. **Strict Budget Allocation:** We CAN claim that the greedy knapsack optimizer enforces strict budget constraints (e.g. 24.69 ha packed for a 25.0 ha budget) without exceeding user limits.
6. **Empirical Solar Derating:** We CAN claim that empirical regression on Gandikota SCADA records reveals a -0.533%/°C derating slope (90% CI: [-0.744, -0.295]), showing real utility losses ~40% steeper than nominal datasheet ratings (-0.380%/°C).
7. **Coupled Solar Penalty:** We CAN claim relative photovoltaic efficiency derating (%) driven by local heat excess under a transparent user-adjustable coupling parameter ($\alpha \in [0.2, 0.8]$).
8. **Multi-Temporal Canopy Watch:** We CAN claim that 2,449 cells exhibited pre-monsoon NDVI decline ($\le -0.10$) with simultaneous built-up index rise between 2019 and 2026.
9. **Full Epistemic Labeling:** We CAN claim that every single metric in the interface and exported dossier carries an explicit [Measured], [Modelled], or [Assumed] tag.

---

## 3. Claims We MUST NOT Make (Forbidden & Unsubstantiated)

1. **NO Ambient Air Temperature:** We MUST NOT claim that our satellite LST readings represent 2-meter ambient air temperature or human physiological heat stress (Wet Bulb Globe Temperature).
2. **NO 3D Tree Canopy or Biomass:** We MUST NOT claim that Sentinel-2 NDVI measures 3D tree volume, crown architecture, tree count, or physical pedestrian shading.
3. **NO Causal Proof:** We MUST NOT claim that our regression tree models prove formal counterfactual causation; they capture empirical geospatial associations.
4. **NO Absolute Solar kWh or CO2 for Pune:** We MUST NOT claim absolute kWh solar generation, rupee savings, or CO2 offset tonnes for Pune rooftops. The solar model was trained on Gandikota utility plants and models *relative percentage efficiency loss only*.
5. **NO Invented Rupee Costs:** We MUST NOT claim exact monetary intervention costs (e.g. ₹X per hectare). UrjaSetu operates strictly in unbuilt hectares.
6. **NO Ground-Truth Cadastral Guarantee:** We MUST NOT claim that Green Loss Watch is field-verified. It is satellite spectral change detection, transparently tagged *"Not yet validated against high-res cadastre"*.
7. **NO Census-Exact Population:** We MUST NOT claim population figures are exact municipal census counts. Ambient resident population is downscaled from 2022 WorldPop projections based on built footprint density and tagged **[Assumed]**.
8. **NO Legal Cadastral Boundaries:** We MUST NOT claim that ward assignments are legal cadastral boundaries. Cells are assigned to administrative wards based on proximity to nearest municipal ward-office centroids.
