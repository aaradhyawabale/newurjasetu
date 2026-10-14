# UrjaSetu: Explainability, Uncertainty Taxonomy & Sensitivity Analysis

## Overview
UrjaSetu is an evidence-backed, multi-criteria decision analysis (MCDA) engine for public infrastructure planning. In accordance with Smart India Hackathon jury requirements and urban planning governance standards (URDPFI, IRC, CEA, CPCB), UrjaSetu does **not** treat site suitability as an opaque black box.

Every suitability score is:
1. **Fully Decomposed**: Every criterion exposes its raw measured value, SI unit, source provider, piecewise mathematical normalization function, and net weighted contribution.
2. **Explicitly Categorized for Uncertainty**: Data points are classified into 5 strict epistemic categories to prevent overclaiming confidence.
3. **Subject to Mandatory Constraint Overrides**: A site that violates physical feasibility or safety buffers cannot score favorably merely by performing well on other criteria.
4. **Stress-Tested Across Alternative Stakeholder Priorities**: Deterministic sensitivity analysis re-evaluates the candidate site across at least 3 distinct weight profiles (Balanced Planning, Operational Logistics, Equity/Environmental Priority) and calculates rank stability.

---

## 1. Uncertainty Taxonomy & Provenance Classification

UrjaSetu classifies every criterion into one of 5 uncertainty states:

| Classification | Definition | Example in UrjaSetu | Epistemic Treatment |
| :--- | :--- | :--- | :--- |
| `confirmed_constraint` | Hard physical boundary or regulatory exclusion verified via vector geometry | Overpass OSM building footprint intersection or 30m railway exclusion corridor | Triggers `fail` or `warn` status. If failed, overall score capped at $\le 24$ regardless of weighted sum. |
| `evidence_supported` | Quantifiable metric derived directly from empirical sensor or authoritative vector datasets | NASA POWER 22-year satellite GHI irradiance ($5.35\text{ kWh/m}^2/\text{day}$) | High confidence ($>0.85$). Normal piecewise evaluation applies. |
| `incomplete_evidence` | Query returned sparse, truncated, or bounded results due to bounding box limits | Overpass API returns 0 waterways in a 500m radius in an area with sparse OSM mapping | Confidence marked incomplete. Benchmark interpreted conservatively without assuming favorable conditions. |
| `estimated_proxy` | Empirical mathematical proxy or Manning equation approximation | Catchment impervious surface ratio estimated from building and highway vector footprint area | Clearly labeled as an indicative proxy; limitations documented in report scorecard. |
| `unknown_condition` | Provider timed out, API rate limited, or dataset lacks coverage for the coordinates | Cloud cover archive unavailable or DEM elevation grid missing | Criterion score set to neutral default ($50/100$) with explicit warning note; confidence penalised. |

---

## 2. Multi-Criteria Scoring & Piecewise Normalization

### Mathematical Model
For candidate site $S$ with $N$ criteria, raw measured values $x_i$ are normalized into dimensionless criterion scores $s_i \in [0, 100]$:

$$s_i = f_i(x_i)$$

where $f_i$ is a piecewise linear utility function defined in `src/server/analysis-engine/scoring.ts`.

#### Raw Weighted Score
Each criterion $i$ has an assigned weight $w_i \in (0, 1]$ where $\sum_{i=1}^N w_i = 1.0$:

$$\text{Score}_{\text{raw}} = \sum_{i=1}^N \left( w_i \times s_i \right)$$

The individual **weighted contribution** presented in the UI scorecard and PDF is:

$$c_i = w_i \times s_i$$

### Mandatory Constraint Override Policy
Standard MCDA models suffer from the **compensatory flaw**: a site directly colliding with an existing hospital or river channel could theoretically score $78/100$ if its solar irradiance and road proximity are ideal. UrjaSetu eliminates this flaw through hard constraint gating:

$$\text{Score}_{\text{final}} = \begin{cases} 
\min(\text{Score}_{\text{raw}}, 24), & \text{if } \text{validationStatus} = \text{"fail"} \text{ (Critical Conflict)} \\
\min(\text{Score}_{\text{raw}}, 65), & \text{if } \text{validationStatus} = \text{"warn"} \text{ (Moderate Warning)} \\
\text{Score}_{\text{raw}}, & \text{if } \text{validationStatus} = \text{"pass"} \text{ (Feasible)}
\end{cases}$$

---

## 3. Stakeholder Sensitivity Analysis

Urban infrastructure planning involves competing stakeholder objectives. For example, an emergency medical director prioritizes arterial transit times, while a public health director prioritizes underserved catchment equity.

### Weight Profiles
For all 10 infrastructure types, UrjaSetu defines at least 3 distinct weight profiles (`src/server/analysis-engine/weight-profiles.ts`):
1. **Baseline / Standard Balanced Planning**: Standard URDPFI / CPHEEO urban planning norms.
2. **Operational / Logistics / Capacity Priority**: Emphasizes structural throughput, grid interconnection, or emergency travel speeds.
3. **Public Equity / Environmental Synergy Priority**: Emphasizes serving unserved residential populations, wetland protection, or hazard mitigation.

### Rank Stability Index
For candidate site $S$, the sensitivity analysis computes scores across all profiles $p \in P$:

$$\Delta_{\text{score}} = \max_{p \in P}(S_p) - \min_{p \in P}(S_p)$$

The candidate site is classified into one of three stability bands:
- **`stable`** ($\Delta_{\text{score}} \le 8\text{ points}$): Site suitability is robust and resilient to stakeholder priority shifts.
- **`sensitive`** ($9 \le \Delta_{\text{score}} \le 18\text{ points}$): Ranking depends moderately on stakeholder weighting.
- **`highly_sensitive`** ($\Delta_{\text{score}} \ge 19\text{ points}$): Strong trade-offs present; site suitability depends critically on chosen policy priorities.

---

## 4. Worked Example 1: Solar Farm (New Delhi)

### Location & Design Parameters
- **Coordinates**: $28.6139^\circ\text{N}, 77.2090^\circ\text{E}$ (Central Delhi Plains)
- **Footprint**: $250\text{m} \times 200\text{m}$ ($50,000\text{ m}^2 / 5.0\text{ ha}$)
- **Target Capacity**: $3.5\text{ MWp}$ ground-mounted utility PV

### Retrieved Geographic Evidence
1. **Solar Resource**: NASA POWER Satellite Climatology (22-year average)
   - Annual Average Global Horizontal Irradiance (GHI): $5.35\text{ kWh/m}^2/\text{day}$
2. **Topography**: Open-Meteo DEM Elevation Model
   - Terrain Slope: $2.1\%$ (Nearly flat alluvial plain)
3. **Electrical Interconnection**: OpenStreetMap Overpass API
   - Nearest Electrical Substation / Power Line: $1,420\text{m}$
4. **Access Infrastructure**: OpenStreetMap Overpass API
   - Distance to Nearest Secondary / Primary Road: $180\text{m}$
5. **Shading Obstruction**: Overpass Building Polygons
   - Mean Surrounding Building Height: $7.2\text{m}$ at $>150\text{m}$ distance (Negligible shading)
6. **Data Confidence**: OSM Volunteered Geographic Density
   - Data Density: $240\text{ points/km}^2$

### Criterion Scorecard & Weighted Contributions

| Criterion ID | Metric | Measured Value | Unit | Piecewise Formula | Criterion Score ($s_i$) | Baseline Weight ($w_i$) | Weighted Contribution ($c_i$) | Uncertainty Classification | Data Source |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `solar_irradiance` | Annual GHI | 5.35 | $\text{kWh/m}^2/\text{day}$ | $s = \min(100, \frac{5.35 - 3.5}{6.0 - 3.5} \times 100)$ | **74.0** | 0.35 | **25.90** | `evidence_supported` | NASA POWER API |
| `grid_substation_proximity` | Distance to Substation | 1,420 | $\text{m}$ | $s = \max(0, 100 - \frac{1420 - 500}{5000 - 500} \times 80)$ | **83.6** | 0.25 | **20.90** | `evidence_supported` | OpenStreetMap Overpass |
| `slope_and_aspect` | Terrain Slope | 2.1 | $\%$ | $s = 100 - (\frac{2.1}{5.0} \times 20)$ | **91.6** | 0.20 | **18.32** | `evidence_supported` | Open-Meteo DEM |
| `road_maintenance_access` | Distance to Road | 180 | $\text{m}$ | $s = 100 - (\frac{180}{500} \times 25)$ | **91.0** | 0.05 | **4.55** | `evidence_supported` | OpenStreetMap Overpass |
| `shading_obstruction_proxy`| Obstruction Angle | 2.8 | $\text{deg}$ | $s = 100 - (\frac{2.8}{15.0} \times 20)$ | **96.3** | 0.05 | **4.82** | `estimated_proxy` | Overpass Building Heights |
| `osm_coverage` | Feature Density | 240 | $\text{pts/km}^2$| $s = \min(100, \frac{240}{100} \times 100)$ | **100.0** | 0.10 | **10.00** | `evidence_supported` | OSM Geographic Density |
| **TOTAL** | | | | | | **1.00** | **84.49 $\rightarrow$ 84** | | |

### Sensitivity Analysis Across Alternative Profiles

| Profile ID | Profile Name | Irradiance Weight | Grid Weight | Slope Weight | Road Weight | Shading Weight | OSM Weight | Computed Score | Suitability Band |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `baseline` | Standard Balanced Planning | 0.35 | 0.25 | 0.20 | 0.05 | 0.05 | 0.10 | **84.5** | Excellent |
| `yield_maximization` | Maximum Energy Yield Priority | 0.50 | 0.15 | 0.15 | 0.05 | 0.10 | 0.05 | **82.3** | Excellent |
| `grid_capex_minimization` | Interconnection & Civil Capex Priority | 0.25 | 0.40 | 0.15 | 0.10 | 0.05 | 0.05 | **85.7** | Excellent |

- **Sensitivity Delta ($\Delta_{\text{score}}$)**: $|85.7 - 82.3| = 3.4\text{ points}$
- **Rank Stability**: **`stable`** ($\Delta \le 8$)
- **Interpretation**: The site remains solidly in the *Excellent* band ($>80$) across all stakeholder priority profiles because its solar resource, flat topography, and grid connectivity are uniformly favorable.

---

## 5. Worked Example 2: Hospital Siting with a Mandatory Constraint Conflict

### Location & Conflict Scenario
- **Coordinates**: $19.0760^\circ\text{N}, 72.8777^\circ\text{E}$ (Mumbai Suburban Ward)
- **Infrastructure**: General Hospital ($120\text{m} \times 80\text{m}$, 200 beds)
- **Accessibility & Demand Metrics**:
  - Arterial Road Frontage: $45\text{m}$ (Excellent, $s = 95/100$)
  - Medically Underserved Catchment: High population deficit ($s = 90/100$)
  - Residential Catchment: 4,200 apartments within 800m ($s = 92/100$)
- **Critical Conflict**: The proposed building boundary directly intersects a designated multi-story commercial structure and high-tension utility easement.
  - Turf.js polygon intersection check: `overlapArea = 1,450 m²`
  - Validation status: **`fail`** (Critical Obstruction Conflict)

### Score Calculation with Mandatory Constraint Enforcement

1. **Unconstrained Weighted MCDA Sum**:
   $$\text{Score}_{\text{raw}} = (0.20 \times 95) + (0.20 \times 90) + (0.20 \times 92) + (0.15 \times 70) + (0.15 \times 85) + (0.10 \times 95) = 88.65 / 100$$
   *(Appears to be an "Excellent" site under traditional unconstrained scoring).*

2. **Application of Mandatory Constraint Cap**:
   $$\text{validationStatus} = \text{"fail"} \implies \text{Cap} = 24$$
   $$\text{Score}_{\text{final}} = \min(88.65, 24) = \mathbf{24 / 100} \text{ (Unsuitable)}$$

3. **Sensitivity Analysis Override**:
   Even if the stakeholder shifts to the `emergency_access` profile ($w_{\text{arterial}} = 0.35$):
   $$\text{Score}_{\text{profile raw}} = 90.2 \implies \text{Overridden to } \mathbf{24 / 100}$$
   The candidate site remains **strictly locked** at $\le 24$ across all profiles until the geometric collision is resolved.

---

## 6. Verification and Reproducibility

To verify the explainability, constraint enforcement, and sensitivity computations programmatically:

```bash
# Run the sensitivity and MCDA test suite
npx vitest run tests/unit/sensitivity.test.ts

# Run the complete test suite (51 unit, integration, and geometry tests)
npm test

# Verify TypeScript type-safety
npx tsc --noEmit
```
