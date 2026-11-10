import { NextResponse } from "next/server";
import { nuGenProvider, redactSecret } from "@/server/ai/llm/nugen-provider";
import { LLMAuthError, LLMTimeoutError } from "@/server/ai/llm/types";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint for NuGen AI
 * GET /api/copilot/health
 *
 * Sends a minimal prompt ("Reply with OK", max tokens ~5) to NuGen and returns
 * { ok: true } or { ok: false, status, errorType, hint } with zero secret leakage.
 */
export async function GET() {
  const apiKey = nuGenProvider.getApiKey();

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        status: 401,
        errorType: "MISSING_KEY",
        hint: "missing key: NUGEN_API_KEY environment variable is not set or is empty in Render.",
      },
      { status: 200 }
    );
  }

  try {
    const start = Date.now();
    await nuGenProvider.complete(
      [{ role: "user", content: "Reply with OK" }],
      { maxTokens: 5, timeoutMs: 15000 }
    );

    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - start,
    });
  } catch (err: any) {
    const sanitizedMsg = redactSecret(err?.message || "Health check failed", apiKey);
    let status = err?.statusCode || 500;
    let errorType = "LLM_ERROR";
    let hint = "wrong base URL/model or NuGen server issue: check NUGEN_BASE_URL and NUGEN_MODEL.";

    if (
      err instanceof LLMAuthError ||
      status === 401 ||
      status === 403 ||
      err?.code === "AUTH_ERROR"
    ) {
      status = 401;
      errorType = "LLM_UNAUTHORIZED";
      hint = "invalid/expired key or wrong header: verify NUGEN_API_KEY in Render has no surrounding quotes or whitespace.";
    } else if (
      err instanceof LLMTimeoutError ||
      status === 504 ||
      err?.code === "TIMEOUT"
    ) {
      status = 504;
      errorType = "LLM_TIMEOUT";
      hint = "timeout: NuGen API did not respond within timeout window.";
    }

    console.error(`[Copilot Health Check Failed] status=${status}, errorType=${errorType}, error=${sanitizedMsg}`);

    return NextResponse.json(
      {
        ok: false,
        status,
        errorType,
        hint,
      },
      { status: 200 }
    );
  }
}
