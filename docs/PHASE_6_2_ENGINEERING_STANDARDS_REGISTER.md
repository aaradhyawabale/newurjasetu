# UrjaSetu Phase 6.2 — Engineering Standards Applicability Register

**Document ID:** `DOC-URJASETU-6.2-STD-01`  
**Status:** Approved & Machine-Integrated  
**Date:** November 2026  
**Jurisdiction:** Pune Municipal Corporation, Maharashtra, India  

---

## 1. Executive Summary & Legal Framework

Urban infrastructure planning systems must maintain rigorous boundaries between **statutory legal mandates**, **contractual specifications**, and **voluntary technical references**. 

In previous iterations of municipal planning tools, technical testing methods from foreign or voluntary bodies (e.g., American Society for Testing and Materials, Green Seal, American Society of Civil Engineers) were occasionally referenced alongside Indian statutory codes without explicit legal qualification.

UrjaSetu Phase 6.2 establishes a structured **Standards Applicability Register** (`src/server/intervention-engine/standards-registry.ts`) that categorizes every referenced engineering standard into one of six legal statuses:
1. `STATUTORY_REQUIREMENT`: Legally mandated by national Acts, state rules, or municipal building regulations.
2. `CONTRACTUAL_REQUIREMENT`: Binding when explicitly cited in public tender schedules and contracts (e.g., CPWD / MoRTH).
3. `TECHNICAL_REFERENCE`: Internationally recognized engineering test protocols referenced for quality verification.
4. `RECOMMENDED_PRACTICE`: Voluntary design guidelines, green building rating targets, or advisory codes.
5. `NOT_APPLICABLE`: Standards lacking legal or technical relevance without explicit local adoption.
6. `UNVERIFIED`: Standards whose legal standing remains unconfirmed for the asset class.

---

## 2. Master Standards Applicability Matrix

| Standard Code | Issuing Body | Origin | Legal Category | Statutory / Contractual Basis | Pune Municipal Applicability Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BEE ECBC 2017 Table 4.1** | Bureau of Energy Efficiency (BEE), MoP | India | `STATUTORY_REQUIREMENT` | Energy Conservation Act 2001; Maharashtra ECBC Rules | Mandatory for commercial/institutional buildings with connected load $\ge 100\text{ kW}$ or contract demand $\ge 120\text{ kVA}$. Cool roof minimums: Initial Reflectance $\ge 0.70$, Emittance $\ge 0.75$, SRI $\ge 78$. |
| **IS 875 (Part 3): 2015** | Bureau of Indian Standards (BIS) | India | `STATUTORY_REQUIREMENT` | National Building Code 2016; Maharashtra UDCPR | Mandatory wind loading design for all building superstructures, solar canopies, carports, and roof frames. Basic wind speed for Pune: $V_b = 39\text{ m/s}$ (Zone 2). |
| **CEA Safety Regulations 2010** | Central Electricity Authority, MoP | India | `STATUTORY_REQUIREMENT` | Electricity Act 2003 (Sec 53 & 177) | Mandatory safety clearances for 11 kV, 22 kV, and 33 kV installations, overhead line clearances, and grounding. |
| **CPWD Specifications 2019** | Central Public Works Department, MoHUA | India | `CONTRACTUAL_REQUIREMENT` | Public Works Contract Schedules | Binding on civil and waterproofing tenders executed under government works schedules. |
| **IRC:SP:73-2018** | Indian Roads Congress (IRC) | India | `CONTRACTUAL_REQUIREMENT` | MoRTH Standard Concession EPC Contracts | Two-lane highway geometric and capacity standards for state highways and arterial road contracts. |
| **IRC:103-2012** | Indian Roads Congress (IRC) | India | `RECOMMENDED_PRACTICE` | IRC Technical Guidelines | Advisory pedestrian planning code. Recommends minimum 1.8m unobstructed pedestrian path. Becomes binding only when formally enacted into PMC urban road guidelines. |
| **Green Seal GS-11** | Green Seal, Inc. | USA | `RECOMMENDED_PRACTICE` | Voluntary Ecolabel | International voluntary environmental standard restricting VOCs (< 50 g/L). Non-statutory in India; referenced for occupied sensitive environments (hospitals). |
| **IS 516 (Part 5): 2021** | Bureau of Indian Standards (BIS) | India | `TECHNICAL_REFERENCE` | BIS Laboratory Testing Manual | Standardized non-destructive testing (NDT) methods (ultrasonic pulse velocity & rebound hammer) to assess concrete slab soundess. |
| **ASTM D4541-22** | ASTM International | USA | `TECHNICAL_REFERENCE` | ASTM Consensus Standards | Standardized tensile pull-off test method for coating adhesion ($\ge 1.5\text{ MPa}$). Foreign testing benchmark; no statutory authority in India. |
| **ASCE 38-02 / 38-22** | American Society of Civil Engineers (ASCE) | USA | `TECHNICAL_REFERENCE` | ASCE Engineering Guideline | Standard for depicting subsurface utilities (Quality Levels D to A). Non-statutory in India; referenced for GPR Quality Level B pre-dig survey protocol. |

---

## 3. Detailed Forensic Audit of Cited Claims

### 3.1 ASTM D4541 (Coating Pull-off Adhesion)
- **Previous Claim**: "ASTM D4541 mandatory testing required before cool roof application."
- **Audit Correction**: ASTM D4541 is a United States technical test method. In India, it is frequently referenced in high-performance coatings contracts, but it is **not** an Indian statutory regulation. UrjaSetu now explicitly designates it as `TECHNICAL_REFERENCE` used for tender quality assurance.

### 3.2 Green Seal GS-11 (Low-VOC Coatings)
- **Previous Claim**: "Must comply with statutory Green Seal GS-11 limits for hospital wards."
- **Audit Correction**: Green Seal GS-11 is a private US certification ecolabel with zero legal jurisdiction in Maharashtra. Statutory environmental air quality mandates in India derive from the Central Pollution Control Board (CPCB) and MoEFCC. Green Seal GS-11 is retained solely as a voluntary `RECOMMENDED_PRACTICE` benchmark for indoor patient ward protection.

### 3.3 ASCE 38-02 (Subsurface Utility Depiction)
- **Previous Claim**: "ASCE 38-02 Level B compliance required by law for road corridors."
- **Audit Correction**: ASCE 38-02 is an American engineering standard. In India, road excavation is governed by local PMC Municipal Corporation road cutting permissions and MSEDCL/Mahanagar Gas alignment clearances. ASCE 38-02 is now designated as `TECHNICAL_REFERENCE` describing the recommended geophysical survey methodology (GPR / EMI).

### 3.4 BEE ECBC 2017 Table 4.1 (Cool Roof SRI)
- **Audit Finding**: Confirmed as `STATUTORY_REQUIREMENT` under the Energy Conservation Act 2001 and Maharashtra ECBC regulations for designated commercial and institutional facilities meeting the connected load threshold ($\ge 100\text{ kW}$).

### 3.5 IS 875 Part 3 (Wind Loading)
- **Audit Finding**: Confirmed as `STATUTORY_REQUIREMENT` via National Building Code 2016 and Maharashtra Unified Development Control and Promotion Regulations (UDCPR). Structural calculation sheets signed by a registered structural engineer are required for solar canopies in Pune (design wind speed $39\text{ m/s}$).

---

## 4. Machine Integration
The registry is exported from `src/server/intervention-engine/standards-registry.ts` and directly queried by candidate evaluation engines, dossier generators, and the Gemini Copilot, preventing any conflation of voluntary international benchmarks with Indian municipal statutes.
