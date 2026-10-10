import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: parsed.email.toLowerCase() },
    });

    if (!user) {
      return errorResponse("Invalid email or password", "INVALID_CREDENTIALS", 401);
    }

    const isValid = await verifyPassword(parsed.password, user.passwordHash);
    if (!isValid) {
      return errorResponse("Invalid email or password", "INVALID_CREDENTIALS", 401);
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });

    setSessionCookie(response, token);
    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}
