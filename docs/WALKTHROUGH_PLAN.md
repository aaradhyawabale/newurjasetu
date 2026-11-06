# UrjaSetu In-App Walkthrough Plan

## Executive Overview
The UrjaSetu In-App Walkthrough provides an interactive, evidence-backed tour of Pune's heat intelligence and climate action platform. It guides municipal planners, technical reviewers, and challenge evaluators through the scientific pipeline, optimization engine, and decision tools without modifying real municipal plans.

## Route-to-Chapter Mapping
| Chapter ID | Title | Route | Steps | Est. Duration | Target Elements (`data-tour`) |
|---|---|---|---|---|---|
| `ch0_big_picture` | The Big Picture | `/walkthrough` | 4 | 80s | `walkthrough-map`, `walkthrough-tools`, `walkthrough-flow`, `walkthrough-limits` |
| `ch1_reading_numbers` | Reading the Numbers | `/method` | 4 | 80s | `method-truth-chips`, `method-cv-error`, `method-surface-vs-air`, `method-limits` |
| `ch2_heat_planner` | Heat Intelligence Planner | `/heat-planner` | 11 | 220s | `heat-layer-selector`, `heat-budget-slider`, `heat-ndvi-slider`, `heat-ward-filter`, `heat-run-button`, `heat-summary-strip`, `heat-map`, `heat-zone-drawer`, `heat-compare-scenario`, `heat-dossier-button`, `heat-limits` |
| `ch3_green_loss` | Green Loss Watch | `/green-loss` | 5 | 100s | `greenloss-header`, `greenloss-metrics`, `greenloss-map`, `greenloss-ward-table`, `greenloss-limits` |
| `ch4_interventions` | Intervention Scenarios | `/interventions` | 5 | 100s | `interventions-comparison`, `interventions-cost-inputs`, `interventions-cooling-chips`, `interventions-recommendation`, `interventions-limits` |
| `ch5_green_cover` | Green Cover Plan | `/green-cover` | 4 | 80s | `greencover-header`, `greencover-list`, `greencover-filters`, `greencover-limits` |
| `ch6_infrastructure` | Infrastructure Upgrades | `/infrastructure` | 4 | 80s | `infra-header`, `infra-hospitals`, `infra-transit`, `infra-limits` |
| `ch7_solar` | Solar & Shadow Simulator | `/solar` | 6 | 120s | `solar-simulator`, `solar-penalty-tab`, `solar-gamma`, `solar-alpha-slider`, `solar-derate-curve`, `solar-limits` |
| `ch8_plans` | Municipal Climate Plans | `/plans` | 4 | 80s | `plans-list`, `plans-save-version`, `plans-forward`, `plans-limits` |
| `ch9_method` | Method & Validation Gate | `/method` | 5 | 100s | `method-model-card`, `method-direction-gate`, `method-cross-validation`, `method-sources`, `method-limits` |

Total Steps: 52 steps across 10 chapters.

## Stable `data-tour` UI Element Targets
### Global & Layout Targets
- `nav-walkthrough`: Main navigation walkthrough link
- `first-visit-banner`: Quiet dismissible on-boarding banner
- `landing-hero-walkthrough`: "Take the walkthrough" secondary button in hero

### Walkthrough Hub (`/walkthrough`)
- `walkthrough-map`: Inline SVG platform map diagram
- `walkthrough-tools`: Tools grid connecting engine components
- `walkthrough-flow`: Municipal workflow sequence indicator
- `walkthrough-start-all`: "Start from the beginning" button
- `walkthrough-resume`: "Resume" button
- `walkthrough-restart`: "Restart" button

### Heat Intelligence Planner (`/heat-planner`)
- `heat-layer-selector`: Heat Burden / Surface Temp / Vegetation / Population / Green Loss chips
- `heat-budget-slider`: Greening Budget Target (ha) input slider
- `heat-ndvi-slider`: Target vegetation index (NDVI) slider
- `heat-ward-filter`: Geographic Scope / Ward selector dropdown
- `heat-run-button`: Run greedy optimization button
- `heat-summary-strip`: Summary metrics (Priority Zones, People Benefiting, Est. Surface Cooling, Plan Robustness)
- `heat-map`: MapLibre 250m cell raster/vector layer
- `heat-zone-drawer`: Selected zone evidence dossier drawer
- `heat-compare-scenario`: Scenario B comparison toggle and side-by-side controls
- `heat-dossier-button`: PDF evidence export button
- `heat-add-to-plan`: Add zone to municipal plan action button

### Green Loss Watch (`/green-loss`)
- `greenloss-header`: Page header and status indicator
- `greenloss-metrics`: Net verified vegetation loss in hectares
- `greenloss-map`: Multi-year Sentinel/Landsat change layer
- `greenloss-ward-table`: Ward-level loss and verification table
- `greenloss-restore-action`: Restore-first priority filter

### Intervention Scenarios (`/interventions`)
- `interventions-comparison`: Greening vs cool roofs vs solar shade matrix
- `interventions-cost-inputs`: Municipal cost parameter inputs
- `interventions-cooling-chips`: Modelled vs Not Modelled cooling indicators
- `interventions-recommendation`: Ranked intervention recommendation card

### Green Cover Plan (`/green-cover`)
- `greencover-header`: Page header and guidance
- `greencover-list`: Priority greening locations and corridors
- `greencover-filters`: Ward and intervention filter controls

### Infrastructure Upgrades (`/infrastructure`)
- `infra-header`: Critical infrastructure resilience overview
- `infra-hospitals`: Hospital heat vulnerability list
- `infra-transit`: Bus depot and transit cooling shelters

### Solar & Shadow Simulator (`/solar`)
- `solar-simulator`: Suncalc geometric shadow projection workspace
- `solar-penalty-tab`: Solar Heat Penalty empirical regression tab
- `solar-gamma`: Empirical temperature penalty coefficient gamma
- `solar-alpha-slider`: Urban microclimate coupling factor alpha slider
- `solar-derate-curve`: Module efficiency loss curve

### Municipal Climate Plans (`/plans`)
- `plans-list`: Portfolio of saved municipal plans
- `plans-save-version`: Version snapshot creation control
- `plans-forward`: Departmental forwarding dialog

### Method & Validation Gate (`/method`)
- `method-model-card`: Architecture and spatial CV RMSE metrics
- `method-direction-gate`: Unconstrained negative response rate gate
- `method-cross-validation`: Spatial block cross-validation details
- `method-sources`: Satellite sensor overpass metadata and licensing

## Content Rules & Token Resolution
1. **Dynamic Tokens**: Every numeric metric in walkthrough copy is resolved from loaded runtime data (`{{model.cv_rmse_c}}`, `{{model.ensemble_members}}`, `{{solar.gamma}}`, `{{solar.alpha_default}}`, etc.).
2. **Fallback**: If a token cannot be resolved, the containing sentence is omitted or falls back to `"Not available"`.
3. **No Raw Digits in Copy**: Content lint tests enforce that no bare digits exist in chapter copy outside token interpolations and step counters.
4. **Vocabulary Invariants**:
   - "surface temperature", never "air temperature" (except when explaining the distinction).
   - "associated with", never "caused by".
   - NDVI is a "vegetation index", never "canopy".
   - Four provenance chips strictly: `Measured`, `Modelled`, `Assumed`, `Input`.
5. **Two Depths**:
   - Simple: Maximum 45 words.
   - Technical: Maximum 90 words.
6. **Honest Limits Step**: Every chapter concludes with an explicit "Limits" step outlining scope boundaries and assumptions.
