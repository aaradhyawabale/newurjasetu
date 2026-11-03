# UrjaSetu: Google Gemini Cloud AI Troubleshooting & Diagnostics

## 1. Overview
UrjaSetu integrates Google Gemini Cloud AI for grounded urban planning and infrastructure siting advisory. If cloud connectivity is disrupted, UrjaSetu autonomously falls back to its deterministic Local GIS Rules Engine, ensuring uninterrupted operation for civil and town planning calculations.

---

## 2. Root Cause Analysis of "fetch failed / network connection failed"

### Primary Root Causes Identified:
1. **Model Retirement by Google (`gemini-2.5-flash` returned 404 NOT_FOUND)**:
   * Google returned: `"This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features and improvements."`
   * Attempting to generate text with deprecated models caused 404 errors, which previously aborted the fallback chain.
2. **Short Request Timeout (15 seconds)**:
   * Cold starts, complex system instructions, and urban planning prompts often require 15–25 seconds.
   * A 15-second `Promise.race` timeout triggered before the model could complete synthesis, throwing a timeout error that fell back to the local engine.
   * **Fix**: Timeout increased to **35 seconds**.
3. **Sandbox Network Isolation**:
   * Running background processes inside standard terminal sandboxes without bypass prevents Node.js from opening outbound TCP sockets on port 443.
   * Outbound calls to `generativelanguage.googleapis.com` are blocked at the OS socket boundary, presenting as `TypeError: fetch failed`.
   * **Fix**: Always run server and live network processes with appropriate network permissions.
4. **Google Spikes in Demand (`gemini-3.8-flash` returning 503 UNAVAILABLE)**:
   * The newest flagship model `gemini-3.8-flash` frequently experiences high demand spikes (503).
   * **Fix**: Built an autonomous fallback chain: `gemini-3.5-flash` (primary, stable), `gemini-3.5-flash-lite`, `gemini-flash-latest`, `gemini-3.8-flash`, `gemini-3-flash-preview`.

---

## 3. Real-Time Diagnostics

UrjaSetu provides a 5-stage diagnostic endpoint at:
`GET /api/copilot/health` (or `GET /api/copilot?diagnostic=true`)

### Diagnostic Stages:
1. **DNS Resolution**: Resolves `generativelanguage.googleapis.com` (verifies IPv4 & IPv6 records).
2. **HTTPS Reachability**: Tests TLS connection to port 443 with a 5-second timeout.
3. **API Authentication**: Validates the server's `GEMINI_API_KEY` format and invokes `ai.models.list()`.
4. **Model Availability**: Identifies which models from the candidate list are active and accessible.
5. **Live Generation Capability**: Executes an actual end-to-end `ai.models.generateContent()` request and records round-trip latency in milliseconds.

### Status Codes:
* `CONNECTED`: All 5 stages succeeded; Gemini Cloud AI is fully operational.
* `NETWORK_UNREACHABLE`: Outbound HTTPS connections to port 443 are blocked by firewall/sandbox.
* `DNS_FAILURE`: DNS resolver cannot look up `generativelanguage.googleapis.com`.
* `AUTHENTICATION_FAILED`: Provided `GEMINI_API_KEY` is invalid or unauthorized (HTTP 401/403).
* `QUOTA_EXCEEDED`: API quota exhausted or rate limit hit (HTTP 429).
* `MODEL_UNAVAILABLE`: Configured model is discontinued or not found (HTTP 404).
* `SERVICE_UNAVAILABLE`: Google's API is temporarily overloaded (HTTP 503).
* `GENERATION_FAILED`: Generation call failed.
* `KEY_NOT_CONFIGURED`: `GEMINI_API_KEY` is missing from environment.

---

## 4. Frontend Resilience & Controlled Retries

* **Non-Intrusive Error Presentation**: The application no longer displays repetitive alarming error banners across every individual chat bubble. Instead, a clean attribution badge (`UrjaSetu Local GIS Rules Engine (Deterministic Mode)`) distinguishes local responses from cloud responses.
* **Live Test Button**: Users and engineers can click **Test Connection** in the Copilot header to run immediate live diagnostics without sending a full chat prompt.
* **Deterministic Fallback**: All civil spatial calculations (setbacks, road alignments, conflict detection) continue functioning with 100% mathematical determinism even when cloud AI is unreachable.
