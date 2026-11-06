# UrjaSetu User Interface Map & Screen Reference

> **Documentation Purpose:** Complete inventory of application routes, visual layouts, interactive controls, data provenance chips, error states, and responsive screenshots.  
> **Screenshot Directory:** `docs/reference/screens/` (Verified 1920×1080 desktop and 390×844 mobile captures)  
> **Data Grounding:** State explicitly whether each route operates on authentic verified data artifacts or mock fallbacks.  

---

## 1. Global Navigation & Layout Architecture

The application layout (`src/components/layout/AppLayout.tsx` & `src/components/layout/SiteLayout.tsx`) wraps all client views:

### Layout Areas:
* **Top Navigation Bar:** Sticky header featuring the UrjaSetu brand mark, Pune Municipal Corporation scope subtitle, direct link to "Heat Planner", a "Climate Tools" dropdown menu (containing all 5 supporting tools), a link to "Method & Quality Gate", and a primary action button ("Open Heat Planner" or "Export Plan" when on `/heat-planner`).
* **Demo Banner:** If mock fallback occurs (`isDemoMode() === true`), a high-visibility amber banner appears across the top: *"UrjaSetu is running on synthetic demonstration data. Real satellite feeds and municipal records are loaded when connected to municipal infrastructure."* When real data is loaded, this banner remains hidden.
* **Footer Area:** Contains PMC statutory municipal caveats, data provenance methodology descriptions, links to all tools, and GitHub / Apache 2.0 open-source licensing.

---

## 2. Route Inventory & Detailed Specifications

---

### Route 1: Landing Page (`/`)

* **Primary Purpose:** Public civic-tech front door introducing Pune's urban heat challenge, explaining UrjaSetu's satellite AI approach, and offering 1-click entry into planning tools.
* **Code Location:** `src/app/page.tsx` rendering `src/components/pages/LandingPage.tsx`.
* **Data Mode:** **Real Data** (`public/data/priority/cells.json` and `public/data/priority/model_card.json`).

#### Visual Layout Areas:
1. **Hero Section:** Headline *"Where should Pune cool first?"*, verified pipeline badges (Landsat, Sentinel-2, 30-member ensemble), primary CTA button *"Start Planning Now"*, and a secondary link to *"Methodology"*.
2. **Interactive Map Preview:** Full-width MapLibre preview rendering the 8,303 250m cells of Pune colored by baseline heat burden.
3. **Core Workflow Cards:** 3 cards illustrating the planning progression: (1) Spot Microclimate Hotspots, (2) Optimize Planting Under Hectare Budget, (3) Download Committee Evidence Dossier.
4. **Supporting Tool Grid:** Direct access cards to Green Loss Watch, Intervention Scenarios, Green Cover Plan, Infrastructure Upgrades, and Solar Simulator.

#### Interactive Controls:
* `Start Planning Now` button: Navigates to `/heat-planner`.
* `View Scientific Method` button: Navigates to `/method`.
* Layer selector pills on map preview: Toggles between Burden, LST, and NDVI.
* Supporting tool cards: Direct navigation to respective tool routes.

#### Numbers Displayed & Provenance:
* `8,303` Priority cells [Modelled] — Source: `cells.json`.
* `30` Ensemble members [Modelled] — Source: `model_card.json (metrics.ensemble_members)`.
* `0.91°C` Spatial-CV RMSE [Modelled] — Source: `model_card.json (metrics.rmse_celsius)`.
* `95.9%` Unconstrained Gate Pass [Measured] — Source: `model_card.json (direction_check.unconstrained_negative_response_pct)`.

#### States:
* **Loading:** Full-width skeleton placeholder (`Skeleton`).
* **Empty / Error:** `ErrorState` card with a retry button.
* **Deep Links:** None.

#### Screenshots:
* **Desktop (1920×1080):** `docs/reference/screens/landing_1920x1080.png`
* **Mobile (390px):** `docs/reference/screens/landing_390px.png`

---

### Route 2: Heat Intelligence & Budget Planner (`/heat-planner`)

* **Primary Purpose:** Flagship municipal planning workspace. Planners set unbuilt hectare budgets and target canopy indices to optimize cooling allocations across Pune's 8,303 cells, review zone uncertainty dossiers, and compare municipal scenarios.
* **Code Location:** `src/app/heat-planner/page.tsx` rendering `src/components/pages/HeatPlannerPage.tsx`.
* **Data Mode:** **Real Data** (Connects directly to `POST /api/optimize`, `public/data/priority/cells.json`, `public/data/priority/model_card.json`, and `public/data/priority/ensemble_effects.bin`).

#### Visual Layout Areas:
1. **Top Sub-Header:** Progress stepper strip (`ProgressStrip.tsx`) showing 4 steps: (1) Explore heat stress, (2) Set planting budget, (3) Review optimal portfolio, (4) Compare scenarios.
2. **Left Scenario Panel (`ScenarioPanel.tsx`):**
   * Budget presets: "Micro (5 ha)", "Ward (10 ha)", "Priority (25 ha)", "City (40 ha)".
   * Fine-tune slider: 1 to 100 hectares.
   * Target canopy selector: 0.45 (Light), 0.55 (Moderate), 0.65 (Dense), 0.75 (Urban Forest).
   * Ward filter dropdown: City-wide or any of the 23 PMC administrative wards.
   * Primary action: *"Run Optimization"* button with spinner.
3. **Center MapLibre Canvas (`MapView.tsx`):**
   * Renders 8,303 250m cells with dynamic quantile color ramp (Viridis/Magma).
   * Layer control toggle: Heat Burden, Surface Temp (LST), Vegetation (NDVI), Solar Heat Penalty.
   * Highlight line around cells selected by the knapsack optimizer.
4. **Bottom Portfolio Summary Bar (`PortfolioSummary.tsx`):**
   * Total zones allocated, exact hectares packed, citizens protected, mean cooling effect with P10–P90 spread.
5. **Slide-Over Zone Evidence Drawer (`EvidenceDrawer.tsx`):**
   * Opens when any cell is clicked on the map or selected via deep link.
   * Detailed breakdown: LST [Measured], NDVI [Measured], Predicted Cooling [Modelled], Population [Assumed], Nearest Ward [Modelled].
   * Satellite scene dates (Landsat 9: 2023-04-22, Sentinel-2B: 2023-04-24).
   * Action button: *"Download 2-Page Committee Dossier (PDF)"*.
6. **Scenario B Compare Modal (`ScenarioCompareModal.tsx`):**
   * Triggered by Step 4 or the "Compare" button in the scenario panel.
   * Side-by-side comparison of Scenario A (e.g. 25 ha) vs Scenario B (e.g. 40 ha).
7. **Climate Copilot Dock (`CopilotDock.tsx`):**
   * Persistent floating dock in bottom-right corner (`⌘J` or click).
   * Real-time conversational assistant citing model statistics and optimization results.

#### Interactive Controls:
* Budget Slider & Presets: Updates `budgetHa` state.
* Target Canopy Selector: Sets `targetNdvi`.
* Ward Dropdown: Scopes optimizer and executes `map.fitBounds` to ward extent.
* `Run Optimization` Button: Executes `POST /api/optimize` (sub-50ms).
* Cell click on map: Opens `EvidenceDrawer` with deep link sync.
* `Export Plan` in header: Generates executive PDF report.
* `Download PDF Dossier` in drawer: Downloads signed zone evidence PDF.
* `Compare Scenarios` toggle: Opens Scenario B comparison view.

#### Numbers Displayed & Provenance:
* `24.69 ha` Allocated [Modelled] — Source: `POST /api/optimize (allocated_ha)`.
* `11` Priority zones [Modelled] — Source: `POST /api/optimize (selected_cells.length)`.
* `14,489` Citizens protected [Assumed] — Source: Sum of `cell.population`.
* `-13.28°C` Mean cooling [Modelled] — Source: Average of `cooling_mean`.
* `-13.03°C to -13.55°C` P10–P90 spread [Modelled] — Source: Ensemble bootstrap bounds.
* `100%` Robustness frequency [Modelled] — Source: Monte Carlo ensemble selection frequency.
* `±0.91°C` Spatial-CV RMSE badge [Modelled] — Source: `model_card.json`.

#### States:
* **Default Load State:** Automatically executes 25.0 ha optimization on load so the screen is immediately populated with verified results.
* **Zone Selected State:** Map zooms to selected cell; right drawer slides out displaying full audit trail.
* **Scenario B State:** Side-by-side modal opens showing marginal return curves.
* **Copilot Open State:** Floating chat drawer expands with starter question prompts.
* **Deep Link:** `/heat-planner?cell=cell_250m_2313` loads the page and immediately opens the evidence drawer for that cell.

#### Screenshots:
* **Default Result Desktop (1920×1080):** `docs/reference/screens/heat_planner_default_1920x1080.png`
* **Default Result Mobile (390px):** `docs/reference/screens/heat_planner_default_390px.png`
* **Zone Selected Desktop (1920×1080):** `docs/reference/screens/heat_planner_zone_selected_1920x1080.png`
* **Zone Selected Mobile (390px):** `docs/reference/screens/heat_planner_zone_selected_390px.png`
* **Scenario B Comparison Modal Desktop (1920×1080):** `docs/reference/screens/heat_planner_scenario_b_comparison_1920x1080.png`
* **Scenario B Comparison Modal Mobile (390px):** `docs/reference/screens/heat_planner_scenario_b_comparison_390px.png`
* **Copilot Open Desktop (1920×1080):** `docs/reference/screens/heat_planner_copilot_open_1920x1080.png`
* **Copilot Open Mobile (390px):** `docs/reference/screens/heat_planner_copilot_open_390px.png`

---

### Route 3: Green Loss Watch (`/green-loss`)

* **Primary Purpose:** Monitors multi-temporal Sentinel-2 pre-monsoon composites (2019 vs 2026) across 8,303 cells to detect significant canopy reduction, rank affected wards, and launch targeted restoration plans.
* **Code Location:** `src/app/green-loss/page.tsx` rendering `src/components/pages/GreenLossPage.tsx`.
* **Data Mode:** **Real Data** (`public/data/priority/green_loss.json`, `public/data/priority/ward_summary.json`).

#### Visual Layout Areas:
1. **Header & Quality Gate Banner:** Headline *"Green Loss Watch"*, multi-temporal dates (Mar–May 2019 vs Mar–May 2026), and validation status badge: *"Not yet validated against high-res cadastre"*.
2. **Left Control & Ward Table Panel:**
   * Tab switcher: "Ward Overview" vs "Protect & Restore".
   * Ranked table of the 23 PMC administrative wards sorted by loss area (hectares).
   * *"Plan Restoration Here"* action button per ward.
3. **Center Map Canvas:** MapLibre view highlighting the 2,449 loss parcel cells in high-contrast red/amber hatching over satellite basemap.
4. **Cell Details Drawer:** Displays cell NDVI drop ($\Delta\text{NDVI} \le -0.10$), NDBI increase, estimated extra heat (+0.81°C mean), and Google Earth inspection link.

#### Interactive Controls:
* Ward Table Rows: Clicking any ward filters map and highlights affected loss parcels.
* `Plan Restoration Here` Button: Pre-scopes the `/heat-planner` optimizer to that ward.
* Tab Switcher: Toggles between general loss overview and restore budget slider.

#### Numbers Displayed & Provenance:
* `2,449` Loss parcels flagged [Modelled] — Source: `green_loss.json (metadata.total_loss_cells)`.
* `6,904.85 ha` Total loss area [Modelled] — Source: `green_loss.json (metadata.total_loss_area_ha)`.
* `23` PMC wards evaluated [Modelled] — Source: `ward_summary.json`.
* `-0.205` Mean $\Delta\text{NDVI}$ of flagged cells [Measured] — Source: `green_loss.json (metadata.sensitivity_table[0])`.

#### Screenshots:
* **Desktop (1920×1080):** `docs/reference/screens/green_loss_1920x1080.png`
* **Mobile (390px):** `docs/reference/screens/green_loss_390px.png`

---

### Route 4: Intervention Scenarios (`/interventions`)

* **Primary Purpose:** Evaluates site-level intervention alternatives (Urban Forestry, Cool Roofs, Solar Canopies) for 24 real civic sites in Pune based on heat mitigation score, implementation complexity, and co-benefits.
* **Code Location:** `src/app/interventions/page.tsx` rendering `src/components/pages/InterventionsPage.tsx`.
* **Data Mode:** **Real Candidate Sites** (`/api/interventions/candidates` & official PMC registers; intervention cost scenarios use deterministic standard rules with mock fallback).

#### Visual Layout Areas:
1. **Header:** Title *"Intervention Scenarios"*, facility filter tabs (All, Hospitals, Gardens, Transit Corridors).
2. **Left Site Selector:** Ranked list of 24 civic sites with heat burden rank, baseline surface temperature, and estimated footprint.
3. **Right Comparison Grid:** Side-by-side cards comparing 3 intervention archetypes: (1) Dense Urban Forestry, (2) High-Albedo Cool Roof, (3) Photovoltaic Solar Shade Canopy. Each card details cooling impact (°C), structural feasibility, and co-benefits.

#### Interactive Controls:
* Facility Filter: Filters list by site category.
* Site Selection: Loads site-specific microclimate profile and intervention matrix.
* `Export Analysis Report` Button: Exports multi-criteria assessment PDF.

#### Numbers Displayed & Provenance:
* `24` Verified civic opportunity sites [Measured/Modelled] — Source: PMC infrastructure registers.
* `38.5°C to 44.0°C` Baseline LST range [Measured] — Source: Landsat-9 overlay.
* `-1.5°C to -3.8°C` Predicted intervention cooling [Modelled] — Source: Intervention physics engine.

#### Screenshots:
* **Desktop (1920×1080):** `docs/reference/screens/interventions_1920x1080.png`
* **Mobile (390px):** `docs/reference/screens/interventions_390px.png`

---

### Route 5: Green Cover Plan (`/green-cover`)

* **Primary Purpose:** Assembles a municipal green corridor and park upgrade plan under an explicit hectare budget constraint. Planners pick sites into an intervention basket and monitor total area, population served, and vegetation gap reduction.
* **Code Location:** `src/app/green-cover/page.tsx` rendering `src/components/pages/GreenCoverPage.tsx`.
* **Data Mode:** **Real Candidate Sites** (24 PMC sites + 8,303 cell background; basket state managed client-side).

#### Visual Layout Areas:
1. **Header & Basket Counter:** Hectare budget slider (10 to 60 ha), current basket counter (`2 sites selected`), total hectares allocated.
2. **Left Ranked Opportunities List:** Park upgrade and green corridor candidates ranked by population served per greenable hectare.
3. **Right Map & Basket Panel:** Interactive map showing candidate locations and a sticky basket summary with "Add to Plan" / "Remove" actions.

#### Interactive Controls:
* Budget Slider: Adjusts municipal greening limit.
* `Add to Basket` / `Remove` toggle: Updates selected intervention basket.
* `Clear Basket`: Resets portfolio.

#### Numbers Displayed & Provenance:
* `30.0 ha` Default budget [Assumed] — Source: User slider state.
* `3.50 ha` Currently allocated [Modelled] — Source: Sum of basket site footprints.
* `12,800` Citizens in buffer [Assumed] — Source: WorldPop 2022 ambient buffer.

#### Screenshots:
* **Desktop (1920×1080):** `docs/reference/screens/green_cover_1920x1080.png`
* **Mobile (390px):** `docs/reference/screens/green_cover_390px.png`

---

### Route 6: Infrastructure Upgrades (`/infrastructure`)

* **Primary Purpose:** Screens critical civic facilities (PMC general hospitals, dispensaries, bus transit depots, public gardens) against hyper-local heat island exposure and provides an audit checklist for emergency shade and misting readiness.
* **Code Location:** `src/app/infrastructure/page.tsx` rendering `src/components/pages/InfrastructurePage.tsx`.
* **Data Mode:** **Real Civic Facilities** (PMC official hospital and garden registers + Landsat-9 LST grid).

#### Visual Layout Areas:
1. **Header & Facility Category Filter:** Hospitals, Transit Depots, Civic Gardens, All Facilities.
2. **Facility Master Table:** Ranked by heat vulnerability with ward name, resident catchment, and baseline LST.
3. **Heat Audit Checklist Panel:** Interactive readiness checkboxes: Structural audit completed, Rooftop solar ready, Pedestrian bays shaded, Misting stations active, Drinking water access verified.

#### Interactive Controls:
* Facility Type Filter: Filters list by facility category.
* Facility Selection: Updates audit checklist panel.
* Checklist Checkboxes: Interactive state tracking for municipal engineering inspections.

#### Numbers Displayed & Provenance:
* `41.8°C` Baseline facility LST [Measured] — Source: Landsat-9 TIRS-2 Band 10.
* `22,400` Patient/resident catchment [Assumed] — Source: Ambient population buffer.

#### Screenshots:
* **Desktop (1920×1080):** `docs/reference/screens/infrastructure_1920x1080.png`
* **Mobile (390px):** `docs/reference/screens/infrastructure_390px.png`

---

### Route 7: Solar & Shadow Simulator (`/solar`)

* **Primary Purpose:** Dual-mode clean energy climate tool: (1) Browser-side 3D geometric solar shadow simulator (`SunCalc`), and (2) Empirical photovoltaic heat derating model coupling local heat excess to relative efficiency loss.
* **Code Location:** `src/app/solar/page.tsx` rendering `src/components/pages/SolarSimulatorPage.tsx`.
* **Data Mode:** **Real Empirical Model** (`public/data/priority/solar_model_card.json` + `public/data/priority/cells.json`).

#### Visual Layout Areas:
1. **Header & Tab Switcher:** Toggles between "3D Shadow Simulator" and "Solar Heat Penalty".
2. **Tab 1: Shadow Simulator:**
   * Sliders: Day of year (1–365), Time of day (6:00 to 18:00), Panel tilt (0–45°), Panel azimuth (0–360°), Obstacle height (1–30m), Obstacle distance.
   * Real-time calculation of Sun Altitude, Sun Azimuth, Shadow Length (m), and Shading Status (Unshaded vs Obstructed).
3. **Tab 2: Solar Heat Penalty:**
   * Alpha ($\alpha$) coupling slider: 0.2 to 0.8 (default: **0.5**, tagged **[Assumed]**).
   * Comparative card: Empirical derating ($\gamma = -0.533\%/^\circ\text{C}$, 90% CI: [-0.744, -0.295]) vs Datasheet derating ($\gamma = -0.380\%/^\circ\text{C}$).
   * Ranked table of Pune cells with highest solar heat penalty (% efficiency loss from local heat excess).

#### Interactive Controls:
* Tab Switcher: Toggles Shadow vs Heat Penalty modes.
* Alpha Coupling Slider: Dynamically recalculates cell solar penalties: $\text{Penalty} = \gamma \times \alpha \times \Delta T_{\text{excess}}$.
* Shadow Sliders: Real-time geometric projection using browser-side `SunCalc`.

#### Numbers Displayed & Provenance:
* `-0.533 %/°C` Empirical gamma [Modelled] — Source: `solar_model_card.json (temperature_penalty.gamma_derating_per_celsius)`.
* `-0.744 to -0.295 %/°C` 90% CI [Modelled] — Source: `solar_model_card.json (temperature_penalty.gamma_confidence_interval_90)`.
* `-0.380 %/°C` Datasheet rating [Assumed] — Source: `solar_model_card.json (temperature_penalty.datasheet_coefficient_per_celsius)`.
* `0.50` Alpha coupling [Assumed] — Source: User slider state.
* `-2.41%` Mean cell PV output derating [Modelled] — Source: Calculated from cell heat excess.

#### Screenshots:
* **Desktop (1920×1080):** `docs/reference/screens/solar_1920x1080.png`
* **Mobile (390px):** `docs/reference/screens/solar_390px.png`

---

### Route 8: Method & Quality Gate (`/method`)

* **Primary Purpose:** Public transparency and scientific disclosure page for SDG 13 competition judges, municipal auditors, and peer researchers.
* **Code Location:** `src/app/method/page.tsx` rendering `src/components/pages/MethodPage.tsx`.
* **Data Mode:** **Real Data** (`public/data/priority/model_card.json` and `public/data/priority/solar_model_card.json`).

#### Visual Layout Areas:
1. **Primary Model Card Card:** Task description, framework (Standalone Gradient Boosted Trees), 5-fold Spatial-CV RMSE (0.91°C), R² (0.70), 136 spatial blocks.
2. **Quality Gate Section:** Status of the Unconstrained Diagnostic Direction Gate (**PASSED_PHYSICAL_CONSISTENCY**, 95.9% negative response rate), with explicit disclosure of null-out failure behavior.
3. **Solar SCADA Model Card:** Gandikota utility dataset description, 34-day operational coverage, empirical vs datasheet derating comparison, and alpha coupling explanation.
4. **Epistemic Limitations Matrix:** Full text of the 10 documented scientific limitations and disclaimers.

#### Interactive Controls:
* Sensor Manifest Collapsible: Toggles Landsat 9 and Sentinel-2 acquisition scene IDs.
* Gate Audit Trail: Displays exact validation code and mathematical formulation.

#### Numbers Displayed & Provenance:
* `0.91°C` Spatial-CV RMSE [Modelled] — Source: `model_card.json`.
* `0.70` Spatial-CV R² [Modelled] — Source: `model_card.json`.
* `0.96°C` Held-out Scene RMSE [Modelled] — Source: `model_card.json`.
* `95.9%` Unconstrained negative response rate [Measured] — Source: `model_card.json`.
* `30` Bootstrap ensemble members [Modelled] — Source: `model_card.json`.
* `-0.533 %/°C` Empirical solar gamma [Modelled] — Source: `solar_model_card.json`.

#### Screenshots:
* **Desktop (1920×1080):** `docs/reference/screens/method_1920x1080.png`
* **Mobile (390px):** `docs/reference/screens/method_390px.png`
