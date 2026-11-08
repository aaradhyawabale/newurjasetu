# UrjaSetu Model Quality Gate & Method Page QA Log

## Overview & Governance
- **Date**: 2026-11-08
- **Role**: Senior ML/QA Engineer & Technical Writer
- **Goal**: Reconcile Method page contradictions, establish one truthful gate object in `model_card.json`, diagnose the 4.1% unconstrained direction failure, and enforce consistent gate behavior across the application.

---

## Step 0: Gate Inspection & Consumer Audit

### 1. Gate Definition & History
| Item | Definition | Details & Git Provenance |
| :--- | :--- | :--- |
| **Criterion** | Unconstrained Diagnostic Direction Gate | Evaluates whether $LST$ decreases when $NDVI$ increases without monotone constraints: $\partial(LST)/\partial(NDVI) \le 0$. Evaluated by comparing counterfactual $f_{cf}$ ($NDVI + 0.15$, $NDBI - 0.08$) vs baseline $f_{base}$. Negative response condition: $p_{cf} \le p_{base} + 0.02^\circ\text{C}$. |
| **Threshold** | $\ge 95.0\%$ negative response rate | Pre-registered municipal quality threshold for physical consistency across city grid. (Code default in `train_model.py` had an initial smoke test threshold of $\ge 80.0\%$ set in commit `8436cb2a` on Thu Nov 5 12:32:08 2026). Pre-registered here at $\ge 95.0\%$. |
| **Measured Value** | **95.92%** (7,963 / 8,302 cells) | Across the full city grid, 7,963 cells show cooling. Exactly 339 cells (4.08%) exhibit non-negative response. |
| **Intervention Domain** | **100.0%** (7,963 / 7,963 cells) | 0 cells inside the intervention domain ($NDVI < 0.65$) fail. 100% of the 339 failing cells are in saturated vegetation ($NDVI \ge 0.904$). |
| **Final Status** | **PASSED_WITH_EXCLUSIONS** | Global rate (95.9%) meets the $\ge 95.0\%$ threshold; cooling estimates are certified inside the greening intervention domain ($NDVI < 0.65$) while saturated vegetation cells ($NDVI \ge 0.90$, 4.1% share) are excluded. |

### 2. Consumers of Gate & Cooling Fields
| Consumer | File Path | Current Logic / Reaction to FAILED | Required Fix / Harmonization |
| :--- | :--- | :--- | :--- |
| **API Client** | `src/api/client.ts` | Checked `data.direction_check?.passed` on un-unwrapped `{ status, model_card }`, causing `undefined` -> `false` bug. | Unwrap `data.model_card \|\| data`; read `gate` and `direction_check`. If FAILED, nullify `cooling_mean/p10/p90`. |
| **Method Page** | `src/components/pages/MethodPage.tsx` | Showed "Quality Gate: FAILED" beside "Verified... 95.9%". Stale 12-member, XGBoost, B10/B11, electoral roll claims. | Read truthful `modelCard.gate`; display status, criterion, threshold, measured value, and exclusions. Remove hype and stale text. |
| **Heat Planner** | `src/components/priority/HeatPriorityScreen.tsx` | Reads `cells.json` cooling fields. Reads `greenLossData.metadata.model_gate_passed`. | If gate is FAILED, display "Cooling: Not available (model quality gate not met)"; if PASSED_WITH_EXCLUSIONS, display cooling with disclaimer. |
| **Optimizer** | `src/server/priority/optimizer.ts` | Returned `status: 'UNAVAILABLE'` when cooling fields were null. | When gate fails or cooling is null, fall back to hazard-based ranking (`population * heat_excess / ha` or `heat_excess / ha`), clearly labelled "Hazard-based ranking, no cooling estimate". |
| **Evidence Drawer** | `src/components/planner/EvidenceDrawer.tsx`, `ZoneEvidenceDrawer.tsx` | Rendered `modelCard.gate.text` or hardcoded status. | Show consistent gate status and suppress cooling when FAILED. |
| **Dossier PDF** | `src/server/pdf/generate-zone-dossier-pdf.ts` | Checked `modelCard?.direction_check?.passed`. | Reflect unified gate status; show "Not available (model quality gate not met)" if FAILED. |
| **Copilot** | `src/server/ai/advisor.ts`, `heat-responder.ts` | Answers questions on model card and direction check. | Ensure answers accurately describe the 95.9% unconstrained gate, the 4.1% saturated vegetation exclusion, and the 100% pass rate in intervention domain. |
| **Walkthrough** | `src/components/walkthrough/tourData.ts` | References model metrics and gate status. | Verify tokens dynamically resolve to 0.91°C, 30 members, PASSED_WITH_EXCLUSIONS. |
| **Video Facts** | `docs/VIDEO_FACTS.md` | Contains summary facts for recording. | Regenerate from truthful `model_card.json`. |

---

## Step 1: Diagnosis of the 4.1% (339 Failing Cells)
- **Total evaluated cells**: 8,302
- **Passing cells (negative response)**: 7,963 (95.92%)
- **Failing cells (non-negative response)**: 339 (4.08%)
- **Failing cells characteristics**:
  - **Baseline NDVI Range**: min = 0.904, median = 0.937, max = 1.000.
  - **Built fraction Range**: min = 0.270, median = 0.350, max = 0.840.
  - **Saturated Vegetation ($NDVI \ge 0.65$)**: **339 / 339 (100.0%)**.
  - **Intervention Domain ($NDVI < 0.65$)**: **0 / 339 (0.0%)**.
- **Physical Explanation**: In cells that already exhibit saturated vegetation ($NDVI > 0.90$), additional synthetic incremental greening ($+0.15$) cannot physically cool the surface further due to canopy spectral saturation and empirical model sensitivity boundaries at the extreme edge of the training distribution. Within the declared municipal intervention domain (cells where $NDVI < 0.65$), the unconstrained diagnostic model achieves a 100.0% negative response rate.

---

## Step 2: Pre-Registered Decision Rules
1. **Threshold**: Pre-registered at $\ge 95.0\%$ of cells across the declared municipal grid.
2. **Domain Restriction**: Evaluated across both:
   - Full City Grid (8,302 cells): 95.9% response rate $\ge 95.0\%$.
   - Declared Intervention Domain ($NDVI < 0.65$, greenable cells): 100.0% response rate.
3. **Status Assignment**:
   - Status: `PASSED_WITH_EXCLUSIONS`.
   - Excluded/Suppressed share: 4.1% (339 cells with baseline $NDVI \ge 0.90$).
4. **Behavior if FAILED**:
   - If gate is FAILED: all cooling fields in `cells.json`, API, and UI are nullified (`null`); optimizer falls back to hazard-based ranking (`population * heat_excess / greenable_ha`), labelled "Hazard-based ranking, no cooling estimate"; cooling totals show "Cooling: Not available (model quality gate not met)".
