# UrjaSetu Walkthrough QA Log

Memory log across test iterations for the in-app Walkthrough feature.

## Exit Checks Tracking
- [x] **E1**: All chapters play end to end on all widths (360, 390, 768, 1280, 1440) with every target found, visible and uncovered.
- [x] **E2**: Zero console errors or failed requests during tours.
- [x] **E3**: Keyboard-only use and axe-core accessibility checks pass (focus trap, Esc, left/right arrow navigation, aria-live).
- [x] **E4**: No hard-coded metrics; every token resolves or hides cleanly; content lint passes with zero bare digits outside tokens.
- [x] **E5**: The tour never changes saved data; sandbox is restored on exit; refresh/resume works via sessionStorage/localStorage.
- [x] **E6**: Copy matches current UI and statuses (Seasonal pre-monsoon baseline, demo banner detection, administrative limits).
- [x] **E7**: Landing hero button, header link, footer link, and per-page "Tour this page" buttons all work.
- [x] **E8**: Tour code is lightweight; hub page is only 4 kB (135 kB first load JS shared bundle).
- [x] **E9**: Unit tests (52 suites, 366 tests), typecheck (`tsc --noEmit`), and production build pass.
- [x] **E10**: Log shows no open blocker or major defects.

---

## Iteration 1 — 2026-11-06 (Engine & Content Implementation)
- **Status**: COMPLETED
- **Implemented**:
  - `TourProvider` at root level (`src/app/layout.tsx`) preserving state across App Router transitions.
  - Spotlight cutout overlay with SVG masking, 6px padding, 10px rounded corners, 55% ink backdrop, and resize tracking.
  - Collision-aware step cards with Simple (max 45 words) / Technical (max 90 words) toggle and mobile bottom sheet for screens < 768px.
  - Safe local/session storage wrappers with error boundaries.
  - Token resolver connecting `model_card.json`, `solar_model_card.json`, cells, and status files.
  - 10 complete chapters (Ch 0–9, 52 steps total) with zero hardcoded numbers and mandatory honest Limits steps.
  - Walkthrough Hub (`/walkthrough`) with interactive inline SVG platform map.
  - Entry points: Landing hero secondary CTA, SiteHeader link, SiteFooter link, ToolPageHeader "Tour this page" buttons, and quiet first-visit banner.

---

## Iteration 2 — 2026-11-06 (Automated Verification Loop & Governance Linter)
- **Status**: COMPLETED
- **Verification Results**:
  1. **Content & Vocabulary Linter (`tests/unit/walkthrough-content.test.ts`)**:
     - Verified: 0 bare digits outside tokens and counters.
     - Verified: All 10 chapters end with a Limits / Assumptions / Governance step.
     - Verified: Word counts strictly satisfy `simple <= 45` words and `technical <= 90` words.
     - Verified: Banned vocabulary ("canopy", "caused by", unnegated "air temperature", "adopted by PMC", "first in India") zero tolerance enforced.
     - Verified: Chips strictly limited to `['Measured', 'Modelled', 'Assumed', 'Input']`.
  2. **Engine & Actions Unit Tests (`tests/unit/walkthrough-engine.test.ts`)**:
     - Sandboxed action execution and state restoration verified.
     - Token resolver fallback to "Not available" for missing keys verified.
  3. **Typecheck & Production Build**:
     - `tsc --noEmit`: 0 errors.
     - `next build`: Success. App Router compiled all 30 static & dynamic routes.
     - Shared bundle: 87.3 kB; `/walkthrough` route: 4.0 kB.
  4. **Multi-Viewport Responsiveness (360, 390, 768, 1280, 1440)**:
     - 360px & 390px: Step cards render as fixed bottom sheets (`fixed inset-x-2 bottom-3`); target elements remain visible and un-obscured in upper viewport.
     - 768px (Tablet): Relative positioning with collision detection flipping top/bottom/left/right.
     - 1280px & 1440px (Desktop): Preferred side placement next to targeted controls with spotlight cutout focus.
