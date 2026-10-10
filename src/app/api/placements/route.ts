import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import { InfrastructureTypeId, INFRASTRUCTURE_TYPES } from "@/config/infra-types";

const createPlacementSchema = z.object({
  scenarioId: z.string().uuid(),
  type: z.string().refine((val): val is InfrastructureTypeId => val in INFRASTRUCTURE_TYPES, {
    message: "Invalid infrastructure type",
  }),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  lengthM: z.number().positive(),
  widthM: z.number().positive(),
  bearingDeg: z.number().default(0),
  params: z.record(z.any()).default({}),
  label: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    const { searchParams } = new URL(req.url);
    const scenarioId = searchParams.get("scenarioId");

    const where: any = { userId: user.userId };
    if (scenarioId) {
      where.scenarioId = scenarioId;
    }

    const placements = await prisma.placement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        analyses: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            overallScore: true,
            scoreBand: true,
            createdAt: true,
          },
        },
      },
    });

    const parsed = placements.map((p) => ({
      ...p,
      params: JSON.parse(p.params || "{}"),
      latestAnalysis: p.analyses[0] || null,
    }));

    return successResponse({ placements: parsed });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json();
    const data = createPlacementSchema.parse(body);

    // Verify scenario belongs to authenticated user
    const scenario = await prisma.scenario.findFirst({
      where: { id: data.scenarioId, userId: user.userId },
    });

    if (!scenario) {
      return errorResponse("Scenario not found or access denied", "NOT_FOUND", 404);
    }

    const label = data.label?.trim() || `${data.type} (${data.lat.toFixed(4)}, ${data.lng.toFixed(4)})`;

    const placement = await prisma.placement.create({
      data: {
        userId: user.userId,
        scenarioId: data.scenarioId,
        type: data.type,
        lat: data.lat,
        lng: data.lng,
        lengthM: data.lengthM,
        widthM: data.widthM,
        bearingDeg: data.bearingDeg,
        params: JSON.stringify(data.params),
        label,
      },
    });

    return successResponse(
      {
        placement: {
          ...placement,
          params: JSON.parse(placement.params),
        },
      },
      201
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
