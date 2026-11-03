# UrjaSetu Phase 6.1 — Remaining Municipal Data Gaps & Technical Roadmap

**Date:** November 1, 2026  
**Status:** Statutory Planning Governance & Data Gap Register  
**Jurisdiction:** Pune Municipal Corporation (PMC) & MSEDCL Pune Circle  

---

## 1. Executive Summary

While Phase 6.1 successfully audited, sanitized, and authenticated all ingested datasets, several fundamental municipal geospatial and telemetry gaps cannot be resolved purely through open-source satellite and GIS extracts. This register establishes an explicit, transparent inventory of remaining data gaps, explains why they cannot be fabricated, and outlines the statutory mitigation requirements necessary before municipal sanction.

---

## 2. Municipal Data Gap Matrix

| # | Missing Municipal / Technical Element | Responsible Statutory Body | Current System State | Technical Impact on Planning | Mandatory Site Survey / Statutory Action Required |
|:---:|:---|:---|:---|:---|:---|
| **1** | **City Survey Cadastral Parcel Demarcation** | City Survey Office (CTSO) / PMC Land Estate Dept | Non-authoritative research boundary derived from Prabhag wards | Point centroids used for public gardens, hospitals, and EV points; exact parcel boundary polygons unavailable | Formal CTSO total-station boundary survey and property card (*7/12 utara* / CTS extract) verification |
| **2** | **Distribution Transformer Spare Headroom & Reverse Power Capacity** | MSEDCL Pune Circle (Urban Infrastructure Planning) | Static nameplate capacity ratings (MVA) from public disclosures; headroom set to `null` | Physical proximity to 11kV/33kV substations known, but spare feeder capacity for high-power EV charging or solar PV export is unverified | Formal Grid Interconnection Application and load-flow simulation study by MSEDCL |
| **3** | **Real-Time EV Charger Telemetry & Socket Occupancy** | Charge Point Operators (CPOs) / Bureau of Energy Efficiency (BEE) | Static point coordinates mapped in OpenStreetMap (`MAPPED_IN_OSM`); telemetry marked `false` | Physical existence of chargers verified, but live uptime, power rating, and bay occupancy unknown | Integration with CPO Open Charge Point Protocol (OCPP 1.6/2.0.1) REST APIs or BEE EV Yatra portal |
| **4** | **Continuous Linear Road Right-of-Way (ROW) Vector Alignments** | PMC Road Department & Town Planning Dept | Representative corridor centroid sample points with estimated carriageway widths | Centerline trace available in KMZ without street names; corridors cannot be treated as surveyed linear geometries | Ingestion of official PMC Development Plan (DP) 2007-2027 sanctioned road widening and ROW sheets |
| **5** | **Net Usable Unencumbered Rooftop Structural Area** | PMC Building Permission Dept & Health Department | Building footprint estimates (e.g. 1,200 m² for hospitals); usable area set to preliminary proxy | Rooftop equipment (HVAC chillers, water tanks, stairwells, parapets) typically consumes 25%–55% of gross roof area | On-site architectural drone photogrammetry and non-destructive rebound hammer concrete testing (IS 516) |
| **6** | **Subsurface Utility Conduits (GPR Cadastre)** | Utility Operators (MNGL, BSNL, MSEDCL, PMC Water Works) | Absent from open GIS datasets; flagged as `CRITICAL_BLOCKER` or `MODERATE_CONSTRAINT` | High risk of utility strikes during roadside tree basin excavation or EV canopy foundation borehole drilling | ASCE 38-02 Quality Level B Ground Penetrating Radar (GPR) utility scanning along corridor alignments |
| **7** | **2m Ambient Air Temperature & Nocturnal Heat Island Dynamics** | India Meteorological Department (IMD) / IITM Pune | Daytime radiometric surface skin temperature (LST) from Landsat 9 ST_B10 at 10:57 AM local time | Captures high-albedo radiant emitters, but does not directly measure nocturnal trapped heat or ambient human thermal comfort (UTCI) | Ingestion of IMD Pune automatic weather station (AWS) continuous hourly meteorological records |

---

## 3. Deep-Dive on Critical Data Limitations

### 3.1 Cadastral Demarcation vs Point Centroids

In municipal planning, an intervention cannot proceed to a Detailed Project Report (DPR) or tendering based solely on point coordinates. The official PMC garden register (`pmc_gardens.json`) and hospital register (`pmc_hospitals.json`) provide entrance and centroid coordinates. 

**Why UrjaSetu does NOT synthesize artificial boundary polygons:**
- Generating synthetic bounding boxes or buffer polygons around point coordinates gives a false appearance of cadastral certainty.
- In dense Indian cities like Pune, property boundaries frequently abut private encroachments, drainage nullahs, and road reservations.
- **UrjaSetu Standard:** The system displays point features with explicit notice: *"Point Centroid Feature: Parcel cadastral boundary requires City Survey Office (CTSO) demarcation."*

---

### 3.2 Electrical Headroom vs Nameplate Transformer Rating

Substations in `pmc_substations.json` list nameplate capacities (e.g., Shivajinagar 132/33kV at 100 MVA, Kothrud 33/11kV at 31.5 MVA). 

**The Engineering Difference:**
- **Nameplate Rating:** The maximum continuous power rating of the power transformer.
- **Available Spare Headroom:** The remaining transformer capacity after subtracting base industrial/residential demand, peak air-conditioning surge, and diversity factors.
- In heavily loaded substations (e.g. Kothrud or Shivajinagar), available headroom during summer peak hours may be less than 5% of nameplate capacity, requiring dedicated feeder line augmentation before a 240 kW EV fast-charging hub or 500 kW solar canopy can be commissioned.
- **UrjaSetu Standard:** `availableHeadroomMva` is strictly set to `null` with status `UNVERIFIED_REQUIRES_MSEDCL_SANCTION`. The system explicitly warns planners: *"Physical proximity indicates layout feasibility only; available transformer headroom requires formal MSEDCL load-flow clearance."*

---

### 3.3 Radiometric Skin LST vs Ambient Air Temperature

A common error in urban heat island reporting is claiming that a tree planting or cool roof project will reduce "air temperature by $X^\circ\text{C}$" based on satellite Land Surface Temperature (LST).

- **Landsat 9 ST_B10:** Measures upwelling thermal infrared radiance emitting from the top skin layer of surfaces at ~10:57 AM local solar time. Asphalt can reach 52°C while the 2m ambient air temperature is 38°C.
- **Microclimatic Cooling Effect:** Replacing dark bitumen with a high-albedo coating (SRI $\ge 78$) reduces surface skin temperature by 10°C to 18°C. However, the resulting 2m ambient air temperature reduction is typically 0.5°C to 1.5°C, mediated by atmospheric wind advection and convective heat transfer.
- **UrjaSetu Standard:** Copilot and Planning Dossiers explicitly report *surface skin radiometric temperature* and refuse to fabricate unverified ambient air temperature drops or bioclimatic cooling claims.

---

## 4. Statutory Survey Checklist Required Prior to Municipal Tendering

For every candidate progressing from `ELIGIBLE_FOR_REVIEW` or `CONDITIONALLY_ELIGIBLE` to implementation, the following field validation surveys are legally and technically mandated:

1. **CTSO Total-Station Cadastral Demarcation:** Formally delineate municipal parcel boundary corners and right-of-way (ROW) lines.
2. **ASCE 38-02 Quality Level B GPR Scanning:** Map all buried gas, electrical, water, and telecom conduits along the excavation footprint.
3. **MSEDCL Grid Feeder Interconnection Study:** Perform reverse power flow and fault-level calculation for distributed generation and DC fast charging.
4. **Concrete Slab Non-Destructive Testing (IS 516 / ASTM D4541):** Measure slab compressive strength, moisture ingress, and membrane pull-off adhesion before applying cool roof elastomeric coatings.
5. **Structural Wind Uplift Calculation (IS 875 Part 3):** Engineer elevated steel canopy trusses for Pune Basic Wind Speed ($V_b = 39\text{ m/s}$).
6. **Botanical Inventory & Soil Infiltration Profiling (CPWD / CGWA):** Conduct species census and double-ring infiltrometer soil percolation tests for rainwater recharge shafts.
