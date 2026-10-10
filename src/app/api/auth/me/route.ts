import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return errorResponse("Not authenticated", "UNAUTHORIZED", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      return errorResponse("User not found", "USER_NOT_FOUND", 404);
    }

    return successResponse({ user });
  } catch (err) {
    return handleRouteError(err);
  }
}
