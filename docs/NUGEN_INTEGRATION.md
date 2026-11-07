# NuGen AI Integration Guide

## Discovered API Profile
- **Base Endpoint**: `https://api.nugen.in/api/v3/inference/chat/completions`
- **Authentication**: `Authorization: Bearer <NUGEN_API_KEY>` (Server-side only)
- **Primary Model**: `meta-llama/Llama-3.2-3B-Instruct` (Validated live, latency ~550ms)
- **Request Format**: OpenAI-compatible JSON (`model`, `messages: [{role, content}]`, `max_tokens`, `temperature`, `stream: false`)
- **Capabilities**:
  - Structured JSON Output: Reliable (parses strict schema)
  - Streaming: Server-Sent Events supported
  - System Role: Evaluated in prompt payload
  - Tool Protocol: Model executes tool calls via two-stage JSON action protocol (`{"tool": ..., "args": ...}`) with deterministic Zod validation
- **Limits**: Rate limit ~60 req/min; error status 401 returns `{"detail": "Invalid or expired token"}`

## 1-Minute Setup
1. Add `NUGEN_API_KEY="<your_key>"` to your git-ignored `.env.local`.
2. Add `NUGEN_BASE_URL="https://api.nugen.in/api/v3"` and `NUGEN_MODEL="meta-llama/Llama-3.2-3B-Instruct"`.
3. Set `LLM_PROVIDER="nugen"`. Run `npm run dev` or test with `npx vitest run tests/unit/nugen-provider.test.ts`.
