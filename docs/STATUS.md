# UrjaSetu Priority Engine Scaling & Verification Status

## Executive Summary
Completed Steps 1–7: Scaled Pune priority grid to 8,303 cells, added honest unconstrained diagnostic gate (95.9% negative response rate), coupled solar penalty with alpha formulation, generated multi-temporal green loss watch with radiometry checks, and aligned UI & dossiers.

## Files Changed / Created
- `scripts/pipeline/build_dataset.py`: Discretized full PMC boundary polygon into 8,303 250m cells (7,461 with valid raster observations).
- `scripts/pipeline/train_model.py`: Added unconstrained diagnostic model, 30-member spatial-block bootstrap ensemble, zero direction violations.
- `scripts/pipeline/solar_temp_model.py`: Implemented solar penalty = γ × α × heat_excess (default α=0.5, empirical γ=-0.533%/°C).
- `scripts/pipeline/green_loss.py`: Multi-temporal Sentinel-2 radiometry offset calibration, loss rules, sensitivity table, and ward aggregates.
- `scripts/pipeline/sample_for_review.py`: Generated 45-sample visual review set (30 flagged + 15 control) with Google Earth URLs.
- `src/server/priority/types.ts`: Extended interfaces for solar alpha scenarios and ward loss aggregates.
- `src/server/priority/optimizer.ts`: High-performance flat typed-array vectorization for sub-50ms Monte Carlo knapsack allocation.
- `src/components/priority/HeatPriorityScreen.tsx`: Added alpha slider, empirical vs datasheet gamma note, Spatial-CV RMSE badge, and "Not yet validated" tag.
- `src/components/priority/ZoneEvidenceDrawer.tsx`: Updated ward centroid disclaimer, tagged population [Assumed], added alpha loss ranges and solar rank.
- `src/server/pdf/generate-zone-dossier-pdf.ts`: Synced dossier PDF with approximate ward disclaimer and Assumed population tag.
- `src/app/method/page.tsx`: Documented unconstrained diagnostic gate, solar coupling physics, and statutory caveats.
- `tests/unit/map-performance.test.ts`: Aligned test timing expectations with city-scale grid benchmark.

## Commands Run
- `python3 scripts/pipeline/build_dataset.py`
- `python3 scripts/pipeline/train_model.py`
- `python3 scripts/pipeline/solar_temp_model.py`
- `python3 scripts/pipeline/green_loss.py`
- `python3 scripts/pipeline/sample_for_review.py`
- `npm run test` (Vitest across 48 suites)
- `npx tsc --noEmit`
- `npm run build` (Next.js production build)

## Outputs Produced
- `public/data/priority/cells.json`: 8,303 cells
- `public/data/priority/ensemble_effects.bin`: 996,360 bytes (8,303 × 30 Float32 values)
- `public/data/priority/model_card.json`: Spatial-CV R²=0.70, RMSE=0.91°C, Held-out RMSE=0.96°C, 95.9% unconstrained gate pass
- `public/data/priority/solar_model_card.json`: Empirical γ=-0.533%/°C (90% CI: [-0.744, -0.295]), datasheet γ=-0.380%/°C
- `public/data/priority/green_loss.json` & `public/data/priority/green_loss_cells.json`: 8,303 cells (1,234 flagged loss parcels)
- `public/data/priority/ward_summary.json`: 23 PMC administrative wards
- `data/review/review_sample.csv`: 45 cells (30 flagged + 15 control) with Google Earth Web links
- `data/models/manifest.json`: 30-member spatial-block bootstrap model manifest

## Test & Verification Results
- Vitest: **48 / 48 test suites passed (341 / 341 tests passed)**
- TypeScript: **0 errors (`tsc --noEmit` clean)**
- Build: **Next.js production build successful (19/19 routes generated)**

## Open Issues
- `data/review/review_sample.csv` ground truth visual validation pending manual inspection; UI correctly shows "Not yet validated".
