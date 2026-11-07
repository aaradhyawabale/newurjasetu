import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as copilotGET, POST as copilotPOST } from "@/app/api/copilot/route";
import { GET as healthGET } from "@/app/api/copilot/health/route";
import { POST as configurePOST } from "@/app/api/copilot/configure/route";
import { hashPassword, createSessionToken } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

describe("NuGen Copilot API Contract Tests", () => {
  let userToken: string;

  beforeEach(async () => {
    const pwd = await hashPassword("password123!");
    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const user = await prisma.user.create({
      data: {
        email: `contract-${unique}@urjasetu.local`,
        passwordHash: pwd,
        name: "Contract Tester",
      },
    });
    userToken = await createSessionToken({ userId: user.id, email: user.email, name: user.name });
  });

  describe("GET /api/copilot/health Contract", () => {
    it("returns conforming diagnostic payload with all expected keys", async () => {
      const req = new NextRequest("http://localhost:3000/api/copilot/health");
      const res = await healthGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("success", true);
      expect(json).toHaveProperty("data");

      const data = json.data;
      expect(data).toHaveProperty("status");
      expect(typeof data.status).toBe("string");
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("configuredModel");
      expect(data).toHaveProperty("dns");
      expect(data.dns).toHaveProperty("resolved");
      expect(data).toHaveProperty("https");
      expect(data.https).toHaveProperty("reachable");
      expect(data).toHaveProperty("auth");
      expect(data.auth).toHaveProperty("keyPresent");
      expect(data).toHaveProperty("model");
      expect(data).toHaveProperty("generation");
      expect(data).toHaveProperty("notes");
      expect(Array.isArray(data.notes)).toBe(true);
    });
  });

  describe("POST /api/copilot/configure Contract", () => {
    it("rejects missing or empty apiKey with 400 Bad Request", async () => {
      const req = new NextRequest("http://localhost:3000/api/copilot/configure", {
        method: "POST",
        headers: {
          cookie: `urjasetu_session=${userToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: "" }),
      });
      const res = await configurePOST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it("accepts valid apiKey and returns masked confirmation payload without leaking secret", async () => {
      const rawKey = "nugen-contract-test-secret-12345";
      const req = new NextRequest("http://localhost:3000/api/copilot/configure", {
        method: "POST",
        headers: {
          cookie: `urjasetu_session=${userToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: rawKey,
          model: "meta-llama/Llama-3.2-3B-Instruct",
        }),
      });
      const res = await configurePOST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.savedTo).toBe(".env.local");
      expect(json.data.configuredModel).toBe("meta-llama/Llama-3.2-3B-Instruct");
      expect(json.data.maskedKey).toContain("...");
      expect(json.data.maskedKey).not.toContain(rawKey);
    });
  });

  describe("POST /api/copilot Contract", () => {
    it("returns valid fallback structure when cloud is unconfigured but fallbackToLocal=true", async () => {
      const originalKey = process.env.NUGEN_API_KEY;
      delete process.env.NUGEN_API_KEY;

      try {
        const req = new NextRequest("http://localhost:3000/api/copilot", {
          method: "POST",
          headers: {
            cookie: `urjasetu_session=${userToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "What is the surface temperature in Kasba Peth?",
            fallbackToLocal: true,
          }),
        });

        const res = await copilotPOST(req);
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json).toHaveProperty("reply");
        expect(typeof json.reply).toBe("string");
        expect(json).toHaveProperty("engineSource", "local_gis_engine");
        expect(json).toHaveProperty("cloudUnavailable", true);
        expect(json).toHaveProperty("modelUsed");
        expect(json).toHaveProperty("assumptions");
        expect(Array.isArray(json.assumptions)).toBe(true);
        expect(json).toHaveProperty("missingEvidence");
        expect(Array.isArray(json.missingEvidence)).toBe(true);
      } finally {
        if (originalKey) {
          process.env.NUGEN_API_KEY = originalKey;
        }
      }
    });
  });
});
