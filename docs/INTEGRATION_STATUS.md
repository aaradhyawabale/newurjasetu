# UrjaSetu Redesign Frontend Integration Status

## 1. Mapped Routes & Pages
- **`/`**: Redesigned Home & Platform Overview (`LandingPage.tsx`) with live stats, 6 module access cards, and model honesty cards.
- **`/heat-planner`**: Interactive Heat Priority Optimizer (`HeatPlannerPage.tsx`) backed by 8,303 cells, 30-member LightGBM ensemble, ward filter, Evidence Drawer, and dossier PDF exports.
- **`/green-loss`**: Green Loss Watch (`GreenLossPage.tsx`) displaying Sentinel-2 2019–2026 delta NDVI, loss hotspots, and verification drawer.
- **`/interventions`**: Multi-Criteria Site Siting (`InterventionsPage.tsx`) evaluating greening, rooftop solar, and EV infrastructure against real spatial constraints.
- **`/green-cover`**: Urban Greening Action Planner (`GreenCoverPage.tsx`) with Ward cooling impact forecasting and intervention baskets.
- **`/infrastructure`**: Resilient Civic Assets (`InfrastructurePage.tsx`) ranking candidate sites across municipal wards.
- **`/solar`**: Solar & Shadow Simulator (`SolarSimulatorPage.tsx`) using real SunCalc/NOAA ephemeris + empirical heat penalty $\alpha \cdot \gamma \cdot \Delta T$.
- **`/method`**: Scientific Method & Model Cards (`MethodPage.tsx`) detailing satellite telemetry, ensemble cross-validation, and thermal derating.
- **`/legacy` & `/legacy/method`**: Original GIS decision workbench and methodology preserved with zero data deletion.

## 2. Adapted Client Fields & Data Contracts (`src/api/client.ts`)
- **Cells & Heat Model**: Ingests `/data/priority/cells.json` (8,303 cells) joined with `/data/priority/green_loss.json`. Adapted `solar_penalty_low/mid/high` from `solar_penalty_mean/p10/p90`.
- **Ensemble Optimization**: POSTs directly to `/api/optimize`, mapping selected cell IDs and cooling effect percentiles ($p_{10}, p_{50}, p_{90}$) to Portfolio Summary and Evidence Drawer.
- **Zone Details & Dossiers**: Queries `/api/zone/:id` and downloads committee dossiers via `/api/zone/:id/dossier-pdf`.
- **Solar Governance**: Ingests `/data/priority/solar_model_card.json` ($\gamma = -0.533\%/^\circ\text{C}$ empirical vs $-0.38\%/^\circ\text{C}$ datasheet). Cell rankings depend solely on `heat_excess_celsius`, maintaining $\alpha$-independence.
- **Authentic Data Assurance**: The dynamic DEMO banner is hidden when authentic data loads, displaying automatically only if a call triggers a fallback.

## 3. Handled Gaps
- **Missing/Unpopulated Endpoints**: Gracefully handled in UI with "Not available" states and zero fabricated values.
- **SunCalc Integration**: Astronomical ephemeris implemented via local NOAA algorithms (`src/server/solar/solar-position.ts`) without external npm dependencies.
- **Map Engine**: Redesign adapted from Leaflet to MapLibre GL 4.7 with high-performance GeoJSON fill layers, data-driven GPU styling, and interactive cell inspection.
