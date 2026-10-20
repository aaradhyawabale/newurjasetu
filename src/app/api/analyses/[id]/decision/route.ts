import { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import {
  generateGeminiPlanningInsights,
  isGeminiConfigured,
  getGeminiModel,
  GeminiAdvisorError,
} from "@/server/ai/gemini-advisor";
import { AnalysisReportResult } from "@/server/analysis-engine/engine";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser(req);
    const configured = isGeminiConfigured();

    const analysis = await prisma.analysis.findFirst({
      where: {
        userId: user.userId,
        OR: [{ id: params.id }, { placementId: params.id }],
      },
      orderBy: { createdAt: "desc" },
    });

    if (!analysis) {
      return errorResponse("Analysis report not found", "NOT_FOUND", 404);
    }

    let parsedResult: AnalysisReportResult;
    try {
      parsedResult = JSON.parse(analysis.result);
    } catch {
      return errorResponse("Malformed analysis result in storage", "INTERNAL_ERROR", 500);
    }

    const aiInsights = parsedResult.aiInsights || null;

    return successResponse({
      configured,
      model: getGeminiModel(),
      hasInsights: Boolean(aiInsights),
      aiInsights,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser(req);

    const analysis = await prisma.analysis.findFirst({
      where: {
        userId: user.userId,
        OR: [{ id: params.id }, { placementId: params.id }],
      },
      orderBy: { createdAt: "desc" },
    });

    if (!analysis) {
      return errorResponse("Analysis report not found", "NOT_FOUND", 404);
    }

    let parsedResult: AnalysisReportResult;
    try {
      parsedResult = JSON.parse(analysis.result);
    } catch {
      return errorResponse("Malformed analysis result in storage", "INTERNAL_ERROR", 500);
    }

    // Check query params: if ?force=true is not passed and we already have cached insights, return cached
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("force") === "true";

    if (!forceRefresh && parsedResult.aiInsights) {
      return successResponse({
        cached: true,
        aiInsights: parsedResult.aiInsights,
      });
    }

    if (!isGeminiConfigured()) {
      return errorResponse(
        "Gemini API key is not configured on the server. Please add GEMINI_API_KEY to your .env file.",
        "KEY_NOT_CONFIGURED",
        503
      );
    }

    // Call Gemini advisor
    const aiInsights = await generateGeminiPlanningInsights(parsedResult);

    // Persist insights inside the stored analysis result
    parsedResult.aiInsights = aiInsights;
    await prisma.analysis.update({
      where: { id: analysis.id },
      data: {
        result: JSON.stringify(parsedResult),
      },
    });

    return successResponse({
      cached: false,
      aiInsights,
    });
  } catch (err) {
    if (err instanceof GeminiAdvisorError) {
      return errorResponse(err.message, err.code, err.statusCode);
    }
    return handleRouteError(err);
  }
}
