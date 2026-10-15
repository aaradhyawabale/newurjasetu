# Solar Reality: Solar Generation, Seasonal Weather & Calibration Engine

## 1. Executive Summary & Objective

**Solar Reality** is an explainable, physics-grounded solar electricity generation, weather analysis, and meter calibration engine built natively into **UrjaSetu** (*Urja* = Clean Energy, *Setu* = Infrastructure Bridge). It bridges spatial multi-criteria decision analysis (MCDA) with bankable kilowatt-hour energy yield predictions, seasonal Monsoon dynamics, actual meter calibration, and financial feasibility metrics.

Unlike simple tools that display raw horizontal irradiance ($GHI$) as if it were AC generation, Solar Reality implements:
1. **Input Audit & Archetype Classification**: Explicit tracking of required, optional, estimated, and missing inputs across 4 installation archetypes.
2. **Liu-Jordan Plane-of-Array (POA) Transposition**: Transposes horizontal satellite irradiance onto tilted collector surfaces.
3. **Decomposed Loss Chain & Shading Integration**: Non-overlapping Balance-of-System (BOS) loss waterfall, dynamically coupled with **Shadow-of-the-Future** 3D ray-tracing simulations while strictly guarding against double-counting.
4. **Seasonal Weather & Monsoon Analysis**: Highlights Monsoon cloud attenuation troughs, dry-season heat derates, and winter clear-sky operating regimes.
5. **Observed Generation Calibration (Phase D)**: Ingests revenue-grade inverter/meter logs to compute Mean Bias Error ($MBE$), Mean Absolute Percentage Error ($MAPE$), and Root Mean Square Error ($RMSE$), while operating in clean estimate-only mode when meter data is absent (never synthesizing fake meter readings).
6. **Statistical Uncertainty Bounds (P50, P90, P10)**: Quantifies combined interannual climatological variance and transposition uncertainty.
7. **25-Year LCOE & Sensitivity Matrix**: Levelized Cost of Electricity, simple payback period, and deterministic capex/tariff sensitivity models.

---

## 2. Input Data Audit & Epistemic Hierarchy (Phase A)

To maintain defensibility in municipal and bankable planning, every input parameter is audited and tagged:

| Parameter | Archetypes Supported | Default / Proxy Sourcing | Classification State |
| :--- | :--- | :--- | :--- |
| **Coordinates ($\phi, \lambda$)** | All | User placement map marker | `required_provided` |
| **DC Capacity ($P_{\text{dc}}$ in kWp)** | Utility, C&I, Rooftop | $80\text{ Wp/m}^2$ footprint proxy or user input | `required_provided` |
| **Installation Archetype** | `ground_mount_utility`, `rooftop_commercial`, `rooftop_residential`, `ground_mount_cni` | Derived from capacity thresholds | `optional_provided` / `estimated_proxy` |
| **Tilt Angle ($\beta$)** | Fixed ground / rooftop | Latitude-matched proxy ($\min(45, \max(5, |\phi|))$) | `optional_provided` / `estimated_proxy` |
| **Orientation (Azimuth $\theta$)** | Fixed orientation | True South ($180^\circ$) in Northern Hemisphere | `optional_provided` / `estimated_proxy` |
| **Shading Loss ($\%$)** | All | **Imported from Shadow-of-the-Future** or $2.0\%$ pre-feasibility benchmark | `optional_provided` / `estimated_proxy` |
| **Soiling Rate ($\%$)** | All | $2.5\%$ typical semi-arid baseline | `optional_provided` / `estimated_proxy` |
| **Inverter Efficiency ($\%$)** | All | $97.5\%$ CEC weighted Tier-1 inverter rating | `optional_provided` / `estimated_proxy` |
| **Actual Inverter / Meter Logs** | Participating plants | Actual monthly utility net energy meter records | `optional_provided` (when present) or `missing_unprovided` (estimate mode) |

---

## 3. Solar Resource Data Provenance (Phase B)

Solar Reality retrieves multi-year empirical satellite climatology from the **NASA Langley Research Center POWER Project**:

| Parameter | Authoritative Value | Description |
| :--- | :--- | :--- |
| **Dataset** | NASA CERES / MERRA-2 Multi-Year Agroclimatology | 22-year satellite observation baseline |
| **Parameters Retrieved** | `ALLSKY_SFC_SW_DWN`, `CLRSKY_SFC_SW_DWN`, `T2M` | Global Horizontal Irradiance, Clear-sky GHI, 2m ambient air temperature |
| **Units** | $\text{kWh/m}^2/\text{day}$ (Irradiance), $^\circ\text{C}$ (Temperature) | Standard SI / WMO units |
| **Spatial Grid** | $0.5^\circ \times 0.5^\circ$ latitude/longitude | Global terrestrial coverage ($\pm 85^\circ$) |
| **Temporal Nature** | **Multi-year monthly climatology** | **Not a short-term weather forecast**. Reflects 22-year empirical averages. |
| **License** | Public Domain (NASA POWER Project) | Open access under NASA data policy |

---

## 4. Physical Generation Model (Phase B)

### A. Liu-Jordan Isotropic Tilt Transposition
Horizontal irradiance ($GHI$) is transposed onto the tilted Plane-of-Array ($POA$) via the **Liu-Jordan / Klein formulation**:

$$R = (1 - K_d) R_b + K_d \left(\frac{1 + \cos\beta}{2}\right) + \rho \left(\frac{1 - \cos\beta}{2}\right)$$

Where:
- $K_d \approx 0.35$ (diffuse fraction under all-sky conditions).
- $\rho = 0.20$ (standard ground albedo).
- $R_b$ is the geometric beam ratio of beam radiation on the tilted surface versus the horizontal surface:
  $$R_b = \frac{\cos(\phi - \beta)\cos(\delta)\sin(\omega'_s) + \omega'_s \sin(\phi - \beta)\sin(\delta)}{\cos(\phi)\cos(\delta)\sin(\omega_s) + \omega_s \sin(\phi)\sin(\delta)}$$

### B. Cell Operating Temperature Derating
Under standard test conditions (STC), solar modules are rated at $25^\circ\text{C}$ cell temperature. In actual operation, panels heat up:

$$T_{\text{cell}} = T_{\text{ambient}} + \left(\frac{\text{NOCT} - 20}{800}\right) \times G_{\text{effective}}$$

Using standard Nominal Operating Cell Temperature $\text{NOCT} = 45^\circ\text{C}$ and peak effective irradiance $750\text{ W/m}^2$:
$$T_{\text{cell}} \approx T_{\text{ambient}} + 23.4^\circ\text{C}$$

For crystalline silicon PV modules (IEC 61215), the temperature coefficient is $\gamma = -0.38\% / ^\circ\text{C}$:
$$f_{\text{temp}} = 1.0 + \gamma \times (T_{\text{cell}} - 25^\circ\text{C})$$

### C. Decomposed Balance of System (BOS) Losses & Shading Integration
To eliminate double-counting, every loss mechanism is isolated and multiplied:

$$f_{\text{BOS}} = f_{\text{inverter}} \times f_{\text{wiring}} \times f_{\text{mismatch}} \times f_{\text{soiling}} \times f_{\text{shading}} \times f_{\text{LID}} \times f_{\text{availability}}$$

When **Shadow-of-the-Future** simulation data is present, the simulated geometric shading percentage directly supersedes the default $2.0\%$ horizon allowance with `doubleCountingGuarded: true`.

---

## 5. Weather & Seasonal Analysis (Phase C)

Solar Reality evaluates seasonal meteorological shifts across three distinct South Asian climatic regimes:

1. **Monsoon Cloud Attenuation (June–September)**:
   - Evaluates the sharp drop in $GHI$ caused by monsoon cloud cover (typically $-15\%$ to $-30\%$ below pre-monsoon peak).
   - Module operating temperatures drop due to precipitation and cloud cover, partially compensating for optical losses.
2. **Pre-Monsoon Dry Dust Heatwave (March–May)**:
   - Peak irradiance coupled with extreme ambient temperatures ($>38^\circ\text{C}$).
   - Thermal derate losses reach seasonal highs ($-10\%$ to $-14\%$).
   - Dry conditions elevate dust accumulation and soiling losses before monsoon washings.
3. **Winter Clear-Sky Regime (October–February)**:
   - Lower sun angles counterbalanced by low ambient temperatures ($12^\circ\text{C} - 20^\circ\text{C}$), delivering superior thermal efficiency (derate $<5\%$).

---

## 6. Modelled versus Observed Performance: Calibration Workflow (Phase D)

For installations with revenue-grade telemetry, Solar Reality compares uncalibrated climatological models against actual meter logs:

### Statistical Calibration Metrics
1. **Mean Bias Error ($MBE$)**:
   $$\text{MBE} = \frac{1}{N} \sum_{m=1}^N (E_{\text{model}, m} - E_{\text{observed}, m})$$
   Indicates systematic overprediction ($>0$) or underprediction ($<0$).
2. **Mean Absolute Percentage Error ($MAPE$)**:
   $$\text{MAPE} = \frac{1}{N} \sum_{m=1}^N \left|\frac{E_{\text{observed}, m} - E_{\text{model}, m}}{E_{\text{observed}, m}}\right| \times 100\%$$
3. **Root Mean Square Error ($RMSE$)**:
   $$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{m=1}^N (E_{\text{model}, m} - E_{\text{observed}, m})^2}$$

### Epistemic Rule
If actual meter readings are not supplied, the system operates in **estimate-only mode** with clear disclosures. **UrjaSetu never synthesizes fake meter readings.**

---

## 7. Statistical Uncertainty Bounds (Phase E)

Quantifies statistical confidence across a normal Gaussian exceedance curve:
- **P50 (Median Base Case)**: 50% probability of exceedance based on 22-year satellite mean.
- **P90 (Conservative Bankable Case)**: Sizing benchmark for project finance and debt-service coverage ratio (DSCR). Accounts for combined $6.8\%$ standard uncertainty ($\sqrt{\sigma_{\text{weather}}^2 + \sigma_{\text{model}}^2}$ where $\sigma_{\text{weather}} = 5.5\%$, $\sigma_{\text{model}} = 4.0\%$):
  $$P90 = P50 \times (1 - 1.282 \times \sigma_{\text{combined}}) \approx P50 \times 0.913$$
- **P10 (Optimistic Case)**: 10% exceedance probability during exceptionally sunny years ($P10 \approx P50 \times 1.087$).

---

## 8. Financial Feasibility & Sensitivity

- **Capital Cost (Capex)**: ₹42,000 / kWp benchmark (CEA / MNRE India).
- **Operating Cost (Opex)**: 1.2% of Capex annually.
- **Simple Payback Period**: $\text{Payback} = \frac{\text{CapexTotal}}{\text{Annual Revenue} - \text{Annual Opex}}$.
- **25-Year LCOE**:
  $$\text{LCOE} = \frac{\text{Capex} + \sum_{t=1}^{25} \frac{\text{Opex}_t}{(1+r)^t}}{\sum_{t=1}^{25} \frac{E_t}{(1+r)^t}} \quad (r = 7.5\%, \text{ Degradation} = 0.6\%/\text{year})$$

---

## 9. Verification & Test Suite (Phase G)

Verified by **20 comprehensive unit tests** in `tests/unit/solar-reality.test.ts` (104/104 passing project-wide):
- Input audit state classification (`required_provided`, `optional_provided`, `estimated_proxy`, `missing_unprovided`).
- Liu-Jordan transposition bounds and winter tilt boost ($R > 1.15$).
- Cell temperature NOCT derating across seasonal heat extremes.
- Monsoon cloud attenuation and seasonal drop percentages.
- Uncalibrated estimate fallback mode (zero fabricated meter data).
- Calibration error statistics ($MBE$, $MAPE$, $RMSE$, normalized CUF).
- Gaussian exceedance bounds ($P90 < P50 < P10$).
- Future-shading integration with double-counting guards.
- PDF report generation with Solar Reality section.
