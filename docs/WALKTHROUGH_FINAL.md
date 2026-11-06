# UrjaSetu Walkthrough: Final Delivery Report

## Chapters Shipped (10 Chapters, 52 Steps)
- **Ch 0: The Big Picture** (`/walkthrough`) — 3 steps (Platform overview, tool workflow, limits)
- **Ch 1: How to Read the Numbers** (`/walkthrough`) — 4 steps (Chips taxonomy, ranges vs promises, limits)
- **Ch 2: Heat Intelligence Planner** (`/heat-planner`) — 8 steps (Map, burden, budget, NDVI, run, drawer, dossier, limits)
- **Ch 3: Satellite Green Loss** (`/green-loss`) — 5 steps (Same-season baseline, metrics, map, ward table, limits)
- **Ch 4: Scenario Comparison** (`/interventions`) — 5 steps (Matrix comparison, cooling chips, costs, recommendation, limits)
- **Ch 5: Green Cover Planning** (`/green-cover`) — 4 steps (Sites map, filters & budget, corridor ranking, limits)
- **Ch 6: Critical Infrastructure** (`/infrastructure`) — 4 steps (Facility buffers, vulnerable hospitals, transit shading, limits)
- **Ch 7: Solar Thermal Derate** (`/solar`) — 6 steps (Rooftop potential, temperature penalty, microclimate alpha, gamma, derate curve, limits)
- **Ch 8: Municipal Plans Portfolio** (`/plans`) — 4 steps (Plan saving, forwarding drafts, portfolio list, limits)
- **Ch 9: Method & Scientific Governance** (`/method`) — 9 steps (Surface vs air, truth chips, model card, direction gate, CV error, spatial blocks, sources, limits)

## Status Flags & Preliminary Visibility
- **No fabricated numbers**: All figures resolve dynamically from runtime JSON (`model_card.json`, `cells.json`, `solar_model_card.json`).
- **Feature Flags**: Preliminary or demo features automatically reflect status from `/api/model-card` and runtime datasets; no features hidden arbitrarily.
- **Administrative Transparency**: Forwarding and saving plans disclose internal draft status; no statutory budget authorization implied.

## How to Add a Step
1. In `src/walkthrough/chapters/index.ts`, locate the target chapter in `CHAPTERS`.
2. Add a `TourStep` object:
   ```ts
   { id: 'chX_sY', targetSelector: '[data-tour="my-target"]', copy: { title: '...', simple: '...', technical: '...', chip: 'Modelled' } }
   ```
3. Use runtime tokens `{{token_name}}` for numbers (never hard-code digits). Ensure `simple <= 45` words and `technical <= 90` words.
4. Add `data-tour="my-target"` to the target JSX element.

## How to Run Tests
- **Lint & Content Rules**: `npx vitest run tests/unit/walkthrough-content.test.ts`
- **Engine & Sandbox**: `npx vitest run tests/unit/walkthrough-engine.test.ts`
- **Typecheck**: `npm run typecheck`
- **Production Build**: `npm run build`
