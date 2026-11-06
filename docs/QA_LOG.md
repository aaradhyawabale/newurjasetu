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

### Iteration 2
- Fixed API response unwrapping in `src/api/client.ts` for `/api/optimize` (`raw.data || raw`), restoring real LightGBM 30-member ensemble pipeline.
- Synchronized `MOCK_MODEL_CARD` in `src/api/mock/data.ts` to match retrained model manifest (30 members, 0.91°C CV RMSE, unconstrained diagnostic direction gate).
- Guarded `MapView.tsx` WebGL initialization with `maplibregl.supported()` and error boundary fallback.
- Executed full headless browser crawl (`scripts/qa/crawl.mjs`) on production build (`http://localhost:3001`):
  - Routes tested: `/`, `/heat-planner`, `/green-loss`, `/interventions`, `/green-cover`, `/infrastructure`, `/solar`, `/method`
  - Viewports: 360, 390, 768, 1280, 1440 (40 screen audits)
  - Results: 0 console errors, 0 failed requests (4xx/5xx), 0 horizontal overflows, 0 text anomalies.
- Verified test suite: all 48 test files passed (342 tests).
- Verified TypeScript: `npx tsc --noEmit` passed with 0 errors.
- Verified production build: `npm run build` compiled all 27 static and dynamic pages with 0 errors.
