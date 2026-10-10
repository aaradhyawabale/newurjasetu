import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";

const updatePlacementSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  lengthM: z.number().positive().optional(),
  widthM: z.number().positive().optional(),
  bearingDeg: z.number().optional(),
  params: z.record(z.any()).optional(),
  label: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser(req);

    const placement = await prisma.placement.findFirst({
      where: { id: params.id, userId: user.userId },
      include: {
        analyses: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!placement) {
      return errorResponse("Placement not found", "NOT_FOUND", 404);
    }

    return successResponse({
      placement: {
        ...placement,
        params: JSON.parse(placement.params || "{}"),
        analyses: placement.analyses.map((a) => ({
          ...a,
          input: JSON.parse(a.input),
          result: JSON.parse(a.result),
        })),
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json();
    const data = updatePlacementSchema.parse(body);

    const existing = await prisma.placement.findFirst({
      where: { id: params.id, userId: user.userId },
    });

    if (!existing) {
      return errorResponse("Placement not found", "NOT_FOUND", 404);
    }

    const updateData: any = {};
    if (data.lat !== undefined) updateData.lat = data.lat;
    if (data.lng !== undefined) updateData.lng = data.lng;
    if (data.lengthM !== undefined) updateData.lengthM = data.lengthM;
    if (data.widthM !== undefined) updateData.widthM = data.widthM;
    if (data.bearingDeg !== undefined) updateData.bearingDeg = data.bearingDeg;
    if (data.label !== undefined) updateData.label = data.label.trim();
    if (data.params !== undefined) {
      const existingParams = JSON.parse(existing.params || "{}");
      updateData.params = JSON.stringify({ ...existingParams, ...data.params });
    }

    const updated = await prisma.placement.update({
      where: { id: params.id },
      data: updateData,
    });

    return successResponse({
      placement: {
        ...updated,
        params: JSON.parse(updated.params),
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

    const existing = await prisma.placement.findFirst({
      where: { id: params.id, userId: user.userId },
    });

    if (!existing) {
      return errorResponse("Placement not found", "NOT_FOUND", 404);
    }

    await prisma.placement.delete({
      where: { id: params.id },
    });

    return successResponse({ success: true, message: "Placement deleted" });
  } catch (err) {
    return handleRouteError(err);
  }
}
