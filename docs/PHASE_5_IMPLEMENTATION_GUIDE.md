# UrjaSetu Phase 5 — Intelligent Urban Intervention Planning Implementation Guide

## Executive Overview
Phase 5 equips UrjaSetu with an evidence-based decision-support workspace for urban planners, municipal engineers, and transit authorities in Pune, Maharashtra. It operationalizes spatial satellite data (Landsat 9 LST, Sentinel-2 NDVI) and municipal infrastructure records into actionable, prioritized intervention dossiers across 5 core categories.

---

## 1. Architectural Architecture & Module Structure

```
src/
├── server/
│   └── intervention-engine/
│       ├── types.ts                  # Schemas: Candidates, Categories, Ledgers, Dossiers
│       ├── intervention-registry.ts   # Metadata, Standards, Survey Checklists, Disclaimers
│       ├── candidate-generator.ts     # Deterministic Candidate Generator & Raster Probe
│       ├── prioritisation-engine.ts   # Multi-Dimensional Evaluation (Zero Fake Scores)
│       ├── comparison-engine.ts       # Side-by-Side Comparison Matrix & Trade-offs
│       ├── dossier-generator.ts      # Formal Municipal Dossier Generator
│       └── index.ts                  # Public API Barrel
├── app/api/interventions/
│   ├── route.ts                      # GET /api/interventions (Stats & Summary)
│   ├── candidates/
│   │   ├── route.ts                  # GET /api/interventions/candidates (?format=geojson)
│   │   └── [id]/route.ts             # GET /api/interventions/candidates/[id]
│   ├── compare/route.ts              # POST /api/interventions/compare
│   └── dossier/route.ts              # POST /api/interventions/dossier
└── components/
    ├── interventions/
    │   └── InterventionPlanningWorkspace.tsx # Full Planning Dashboard & Modals
    ├── layout/
    │   ├── TopBar.tsx                # Added "Interventions" button
    │   └── AppShell.tsx              # Workspace toggle & Map fly-to coordination
    └── map/
        └── MapView.tsx               # GeoJSON source, glow/circle layers & popups
```

---

## 2. Five Mandatory Intervention Categories

| Category Identifier | Category Name | Typical Features | Key Governing Standards |
|---|---|---|---|
| `URBAN_GREENING_CORRIDOR` | Urban Greening & Tree Corridors | Karve Rd, Laxmi Rd, FC Rd | IRC:103-2012, CPWD Urban Greenery Guidelines |
| `COOL_ROOF_FEASIBILITY` | Cool Roof Opportunities | PMC HQ, Sassoon Hospital, Balgandharva | BEE ECBC 2017 Table 4.1 (SRI $\ge 78$), ASTM E1980 |
| `SOLAR_CANOPY_EV_COLOCATION` | Solar Canopy & EV Co-Location | Mandai Parking, Sambhaji Lot, Swargate | IEC 61215:2021, EPRI 3002016335, ARAI AIS-138 |
| `GREEN_SPACE_ENHANCEMENT` | Green Space Improvement | Saras Baug, Kamala Nehru Park | URDPFI 2014, CPWD Horticultural Specs, CGWA 2020 |
| `INTEGRATED_FACILITY_UPGRADE` | Integrated Facility Upgrades | Shivajinagar Multimodal Interchange | GRIHA v2019, BEE ECBC 2017, MoHUA TOD Policy |

---

## 3. Strict Scientific & Engineering Rules

1. **Zero Fabricated Benefits**: The engine does NOT invent microclimate cooling degrees (e.g., claiming "planting 50 trees will lower air temperature by 3.2°C") or theoretical financial paybacks without CFD microclimate modeling and utility tariff data.
2. **Continuous Relative Context**: Thermal and vegetation profiles are reported strictly as continuous differences from verified baselines:
   - Study Area Mean LST Baseline: $46.3^\circ\text{C}$ (Landsat 9 Collection 2 Band 10).
   - Study Area Terrestrial Mean NDVI Baseline: $0.514$ (Sentinel-2B BOA).
3. **Footprint $\ne$ Usable Rooftop Area**: Building footprint area is explicitly discounted (typically $45-75\%$ net) to account for HVAC chiller plants, parapets, stairwell towers, and water storage.
4. **LST $\ne$ Battery / PV Cell Temperature**: Satellite LST measures radiometric ground skin temperature, not solar panel cell junction temperature or EV battery core temperature.
5. **Exploratory Planning Status**: Candidate eligibility is an exploratory municipal planning classification, NOT formal administrative sanction, environmental clearance, or budget allocation.

---

## 4. Verification & Testing Summary
- **Test Suite**: 30 passed test files (30/30), 247 passed unit & integration tests (247/247).
- **TypeScript**: 0 typecheck errors (`tsc --noEmit` code 0).
- **Copilot Integration**: Local deterministic GIS fallback (Intent 8) verified with exact candidate queries and general category overviews.
