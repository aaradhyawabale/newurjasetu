import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import {
  generateCopilotResponse,
  buildStaticScenarioSummary,
  isAIConfigured,
  getAIModel,
  sanitizeErrorMessage,
  AIAdvisorError,
  CopilotChatContext,
  CopilotChatMessage,
} from "@/server/ai/advisor";
import { nuGenProvider } from "@/server/ai/llm/nugen-provider";
import { LLMAuthError, LLMTimeoutError } from "@/server/ai/llm/types";
import { globalAIRouteRateLimiter } from "@/server/ai/llm";

export async function GET(req: NextRequest) {
  const isDiagnostic = req.nextUrl?.searchParams?.get("diagnostic") === "true";
  if (isDiagnostic) {
    const { runNuGenConnectionDiagnostic } = await import("@/server/ai/diagnostic");
    const diagnostic = await runNuGenConnectionDiagnostic();
    return successResponse(diagnostic);
  }

  return successResponse({
    configured: isAIConfigured(),
    model: getAIModel(),
    status: "ready",
    hasLocalEngine: true,
  });
}

export async function POST(req: NextRequest) {
  try {
    // Optional planner authentication: guests and planners can both query Copilot
    await getSessionUser(req).catch(() => null);

    // Apply per-IP rate limit
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rateCheck = globalAIRouteRateLimiter.check(ip);
    if (!rateCheck.allowed) {
      return errorResponse("Too many requests to AI Copilot. Please wait a moment.", "RATE_LIMIT_EXCEEDED", 429);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON payload", "BAD_REQUEST", 400);
    }

    const { message, context, history } = body as {
      message?: string;
      context?: CopilotChatContext;
      history?: CopilotChatMessage[];
      fallbackToLocal?: boolean;
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return errorResponse("Message is required and cannot be empty", "BAD_REQUEST", 400);
    }

    // If NuGen API key is missing on the server
    if (!isAIConfigured()) {
      const staticSummary = buildStaticScenarioSummary(context);
      console.error("[Copilot Error] NUGEN_API_KEY environment variable is not configured or empty.");
      return successResponse({
        reply: `The AI service is temporarily unavailable. Here is the static scenario summary: ${staticSummary}`,
        degraded: true,
        error: "LLM_UNAUTHORIZED",
        engineSource: "static_fallback",
      });
    }

    // Default route is ALWAYS NuGen AI
    try {
      const result = await generateCopilotResponse(message.trim(), context, history);
      return successResponse({
        ...result,
        engineSource: "nugen_cloud",
      });
    } catch (err: unknown) {
      const sanitizedErr = sanitizeErrorMessage(err);
      const endpoint = `${nuGenProvider.getBaseUrl()}/inference/chat/completions`;
      const model = nuGenProvider.getModel();

      let statusCode = 500;
      let errorType: "LLM_UNAUTHORIZED" | "LLM_TIMEOUT" | "LLM_ERROR" = "LLM_ERROR";

      if (
        err instanceof LLMAuthError ||
        (err as any)?.statusCode === 401 ||
        (err as any)?.statusCode === 403 ||
        (err as any)?.code === "KEY_NOT_CONFIGURED" ||
        (err as any)?.code === "AUTH_ERROR"
      ) {
        statusCode = 401;
        errorType = "LLM_UNAUTHORIZED";
      } else if (
        err instanceof LLMTimeoutError ||
        (err as any)?.statusCode === 504 ||
        (err as any)?.code === "TIMEOUT"
      ) {
        statusCode = 504;
        errorType = "LLM_TIMEOUT";
      }

      console.error(
        `[Copilot LLM Failure] Status: ${statusCode}, Endpoint: ${endpoint}, Model: ${model}, Response: ${sanitizedErr}`
      );

      const staticSummary = buildStaticScenarioSummary(context);
      return successResponse({
        reply: `The AI service is temporarily unavailable. Here is the static scenario summary: ${staticSummary}`,
        degraded: true,
        error: errorType,
        engineSource: "static_fallback",
        cloudUnavailable: true,
        cloudError: sanitizedErr,
      });
    }
  } catch (err: unknown) {
    if (err instanceof AIAdvisorError) {
      return errorResponse(err.message, err.code, err.statusCode);
    }
    return handleRouteError(err);
  }
}
