# UrjaSetu Redesign Integration Plan

This plan specifies the architecture and mapping for replacing the previous UI with the redesigned frontend from `urjasetu---pune-heat-intelligence-&-climate-planner.zip`, integrating it with the existing Next.js 14 backend and data pipelines while preserving all tests and scientific governance rules.

---

## 1. Route Mapping (New Pages to Next.js App Router)

| Route | New Component | Target App Router File | Description |
|---|---|---|---|
| `/` | `LandingPage` | `src/app/page.tsx` | Redesigned landing page with live heat burden minimap, 3-step decision flow, and tools |
| `/heat-planner` | `HeatPlannerPage` | `src/app/heat-planner/page.tsx` | Primary Heat Intelligence Planner & Budget Knapsack Optimizer |
| `/green-loss` | `GreenLossPage` | `src/app/green-loss/page.tsx` | Sentinel-2 canopy depletion & 23 PMC ward rankings |
| `/interventions` | `InterventionsPage` | `src/app/interventions/page.tsx` | Site-level cool roof, greening, and solar canopy comparisons |
| `/green-cover` | `GreenCoverPage` | `src/app/green-cover/page.tsx` | Urban green corridor network & municipal unbuilt parcels |
| `/infrastructure` | `InfrastructurePage` | `src/app/infrastructure/page.tsx` | Civic hospitals, transit hubs, and public facility thermal audits |
| `/solar` | `SolarSimulatorPage` | `src/app/solar/page.tsx` | Sun shadow simulator & Kaggle Gandikota PV derating model |
| `/method` | `MethodPage` | `src/app/method/page.tsx` | Primary and solar model cards, unconstrained gate, caveats |
| `/legacy` | `MainWorkspace` | `src/app/legacy/page.tsx` | Preserved original workspace with full manual siting GIS tools |
| `/legacy/method` | `LegacyMethodPage` | `src/app/legacy/method/page.tsx` | Preserved original methodology documentation |

---

## 2. Component Port List

### UI Primitives (`src/components/ui/`)
- `TruthChip.tsx`: Epistemic provenance badges (`[Measured]`, `[Modelled]`, `[Assumed]`) with distinct styling.
- `Button.tsx`: Accessible interactive button primitive.
- `Card.tsx`: Single-elevation container surface.
- `StatTile.tsx`: Provenance-aware metric tile with uncertainty labels.
- `ToolCard.tsx` & `ToolPageHeader.tsx`: Goal-oriented card headers and collapsible 3-step guides.
- `FeedbackStates.tsx`: Skeleton loaders, error states, and empty state fallbacks.
- `FormControls.tsx`: Accessible Sliders and Tab switchers.

### Planner Modules (`src/components/planner/`)
- `EvidenceDrawer.tsx`: Zone evidence inspection drawer with data provenance and dossier export link.
- `ProgressStrip.tsx`: 4-step decision progress indicator.
- `PortfolioSummary.tsx`: Aggregate impact strip showing area, population shielded, and ensemble confidence.
- `ScenarioPanel.tsx`: Hectare budget slider, target NDVI slider, and ward filters.
- `ScenarioCompareModal.tsx`: Side-by-side scenario comparison modal.
- `CopilotDock.tsx`: Floating climate advisory assistant.

### Layout & Navigation (`src/components/layout/` & `src/lib/`)
- `SiteLayout.tsx`: SiteHeader (with 3-zone layout and tools menu), SiteFooter, and DemoBanner.
- `nav.tsx`: Abstraction layer mapping `AppLink`, `useAppNavigate`, `useAppLocation`, and `useAppSearchParams` to Next.js `next/link` and `next/navigation`.

### Map Component (`src/components/map/MapView.tsx`)
- High-performance MapLibre GL 4.7 implementation (preserving project's existing MapLibre stack, without Leaflet dependency) rendering 8,303 cells with dynamic GPU fill expressions for `burden`, `lst`, `ndvi`, `population`, `loss`, and `selected`.

---

## 3. API & Data Contract Mapping (`src/api/contract.ts`)

| Client Function | Endpoint Constant | Real Backend Route / File | Response Adaptation & Provenance |
|---|---|---|---|
| `getCells()` | `ENDPOINTS.CELLS` | `/data/priority/cells.json` + `/data/priority/green_loss.json` | Returns 8,303 cells with LST `[Measured]`, NDVI `[Measured]`, Population `[Assumed]`, and solar derating `[Modelled]` |
| `getModelCard()` | `ENDPOINTS.MODEL_CARD` | `/api/model-card` (or `/data/priority/model_card.json`) | Maps `metrics.rmse_celsius` -> `cv_rmse_c`, `metrics.r2_score` -> `cv_r2`, `direction_check` -> `gate` |
| `getSolarModelCard()` | `ENDPOINTS.SOLAR_MODEL_CARD` | `/data/priority/solar_model_card.json` | Maps empirical $\gamma = -0.533\%/^\circ\text{C}$ (`gamma_pct_per_c`), CI $[-0.744, -0.295]$, datasheet $-0.380\%/^\circ\text{C}$, $\alpha=0.5$ |
| `optimize(req)` | `ENDPOINTS.OPTIMIZE` | `/api/optimize` (POST) | Runs 30-member Monte Carlo knapsack; client adapts `selected_cells` into `selected` and `totals` |
| `getZone(id)` | `ENDPOINTS.ZONE_DETAILS` | `/api/zone/[id]` | Returns individual cell observations, ensemble spread, and ward centroid |
| `getWardSummary()` | `ENDPOINTS.WARD_SUMMARY` | `/data/priority/ward_summary.json` | 23 PMC administrative wards with verified canopy loss area and affected population |
| `getSites(kind?)` | `ENDPOINTS.SITES` | `/api/interventions/candidates` | Civic hospitals, transit hubs, and parks from dynamic spatial discovery |
| `compareInterventions(id)` | `ENDPOINTS.INTERVENTIONS` | `/api/interventions/compare` | Compares cool roofs, greening, and shade canopies for candidate parcel |
| `getDossierUrl(id)` | `ENDPOINTS.DOSSIER_DOWNLOAD` | `/api/zone/${id}/dossier-pdf` | Authoritative 2-page publication-grade PDF evidence dossier |
| `askCopilot(msg, ctx)` | `ENDPOINTS.COPILOT` | `/api/copilot` (POST) | Local GIS engine + Google Gemini with contextual model metrics |

---

## 4. Gaps and Fallback Handling

1. **Financial Cost Estimates (INR Lakhs):**
   - The core GIS engine computes thermodynamic surface cooling and hectares; monetary intervention budgets are labelled `[Assumed]`.
2. **Historical Green Loss for Unaffected Parcels:**
   - Cells without detected loss between 2019 and 2026 keep `loss_ha` as `null` and render "Not available".
3. **Interactive Shadow Slicing:**
   - Evaluated client-side using standard astronomical solar geometry algorithms; absolute solar kWh is unpromised without structural balance-of-system design.
4. **Demo Banner Behavior:**
   - When real API data is successfully loaded, the banner is hidden automatically (`isDemoMode() === false`).
   - If any critical endpoint falls back to mock data or offline state, the banner is shown to maintain scientific honesty.
