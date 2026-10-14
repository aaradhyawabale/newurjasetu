# Solar Reality: Solar Generation & Feasibility Estimation

## Overview
**Solar Reality** is an explainable, physics-grounded solar generation and feasibility estimation engine integrated directly into **UrjaSetu** (*Urja* = Clean Energy, *Setu* = Infrastructure Bridge). It bridges the gap between high-level geospatial site suitability and real-world kilowatt-hour generation and budgetary payback analysis.

---

## 1. Project Alignment & Scope Verification
- **Domain Fit**: Solar energy placement is central to UrjaSetu's problem statement. The project natively supports **Solar Farm** as one of its 10 core infrastructure types (`src/config/infra-types.ts`), evaluating multi-criteria spatial factors like Global Horizontal Irradiance (NASA POWER), electrical substation proximity, terrain slope (Open-Meteo DEM), and heavy equipment delivery access.
- **The Gap**: Spatial MCDA identifies *where* a solar array can be physically sited; **Solar Reality** answers *how much clean energy it will generate* ($kWh$) and *what its economic payback and LCOE will be*.
- **Architecture Integrity**: Reuses existing MapLibre map, PlacementPanel, NASA POWER provider, and Prisma database schema without introducing external frameworks.

---

## 2. Solar Resource Data Provenance (STEP 2)

Solar Reality relies on multi-year satellite climatology from the **NASA Langley Research Center POWER Project**:

| Parameter | Authoritative Value | Description |
| :--- | :--- | :--- |
| **Dataset** | NASA CERES / MERRA-2 Multi-Year Agroclimatology | 22-year satellite observation baseline |
| **Parameters Retrieved** | `ALLSKY_SFC_SW_DWN`, `CLRSKY_SFC_SW_DWN`, `T2M` | Global Horizontal Irradiance, Clear-sky GHI, 2-meter ambient air temperature |
| **Units** | $\text{kWh/m}^2/\text{day}$ (Irradiance), $^\circ\text{C}$ (Temperature) | Standard SI / WMO units |
| **Spatial Grid** | $0.5^\circ \times 0.5^\circ$ latitude/longitude | Global terrestrial coverage ($\pm 85^\circ$) |
| **Temporal Nature** | **Multi-year monthly climatology** | **Not a short-term weather forecast**. Reflects 22-year empirical averages, filtering short-term anomalies. |
| **License** | Public Domain (NASA POWER Project) | Open access under NASA data policy |

> [!NOTE]
> Weather forecasts reflect chaotic 1-to-7 day atmospheric simulations. Solar Reality uses empirical 22-year satellite climatology, which is the international standard for long-term pre-feasibility modeling.

---

## 3. Physical Generation Model (STEP 3)

### A. Liu-Jordan Isotropic Tilt Transposition
Horizontal irradiance ($GHI$) must be transposed onto a tilted plane ($POA$ - Plane-of-Array). For an array at latitude $\phi$ tilted at angle $\beta$ oriented towards the equator, the transposition factor $R = POA / GHI$ is modeled via the **Liu-Jordan / Klein formulation**:

$$R = (1 - K_d) R_b + K_d \left(\frac{1 + \cos\beta}{2}\right) + \rho \left(\frac{1 - \cos\beta}{2}\right)$$

Where:
- $K_d \approx 0.35$ (diffuse fraction under all-sky conditions).
- $\rho = 0.20$ (standard terrestrial ground albedo).
- $R_b$ is the geometric beam ratio of beam radiation on the tilted surface versus the horizontal surface:
  $$R_b = \frac{\cos(\phi - \beta)\cos(\delta)\sin(\omega'_s) + \omega'_s \sin(\phi - \beta)\sin(\delta)}{\cos(\phi)\cos(\delta)\sin(\omega_s) + \omega_s \sin(\phi)\sin(\delta)}$$
  with monthly solar declination $\delta$ and sunset hour angles $\omega_s, \omega'_s$.

### B. Cell Operating Temperature Derating
Under standard test conditions (STC), solar modules are rated at $25^\circ\text{C}$ cell temperature and $1000\text{ W/m}^2$. In actual operation, panels heat up:

$$T_{\text{cell}} = T_{\text{ambient}} + \left(\frac{\text{NOCT} - 20}{800}\right) \times G_{\text{effective}}$$

Using standard Nominal Operating Cell Temperature $\text{NOCT} = 45^\circ\text{C}$ and peak effective irradiance $750\text{ W/m}^2$:
$$T_{\text{cell}} \approx T_{\text{ambient}} + 23.4^\circ\text{C}$$

For crystalline silicon PV modules (IEC 61215), the temperature power coefficient is $\gamma = -0.38\% / ^\circ\text{C}$. The monthly temperature derate factor is:
$$f_{\text{temp}} = 1.0 + \gamma \times (T_{\text{cell}} - 25^\circ\text{C})$$

### C. Decomposed Balance of System (BOS) Losses
To eliminate double-counting, every loss mechanism is isolated and multiplied:

| Loss Component | Loss $\%$ | Derate Factor ($f_i$) | Physical Rationale |
| :--- | :--- | :--- | :--- |
| **Inverter Efficiency** | $2.5\%$ | $0.975$ | Thermal and switching losses in central/string inverters (rated 97.5% CEC efficiency). |
| **DC/AC Wiring** | $2.0\%$ | $0.980$ | $I^2R$ ohmic resistive voltage drop across DC string cables and AC transformer feeders. |
| **Module Mismatch** | $1.5\%$ | $0.985$ | Electrical parameter differences ($V_{\text{mp}}, I_{\text{mp}}$) across interconnected PV modules. |
| **Soiling & Particulates** | $2.5\%$ | $0.975$ | Dust and smog deposition on glass surfaces between scheduled array washings. |
| **Shading Obstruction** | $2.0\%$ | $0.980$ | External geometric obstruction (coupled directly with **Shadow-of-the-Future** ray tracing). |
| **LID & Stabilization** | $1.0\%$ | $0.990$ | Light-Induced Degradation (boron-oxygen defect formation in first operational months). |
| **Grid Availability** | $0.5\%$ | $0.995$ | Scheduled transformer maintenance, grid curtailment, and switchgear downtime. |

**Net System Performance Ratio (PR)**:
$$PR = f_{\text{temp}} \times \prod_{i=1}^7 f_i \approx 0.76 - 0.82 \quad (76\% - 82\%)$$

---

## 4. Energy Yield Outputs (STEP 4)

Given installed DC capacity $P_{\text{dc}}$ (in $\text{kWp}$):

1. **Monthly Production ($E_m$ in $\text{kWh}$)**:
   $$E_m = P_{\text{dc}} \times POA_m \times \text{Days}_m \times PR_m$$
2. **Annual Production ($E_{\text{annual}}$ in $\text{kWh}$ and $\text{MWh}$)**:
   $$E_{\text{annual}} = \sum_{m=1}^{12} E_m, \quad E_{\text{MWh}} = \frac{E_{\text{annual}}}{1000}$$
3. **Specific Yield ($Y_{\text{spec}}$ in $\text{kWh/kWp/year}$)**:
   $$Y_{\text{spec}} = \frac{E_{\text{annual}}}{P_{\text{dc}}}$$
4. **Capacity Utilization Factor ($CUF$ in $\%$ over 8,760 hours/year)**:
   $$CUF = \frac{E_{\text{annual}}}{P_{\text{dc}} \times 8760\text{ hours}} \times 100\%$$

---

## 5. Economic Feasibility & Sensitivity Analysis (STEP 5)

Pre-feasibility financial screening using benchmark capital expenditure and commercial/industrial grid tariffs:

- **Benchmark Capital Expenditure (Capex)**:
  - Benchmark rate: ₹42,000 / kWp (~₹4.2 Cr / MWp, conforming to Central Electricity Authority India / MNRE norms).
  - Total Capex: $\text{CapexTotal} = P_{\text{dc}} \times \text{CapexRate}$.
- **Operating & Maintenance (Opex)**:
  - $1.2\%$ of Capex per year (~₹500 / kWp / year).
- **Annual Cost Avoidance / Revenue**:
  $$\text{Revenue} = E_{\text{annual}} \times \text{Tariff} \quad (\text{Benchmark Tariff: ₹6.50 / kWh})$$
- **Simple Payback Period**:
  $$\text{Payback} = \frac{\text{CapexTotal}}{\text{Revenue} - \text{Opex}}$$
- **25-Year Levelized Cost of Electricity (LCOE in ₹/kWh)**:
  - Discount rate $r = 7.5\%$, annual PV degradation $0.6\%/\text{year}$:
    $$\text{LCOE} = \frac{\text{Capex} + \sum_{t=1}^{25} \frac{\text{Opex}_t}{(1+r)^t}}{\sum_{t=1}^{25} \frac{E_t}{(1+r)^t}}$$

### Deterministic Sensitivity Matrix
Evaluates how financial returns shift under changing market parameters:
1. **Baseline Model**: ₹42,000/kWp, ₹6.50/kWh tariff $\rightarrow$ ~3.9 years payback, ₹2.38/kWh LCOE.
2. **Capex Savings (-15%)**: Bulk equipment procurement $\rightarrow$ ~3.3 years payback.
3. **Capex Escalation (+15%)**: High transmission/civil grading costs $\rightarrow$ ~4.5 years payback.
4. **Conservative Tariff (-20%)**: Utility PPA tariff ₹5.20/kWh $\rightarrow$ ~4.9 years payback.
5. **Peak Industrial Tariff (+20%)**: High commercial grid tariff ₹7.80/kWh $\rightarrow$ ~3.2 years payback.

---

## 6. Worked Example (1 MWp in New Delhi)

- **Location**: $28.6139^\circ\text{N}, 77.2090^\circ\text{E}$ (Central Delhi Plains)
- **Capacity**: $1,000\text{ kWp}$ ($1.0\text{ MWp}$)
- **Array Tilt**: $22^\circ$ (True South)
- **NASA POWER GHI**: $5.35\text{ kWh/m}^2/\text{day}$
- **Liu-Jordan POA Average**: $5.68\text{ kWh/m}^2/\text{day}$ ($+6.2\%$ tilt gain)
- **System PR**: $78.8\%$ (Temperature derate $9.8\%$, Inverter $2.5\%$, Wiring $2.0\%$, Soiling $2.5\%$, Mismatch $1.5\%$, Shading $2.0\%$, LID $1.0\%$, Availability $0.5\%$)
- **Annual Generation**: **$1,632,450\text{ kWh}$ ($1,632.5\text{ MWh/year}$)**
- **Specific Yield**: **$1,632\text{ kWh/kWp/year}$**
- **CUF**: **$18.6\%$**
- **Capital Cost**: ₹4.20 Cr
- **Annual Gross Revenue**: ₹1.06 Cr/year (at ₹6.50/kWh)
- **Annual O&M**: ₹0.05 Cr/year
- **Simple Payback**: **$4.1\text{ Years}$**
- **25-Year LCOE**: **₹$2.34\text{ / kWh}$**

---

## 7. Testing & Verification

The test suite in `tests/unit/solar-reality.test.ts` (13 unit tests) covers:
1. **Tilt Transposition**: $0^\circ$ tilt equals $1.0$; winter tilt boost $>1.15$; bounded across all 12 months.
2. **Temperature Derate**: Higher summer cell temperatures produce strictly greater loss percentages.
3. **Capacity Validation**: Negative and zero capacities are rejected.
4. **Mathematical Consistency**: Sum of 12 monthly productions equals annual total within rounding.
5. **Loss Waterfall**: Derate factors are strictly in $(0, 1]$ with no double-counting.
6. **Shading Integration**: Increased shading loss correctly reduces annual kilowatt-hour yield.
7. **Economic Feasibility**: Directional sensitivity shifts (lower Capex / higher tariff yields shorter payback).
8. **Disclaimers**: Mandatory non-guaranteed pre-feasibility disclaimer present.
