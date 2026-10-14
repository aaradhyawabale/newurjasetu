import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { errorResponse, handleRouteError } from "@/server/utils/response";
import { buildCandidateSummary, compareCandidates } from "@/server/scenarios/comparison";
import { CandidateSummary } from "@/server/scenarios/types";
import { generateScenarioComparisonPdf } from "@/server/pdf/generate-scenario-comparison-pdf";

export const dynamic = "force-dynamic";

const comparePdfSchema = z.object({
  placementIds: z.array(z.string().uuid()).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json();
    const { placementIds } = comparePdfSchema.parse(body);

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

    if (candidates.length === 0) {
      return errorResponse("No analyzed candidates found among selected placements", "BAD_REQUEST", 400);
    }

    const comparison = compareCandidates(candidates);
    const pdfBytes = await generateScenarioComparisonPdf(comparison);

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="UrjaSetu-Candidate-Comparison-${Date.now()}.pdf"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
