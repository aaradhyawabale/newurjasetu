# NuGen AI Migration Plan & API Contract Ledger

## 1. Overview & Objectives
Migrate all generative AI operations from Google Gemini to the **NuGen Intelligence AI Model** (`https://api.nugen.in/api/v3`) without altering any UI layout, styling, components, or client-facing response schemas.

---

## 2. Inventory of AI Integrations

| Feature / Location | Purpose | Previous Engine | Target NuGen Architecture |
| :--- | :--- | :--- | :--- |
| **`/api/copilot`** | Multi-turn heat resilience assistant with function calling (`run_optimization`, `get_zone`) | Gemini Flash SDK (`@google/genai`) | NuGenProvider via HTTP `/api/v3/inference/chat/completions` with JSON tool execution protocol & grounding validator |
| **`/api/copilot/health`** | Diagnostic connection & capability verifier | Gemini DNS/auth ping | NuGen 5-stage health check (`api.nugen.in`, auth token, model availability, live test generation) |
| **`/api/copilot/configure`** | Runtime API key update from UI drawer | Gemini env mutation | NuGen env updater (`.env.local` mutation, never committed) |
| **`/api/analyses/[id]/decision`** | Detailed planning rationale & narrative insights | Gemini Structured JSON schema | NuGenProvider structured JSON inference with Zod schema validation & deterministic fallback |
| **`generate-report-pdf.ts`** | PDF dossier executive summary generation | Gemini narrative generator | NuGenProvider completion with deterministic GIS fallback |

---

## 3. Strict API Route Request/Response Contracts

### A. `POST /api/copilot`
- **Request Body:**
  ```json
  {
    "message": "Run counterfactual cooling optimization with 15 hectares budget",
    "context": {
      "selectedSiteId": null,
      "selectedCandidateId": null,
      "selectedCellId": "cell_250m_0001",
      "activeTab": "cooling",
      "ward": "Kasba Peth Ward",
      "scenarioBudgetHa": 15.0,
      "scenarioTargetNdvi": 0.65,
      "scenarioObjective": "cooling"
    },
    "history": [
      { "role": "user", "content": "Hello" },
      { "role": "assistant", "content": "Welcome to UrjaSetu." }
    ],
    "fallbackToLocal": true
  }
  ```
- **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "reply": "Optimized cooling plan for 15.0 ha...",
      "suggestedQuestions": ["How many people benefit?", "What is the model CV RMSE?"],
      "referencedInterventions": [],
      "referencedWards": ["Kasba Peth Ward"],
      "referencedMetrics": { "allocated_ha": 14.8, "cooling_c": -2.3 },
      "toolCalls": [
        {
          "tool": "run_optimization",
          "args": { "budget_ha": 15.0, "target_ndvi": 0.65 },
          "result": { "status": "OK", "allocated_ha": 14.8, "selected_cells": [...] }
        }
      ],
      "engineSource": "nugen_cloud",
      "cloudUnavailable": false,
      "cloudError": null
    }
  }
  ```

### B. `GET /api/copilot`
- **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "configured": true,
      "model": "meta-llama/Llama-3.2-3B-Instruct",
      "status": "ready",
      "hasLocalEngine": true
    }
  }
  ```

### C. `GET /api/copilot/health`
- **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "status": "healthy",
      "provider": "nugen",
      "model": "meta-llama/Llama-3.2-3B-Instruct",
      "endpoint": "https://api.nugen.in/api/v3",
      "checks": {
        "endpoint_reachable": true,
        "key_configured": true,
        "model_accessible": true,
        "inference_verified": true
      },
      "latencyMs": 420,
      "timestamp": "2026-11-07T09:40:00.000Z"
    }
  }
  ```

### D. `POST /api/copilot/configure`
- **Request Body:**
  ```json
  {
    "apiKey": "nugen-...",
    "model": "meta-llama/Llama-3.2-3B-Instruct"
  }
  ```
- **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "configured": true,
      "model": "meta-llama/Llama-3.2-3B-Instruct",
      "message": "NuGen AI model credentials configured successfully."
    }
  }
  ```

### E. `GET /api/analyses/[id]/decision` & `POST /api/analyses/[id]/decision`
- **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "configured": true,
      "model": "meta-llama/Llama-3.2-3B-Instruct",
      "hasInsights": true,
      "aiInsights": {
        "headline": "Targeted Urban Cooling in High-Exposure Zone",
        "engineeringConsiderations": ["Cool roofs with SRI >= 78 per BEE ECBC 2017 Table 4.1"],
        "planningRecommendations": ["Prioritize unbuilt parcels along transport arteries"],
        "riskAndGovernance": ["Model CV RMSE is +/-0.91 C; actual cooling depends on species survival"],
        "confidenceScore": 88
      }
    }
  }
  ```

---

## 4. UI Text Replacements (No Layout or Style Changes)
- `CopilotDrawer.tsx`: Replace "Powered by Google Gemini 2.5 Flash" / "Gemini" with "NuGen AI".
- `UnifiedTopBar.tsx` / `AppShell.tsx`: Replace "Gemini" model chips with "NuGen AI".
- `GeminiInsightsCard.tsx` / `ReportDrawer.tsx`: Update text to cite NuGen AI analysis.
- Remove all `@google/genai` packages from `package.json`.
