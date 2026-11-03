# UrjaSetu Phase 6.2 — Test Execution & Browser Validation Report

**Document ID:** `DOC-URJASETU-6.2-TST-01`  
**Status:** All Tests Passing & Production Build Verified  
**Date:** November 2026  
**Execution Environment:** Node.js v20+, Next.js 14.2.35, Vitest, TypeScript Strict  

---

## 1. Test Suite Summary

The entire UrjaSetu automated test suite was executed in Phase 6.2, expanding test coverage across satellite reconciliation, engineering standards legal classification, and spatial geometry integrity:

```
Test Files:  37 passed (37 total)
Tests:       279 passed (279 total)
Errors:      0
Duration:    12.34s
```

---

## 2. Test Coverage Breakdown by Workstream

### 2.1 Satellite Metadata Reconciliation (`tests/unit/satellite-metadata-reconciliation.test.ts`)
- **Passed: 5/5**
- Confirms authoritative Landsat 9 scene ID `LC09_L2SP_147047_20230422_02_T1` and acquisition date `2023-04-22T05:27:39Z`.
- Confirms Sentinel-2B scene ID `S2B_MSIL2A_20230424T052649_N0510_R105_T43QCA_20240831T130916` and acquisition date `2023-04-24T05:26:49Z`.
- Verifies per-pixel ST_QA uncertainty statistics (mean 2.16 K, median 2.10 K, min 1.51 K, max 62.75 K) and refutes uniform $\pm 0.81\text{ K}$ claim.
- Validates target grid dimensions (1012 × 871 at 30m) and coordinate system (EPSG:32643).

### 2.2 Engineering Standards Applicability (`tests/unit/standards-applicability.test.ts`)
- **Passed: 4/4**
- Verifies statutory Indian building regulations: BEE ECBC 2017 Table 4.1 (`STATUTORY_REQUIREMENT`), IS 875 Part 3 (`STATUTORY_REQUIREMENT`), CEA Regulations 2010 (`STATUTORY_REQUIREMENT`).
- Verifies proper qualification of foreign/voluntary standards: ASTM D4541 (`TECHNICAL_REFERENCE`), Green Seal GS-11 (`RECOMMENDED_PRACTICE`), ASCE 38-02 (`TECHNICAL_REFERENCE`).
- Asserts that foreign standards are never portrayed as Indian statutory mandates.

### 2.3 Spatial Integrity & Boundary Classification (`tests/unit/spatial-integrity-boundary.test.ts`)
- **Passed: 6/6**
- Verifies loading of `pmc_candidate_boundary.geojson` and confirms its explicit non-authoritative candidate legal status.
- Validates coordinate bounds against Pune geographic plausibility box $[18.40^\circ\text{N} - 18.65^\circ\text{N}, 73.70^\circ\text{E} - 74.05^\circ\text{E}]$.
- Evaluates exact point-in-polygon containment using Turf.js against the 519.57 km² candidate boundary.
- Verifies detection of non-finite coordinates, out-of-range latitudes, and flipped coordinates.
- Prohibits fabricated area metrics on Point geometries.
- Detects self-intersecting kinks in polygon geometries.

### 2.4 Dataset Forensic Integrity (`tests/unit/dataset-forensic-audit.test.ts`)
- **Passed: 5/5**
- Confirms 81 gardens, 50 hospitals, 6 substations, 13 EV plazas, and 10 road corridors match official records.
- Verifies available headroom is `null` across all substations.
- Verifies EV stations contain no fabricated default capacities.

### 2.5 Dynamic Discovery & Scientific Validation (`tests/unit/dynamic-discovery-engine.test.ts`, `tests/unit/scientific-validation.test.ts`)
- **Passed: 9/9**
- Confirms candidate generation with configurable thermal and vegetation screening parameters.
- Validates reproducible parameter sensitivity sweeping.
- Verifies candidate eligibility states (`ELIGIBLE_FOR_REVIEW`, `CONDITIONALLY_ELIGIBLE`, `REQUIRES_SITE_VALIDATION`).

---

## 3. TypeScript Strict Typecheck & Production Build

### 3.1 TypeScript Typecheck
- **Command**: `npm run typecheck` (`tsc --noEmit`)
- **Result**: Exited with code 0. Zero type errors.

### 3.2 Production Build
- **Command**: `npm run build` (`prisma generate && next build`)
- **Result**: Exited with code 0.
- All 18 static and dynamic routes compiled and generated successfully.

---

## 4. Actual Application Runtime & UI Verification

The Next.js application was verified against running server on port 3000:
1. **Interactive GIS Map (`/`)**:
   - MapLibre GL rendered satellite LST and NDVI raster overlays cleanly.
   - Point-based satellite probe correctly queries calibrated LST, per-pixel ST_QA uncertainty (mean ~2.16 K), and Sentinel-2 NDVI.
   - PMC candidate boundary overlay displays prominent non-authoritative candidate disclaimer.
2. **Heat Intelligence Dashboard**:
   - Displays thermal distribution metrics ($25.76^\circ\text{C}$ to $61.41^\circ\text{C}$).
   - Displays ST_QA uncertainty breakdown.
   - Clarifies radiometric skin temperature ($T_{\text{skin}}$) vs. ambient air temperature ($T_{\text{air}}$).
3. **Intervention Planning Workspace**:
   - Dynamic discovery generates candidates across the 5 categories.
   - Evidence ledgers accurately display reconciled satellite dates (2023-04-22 / 2023-04-24).
   - Electrical feasibility explicitly indicates that substation headroom requires formal MSEDCL sanction.
   - Dossier modal generates comprehensive planning dossiers without fabricated area calculations.
4. **Gemini Copilot & Local GIS Engine**:
   - Properly responds with evidence-grounded recommendations.
   - Refuses to hallucinate missing structural or electrical headroom metrics.
