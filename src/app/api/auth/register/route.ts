import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { hashPassword, createSessionToken, setSessionCookie } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({
      where: { email: parsed.email.toLowerCase() },
    });

    if (existing) {
      return errorResponse("User with this email already exists", "EMAIL_EXISTS", 400);
    }

    const passwordHash = await hashPassword(parsed.password);

    const user = await prisma.user.create({
      data: {
        email: parsed.email.toLowerCase(),
        passwordHash,
        name: parsed.name?.trim() || parsed.email.split("@")[0],
        scenarios: {
          create: {
            name: "Untitled scenario",
          },
        },
      },
      include: {
        scenarios: true,
      },
    });

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
      defaultScenarioId: user.scenarios[0]?.id,
    });

    setSessionCookie(response, token);
    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}
