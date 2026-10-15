# Shadow-of-the-Future: Future-Aware Solar Shading Simulator & Diurnal Solar Access

## 1. Executive Summary & Objective

**Shadow-of-the-Future** is an explainable, future-aware 3D solar shading and diurnal solar access simulation engine built directly into **UrjaSetu**. It enables municipal planners, renewable energy project developers, and evaluators to evaluate how surrounding structures and documented future-development masterplans impact solar access at ground-mounted or rooftop photovoltaic installations.

Unlike traditional static tools that only look at historical climatology or assume an empty surrounding built environment, Shadow-of-the-Future rigorously distinguishes:
1. **Observed Baseline Built Environment**: Physically verified structures mapped in OpenStreetMap.
2. **Approved Masterplan Developments**: Formally approved municipal permits or zoning bylaws with high confidence.
3. **Proposed Masterplans**: Draft zonal plans, transit-oriented development (TOD) corridors, or public masterplan proposals.
4. **Hypothetical What-If Scenarios**: User-defined stress test towers to evaluate resilience against vertical densification.

---

## 2. Input Data Audit & Provenance Hierarchy (Phase A)

Building heights in volunteered geographic information (OpenStreetMap) vary widely in completeness and accuracy. In accordance with UrjaSetu's epistemic integrity rules, the engine **never silently assigns precise heights to buildings whose heights are unknown**.

Every structure is classified into one of five height provenance states:

| Classification | Sourcing Method | Example in Engine | Epistemic Status & Governance |
| :--- | :--- | :--- | :--- |
| `measured` | Explicitly tagged in OpenStreetMap (`tags.height` or `attributes.heightM`) | `height=24.5` $\rightarrow 24.5\text{m}$ | High confidence. Direct laser/LIDAR/survey measurement. |
| `inferred_from_levels` | Computed from storey counts (`tags["building:levels"]` $\times 3.2\text{m}$) | `building:levels=5` $\rightarrow 16.0\text{m}$ | Explicitly labeled as an architectural storey proxy (3.2m per floor). Not a laser measurement. |
| `hypothetical_user` | Defined by the user in what-if scenarios (e.g. proposed adjacent commercial high-rise) | Proposed 50m tower | Strictly labeled as a hypothetical proposal. Never described as an approved master plan. |
| `default_assumption` | Missing both height and level tags in OSM, but user explicitly enabled a proxy (e.g. 6.0m) | 2-storey default proxy | Documented transparently in the scorecard and obstruction inspector. |
| `unavailable` | Missing all height tags, and proxy calculation is disabled | Height set to $0\text{m}$ | Excluded from 3D shadow projection to avoid fabricating ground geometry. |

### Development Status Hierarchy (Phase C)
To prevent misleading planners or juries, all future structures are explicitly tagged:
- `existing_observed`: Observed existing physical structure.
- `approved_development`: Permitted development with verified planning horizon.
- `proposed_development`: Publicly proposed masterplan development.
- `hypothetical_scenario`: User what-if speculative stress test.

---

## 3. Astronomical Solar Position Algorithm (Phase B)

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

## 4. Rooftop Receiver Elevation Offsetting & Ray Tracing

### Rooftop Geometry Offsetting
Most urban solar arrays are mounted on rooftops rather than at grade. An elevated solar array at height $H_{\text{receiver}}$ cannot be shaded by adjacent single- or two-storey buildings whose roofs are lower than the panel horizon.

The engine computes an effective obstruction height:
$$H_{\text{effective}} = \max(0, H_{\text{building}} - H_{\text{receiver}})$$

- If $H_{\text{building}} \le H_{\text{receiver}}$, $H_{\text{effective}} = 0$, producing zero cast shadow on the solar array.
- If $H_{\text{building}} > H_{\text{receiver}}$, shadow casting is evaluated only for the differential height protruding above the receiver plane.

### Anti-Solar Vector & Ground Projection
1. **Anti-Solar Vector**:
   Light arriving from azimuth $\theta_{\text{sun}}$ projects shadows along the opposite bearing:
   $$\theta_{\text{shadow}} = (\theta_{\text{sun}} + 180^\circ) \bmod 360^\circ$$
2. **Projected Shadow Length ($L$)**:
   On horizontal ground, shadow length is inversely proportional to the tangent of solar elevation:
   $$L = \frac{H_{\text{effective}}}{\tan(\alpha)}$$
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

## 5. Diurnal Solar Access & Solar Access Ratio (SAR) (Phase D)

Instantaneous noon snapshots fail to reveal real solar feasibility: morning and afternoon sun angles cast much longer shadows.

### Temporal Diurnal Sampling
Shadow-of-the-Future samples daytime hours at 2-hour increments (07:00, 09:00, 11:00, 13:00, 15:00, 17:00 local time).
For each hour $t$, the engine computes:
1. Astronomical solar position $(\alpha_t, \theta_t)$.
2. Theoretical clear-sky direct beam irradiance using the Haurwitz/Liu-Jordan clear-sky elevation model:
   $$G_t = 1000 \cdot \left(\sin \alpha_t\right)^{1.15} \quad (\text{W/m}^2)$$
3. Shaded fraction $s_t$ and unshaded fraction $u_t = 1 - s_t$.
4. **Diurnal Sunlight Hours**: Number of daylight hours with $\ge 50\%$ unshaded array area.

### Solar Access Ratio (SAR)
The overall diurnal Solar Access Ratio is the clear-sky flux-weighted fraction of unshaded direct sunlight:
$$\text{SAR} = \frac{\sum_{t} u_t \cdot G_t}{\sum_{t} G_t}$$

### Annualized Energy Loss Screening ($\Delta\text{MWh}$)
When baseline annual generation ($E_{\text{baseline}}$ in MWh) is known from NASA POWER or user system specifications, the screening loss is derived as:
$$\text{LossRatio} = \max\left(0, \frac{\text{SAR}_{\text{baseline}} - \text{SAR}_{\text{scenario}}}{\text{SAR}_{\text{baseline}}}\right)$$
$$E_{\text{scenario}} = E_{\text{baseline}} \cdot (1 - \text{LossRatio})$$
$$\Delta E_{\text{annual}} = E_{\text{baseline}} - E_{\text{scenario}}$$

*Disclaimer: This represents a direct-beam insolation loss screening proxy derived from diurnal sampling weighted by the clear-sky solar elevation curve. It serves as an early-stage planning screening rather than a replacement for full 8,760-hour CAD micro-siting.*

---

## 6. User Interface & Scenario Presets (Phase E)

The interactive modal (`ShadowSimulatorModal.tsx`) provides 5 specialized tabs:
1. **Instantaneous Exposure**: Real-time solar position, baseline vs scenario shaded area ($m^2$), and $\Delta\%$ loss.
2. **Diurnal Profile & SAR**: Hourly table (07:00–17:00) with ClearSky Flux ($W/m^2$), unshaded %, Solar Access Ratio, and annual MWh screening loss.
3. **Future Scenarios**:
   - Quick presets: *2026 Baseline*, *2028 Approved Commercial*, *2032 High-Density Future*.
   - Scenario editor: Configure height, distance, bearing, target year, development status, and provenance notes.
4. **Obstructing Buildings**: Sourced table of all physical obstructions with height provenance badges (`measured`, `inferred_from_levels`, `default_assumption`, `hypothetical_user`) and effective height after rooftop offsetting.
5. **Assumptions & Governance**: Transparent disclosure of model boundaries.

---

## 7. Performance & Verification (Phase F & Phase G)

- **Bounding Radius**: Surrounding building queries are strictly bounded to an 800m radial buffer.
- **Cache Reuse**:surrounding Overpass GeoJSON features are cached within the placement record to eliminate redundant network roundtrips.
- **Unit & Integration Tests**: 97 automated tests across 12 test suites verifying solar positioning, shadow direction, rooftop receiver elevation offsetting, diurnal sampling, and user authorization isolation.
