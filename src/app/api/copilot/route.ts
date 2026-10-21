import { NextRequest } from "next/server";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import {
  generateCopilotResponse,
  generateLocalCopilotResponse,
  isGeminiConfigured,
  getGeminiModel,
  GeminiAdvisorError,
  CopilotChatContext,
  CopilotChatMessage,
} from "@/server/ai/gemini-advisor";

export async function GET() {
  return successResponse({
    configured: isGeminiConfigured(),
    model: getGeminiModel(),
    status: "ready",
    hasLocalEngine: true,
  });
}

export async function POST(req: NextRequest) {
  try {
    await requireAuthUser(req);

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

    // If Gemini API key is missing on the server
    if (!isGeminiConfigured()) {
      if (fallbackToLocal) {
        const localResult = generateLocalCopilotResponse(message.trim(), context, history);
        return successResponse(localResult);
      }

      return errorResponse(
        "Gemini API key is not configured on the server. Please add GEMINI_API_KEY to your .env file.",
        "KEY_NOT_CONFIGURED",
        503,
        { canUseLocalFallback: true }
      );
    }

    // When Gemini API key is present, invoke Google Gemini Live AI with local fallback resilience
    try {
      const result = await generateCopilotResponse(message.trim(), context, history);
      return successResponse(result);
    } catch (err: unknown) {
      if (fallbackToLocal) {
        console.warn("[Copilot] Cloud Gemini API failed, falling back to local GIS engine:", err);
        const localResult = generateLocalCopilotResponse(message.trim(), context, history);
        return successResponse(localResult);
      }
      throw err;
    }
  } catch (err: unknown) {
    if (err instanceof GeminiAdvisorError) {
      return errorResponse(err.message, err.code, err.statusCode);
    }
    return handleRouteError(err);
  }
}
