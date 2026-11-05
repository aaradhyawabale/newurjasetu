# URJASETU: Comprehensive Computational Model Architecture & Inventory Audit

**Audit Date:** 2026-11-05  
**Auditor Roles:** Principal Machine Learning Engineer, Geospatial Data Scientist, Climate Modelling Researcher, Statistical Validation Expert, Software Test Engineer & Scientific Auditor.  
**Platform Evaluated:** UrjaSetu Decision-Support Platform (Pune / PCMC / NMC parameterization).  
**Scientific Directives Enforced:**
1. Surface temperature ($LST$) is radiometric skin temperature, NOT 2m ambient air temperature.
2. $NDVI$ is a spectral chlorophyll reflection ratio, NOT 3D canopy cover or architectural tree shade.
3. No arbitrary weighted composite scores in scientific predictions.
4. Unknown values stay null and render as "Not available".
5. Every displayed or computed parameter is strictly tagged as **Measured**, **Modelled**, or **Assumed**.

---

## 1. Executive Computational Model Inventory

The UrjaSetu codebase incorporates eight distinct computational, statistical, geospatial, and AI engines:

| Engine / Model | Mathematical / Algorithmic Foundation | Input Features | Primary Targets / Outputs | Primary Source / Dataset | Implementation File(s) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Urban Heat Ensemble** | LightGBM / Gradient-Boosted Trees with Monotone Constraints + 30-member Spatial Bootstrap | $NDVI$, $NDBI$, $NDWI$, $BuiltFrac$, $Elevation$, $DistToWater$ | Radiometric $LST$ ($^\circ\text{C}$), Marginal cooling response ($\Delta T/\text{ha}$) | USGS Landsat-9 TIRS-2, Copernicus S2 L2A BOA, GLO-30 DEM | `scripts/pipeline/train_model.py`, `src/server/priority/loader.ts` |
| **2. Solar PV Thermal Derating** | Empirical Gradient-Boosted Regressor with Whole-Day Temporal Holdout | $Irradiation$ ($\text{kW/m}^2$), $ModuleTemp$ ($^\circ\text{C}$) | $AC\_Power$ ($\text{kW}$), Efficiency Loss $\%/\Delta 10^\circ\text{C}$ | Kaggle Gandikota Solar Plant 1 & 2 SCADA (34 days) | `scripts/pipeline/solar_temp_model.py`, `public/data/priority/solar_model_card.json` |
| **3. Greedy Cooling Budget Optimizer** | Greedy Knapsack Heuristic with Monte Carlo Ensemble Robustness (30 runs) | Budget ($\text{ha}$), Target $NDVI$, Candidate Cell subset | Allocated cells, Total ha, Selection frequency ($0.0 - 1.0$) | Precomputed 250m priority cells, binary ensemble buffer | `src/server/priority/optimizer.ts` |
| **4. Green Loss Watch** | Dual-Index Bi-Temporal Change Detection ($\Delta NDVI < -\theta \land \Delta NDBI > 0$) | Sentinel-2 B4, B8, B11 median composites (2019 vs 2026) | Loss confirmation boolean, Loss area ($\text{ha}$), Extra heat ($^\circ\text{C}$) | Sentinel-2 L2A BOA (Planetary Computer STAC) | `scripts/pipeline/green_loss.py`, `public/data/priority/green_loss.json` |
| **5. Multi-Criteria Siting Engine** | Geometric Buffer Analysis, 100-Point Piecewise Scoring, Negative Setback Screening | Point/Polygon geometry, OSM vectors, Overpass API, Open-Meteo, NASA POWER | Feasibility boolean, 0–100 suitability score, Hard conflict list | OpenStreetMap via Overpass API, NASA POWER, Open-Meteo | `src/server/analysis-engine/engine.ts`, `validation.ts`, `scoring.ts` |
| **6. Bridge Crossing Planner** | Perpendicular Vector Projection, Line Intersection, IRC Road Hierarchy Gate | Dual riverbank LineStrings, bridge length/width, OSM road classes | Crossing candidates, Abutment coordinates, Approach road corridors | OSM Waterways & Highways, IRC:SP:73 / IRC:SP:84 | `src/server/analysis-engine/bridge-planner.ts` |
| **7. Solar Shadow Simulator** | NOAA Astronomical Position Algorithm (Meeus) + 2.5D Ray-Casting Trigonometry | Lat, Lon, Timestamp, Building footprint polygons, Heights | Ground shadow polygon, Shading fraction $\%$, Obstruction loss | OpenStreetMap building heights / storeys, Jean Meeus equations | `src/server/solar/solar-position.ts`, `shadow-engine.ts` |
| **8. Gemini AI Grounding & Tools** | Gemini 2.0 Function Calling + Strict Numerical Tool Grounding Gate + Zod Validation | User text prompt, live spatial context, function call responses | Grounded municipal synthesis, zero-hallucination answers | Server endpoints (`/api/optimize`, `/api/zone/[id]`) | `src/server/ai/gemini-advisor.ts` |

---

## 2. Detailed Technical & Mathematical Audit by System

### 2.1. LightGBM Urban Heat Prediction Ensemble

#### Problem Solved
Estimates the counterfactual radiometric skin cooling effect ($\Delta LST$) resulting from increasing vegetation density ($NDVI$) on available greenable land within 250m urban grid cells.

#### Mathematical Formulation
1. **Regression Function:**
   $$LST_i = f(NDVI_i, NDBI_i, NDWI_i, Built_i, Elevation_i, DistWater_i) + \epsilon_i$$
2. **Monotone Thermodynamic Constraints:**
   $$\frac{\partial f}{\partial NDVI} \le 0, \quad \frac{\partial f}{\partial NDBI} \ge 0, \quad \frac{\partial f}{\partial NDWI} \le 0, \quad \frac{\partial f}{\partial Built} \ge 0, \quad \frac{\partial f}{\partial Elevation} \le 0$$
3. **Counterfactual Cooling ($\Delta T$):**
   $$\Delta T_i = \text{median}_{m \in [1, 30]} \left[ f_m(\mathbf{x}_i^{\text{baseline}}) - f_m(\mathbf{x}_i^{\text{intervened}}) \right]$$
   where:
   $$NDVI_i^{\text{intervened}} = \min(0.85, NDVI_i + \text{GreenableFrac}_i \cdot (\text{TargetNDVI} - NDVI_i))$$
4. **Direction Check Gate:**
   $$\text{Gate Passed} \iff \forall i \in \text{ValidCells}, \quad \Delta T_i \ge 0$$
   If any physical violation ($\Delta T_i < 0$) is detected, the gate fails and all cooling predictions are set to `null` to avoid misleading municipal planning.

#### Training & Validation Methodology
- **Spatial Block Cross-Validation:** The study area is divided into $2.0 \times 2.0\text{ km}$ spatial blocks (`get_spatial_block_id`). 5-fold CV splits data by entire blocks, ensuring zero adjacent pixel leakage between training and validation folds.
- **Ensemble Generation:** 30 independent bootstrap models trained on block-level resampled data (`random.choices(unique_blocks)`).

#### Assumptions & Scientific Limitations
- **Radiometric LST vs. Air Temperature:** The model predicts surface radiometric skin temperature at ~10:45 AM local solar overpass. It does **not** model nocturnal urban heat island (UHI) intensity or 2-meter ambient air temperature.
- **NDVI vs. Canopy Architecture:** Does not differentiate between low turf grass, shrubs, and deep 3D tree canopy volume.

---

### 2.2. Solar Photovoltaic Thermal Derating Model

#### Problem Solved
Quantifies the efficiency degradation penalty suffered by crystalline silicon photovoltaic (PV) modules due to local microclimatic urban heat excess.

#### Mathematical Formulation
1. **Empirical Power Function:**
   $$P_{AC} = g(G, T_{\text{mod}}) + \epsilon$$
   where $G$ is solar irradiance ($\text{kW/m}^2$) and $T_{\text{mod}}$ is module temperature ($^\circ\text{C}$).
2. **Standard Benchmark Temperature Derating:**
   $$\Delta P_{\%}(+10^\circ\text{C}) = \frac{g(G=0.8, T_{\text{mod}}=55^\circ\text{C}) - g(G=0.8, T_{\text{mod}}=45^\circ\text{C})}{g(G=0.8, T_{\text{mod}}=45^\circ\text{C})} \times 100$$
3. **Local Grid Derating Application:**
   $$\text{Penalty}_i = \text{ExcessHeat}_i \times \frac{\Delta P_{\%}(+10^\circ\text{C})}{10.0}$$
   where $\text{ExcessHeat}_i = \max(0.0, LST_i - LST_{\text{city\_median}})$.

#### Training & Validation Methodology
- **Dataset:** 68,000+ 15-minute SCADA measurements across 34 calendar days (May 15 – June 17, 2020) from two utility plants (Gandikota Plant 1 & 2).
- **Whole-Day Holdout:** Train/test split holds out entire calendar days (7 whole days held out out of 34, ~20%). Random row splitting is explicitly forbidden to prevent intraday temporal autocorrelation leakage.
- **Observed Metrics:** $R^2 = 0.995$, $\text{RMSE} = 20.1\text{ kW}$ on Plant 1; $R^2 = 0.994$, $\text{RMSE} = 25.2\text{ kW}$ on Plant 2.
- **Derived Derating:** Mean penalty of $-5.33\%$ per $+10^\circ\text{C}$ (P10: $-7.44\%$, P90: $-2.95\%$, bootstrap $N=30$), consistent with physical silicon temperature coefficients ($\gamma \approx -0.35\%$ to $-0.55\%/^\circ\text{C}$).

#### Assumptions & Scientific Limitations
- **Not Absolute kWh:** UrjaSetu restricts outputs strictly to **relative percentage loss**. It explicitly refuses to fabricate absolute kWh values for Pune cells because site-specific rooftop slope, azimuth, inverter clipping, and soiling indices are unmeasured.
- **Skin Temp vs Module Temp:** Uses surface radiometric temperature excess as a proxy for localized microclimatic thermal stress.

---

### 2.3. Greedy Cooling Budget Optimization Engine

#### Problem Solved
Selects an optimal subset of 250m grid cells to intervene on (tree planting, green corridors) under a strict hectare budget constraint.

#### Mathematical Formulation
1. **Objective Functions:**
   - Thermal Cooling Only:
     $$\max_{S \subseteq C} \sum_{i \in S} \Delta T_i \quad \text{s.t.} \quad \sum_{i \in S} \text{Area}_i \le B$$
   - Population-Weighted Thermal Relief:
     $$\max_{S \subseteq C} \sum_{i \in S} \left( \Delta T_i \times \frac{\text{Pop}_i}{1000} \right) \quad \text{s.t.} \quad \sum_{i \in S} \text{Area}_i \le B$$
2. **Greedy Heuristic Selection:**
   Computes the benefit density ratio:
   $$r_i = \frac{\text{Benefit}_i}{\text{Area}_i}$$
   Sorts candidates descending by $r_i$ and greedily packs cells into budget $B$.
3. **Monte Carlo Ensemble Selection Frequency:**
   Repeats greedy packing across all 30 ensemble members:
   $$\text{SelectionFrequency}_i = \frac{1}{30} \sum_{m=1}^{30} \mathbb{I}(i \in S_m)$$

#### Scientific Audit Finding: Heuristic vs. Global Optimum
The greedy ratio sort is an approximation for the NP-hard 0-1 Knapsack problem. When item weights ($\text{Area}_i$) are non-uniform and the budget is tight, the greedy packing can stop short of the global optimum (see verification tests in Section 4). 
*Classification:* Scientifically sound heuristic approximation; cannot be labelled a "mathematically proven global optimum."

---

### 2.4. Sentinel-2 Green Loss Watch Pipeline

#### Problem Solved
Detects multi-year urban canopy loss between 2019 and 2026 pre-monsoon seasons (March–May) and estimates the resulting localized thermal penalty.

#### Mathematical Formulation
1. **Bi-Temporal Spectral Indices:**
   $$NDVI = \frac{B08 - B04}{B08 + B04}, \quad NDBI = \frac{B11 - B08}{B11 + B08}$$
2. **Dual-Condition Change Detection:**
   $$\text{IsLoss}_i \iff (\Delta NDVI_i \le -\theta_{\text{loss}}) \land (\Delta NDBI_i > 0)$$
   where default $\theta_{\text{loss}} = 0.10$.
   *Scientific Purpose of $\Delta NDBI > 0$:* Excludes agricultural crop harvesting or seasonal fallow cycles. Vegetation loss is only flagged when accompanied by an increase in built/impervious surface or bare soil exposure.
3. **Extra Surface Heat Estimation:**
   $$\text{ExtraHeat}_i = f(\mathbf{x}_i^{\text{2026}}) - f(\mathbf{x}_i^{\text{counterfactual with 2019 NDVI}})$$
   If the thermodynamic direction check fails, $\text{ExtraHeat}$ is automatically set to `null`.

---

### 2.5. Multi-Criteria Infrastructure Siting Engine

#### Problem Solved
Assesses the spatial suitability and regulatory feasibility of installing point infrastructure (EV charging stations, solar arrays, health clinics, schools, parks, substations) and linear infrastructure (roads, canals, drainage).

#### Mathematical Formulation
1. **Piecewise Scoring:**
   $$S = \sum_{k} w_k \cdot s_k(v_k), \quad \sum_k w_k = 1.0, \quad s_k \in [0, 100]$$
2. **Hard Mandatory Constraints (Kill-Switch):**
   $$\text{Feasible} \iff \forall c \in \text{Constraints}, \quad \text{Dist}(p, c_{\text{hazard}}) \ge \text{BufferThreshold}_c$$
   If an EV station or school intersects a high-tension power line buffer (<10m) or active water body buffer (<30m), the score is capped or flagged as **UNFAVORABLE** regardless of high demand scores.
3. **Suitability Bands:**
   - $\ge 80$: **Optimal**
   - $65 - 79$: **Acceptable**
   - $50 - 64$: **Suboptimal**
   - $< 50$ or constraint breach: **Constrained / Unfavorable**

---

### 2.6. Bridge Crossing Geometry Planner

#### Problem Solved
Evaluates proposed bridge centerlines across rivers, checks abutment compatibility with the connected municipal road hierarchy, and recommends geometric crossing candidates.

#### Mathematical Formulation
1. **Road Hierarchy Compatibility:**
   Enforces Indian Road Congress guidelines (IRC:SP:73 / IRC:SP:84 / IRC:5):
   A bridge with width $W \ge 12\text{m}$ (dual-lane or 4-lane) cannot discharge into a pedestrian alley, living street, or narrow service corridor (`MINOR_ALLEY_CLASSES`).
2. **Dual-Bank Connection:**
   Calculates perpendicular distances from both bridge abutment terminals ($A, B$) to candidate road centerlines. A bridge is classified as `fully_connected` if both abutments lie within $\le 25\text{m}$ of a compatible road class.

---

### 2.7. 3D Solar Shadow Simulator

#### Problem Solved
Calculates solar shadow casting from adjacent building footprints onto potential rooftop or ground-mount solar arrays across seasons.

#### Mathematical Formulation
1. **Solar Geometry (NOAA / Jean Meeus):**
   Computes solar declination ($\delta$), equation of time ($EoT$), hour angle ($H$), solar elevation ($\alpha$), and solar azimuth ($\theta_s$).
2. **Trigonometric Ground Shadow Projection:**
   For a building of height $h$, each vertex $(x_v, y_v)$ projects a ground shadow vertex along the anti-solar azimuth:
   $$\Delta x = \frac{h}{\tan(\alpha)} \cdot \sin(\theta_s + 180^\circ)$$
   $$\Delta y = \frac{h}{\tan(\alpha)} \cdot \cos(\theta_s + 180^\circ)$$
3. **Clipping & Physical Boundaries:**
   - If $\alpha \le 0^\circ$ (night), shadow length is zero.
   - For grazing angles ($\alpha \to 0^\circ$), shadow length is physically clamped at $800\text{m}$ to prevent infinite projection artifacts.

---

### 2.8. Gemini AI Function Calling & Decision-Support Pipeline

#### Problem Solved
Provides executive synthesis and interactive Q&A for town planners without inventing facts or hallucinating unverified numbers.

#### Architectural Safeguards
1. **Tool Gate:** Gemini is equipped with real backend tools:
   - `run_optimization(budget_ha, target_ndvi)`
   - `get_zone(id)`
2. **Zero-Hallucination Policy:** Gemini system instructions mandate:
   *"You MAY ONLY quote numbers returned by tools or provided in verified GIS context. You are STRICTLY FORBIDDEN from inventing, fabricating, extrapolating, or guessing numerical values."*
3. **Deterministic Fallback:** If the Gemini API key is missing or calls time out (>15s), the system falls back to a deterministic, rule-based municipal advisory engine (`deterministicFallback()`).

---
