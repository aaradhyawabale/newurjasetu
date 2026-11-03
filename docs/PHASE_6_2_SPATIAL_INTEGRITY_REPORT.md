# UrjaSetu Phase 6.2 — Spatial Integrity & Boundary Classification Report

**Document ID:** `DOC-URJASETU-6.2-GEO-01`  
**Status:** Approved & Machine-Integrated  
**Date:** November 2026  
**Target Coordinate System:** EPSG:4326 (WGS 84 Storage) / EPSG:32643 (UTM Zone 43N Analysis)  

---

## 1. Executive Summary & Core Spatial Distinctions

In geospatial planning systems, confusing operational study extents or candidate boundaries with certified statutory borders exposes municipal decision-makers to legal vulnerability.

UrjaSetu Phase 6.2 formally categorizes and separates five distinct spatial concepts:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Statutory Municipal Boundary                                        │
│    (Gazetted legal limit issued by Maharashtra Urban Dev Dept)         │
│    Status in UrjaSetu: NOT AVAILABLE (Source cadastre unavailable)     │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. PMC Candidate Planning Boundary (pmc_candidate_boundary.geojson)     │
│    Union of 23 post-2021 Prabhag wards; non-authoritative candidate    │
│    Area: 519.57 km² | Interior defense corridor exclusions retained   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Operational Study Area                                              │
│    The active geographic envelope selected for candidate discovery      │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. Raster Coverage Extent (Landsat 9 / Sentinel-2B)                    │
│    Rectangular grid: 1012 × 871 pixels at 30m resolution (EPSG:32643)  │
│    Total pixels: 881,452 | Valid terrestrial study pixels: 577,304     │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 5. Geographic Plausibility Bounding Box                                │
│    Coordinate window: [18.40°N - 18.65°N, 73.70°E - 74.05°E]           │
│    Strictly an operational sanity filter; NEVER a municipal boundary   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Reusable Spatial Integrity Architecture (`spatial-validation.ts`)

UrjaSetu implements centralized spatial validation via `src/server/gis/spatial-validation.ts`:

### 2.1 Coordinate Reference System (CRS) Verification
- All spatial layers are stored in strict GeoJSON WGS 84 (`EPSG:4326`) format with `[longitude, latitude]` coordinate ordering.
- Latitudes must fall strictly within $[-90^\circ, 90^\circ]$ and longitudes within $[-180^\circ, 180^\circ]$.
- Finite number validation rejects `NaN`, `null`, `undefined`, and infinite coordinates.

### 2.2 Topological Correctness & Kink Detection
- Linear rings in GeoJSON Polygons must be closed (first coordinate equals last coordinate).
- Polygons are evaluated with `turf.kinks` to identify self-intersecting boundaries.
- Polygons with non-zero kinks are flagged as topologically defective and rejected from candidate buffering.

### 2.3 Point Geometry Semantics & Anti-Buffering Policy
- Point features representing hospitals, gardens, EV chargers, and substations are treated strictly as point coordinates.
- **Prohibition of Synthetic Buffering**: UrjaSetu prohibits generating arbitrary circular buffers (e.g., 50-meter circles around a hospital entrance gate) to synthesize artificial rooftop areas or calculate fictitious solar PV capacity.
- **Rooftop Area Policy**: Any area calculation on a point feature must cite a verified property survey or cadastral shapefile. In the absence of primary cadastre polygons, area is recorded as `null` and explicitly marked as `UNVERIFIED_IN_SOURCE`.

### 2.4 Point-in-Polygon vs. Bounding Box Containment
- Geographic sanity checks (`isWithinGeographicPlausibilityBox`) verify coordinate bounds $[18.40^\circ\text{N} - 18.65^\circ\text{N}, 73.70^\circ\text{E} - 74.05^\circ\text{E}]$.
- Municipal boundary screening (`isPointInsideCandidateBoundary`) executes exact ray-casting point-in-polygon tests using Turf.js against `pmc_candidate_boundary.geojson`.
- The system never conflates a passing bounding box check with verification of municipal jurisdiction.

---

## 3. Candidate Boundary Provenance & Properties

- **Source File**: `src/data/boundaries/pmc_candidate_boundary.geojson`
- **Methodology**: 72-feature Turf union of administrative prabhag polygons incorporating 23 peripheral villages merged under Maharashtra UDD Notification No. PMC-2020/CR-101/UD-22 (June 30, 2021).
- **Interior Exclusions**: Verified defense corridor exclusions (Mundhwa Jackwell / Ghorpadi defense corridor, $0.815\text{ km}^2$) are preserved. Hairline sliver seams ($< 1\text{ ha}$) resulting from digital cartographic mismatch were suppressed.
- **Legal Disclaimer**: This polygon is a candidate planning geometry, not an official certified municipal cadastre.

---

## 4. Test Verification
Spatial validation rules are tested in `tests/unit/spatial-integrity-boundary.test.ts`, verifying that invalid coordinates, flipped lat/lng pairs, self-intersecting polygons, and synthetic buffering violations are caught and reported.
