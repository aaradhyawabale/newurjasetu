# Shadow-of-the-Future: Future-Aware Solar Shading Simulator

## Overview
**Shadow-of-the-Future** is an explainable, future-aware 3D solar shading simulator built directly into **UrjaSetu**. It allows municipal planners, solar developers, and Smart India Hackathon jury evaluators to rigorously evaluate how the surrounding built environment—both existing mapped structures and hypothetical future vertical developments—casts geometric shadows across a proposed ground-mounted photovoltaic or rooftop solar installation.

---

## 1. Project Alignment & Problem Statement
- **Domain Fit**: UrjaSetu (*Urja* = Clean Energy, *Setu* = Infrastructure Bridge) already supports **Solar Farm** as a first-class infrastructure type (`src/config/infra-types.ts`), complete with parameters (`targetCapacityMw`, `panelTiltDeg`) and multi-criteria evaluations (`solar_irradiance` via NASA POWER, `grid_substation_proximity`, `slope_and_aspect`, `road_maintenance_access`, and `shading_obstruction_proxy`).
- **Core Problem**: Traditional solar planning tools evaluate only the *historical* climatological irradiance or current static building footprint. In fast-urbanizing regions, adjacent plots frequently undergo vertical densification (e.g. 5-storey residential zones rezoned to 15-storey commercial corridors). A solar installation that appears viable today may suffer devastating beam obstruction within 3 to 5 years.
- **UrjaSetu Solution**: Without creating a fragmented separate application, Shadow-of-the-Future embeds an interactive 3D ray-casting simulator into UrjaSetu's existing MapLibre map and analysis workspace.

---

## 2. Geometric Inputs & Height Provenance (STEP 1)

Building heights in volunteered geographic information (OpenStreetMap) vary widely in completeness and accuracy. In accordance with UrjaSetu's epistemic integrity rules, the engine **never silently assigns precise heights to buildings whose heights are unknown**.

Every structure is classified into one of five height provenance states:

| Classification | Sourcing Method | Example in Engine | Epistemic Status |
| :--- | :--- | :--- | :--- |
| `measured` | Directly tagged in OpenStreetMap (`tags.height` or `attributes.heightM`) | `height=24.5` $\rightarrow 24.5\text{m}$ | High confidence. Direct laser/LIDAR/survey measurement. |
| `inferred_from_levels` | Computed from storey counts (`tags["building:levels"]` $\times 3.2\text{m}$) | `building:levels=5` $\rightarrow 16.0\text{m}$ | Explicitly labeled as an architectural storey proxy (3.2m per floor). Not a laser measurement. |
| `hypothetical_user` | Defined by the user in what-if scenarios (e.g. proposed adjacent commercial high-rise) | Proposed 50m tower | Strictly labeled as a hypothetical proposal. Never described as an approved master plan. |
| `default_assumption` | Missing both height and level tags in OSM, but user explicitly enabled a proxy (e.g. 6.0m) | 2-storey default proxy | Documented transparently in the scorecard and obstruction inspector. |
| `unavailable` | Missing all height tags, and proxy calculation is disabled | Height set to $0\text{m}$ | Excluded from 3D shadow projection to avoid fabricating ground geometry. |

---

## 3. Astronomical Solar Position Algorithm (STEP 2)

Shadow-of-the-Future uses a high-precision implementation of the **NOAA Astronomical Solar Position Algorithm** (Jean Meeus *Astronomical Algorithms*):

1. **Julian Day & Century**:
   $$JD = \frac{\text{unixMs}}{86400000} + 2440587.5, \quad T = \frac{JD - 2451545.0}{36525}$$
2. **Solar Declination ($\delta$) & Equation of Time ($EoT$)**:
   - Accounts for orbital eccentricity $e$, solar mean anomaly $M$, and obliquity of the ecliptic $\epsilon$.
3. **True Solar Time ($TST$) & Solar Hour Angle ($\omega$)**:
   $$TST = (\text{utcMinutes} + EoT + 4 \times \lambda) \bmod 1440$$
   $$\omega = \frac{TST}{4} - 180^\circ$$
4. **Apparent Solar Elevation ($\alpha$)**:
   $$\sin(\alpha_{\text{geom}}) = \sin(\phi)\sin(\delta) + \cos(\phi)\cos(\delta)\cos(\omega)$$
   Corrected for atmospheric refraction using the Bennett formula.
5. **Solar Azimuth ($\theta$, clockwise from True North $0^\circ$)**:
   $$y = -\sin(\omega), \quad x = \tan(\delta)\cos(\phi) - \sin(\phi)\cos(\omega)$$
   $$\theta = (\text{atan2}(y, x) \times \frac{180}{\pi} + 360^\circ) \bmod 360^\circ$$

---

## 4. Geometric Ground Shadow Projection (STEP 3)

1. **Anti-Solar Vector**:
   Light arriving from azimuth $\theta_{\text{sun}}$ projects shadows along the opposite bearing:
   $$\theta_{\text{shadow}} = (\theta_{\text{sun}} + 180^\circ) \bmod 360^\circ$$
2. **Projected Shadow Length ($L$)**:
   On horizontal ground, shadow length is inversely proportional to the tangent of solar elevation:
   $$L = \frac{H}{\tan(\alpha)}$$
   *(Capped at 800m to prevent infinite numerical elongation during near-horizon grazing incidence).*
3. **Geodesic Vertex Translation**:
   For each vertex $v_i = (lng_i, lat_i)$ of the building base polygon, the corresponding roof vertex $v'_i$ is projected using Turf.js geodesic destination:
   $$v'_i = \text{turf.destination}(v_i, \frac{L}{1000}, \theta_{\text{shadow}}, \{\text{units: 'kilometers'}\})$$
4. **Shadow Polygon Hull**:
   The complete 2D ground shadow envelope is generated as the convex hull of the base vertices $\cup$ projected roof vertices:
   $$S = \text{turf.convex}(\{v_1, \dots, v_n, v'_1, \dots, v'_n\})$$
5. **Solar Array Clipping & Shaded Fraction**:
   The proposed solar array footprint $P_{\text{solar}}$ is intersected with the union of all active shadows $\bigcup S_j$:
   $$I_{\text{shaded}} = \text{turf.intersect}(P_{\text{solar}}, \bigcup S_j)$$
   $$\text{ShadedPercentage} = \min\left(100, \frac{\text{Area}(I_{\text{shaded}})}{\text{Area}(P_{\text{solar}})} \times 100\right)$$

---

## 5. Future Scenarios & What-If Modeling (STEP 4 & STEP 5)

Users can configure, simulate, and compare:
- **Baseline (Current Environment)**: Shadows cast exclusively by existing mapped OSM buildings.
- **Future What-If Scenarios**:
  - Add hypothetical towers (e.g. 50m commercial high-rise, 80m south of array).
  - Modify existing building heights (e.g. simulating vertical zoning allowances).
  - Adjust date and time sliders across the diurnal cycle (06:00 to 18:00) and solstices (Summer Solstice, Winter Solstice, Equinox).
- **Delta Impact Metrics**:
  - $\Delta \text{ Shaded Area } (m^2) = \text{Area}_{\text{scenario}} - \text{Area}_{\text{baseline}}$
  - $\Delta \text{ Shaded Percentage } (\%) = \%_{\text{scenario}} - \%_{\text{baseline}}$
  - Exposure impact classification (`no_change`, `increased_shading`, `decreased_shading`).

### Explicit Epistemic Limitations & Disclaimers
1. **Instantaneous Snapshot**: The simulation calculates direct beam obstruction at the simulated hour. It does not claim cumulative annual kilowatt-hour loss without a full 8,760-hour irradiance integration.
2. **Planar Ground Approximation**: Terrain between the building base and the solar array is evaluated as locally planar.
3. **Hypothetical Distinction**: User-proposed structures are strictly hypothetical what-if simulations and do not represent approved municipal master plans.
4. **Direct Beam Focus**: Diffuse sky radiation and ground albedo reflection are secondary to direct line-of-sight beam blockage.

---

## 6. Map & UI Integration (STEP 6)

1. **MapLibre Overlays (`MapView.tsx`)**:
   - `solar-shadows-fill`: Semi-transparent dark slate ground shadows (`#0f172a`, opacity 0.35).
   - `solar-hypothetical-fill`: Distinct purple dashed boundary (`#9333ea`) for user-proposed future towers.
   - `solar-shaded-overlap-fill`: Vivid crimson hatched overlay (`#ef4444`) highlighting the exact shaded portion of the PV array.
   - **Floating Sun Tracker**: Displays real-time sun azimuth and elevation badge on the live map.
2. **Interactive Modal (`ShadowSimulatorModal.tsx`)**:
   - Time-of-day slider and Solstice / Equinox quick presets.
   - Rooftop receiver elevation adjustment ($H_{\text{effective}} = \max(0, H_{\text{bldg}} - H_{\text{receiver}})$).
   - Diurnal Solar Access table (07:00–17:00), Solar Access Ratio (SAR), and annualized $\Delta\text{MWh}$ screening.
   - Real-time exposure cards with baseline vs scenario comparison.
   - Obstructing buildings inspector displaying distance, height, and provenance badge for every shade-casting structure.
   - Hypothetical tower insertion form with status hierarchy (`approved_development`, `proposed_development`, `hypothetical_scenario`).

---

## 7. Verification & Test Suite

All calculations are verified by automated tests in `tests/unit/`:

```bash
# 1. Test astronomical solar position (Solstices, Equinox, Diurnal rotation, Southern Hemisphere)
npx vitest run tests/unit/solar-position.test.ts

# 2. Test geometric shadow projection, rooftop receiver elevation, provenance tracking, and diurnal access
npx vitest run tests/unit/shadow-engine.test.ts

# 3. Full project test suite (97 tests across 12 test files)
npm test

# 4. Production build verification
npm run build
```

For in-depth mathematical derivations and municipal planning integration details, see [FUTURE_AWARE_SOLAR_SHADING.md](file:///Users/aaradhya/Downloads/newesturjasetu/docs/FUTURE_AWARE_SOLAR_SHADING.md).
