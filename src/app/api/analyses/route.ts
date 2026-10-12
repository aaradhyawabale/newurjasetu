import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import { runAnalysisEngine } from "@/server/analysis-engine/engine";
import { InfrastructureTypeId } from "@/config/infra-types";

const runAnalysisSchema = z.object({
  placementId: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);

    const analyses = await prisma.analysis.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      include: {
        placement: {
          select: {
            id: true,
            type: true,
            label: true,
            lat: true,
            lng: true,
            scenario: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const parsed = analyses.map((a) => ({
      id: a.id,
      placementId: a.placementId,
      engineVersion: a.engineVersion,
      overallScore: a.overallScore,
      scoreBand: a.scoreBand,
      createdAt: a.createdAt,
      type: a.placement.type,
      label: a.placement.label,
      lat: a.placement.lat,
      lng: a.placement.lng,
      scenarioName: a.placement.scenario.name,
    }));

    return successResponse({ analyses: parsed });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json();
    const { placementId } = runAnalysisSchema.parse(body);

    const placement = await prisma.placement.findFirst({
      where: { id: placementId, userId: user.userId },
    });

    if (!placement) {
      return errorResponse("Placement not found or access denied", "NOT_FOUND", 404);
    }

    const customParams = JSON.parse(placement.params || "{}");
    const generatedAnalysisId = crypto.randomUUID();

    // Execute 10-step analysis engine pipeline
    const result = await runAnalysisEngine({
      analysisId: generatedAnalysisId,
      placementId: placement.id,
      type: placement.type as InfrastructureTypeId,
      lat: placement.lat,
      lng: placement.lng,
      lengthM: placement.lengthM,
      widthM: placement.widthM,
      bearingDeg: placement.bearingDeg,
      customParams,
      label: placement.label || undefined,
    });

    // Step 9: Persist full result snapshot in DB
    const analysis = await prisma.analysis.create({
      data: {
        id: generatedAnalysisId,
        userId: user.userId,
        placementId: placement.id,
        engineVersion: result.engineVersion,
        overallScore: result.overall.score,
        scoreBand: result.overall.band,
        input: JSON.stringify({
          placementId: placement.id,
          type: placement.type,
          lat: placement.lat,
          lng: placement.lng,
          lengthM: placement.lengthM,
          widthM: placement.widthM,
          bearingDeg: placement.bearingDeg,
          params: result.placementSnapshot.params,
        }),
        result: JSON.stringify(result),
      },
    });

    // Step 10: Return structured response to frontend
    return successResponse(
      {
        analysis: {
          id: analysis.id,
          placementId: analysis.placementId,
          engineVersion: analysis.engineVersion,
          overallScore: analysis.overallScore,
          scoreBand: analysis.scoreBand,
          createdAt: analysis.createdAt,
          result,
        },
      },
      201
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

