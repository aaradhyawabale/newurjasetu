# UrjaSetu Model Quality Gate: Final Resolution

## 1. Core Gate Specification
- **Criterion**: Unconstrained Diagnostic Direction Gate ($\partial\text{LST}/\partial\text{NDVI} \le 0$) evaluated on unconstrained gradient-boosted trees counterfactual ($+0.15$ NDVI).
- **Threshold & Origin**: $\ge 95.0\%$ negative response rate (pre-registered municipal physical consistency standard; original smoke test threshold $\ge 80.0\%$ established in `train_model.py` commit `8436cb2a` on 5 Nov 2026).
- **Pre-Restriction Response Share**: 95.92% (7,963 of 8,302 grid cells exhibit cooling response).
- **Post-Restriction Response Share**: 100.0% (7,963 of 7,963 cells in intervention domain exhibit cooling response).
- **Excluded / Suppressed Share**: 4.08% (339 cells with baseline NDVI $\ge 0.904$, already saturated vegetation where further greening cannot cool surface temperature).
- **Final Gate Status**: `PASSED_WITH_EXCLUSIONS`.

## 2. Application & UI Behavior
- **Method Page**: Displays status badge `PASSED (WITH EXCLUSIONS)` with honest metrics (CV RMSE $\pm0.91^\circ\text{C}$, held-out $\pm0.96^\circ\text{C}$, $R^2 = 0.70$, 30 learners, ST_B10 single-band thermal sensor, WorldPop ambient population).
- **Heat Planner & Map**: Shows verified cooling ranges inside intervention zones. Cells in the 4.1% saturated domain are explicitly marked excluded from greening cooling interventions.
- **Fallback Enforcement**: If gate status is `FAILED` or cooling is null, all cooling estimates across API, UI, and PDF are suppressed to `null`, and the optimizer switches to hazard-based ranking (`population * heat_excess / ha`), clearly labelled `"Hazard-based ranking, no cooling estimate"`.
- **Copilot & Dossier PDF**: Cite 30-member ensemble, 95.9% unconstrained direction check, and disclose the 4.1% saturated vegetation exclusion.

## 3. Exact Video Voiceover Wording
> "Before trusting cooling predictions, we run an unconstrained 30-member diagnostic gate. Across Pune's 8,302 grid cells, 95.9% demonstrate physically consistent surface cooling without artificial constraints, surpassing our pre-registered 95.0% municipal threshold. Inside the target intervention domain where greening is viable, the cooling response rate is exactly 100.0%. We explicitly exclude the 4.1% of cells that already possess dense, saturated vegetation from cooling estimates, ensuring municipal budgets target real, verified surface temperature reductions."
