import { NextRequest } from "next/server";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import {
  generateCopilotResponse,
  generateLocalCopilotResponse,
  isAIConfigured,
  getAIModel,
  sanitizeErrorMessage,
  AIAdvisorError,
  CopilotChatContext,
  CopilotChatMessage,
} from "@/server/ai/advisor";
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
    await requireAuthUser(req);

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

    const { message, context, history, fallbackToLocal } = body as {
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
      if (fallbackToLocal) {
        const localResult = generateLocalCopilotResponse(message.trim(), context, history);
        return successResponse({
          ...localResult,
          engineSource: "local_gis_engine",
          cloudUnavailable: true,
          cloudError: "NuGen API key is not configured on the server.",
        });
      }

      return errorResponse(
        "NuGen API key is not configured on the server. Please add NUGEN_API_KEY to your .env.local file.",
        "KEY_NOT_CONFIGURED",
        503,
        { canUseLocalFallback: true }
      );
    }

    // When NuGen API key is present, invoke NuGen AI with local fallback resilience
    try {
      const result = await generateCopilotResponse(message.trim(), context, history);
      return successResponse({
        ...result,
        engineSource: "nugen_cloud",
      });
    } catch (err: unknown) {
      const sanitizedErr = sanitizeErrorMessage(err);
      console.warn("[Copilot] NuGen AI API call failed:", sanitizedErr);
      if (fallbackToLocal) {
        const localResult = generateLocalCopilotResponse(message.trim(), context, history);
        return successResponse({
          ...localResult,
          engineSource: "local_gis_engine",
          cloudUnavailable: true,
          cloudError: sanitizedErr,
          reply:
            `> ℹ️ **UrjaSetu Copilot Notice: NuGen Cloud AI unreachable** (${sanitizedErr}). Analyzed via **UrjaSetu Local GIS Rules Engine (Deterministic)**:\n\n` +
            localResult.reply,
        });
      }
      throw err;
    }
  } catch (err: unknown) {
    if (err instanceof AIAdvisorError) {
      return errorResponse(err.message, err.code, err.statusCode);
    }
    return handleRouteError(err);
  }
}
