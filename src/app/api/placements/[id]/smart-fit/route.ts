import { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import { smartFitFootprint } from "@/server/analysis-engine/smart-fit";
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

    const fitResult = await smartFitFootprint(
      placement.type as InfrastructureTypeId,
      placement.lat,
      placement.lng,
      placement.lengthM,
      placement.widthM,
      placement.bearingDeg
    );

    if (!fitResult) {
      return errorResponse(
        "Could not detect an adjacent road corridor within 300m to align the footprint.",
        "NO_ROAD_FRONTAGE",
        422
      );
    }

    // Update placement in database with fitted geometry
    const updated = await prisma.placement.update({
      where: { id: params.id },
      data: {
        lat: fitResult.lat,
        lng: fitResult.lng,
        lengthM: fitResult.lengthM,
        widthM: fitResult.widthM,
        bearingDeg: fitResult.bearingDeg,
      },
    });

    // Run immediate site validation on the new geometry
    const customParams = JSON.parse(updated.params || "{}");
    const validation = await validateFootprint(
      updated.type as InfrastructureTypeId,
      updated.lat,
      updated.lng,
      updated.lengthM,
      updated.widthM,
      updated.bearingDeg,
      undefined,
      customParams
    );

    return successResponse({
      placement: {
        ...updated,
        params: customParams,
      },
      validation,
      smartFit: fitResult,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
