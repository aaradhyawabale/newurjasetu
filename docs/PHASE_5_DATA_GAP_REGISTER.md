# UrjaSetu Phase 5 — Municipal & Engineering Data Gap Register

## Purpose
This register tracks missing spatial, structural, geotechnical, and electrical datasets that cannot be derived from satellite remote sensing or OpenStreetMap extracts alone. Urban planners and engineers must clear these data gaps through physical site surveys and departmental coordination prior to tendering or implementation.

---

## 1. Data Gaps by Intervention Category

### A. Urban Greening & Tree Corridors (`URBAN_GREENING_CORRIDOR`)
| Missing Dataset / Survey | Mandated Methodology / Standard | Responsible Agency | Risk If Unresolved |
|---|---|---|---|
| Underground Utility Cadastre (Gas, Power, Fiber, Water) | ASCE 38-02 Quality Level B Ground-Penetrating Radar (GPR) | PMC Road Dept, MNGL, MSEDCL | Severe pipe or high-voltage cable rupture during tree pit excavation |
| Effective Pedestrian Walkway Clear Width | IRC:103-2012 Walkability & Pedestrian Infrastructure Audit | PMC Traffic Engineering Cell | Pedestrian spillover into active vehicular lanes if walkway width < 1.8m |
| Arboricultural Health of Existing Canopy | ISA Tree Risk Assessment Qualification (TRAQ) Sonic Tomography | PMC Garden Department | Premature tree failure or hazard during monsoon squalls |

### B. Cool Roof Investigation Opportunities (`COOL_ROOF_FEASIBILITY`)
| Missing Dataset / Survey | Mandated Methodology / Standard | Responsible Agency | Risk If Unresolved |
|---|---|---|---|
| Concrete Slab Structural Integrity | Non-destructive rebound hammer & ultrasonic pulse velocity (IS 516 / IS 13311) | Licensed Structural Engineer, PMC Structural Cell | Structural overloading or collapse on aged public slabs |
| Net Usable Unobstructed Rooftop Area | High-resolution drone photogrammetry / Total Station CAD survey | PMC Building Maintenance Cell | Inaccurate procurement quantities and overestimation of energy savings |
| Subsurface Moisture & Screed Waterproofing Condition | ASTM C1153 Infrared Rooftop Moisture Scanning at dusk | Waterproofing Specialist Contractor | Entrapment of water under high-SRI coating leading to blistering and ceiling leaks |

### C. Solar Canopy & EV Co-Location (`SOLAR_CANOPY_EV_COLOCATION`)
| Missing Dataset / Survey | Mandated Methodology / Standard | Responsible Agency | Risk If Unresolved |
|---|---|---|---|
| Distribution Transformer (DT) Capacity & Reverse Power Limit | CEA Regulations 2019 / MSEDCL Load-Flow Interconnection Study | MSEDCL Electrical Distribution Division | Grid feeder tripping and denial of grid-tie net-metering permission |
| Wind Uplift & Foundation Anchorage Testing | IS 875 (Part 3) Wind Load Calculations + ASTM E488 Anchor Pull-out Testing | Structural Engineer & Geotechnical Firm | Canopy overturning or roof deck column failure under peak gusts (Vb = 39 m/s) |
| Heavy Vehicle Swept-Path Turning Radii | AutoTURN simulation under IRC:SP:112 Heavy Vehicle Standards | PMC Traffic Police & PMPML | Collision of turning transit buses with canopy support columns |

### D. Urban Green-Space Improvement (`GREEN_SPACE_ENHANCEMENT`)
| Missing Dataset / Survey | Mandated Methodology / Standard | Responsible Agency | Risk If Unresolved |
|---|---|---|---|
| Hydrogeological Percolation Rate & Aquifer Depth | CGWA Guidelines 2020 / Double-Ring Infiltrometer Testing | Central Ground Water Authority & PMC Environment Dept | Ineffective stormwater recharge shafts or groundwater contamination |
| Soil Organic Carbon, pH & Salinity Profile | ICAR Standard Laboratory Soil Testing Protocol | College of Agriculture Pune & PMC Garden Dept | Failure of newly planted indigenous species due to soil compaction or toxicity |
| Municipal Cadastral Boundary Encroachment Audit | CTSO / DILR Cadastral Demarcation Map | Inspector of Land Records (DILR) | Encroachment litigation halting landscaping works |

### E. Integrated Facility Upgrades (`INTEGRATED_FACILITY_UPGRADE`)
| Missing Dataset / Survey | Mandated Methodology / Standard | Responsible Agency | Risk If Unresolved |
|---|---|---|---|
| Campus-Wide Energy & Thermal Load Profile | ASHRAE Level II / BEE Certified Energy Auditor Comprehensive Audit | Certified Energy Auditor (BEE) | Mis-sizing of solar inverter capacity relative to daytime baseload |
| Multi-Modal Microclimate CFD Simulation | ENVI-met 3D Microclimate & Pedestrian Comfort (UTCI/PET) Modeling | Urban Climatology Institute / COEP | Suboptimal shading layout failing to reduce pedestrian heat stress |
| Multi-Agency Land Title & Operational Jurisdiction Matrix | Inter-departmental MoU (PMC, MahaMetro, MSRTC, Central Railway) | Urban Development Dept (Govt of Maharashtra) | Project paralysis due to overlapping institutional ownership |

---

## 2. Governance Protocol
No candidate site within the UrjaSetu system may advance from `ELIGIBLE_FOR_REVIEW` to `IMPLEMENTATION_TENDERING` until all Phase 1 (`TECHNICAL_FEASIBILITY`) survey items in this register have been formally validated and attached to the candidate dossier.
