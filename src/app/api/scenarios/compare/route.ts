import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import { buildCandidateSummary, compareCandidates } from "@/server/scenarios/comparison";
import { CandidateSummary } from "@/server/scenarios/types";

const compareRequestSchema = z.object({
  placementIds: z.array(z.string().uuid()).min(1, "At least one placement ID is required"),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json();
    const { placementIds } = compareRequestSchema.parse(body);

    const placements = await prisma.placement.findMany({
      where: {
        id: { in: placementIds },
        userId: user.userId,
      },
      include: {
        scenario: {
          select: { id: true, name: true },
        },
        analyses: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (placements.length === 0) {
      return errorResponse("No matching placements found", "NOT_FOUND", 404);
    }

    const candidates: CandidateSummary[] = [];

    for (const p of placements) {
      const latestAnalysis = p.analyses[0];
      if (latestAnalysis) {
        let parsedParams = {};
        try {
          parsedParams = JSON.parse(p.params || "{}");
        } catch {
          parsedParams = {};
        }

        candidates.push(
          buildCandidateSummary({
            placement: {
              ...p,
              params: parsedParams,
            },
            analysis: latestAnalysis,
            scenarioName: p.scenario.name,
          })
        );
      }
    }

    const comparison = compareCandidates(candidates);

    return successResponse({ comparison });
  } catch (err) {
    return handleRouteError(err);
  }
}
