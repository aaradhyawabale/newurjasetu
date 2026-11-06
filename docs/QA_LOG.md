# UrjaSetu Autonomous QA & Polish Log

## Defect Inventory & Status Matrix

| ID | Page | Severity | Status | Description | Fix & Verification Evidence |
|---|---|---|---|---|---|
| D1 | /heat-planner, maps | Blocker | Verified | Basemap displays Carto API key watermark error. | Replaced Carto with OpenFreeMap positron (`https://tiles.openfreemap.org/styles/positron`), environment variable override (`NEXT_PUBLIC_MAP_STYLE_URL`), OSM raster fallback, and blank canvas with attribution. Verified in MapView.tsx. |
| D2 | /heat-planner, maps | Major | Verified | Data layer pale blob in wide-zoomed map; hardcoded min/max in legend. | Added `fitBounds={true}` to cell extents on load and ward change; 5-quantile color palettes (`FIVE_CLASS_PALETTES`), and dynamic data-driven min/max values in legend. |
| D3 | /heat-planner | Major | Verified | Optimizer exceeds budget (e.g. 25 ha showed 25.1 ha). | Enforced strict `allocatedHa + cellHa <= budgetHa` in `src/api/mock/data.ts` and `src/server/priority/optimizer.ts`. Added property test across 5–60 ha in `tests/unit/priority-optimizer.test.ts` (all pass). |
| D4 | /heat-planner, dossier | Major | Verified | Inconsistent cooling signs: "-2 C (1.4 to 2.6 C)". | Standardized across `PortfolioSummary.tsx`, `EvidenceDrawer.tsx`, `ScenarioCompareModal.tsx`, and `generate-zone-dossier-pdf.ts` to `-X.X°C (-P90 to -P10°C)` with Spatial-CV RMSE `±0.91°C`. |
| D5 | /heat-planner, all | Major | Verified | Invalid chips like "Ranked", "Ensemble"; People Protected labeled Measured. | Enforced strict chip naming in `TruthChip.tsx` to `Measured`, `Modelled`, `Assumed`, or `Input`. Labeled People Benefiting as `Modelled`, Population as `Assumed`, and sliders as `Input`. |
| D6 | /heat-planner | Minor | Verified | Slider "Target Green Canopy (NDVI)" helper text overlap and range caption. | Renamed slider to "Target vegetation index (NDVI)", removed overlap, replaced caption with min/max, added indicative guidance help text. |
| D7 | Global | Major | Verified | Missing/incorrect DEMO banner logic. | Fixed unwrapping of `/api/optimize` response in `src/api/client.ts` (`raw.data || raw`), enabling authentic real optimizer data. Confirmed DEMO banner is hidden when authentic data loads (`HAS DEMO BANNER: false`). |
| D8 | Global | Minor | Verified | Footer text clipped under floating Copilot button. | Added `pt-8 pb-24 sm:pb-20` and `flex-wrap` to `SiteFooter` in `SiteLayout.tsx` so Copilot dock never obscures footer links or copyright text. |
| D9 | Global / Nav | Minor | Verified | "Open Heat Planner" button shown on /heat-planner; active nav item not clearly highlighted. | Switched button to "Method & Model Card" link when on `/heat-planner`. Added active border and text highlight to "Climate Tools" dropdown on child routes. |
| D10 | /heat-planner | Minor | Verified | Slider caption "Available unbuilt surface to plant" unclear. | Replaced caption with "Min 5 ha / Max 60 ha" and plain range indicators. |

## Iteration History

### Iteration 1
- Baseline audit across 8 routes and 5 viewports (360, 390, 768, 1280, 1440) using CDP crawler.
- Fixed D1 (OpenFreeMap Positron + keyless fallback chain), D2 (fitBounds and 5-quantile legend), D3 (strict knapsack budget enforcement), D4 (cooling sign convention), D5 (TruthChip compliance), D6/D10 (slider labels and constraints), D8 (footer bottom padding), D9 (header link conditional rendering).
- Fixed root layout horizontal overflow via `overflow-x-hidden` on `AppLayout.tsx`.

### Iteration 3 (P0 Defects & P1 Municipal Plan Workflow)
- **P0 Defect A (Basemap & Legend Integrity):** Inserted map layers strictly below `firstSymbolId` (first symbol layer of basemap) with `fill-opacity: 0.75`. Fixed legend 0.0°C artifact: `extractVal` filters out unmeasured null/missing values and non-positive LST (`v > 0`) so unmeasured cells never drag legend minimum to 0.0°C. Unit test: `tests/unit/map-legend-integrity.test.ts` (passed).
- **P0 Defect B (Zone Selection, Locality Names & Two-Way Sync):** Built `scripts/pipeline/add_locality.py` assigning nearest authentic OSM locality (within 1.5 km) across all 8,303 cells in `public/data/priority/cells.json`. Added two-way list and map selection (`highlightedCellId`, flyTo, interactive popups, permanent readable halo layer `top-zones-labels`), "Top zones per ward" filter/toggle in `ScenarioPanel.tsx`, and "Add to Plan" button.
- **P0 Defect C & D (Green Loss Pipeline & Data Integrity):** Root-caused and removed synthetic sinusoidal wave artifact in `green_loss.py`. Replaced with physical NDVI/NDBI threshold rule and verified against stable control masks (water bodies: 0.0% loss; Kasba Peth heritage core: 0.0% loss). Added `fitBounds={true}` to MapView, renamed "Canopy Loss" to "Vegetation loss", added Exposed Pop Assumed chip, and "Add to Plan" on restoration parcels. Unit test: `tests/unit/pipeline-green-loss.test.ts` (passed).
- **P0 Defect E & G (Solar & Shadow Simulator Geometry Engine):** Rewrote `src/lib/suncalc.ts` with `getISTDate`, analytical 2D geometry `calculateShadowGeometry` with point-in-polygon ray-casting. Fixed SunCalc altitude/azimuth units and night bugs. Integrated season presets (Solstices/Equinox/Pre-monsoon), live readouts, hourly timeline, honest gamma calibration notes (`derived from two plants over about 34 days...`), honest alpha captions (`indicative guidance, not measured`), and "Add to Plan" buttons. Unit test: `tests/unit/solar-simulator-geometry.test.ts` (passed).
- **P0 Defect F (Interventions Page Polish & Scientific Governance):** Enforced vegetation-only cooling estimates on `/interventions`; cool roofs and solar canopies show "Not modelled" with qualitative notes. Replaced "tree canopy" with "existing shade coverage", added "Add to Plan" button, and fixed mobile overflow with `min-w-0 max-w-full overflow-x-hidden`.
- **P1 Municipal Plan Workflow (End-to-End):**
  - Database schema: Added `Plan`, `PlanVersion`, and `PlanEvent` models in `prisma/schema.prisma` backed up to `prisma/dev.db.bak`. Tested DB isolation in `tests/unit/db-isolation.test.ts` (passed).
  - API Routes: Created `/api/plans`, `/api/plans/[id]`, `/api/plans/[id]/version`, and `/api/plans/[id]/forward` with Zod validation.
  - Client Architecture: Centralized `PlanContext` with debounced autosave, `PlanDrawer` 4-step workflow, portfolio manager at `/plans`, read-only audit at `/plans/[id]`, and "My Plan (n)" header pill.
  - Test hooks: Exposed `window.__urjasetu.test` with `getSelectedZoneIds()`, `getMapLayerIds()`, `getMapErrors()`, and `getPlanState()`.
- **Verification Summary:**
  - TypeScript: `npm run typecheck` passed with 0 errors.
  - Tests: `npm run test` passed with all 50 test files and 352 unit & integration tests passing.
  - Production Build: `npm run build` compiled all 29 routes with 0 errors.
  - Live Server: Running production daemon on port 3001.
