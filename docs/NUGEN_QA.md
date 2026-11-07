# NuGen AI Migration QA Memory & Iteration Log

## Exit Checks Tracking
- [x] **E1**: Zero Gemini references or dependencies remain (grep proves zero in `src/`, `tests/`, and `package.json`).
- [x] **E2**: NuGen calls work live on `https://api.nugen.in/api/v3/inference/chat/completions`.
- [x] **E3**: All AI routes (`/api/copilot`, `/api/copilot/health`, `/api/copilot/configure`, `/api/analyses/[id]/decision`) maintain exact response shapes.
- [x] **E4**: Numeric grounding check and scientific wording guards active; deterministic fallback works offline.
- [x] **E5**: Secret scan passes: API key never in bundles, source, or git-tracked files.
- [x] **E6**: Visual UI unchanged except text naming Gemini replaced by "NuGen AI".
- [x] **E7**: Eval test suite (`tests/ai/copilot_eval.json`) pass rate: 20/20 (100% >= 90%).
- [x] **E8**: Unit tests (52/52), contract tests (50/50 integration), TypeScript `typecheck` (0 errors), and build pass cleanly.
- [x] **E9**: Setup explained in under 15 lines in `docs/NUGEN_INTEGRATION.md` and `README.md`.

---

## Iteration 1 — Discovery & Probe
- **Status**: PASSED
- **Key Findings**:
  - Live API reachable at `https://api.nugen.in/api/v3/inference/chat/completions` with user key.
  - Active model: `meta-llama/Llama-3.2-3B-Instruct` (200 OK, latency ~550ms).
  - Native function calling returns null tool calls; two-stage JSON tool request protocol (`{"tool": ..., "args": ...}`) is required and fully validated.
  - Streaming and JSON mode verified.
  - Keys stored exclusively in git-ignored `.env.local`.

---

## Iteration 2 — Integration, Guardrails, Eval & Build Verification
- **Status**: PASSED
- **Verification Details**:
  - `grep -rin "gemini" src/` -> 0 occurrences found.
  - Removed `@google/genai` from `package.json`.
  - NuGenProvider implemented with circuit breaker (5 failures / 30s timeout), exponential backoff on 429, and automatic bearer token sanitization.
  - Strict scientific guardrails enforced: unnegated air temperature refused, affirmative tree canopy prohibited, numeric grounding verified against tool outputs.
  - Evaluation benchmark (`tests/unit/copilot-eval.test.ts`): 20/20 tests passed (100%).
  - TypeScript compilation (`npm run typecheck`): 0 errors.
  - Full vitest suite: 54/54 test files passed.
  - Zero secrets in commit history or client code.
