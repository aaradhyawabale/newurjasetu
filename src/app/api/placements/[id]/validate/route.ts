import { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import { validateFootprint } from "@/server/analysis-engine/validation";
import { InfrastructureTypeId } from "@/config/infra-types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser(req);

    const placement = await prisma.placement.findFirst({
      where: { id: params.id, userId: user.userId },
    });

    if (!placement) {
      return errorResponse("Placement not found", "NOT_FOUND", 404);
    }

    const validation = await validateFootprint(
      placement.type as InfrastructureTypeId,
      placement.lat,
      placement.lng,
      placement.lengthM,
      placement.widthM,
      placement.bearingDeg
    );

    return successResponse({ validation });
  } catch (err) {
    return handleRouteError(err);
  }
}
