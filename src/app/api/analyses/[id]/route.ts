import { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser(req);

    const analysis = await prisma.analysis.findFirst({
      where: { id: params.id, userId: user.userId },
      include: {
        placement: true,
      },
    });

    if (!analysis) {
      return errorResponse("Analysis report not found", "NOT_FOUND", 404);
    }

    return successResponse({
      analysis: {
        id: analysis.id,
        placementId: analysis.placementId,
        engineVersion: analysis.engineVersion,
        overallScore: analysis.overallScore,
        scoreBand: analysis.scoreBand,
        createdAt: analysis.createdAt,
        input: JSON.parse(analysis.input),
        result: JSON.parse(analysis.result),
        placement: {
          ...analysis.placement,
          params: JSON.parse(analysis.placement.params || "{}"),
        },
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser(req);

    const analysis = await prisma.analysis.findFirst({
      where: { id: params.id, userId: user.userId },
    });

    if (!analysis) {
      return errorResponse("Analysis report not found", "NOT_FOUND", 404);
    }

    await prisma.analysis.delete({
      where: { id: params.id },
    });

    return successResponse({ success: true, message: "Analysis report deleted" });
  } catch (err) {
    return handleRouteError(err);
  }
}
