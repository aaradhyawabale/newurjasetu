import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";

const updateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json();
    const { name } = updateSchema.parse(body);

    const existing = await prisma.scenario.findFirst({
      where: { id: params.id, userId: user.userId },
    });

    if (!existing) {
      return errorResponse("Scenario not found", "NOT_FOUND", 404);
    }

    const updated = await prisma.scenario.update({
      where: { id: params.id },
      data: { name: name.trim() },
    });

    return successResponse({ scenario: updated });
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

    const existing = await prisma.scenario.findFirst({
      where: { id: params.id, userId: user.userId },
    });

    if (!existing) {
      return errorResponse("Scenario not found", "NOT_FOUND", 404);
    }

    await prisma.scenario.delete({
      where: { id: params.id },
    });

    return successResponse({ success: true, message: "Scenario deleted" });
  } catch (err) {
    return handleRouteError(err);
  }
}
