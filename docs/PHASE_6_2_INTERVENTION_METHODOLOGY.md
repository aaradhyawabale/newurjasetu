# UrjaSetu Phase 6.2 — Urban Intervention Planning Methodology

**Document ID:** `DOC-URJASETU-6.2-INT-01`  
**Status:** Approved & Machine-Integrated  
**Date:** November 2026  
**Target City:** Pune, Maharashtra  

---

## 1. Overview & Intervention Categories

UrjaSetu structures urban cooling and clean energy interventions into five distinct, technically grounded planning categories:

1. **Urban Greening Corridors (`URBAN_GREENING_CORRIDOR`)**: Multi-tiered tree canopy corridors, vegetative buffers, and bioswales along arterial roads to attenuate radiative heat and shelter pedestrian pathways.
2. **Cool Roof Feasibility (`COOL_ROOF_FEASIBILITY`)**: High-albedo solar-reflective elastomeric coatings (BEE ECBC SRI $\ge 78$) on flat civic and public hospital roofs to mitigate indoor heat ingress and reduce peak HVAC cooling loads.
3. **Solar Canopy & EV Co-Location (`SOLAR_CANOPY_EV_COLOCATION`)**: Photovoltaic shading canopies integrated over existing municipal parking lots and EV charging plazas.
4. **Green Space & Park Enhancement (`GREEN_SPACE_ENHANCEMENT`)**: Urban microclimate buffering through dense native planting, shade trees, and rainwater recharge pits in public municipal gardens.
5. **Integrated Transit Facility Upgrade (`INTEGRATED_FACILITY_UPGRADE`)**: Multi-modal transit node retrofits combining solar shading, cool surfaces, and passenger comfort microclimate improvements.

---

## 2. Dynamic Spatial Discovery Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ Authentic Municipal Master Registers (src/data/official/)              │
│ 81 Gardens (Point) | 50 Hospitals (Point) | 6 Substations (Point)      │
│ 13 EV Plazas (Point) | 10 Arterial Corridors (Point)                   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Reusable Spatial Validation (src/server/gis/spatial-validation.ts)      │
│ Validates WGS84 coordinates | Rejects non-finite values                │
│ Enforces Point geometry semantics (Prohibits fake area buffering)      │
│ Evaluates exact Point-in-Polygon containment against Candidate Boundary │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Scientific Satellite Probing (src/server/heat-engine/loader.ts)        │
│ Landsat 9 LST (°C) + ST_QA Uncertainty (K)                             │
│ Sentinel-2B NDVI [-1.0, 1.0] + SCL Masking (Water/Cloud Exclusions)    │
│ MSEDCL Substation Geodesic Proximity (m)                               │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Configurable Screening & Evidence Ledger Assembly                     │
│ Evaluates candidate against screening thresholds                       │
│ Tags differentiated status: ELIGIBLE_FOR_REVIEW / CONDITIONALLY_...   │
│ Assembles 6-tier traceable evidence ledger                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Geometry Semantics & Area Governance

To prevent data fabrication, the intervention discovery engine enforces strict geometric rules:
1. **Point Coordinates**:
   - Hospitals and gardens are stored as point coordinates representing municipal facility entrance gates or centroids.
   - The system **prohibits** calculating rooftop area or garden canopy acreage by applying arbitrary geometric scalars (e.g., $50\text{m}$ circular buffers).
   - In planning dossiers and API outputs, rooftop area is explicitly flagged as `Not established from point geometry (requires CTSO cadastre demarcation)`.
2. **Road Corridors**:
   - Manually curated corridor sample points represent arterial centerline vertices.
   - Carriageway widths and corridor lengths are recorded as indicative planning estimates; asphalt surface area calculations are withheld pending official street centerline shapefiles.

---

## 4. Six-Tier Evidence Ledger

Every discovered candidate is accompanied by an immutable Evidence Ledger:
- `SATELLITE_OBSERVATION`: Physical radiometric measurements (Landsat 9 LST, Sentinel-2 NDVI, SCL).
- `DETERMINISTIC_CALCULATION`: Geodesic network distances (nearest road, nearest substation).
- `VERIFIED_TECHNICAL_REFERENCE`: Authoritative registers (PMC Garden Master List, PMC Hospital List, MSEDCL Substation List).
- `GENERAL_ENGINEERING_GUIDANCE`: Best-practice rules of thumb (e.g. PV thermal derating co-efficient $-0.40\% / ^\circ\text{C}$ above $25^\circ\text{C}$).
- `AI_INTERPRETATION`: Contextual qualitative synthesis produced by Gemini Copilot or deterministic fallback rules.
- `UNVERIFIED_REQUIRES_ADDITIONAL_DATA`: Mandatory survey checklist items that must be executed in the field before project approval.

---

## 5. Pre-Implementation Survey Mandate

UrjaSetu dossiers require the following field surveys before municipal sanction:
- **ASCE 38-02 Quality Level B Ground Penetrating Radar (GPR)**: Subsurface scanning along road corridors to prevent strikes on optical fiber, water, and power conduits.
- **IS 516 / ASTM D4541 Structural Testing**: Ultrasonic pulse velocity, rebound hammer, and pull-off adhesion tests on existing concrete hospital slabs prior to solar or coating application.
- **MSEDCL Grid Interconnection Application**: Formal engineering load-flow study to confirm distribution transformer capacity and reverse power injection headroom.
- **IRC:103-2012 Walkability Audit**: Verification that sidewalk tree pits do not impede the required 1.8m clear pedestrian walking zone.
