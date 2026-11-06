# UrjaSetu QA & Polish Verification: Final Report

## Summary & Exit Check Results
- **Iterations Used:** 2 | **Exit Checks (E1–E9):** ALL PASSED
- **E1:** 0 console errors, 0 failed network requests across 8 routes & 5 viewports (`docs/qa/iter-2/crawl_report.json`).
- **E2:** OpenFreeMap Positron (keyless), OSM raster fallback, visible attribution, 5-quantile heat scale & dynamic legend.
- **E3:** Strict knapsack packing holds ($\le$ budget) across 5–60 ha; portfolio totals match selected zone sums.
- **E4:** TruthChips strictly Measured, Modelled, Assumed, or Input. Temperatures use `-X.X°C (-P90 to -P10°C)` with CV RMSE.
- **E5:** 0 horizontal overflow across 360, 390, 768, 1280, 1440 viewports.
- **E6:** Loading skeletons, empty states, and primary actions placed above the fold on all routes.
- **E7:** Full keyboard accessibility (`focus-visible:ring-2`) across sliders, filters, and scenario modals.
- **E8:** `npm run test` (342/342 passed), `npx tsc --noEmit` (0 errors), `npm run build` (27/27 pages compiled).
- **E9:** Zero open blocker or major defects in `docs/QA_LOG.md`.

## Defects Fixed
- **D1 (Blocker):** Removed Carto API key watermark; integrated OpenFreeMap Positron and fallback chain.
- **D2 (Major):** Added dynamic fitBounds on cell extents and 5-class quantile color interpolation.
- **D3 (Major):** Eliminated 5% budget overshoot in mock and real optimizers; verified via property tests.
- **D4 (Major):** Standardized cooling notation to `-X.X°C (-P90 to -P10°C)` with CV RMSE across UI and PDF dossiers.
- **D5 (Major):** Normalized all TruthChips to Measured, Modelled, Assumed, or Input; marked People Benefiting as Modelled.
- **D6 & D10 (Minor):** Renamed target canopy to target vegetation index (NDVI) with indicative guidance and clear min/max.
- **D7 (Major):** Unwrapped `/api/optimize` response payload in API client; DEMO banner hides when authentic data is loaded.
- **D8 (Minor):** Added bottom padding to SiteFooter to prevent Copilot floating dock obstruction.
- **D9 (Minor):** Made header action contextual ("Method & Model Card" when on `/heat-planner`) and highlighted active dropdown tabs.

## Remaining Minors
- None. All identified defects resolved and verified.

## How to Run the App
```bash
npm install
npx vitest run && npx tsc --noEmit
npm run build && npm run start -- -p 3001
# Open http://localhost:3001
```
