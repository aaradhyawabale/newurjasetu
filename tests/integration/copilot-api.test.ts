import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db/prisma";
import { hashPassword, createSessionToken } from "@/server/auth/session";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/copilot/route";

describe("Copilot API Integration & Security", () => {
  let userId: string;
  let userToken: string;

  beforeEach(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: { email: { in: ["copilot-test@example.com"] } },
    });

    const user = await prisma.user.create({
      data: {
        email: "copilot-test@example.com",
        passwordHash: await hashPassword("testPassword123!"),
        name: "Copilot Test User",
      },
    });
    userId = user.id;
    userToken = await createSessionToken({ userId: user.id, email: user.email });
  });

  it("GET /api/copilot returns status and configured model info", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ready");
    expect(typeof json.model).toBe("string");
  });

  it("POST /api/copilot rejects unauthenticated request with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/copilot", {
      method: "POST",
      body: JSON.stringify({ message: "Is this location suitable?" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("POST /api/copilot rejects empty message with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/copilot", {
      method: "POST",
      headers: {
        cookie: `urjasetu_session=${userToken}`,
      },
      body: JSON.stringify({ message: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("BAD_REQUEST");
  });

  it("POST /api/copilot handles missing API key gracefully with 503", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const req = new NextRequest("http://localhost:3000/api/copilot", {
        method: "POST",
        headers: {
          cookie: `urjasetu_session=${userToken}`,
        },
        body: JSON.stringify({
          message: "Check road access for hospital",
          context: {
            studyArea: "Pune Central Study Area (PMC)",
            infrastructureType: "Hospital",
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.code).toBe("KEY_NOT_CONFIGURED");
    } finally {
      if (originalKey) {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });
});
