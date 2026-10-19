import { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import { smartFitFootprint, SmartFitOtherPlacement } from "@/server/analysis-engine/smart-fit";
import { validateFootprint } from "@/server/analysis-engine/validation";
import { InfrastructureTypeId } from "@/config/infra-types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json().catch(() => ({}));

    const placement = await prisma.placement.findFirst({
      where: { id: params.id, userId: user.userId },
    });

    if (!placement) {
      return errorResponse("Placement not found", "NOT_FOUND", 404);
    }

    // Use latest client in-memory coordinates/dimensions if provided
    const targetType = (body.type || placement.type) as InfrastructureTypeId;
    const targetLat = typeof body.lat === "number" ? body.lat : placement.lat;
    const targetLng = typeof body.lng === "number" ? body.lng : placement.lng;
    const targetLengthM = typeof body.lengthM === "number" ? body.lengthM : placement.lengthM;
    const targetWidthM = typeof body.widthM === "number" ? body.widthM : placement.widthM;
    const targetBearingDeg = typeof body.bearingDeg === "number" ? body.bearingDeg : placement.bearingDeg;

    // Fetch other user-placed infrastructures in this scenario to prevent mutual overlap
    const otherDbPlacements = await prisma.placement.findMany({
      where: {
        userId: user.userId,
        scenarioId: placement.scenarioId,
        id: { not: placement.id },
      },
    });

    const otherPlacements: SmartFitOtherPlacement[] = otherDbPlacements.map((p) => ({
      id: p.id,
      type: p.type,
      lat: p.lat,
      lng: p.lng,
      lengthM: p.lengthM,
      widthM: p.widthM,
      bearingDeg: p.bearingDeg,
    }));

    // If client supplied any extra uncommitted placements in body
    if (Array.isArray(body.otherPlacements)) {
      for (const op of body.otherPlacements) {
        if (op.id !== placement.id) {
          otherPlacements.push(op);
        }
      }
    }

    const fitResult = await smartFitFootprint(
      targetType,
      targetLat,
      targetLng,
      targetLengthM,
      targetWidthM,
      targetBearingDeg,
      undefined,
      otherPlacements
    );

    if (!fitResult) {
      return errorResponse(
        "No unbuilt open land parcel found along nearby road corridors without overlapping buildings, roads, or other infrastructures. Please select an open parcel or reduce the footprint dimensions.",
        "NO_UNBUILT_PARCEL",
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
