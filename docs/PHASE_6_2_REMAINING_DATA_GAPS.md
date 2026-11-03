# UrjaSetu Phase 6.2 — Remaining Geospatial & Engineering Data Gaps

**Document ID:** `DOC-URJASETU-6.2-GAPS-01`  
**Status:** Disclosed & Governance-Tracked  
**Date:** November 2026  
**Target City:** Pune Municipal Corporation, Maharashtra, India  

---

## 1. Executive Summary

UrjaSetu maintains strict fidelity to data provenance. When essential engineering or legal data is not published in authoritative open records, the platform explicitly marks the attribute as `null` or `UNVERIFIED_REQUIRES_ADDITIONAL_DATA` rather than substituting speculative approximations.

This document details the six remaining data gaps that require physical field surveys, non-public utility feeds, or official inter-departmental data-sharing agreements.

---

## 2. Inventory of Primary Data Gaps

### 2.1 Gazetted Statutory Municipal Boundary Cadastre
- **Current State**: UrjaSetu uses `pmc_candidate_boundary.geojson` ($519.57\text{ km}^2$), derived from a 72-feature union of post-2021 Prabhag ward polygons.
- **Data Gap**: Official gazetted cadastre boundary shapefile demarcated by the Maharashtra Urban Development Department (UDD) under Notification No. PMC-2020/CR-101/UD-22.
- **Responsible Authority**: Maharashtra State Settlement Commissioner & Director of Land Records; PMC Municipal Secretary / GIS Cell.
- **UrjaSetu Mitigation**: Prominently labels boundary as non-authoritative candidate planning boundary across all UI views and municipal dossiers.

### 2.2 Property Parcel Cadastre & Rooftop Polygons
- **Current State**: Hospitals and civic facilities in `pmc_hospitals.json` and `pmc_gardens.json` are represented as GeoJSON `Point` coordinates.
- **Data Gap**: True 2D building footprint polygons, roof slope geometries, parapet heights, and usable rooftop area.
- **Responsible Authority**: City Survey and Land Records Office (CTSO); PMC Town Planning & Building Permission Department.
- **UrjaSetu Mitigation**: Prohibits synthetic buffering. Rooftop area is marked as `Not established from point geometry (requires CTSO cadastre demarcation)`.

### 2.3 MSEDCL Substation Transformer Loading & Available Headroom
- **Current State**: 6 high-voltage substations recorded with verified nameplate MVA capacity; spare headroom is strictly set to `null`.
- **Data Gap**: Dynamic feeder loading curves, distribution transformer loading percentages, reverse power hosting capacity, and peak solar injection limits.
- **Responsible Authority**: Maharashtra State Electricity Distribution Co. Ltd. (MSEDCL) Pune Circle / SLDC Kalwa.
- **UrjaSetu Mitigation**: Distinguishes spatial proximity from electrical feasibility. Displays `Not available — requires MSEDCL confirmation`.

### 2.4 Real-Time EV Charger Telemetry & Dynamic Utilization
- **Current State**: 13 public charging locations derived from OpenStreetMap nodes.
- **Data Gap**: Real-time live status (Available, Charging, Faulted, Offline), instantaneous power draw (kW), and pricing.
- **Responsible Authority**: Charge Point Operators (CPOs: Tata Power EZ Charge, Magenta Power, Statiq, Jio-bp) via Open Charge Point Protocol (OCPP 1.6/2.0.1) or OCPI.
- **UrjaSetu Mitigation**: Stripped all fabricated default connector counts. Recommends live OCPP API integration in future phases.

### 2.5 Subsurface Road Utility Duct Alignments
- **Current State**: 10 arterial road corridors recorded as sample centerline points with estimated carriageway widths.
- **Data Gap**: 3D underground utility cadastre showing exact alignments and depths of high-voltage cables, water distribution mains, sewage lines, and telecom optical fiber ducts.
- **Responsible Authority**: PMC Road Department; MSEDCL Underground Cabling Cell; Mahanagar Gas Limited (MGL); BSNL / private telecom operators.
- **UrjaSetu Mitigation**: Mandates non-destructive ASCE 38-02 Quality Level B Ground Penetrating Radar (GPR) scanning in all project dossiers prior to tree pit excavation.

### 2.6 In-Situ Microclimate & 2-Meter Ambient Air Temperature ($T_{\text{air}}$)
- **Current State**: Instantaneous Land Surface Temperature ($T_{\text{skin}}$) from Landsat 9 TIRS-2 at ~10:57 AM local solar time.
- **Data Gap**: Continuous diurnal 2-meter air temperature ($T_{\text{air}}$), relative humidity, wind speed, and Wet-Bulb Globe Temperature (WBGT) across urban street canyons.
- **Responsible Authority**: India Meteorological Department (IMD) Pune; Indian Institute of Tropical Meteorology (IITM); PMC Environment Department.
- **UrjaSetu Mitigation**: Explicitly disclaims that LST is radiometric surface skin temperature, not ambient air temperature or human physiological heat index.
