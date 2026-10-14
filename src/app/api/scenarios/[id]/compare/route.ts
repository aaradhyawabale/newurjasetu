import { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import { buildCandidateSummary, compareCandidates } from "@/server/scenarios/comparison";
import { CandidateSummary } from "@/server/scenarios/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser(req);

    // Verify scenario ownership
    const scenario = await prisma.scenario.findFirst({
      where: { id: params.id, userId: user.userId },
      include: {
        placements: {
          orderBy: { createdAt: "asc" },
          include: {
            analyses: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!scenario) {
      return errorResponse("Scenario not found or access denied", "NOT_FOUND", 404);
    }

    const candidates: CandidateSummary[] = [];

    for (const p of scenario.placements) {
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
            scenarioName: scenario.name,
          })
        );
      }
    }

    const comparison = compareCandidates(candidates, {
      id: scenario.id,
      name: scenario.name,
    });

    return successResponse({ comparison });
  } catch (err) {
    return handleRouteError(err);
  }
}
