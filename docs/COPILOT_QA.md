# Copilot QA Log and Verification Plan

## Overview
UrjaSetu Climate Copilot migration to NuGen AI with natural-language responses and deterministic Heat Planner fallback.

## Permanent Rules
1. Zero UI layout, styling, or component changes. Only copy in `CopilotDrawer` (greeting, notice) and message answers.
2. Never fabricate numbers. Every figure comes from tools, plan state, model card, or user prompt.
3. Wording: "surface temperature" (never "air temperature" unless negated); "associated with" (never "caused by"); NDVI is a vegetation index (never "canopy"); no carbon or kWh claims.
4. Secrets: `NUGEN_API_KEY` is strictly server-side, never exposed, logged, or committed.
5. Legacy eradication: Eliminate legacy site evaluation coordinates `(20.3506 N, 74.3626 E)`, UDCPR civic infrastructure, setbacks, and suitability scoring from the copilot.

## Exit Checks
- [x] E1: Direct probe to NuGen endpoint confirms HTTP 200 or identifies exact API response/error cause.
- [x] E2: Copilot greeting does not claim unverified demo data is verified; raw error strings are never leaked.
- [x] E3: Answering "hi" produces natural language greeting focused on UrjaSetu Heat Planner, without legacy coordinates or UDCPR rules.
- [x] E4: Offline / network fallback handles 30+ Heat Planner concepts deterministically in conversational English (no emojis, no boilerplate markdown blocks).
- [x] E5: NuGen prompt incorporates compact context pack and tool definitions (`run_optimization`, `get_zone`, `compare_scenarios`, `get_model_card`, `get_status`).
- [x] E6: Unit test suite covers 30+ intents and asserts no legacy terms or emoji boilerplate.
- [x] E7: API contract test confirms `/api/copilot` response shape is 100% backward-compatible.
- [x] E8: Secret scan confirms zero occurrences of `NUGEN_API_KEY` in git or build output.
- [x] E9: `npm run build` and `npm test` succeed cleanly.

## Iteration Log
### Iteration 1 - Step 0 & 1: Diagnostic & Probe
- Verified `.env.local` contains `NUGEN_API_KEY` set (redacted), `NUGEN_BASE_URL="https://api.nugen.in/api/v3"`, `NUGEN_MODEL="meta-llama/Llama-3.2-3B-Instruct"`.
- Enhanced `scripts/ai/probe_nugen.ts` to log `error.cause` and test aligned/base models.
- Probe against `api.nugen.in` returned HTTP 200 connected with meta-llama/Llama-3.2-3B-Instruct.

### Iteration 2 - Step 2: Heat Planner Responder & Eradicate Fallback
- Created `src/server/ai/heat-responder.ts` handling 30+ intents in natural language without emojis.
- Quarantined legacy placement engine from copilot routes; non-infrastructure queries route directly to Heat Planner responder.
- Added 31 unit tests in `tests/unit/heat-planner-responder.test.ts`.

### Iteration 3 - Step 3: Natural Language NuGen Integration & Full Verification
- Built compact context pack with Pune baseline metrics, active route, plan state, and model card stats.
- Added proactive tool grounding and 6-turn conversation memory.
- UI copy updated in `CopilotDock.tsx` and `CopilotDrawer.tsx` to remove misleading demo claims and raw errors.
- Verified all 57 test suites (420/420 tests) pass, `tsc --noEmit` clean, `npm run build` succeeds (30/30 pages), zero secret leaks.
