import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import { OverpassProvider } from "@/server/providers/overpass";
import { analyzeBridgeConnectivity } from "@/server/analysis-engine/bridge-planner";
import { validateFootprint } from "@/server/analysis-engine/validation";

const overpassProvider = new OverpassProvider();

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser(req);
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const action = body.action || "get_appraisal";

    const placement = await prisma.placement.findFirst({
      where: { id, userId: user.userId },
    });

    if (!placement) {
      return errorResponse("Placement not found", "NOT_FOUND", 404);
    }

    if (placement.type !== "Bridge") {
      return errorResponse(
        "Bridge actions only applicable for Bridge infrastructure",
        "INVALID_INFRA_TYPE",
        400
      );
    }

    // Fetch local OSM elements around bridge
    const overpassRes = await overpassProvider.getFeaturesAround(
      placement.lat,
      placement.lng,
      1200
    );

    const appraisal = analyzeBridgeConnectivity({
      lat: placement.lat,
      lng: placement.lng,
      lengthM: placement.lengthM,
      widthM: placement.widthM,
      bearingDeg: placement.bearingDeg,
      osmElements: overpassRes.elements,
    });

    if (action === "relocate_to_crossing") {
      const candidate =
        body.candidate || appraisal.recommendedActions.suggestion1_relocate.candidate;

      if (!candidate) {
        return errorResponse(
          "No suitable nearby river crossing candidate found to relocate to.",
          "NO_CROSSING_FOUND",
          422
        );
      }

      const updated = await prisma.placement.update({
        where: { id },
        data: {
          lat: candidate.centerLat,
          lng: candidate.centerLng,
          lengthM: candidate.spanM,
          bearingDeg: candidate.bearingDeg,
        },
      });

      // Auto revalidate
      const parsedParams = JSON.parse(placement.params || "{}");
      const validation = await validateFootprint(
        "Bridge",
        updated.lat,
        updated.lng,
        updated.lengthM,
        updated.widthM,
        updated.bearingDeg,
        overpassRes.elements,
        parsedParams
      );

      return successResponse({
        action: "relocate_to_crossing",
        placement: {
          ...updated,
          params: parsedParams,
        },
        validation,
        message: `Relocated bridge to natural road-to-road river crossing linking ${candidate.bank1RoadName} and ${candidate.bank2RoadName}.`,
      });
    }

    // Default: return appraisal and approach road geometries
    return successResponse({
      action: "get_appraisal",
      appraisal,
    });
  } catch (err: any) {
    return handleRouteError(err);
  }
}
