import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, handleRouteError } from "@/server/utils/response";

const createScenarioSchema = z.object({
  name: z.string().min(1, "Scenario name cannot be empty").max(100),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    const scenarios = await prisma.scenario.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { placements: true },
        },
      },
    });

    return successResponse({ scenarios });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json();
    const { name } = createScenarioSchema.parse(body);

    const scenario = await prisma.scenario.create({
      data: {
        userId: user.userId,
        name: name.trim(),
      },
    });

    return successResponse({ scenario }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
