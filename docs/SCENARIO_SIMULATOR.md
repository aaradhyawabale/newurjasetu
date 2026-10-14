# Infrastructure Impact and Scenario Simulator

UrjaSetu includes an explainable, multi-candidate **Infrastructure Impact and Scenario Simulator** designed for municipal planners, energy developers, and infrastructure decision-makers. It enables rigorous, evidence-backed evaluation of alternative siting candidates and planning scenarios using identical criteria, spatial separation metrics, and impact trade-offs.

---

## 1. Architecture Overview

The Scenario Simulator integrates directly into UrjaSetu's existing multi-criteria geospatial engine and Next.js / Prisma architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Scenario Simulator Modal                        │
│   (Rankings Overview • Criteria Differential • Impact • Uncertainty)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Comparative Analysis Endpoints                      │
│   • GET /api/scenarios/[id]/compare                                    │
│   • POST /api/scenarios/compare                                        │
│   • GET /api/scenarios/[id]/compare/pdf                                │
│   • POST /api/scenarios/compare/pdf                                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Comparison & Simulation Engine                      │
│   • src/server/scenarios/comparison.ts                                 │
│   • Normalized Candidate Summaries & Mandatory Constraints Audit       │
│   • Differential Matrix (Delta Score = Leader - Trailing)              │
│   • Spatial Impact Proxies & Geodesic Separation                       │
│   • Baseline Site vs Proposed Scenarios Disclaimers                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Prisma Persistence & Isolation                    │
│   • Scenarios (1:N) Placements (1:N) Analysis Reports                  │
│   • Strict user isolation: where: { userId: user.userId }              │
│   • Cascading delete integrity (Prisma onDelete: Cascade)             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Capabilities & Methodology

### Step 1 — Multiple Candidate Locations
- Planners can position and configure multiple candidate placements within a single scenario or across alternative scenarios.
- Each candidate persists its exact coordinates, orientation (bearing), length, width, area ($m^2$), infrastructure type, custom engineering parameters, and its latest analytical snapshot.

### Step 2 — Comparable Analysis
- **Direct Identical Criteria**: When candidate placements share the same infrastructure type (e.g. comparing two alternative Hospital sites), identical criterion IDs, weights, and benchmarks are used to compute mathematically exact delta scores ($\Delta \text{score} = \text{Score}_{\text{winner}} - \text{Score}_{\text{loser}}$).
- **Cross-Type Advisory**: When candidates represent heterogeneous infrastructure types (e.g. comparing a Hospital site against a Solar Farm), the simulator flags a `cross_type_advisory` notice advising planners to compare score bands, spatial footprints, and mandatory constraints rather than raw criterion deltas.

### Step 3 — Comparison View & Differential Matrix
- **Candidate Rankings**: Evaluates candidates by overall score (0–100) while enforcing mandatory exclusion rules. A site with high raw scores that violates a statutory buffer (e.g. railway corridor or prohibited waterway) receives an overriding penalty and is ranked below compliant alternatives.
- **Criteria Differential Table**: Presents criterion-level metrics, weights, and delta scores side-by-side, explicitly attributing winning performance to specific site factors (e.g. +30 pts in arterial access).
- **Strengths & Disadvantages**: Identifies top criteria advantages and limitations for each candidate.

### Step 4 — Impact Simulation & Spatial Proxies
- **Arterial Access**: Straight-line distance in meters to the nearest primary or secondary road network, categorized into Optimal ($\le 100\text{m}$), Acceptable ($\le 350\text{m}$), or Constrained ($> 350\text{m}$).
- **Geodesic Spatial Separation Matrix**: Computes true Haversine distance between all pairs of candidate sites.
- **Solar Screening Yield**: For Solar Farm candidates, derives estimated annual energy generation (MWh/year) and specific yield (kWh/kWp) based on local NASA POWER GHI and array capacity.
- **Service Catchment Proxy**: Evaluates facility counts within a 500m Euclidean radius.
  > [!IMPORTANT]
  > **Catchment Proxy Disclaimer**: Catchment calculations use straight-line Euclidean distance proxies. The system does not claim to calculate census population served, demographic service equity, or dynamic multimodal travel times without authoritative census block data.

### Step 5 — Baseline vs Scenario Modeling
- Compares pre-construction natural baseline site conditions (zero impervious surface, existing network proximity) against proposed civil intervention.
- Discloses the distinction between preliminary modeled spatial estimates and on-site geotechnical outcomes.

### Step 6 — Persistence & Security
- All scenario comparison and PDF export endpoints enforce strict user isolation (`where: { userId: user.userId }`).
- Scenario lifecycle operations (create, rename, switch, delete) maintain referential integrity with cascading deletion of placements and analyses.

### Step 7 — Reporting & PDF Export
- Generates high-fidelity PDF comparative scenario reports via `generateScenarioComparisonPdf` (`pdf-lib`), documenting scenario definitions, candidate rankings, the criteria differential table, spatial impact proxies, and legal/engineering disclaimers.

### Step 8 — Testing & Verification
- Unit test suite: `tests/unit/comparison.test.ts` (8 tests) verifies ranking logic, mandatory constraint penalties, criteria deltas, cross-type notices, missing evidence handling, spatial separation, and calculation consistency across identical inputs.
- Integration test suite: `tests/integration/scenarios.test.ts` (4 tests) validates API endpoints, user isolation across tenants, and binary PDF generation.
