import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/server/db/prisma";
import { hashPassword, createSessionToken } from "@/server/auth/session";

describe("API Route Integration & Auth Ownership", () => {
  let user1Id: string;
  let user2Id: string;
  let user1Token: string;
  let user2Token: string;
  let user1ScenarioId: string;

  beforeEach(async () => {
    // Clear only test-generated entities (preserve demo@urjasetu.gov.in and seeded plans)
    const testUsers = await prisma.user.findMany({
      where: { email: { contains: "urjasetu.local" } },
      select: { id: true },
    });
    const testUserIds = testUsers.map((u) => u.id);
    if (testUserIds.length > 0) {
      await prisma.analysis.deleteMany({ where: { userId: { in: testUserIds } } });
      await prisma.placement.deleteMany({ where: { userId: { in: testUserIds } } });
      await prisma.scenario.deleteMany({ where: { userId: { in: testUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    }

    const pwd = await hashPassword("password123");
    const uniqueSuffix = `api-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Create User 1
    const u1 = await prisma.user.create({
      data: {
        email: `planner1-${uniqueSuffix}@urjasetu.local`,
        passwordHash: pwd,
        name: "Planner One",
        scenarios: {
          create: { name: "Untitled scenario" },
        },
      },
      include: { scenarios: true },
    });
    user1Id = u1.id;
    user1ScenarioId = u1.scenarios[0].id;
    user1Token = await createSessionToken({ userId: u1.id, email: u1.email, name: u1.name });

    // Create User 2
    const u2 = await prisma.user.create({
      data: {
        email: `planner2-${uniqueSuffix}@urjasetu.local`,
        passwordHash: pwd,
        name: "Planner Two",
        scenarios: {
          create: { name: "Second User Scenario" },
        },
      },
      include: { scenarios: true },
    });
    user2Id = u2.id;
    user2Token = await createSessionToken({ userId: u2.id, email: u2.email, name: u2.name });
  });

  it("enforces strict user isolation across placements and scenarios", async () => {
    // User 1 creates a placement
    const p1 = await prisma.placement.create({
      data: {
        userId: user1Id,
        scenarioId: user1ScenarioId,
        type: "Hospital",
        lat: 28.6139,
        lng: 77.2090,
        lengthM: 120,
        widthM: 80,
        label: "City Hospital",
      },
    });

    // Query placements for User 1
    const u1Placements = await prisma.placement.findMany({
      where: { userId: user1Id },
    });
    expect(u1Placements.length).toBe(1);
    expect(u1Placements[0].id).toBe(p1.id);

    // Query placements for User 2 -> must be 0
    const u2Placements = await prisma.placement.findMany({
      where: { userId: user2Id },
    });
    expect(u2Placements.length).toBe(0);

    // Attempt by User 2 to access User 1's placement
    const crossAccess = await prisma.placement.findFirst({
      where: { id: p1.id, userId: user2Id },
    });
    expect(crossAccess).toBeNull();
  });

  it("cascades analysis deletion when placement is deleted", async () => {
    const p = await prisma.placement.create({
      data: {
        userId: user1Id,
        scenarioId: user1ScenarioId,
        type: "School",
        lat: 12.9716,
        lng: 77.5946,
        lengthM: 100,
        widthM: 60,
      },
    });

    const a = await prisma.analysis.create({
      data: {
        userId: user1Id,
        placementId: p.id,
        engineVersion: "1.0.0",
        overallScore: 82,
        scoreBand: "High Suitability",
        input: JSON.stringify({}),
        result: JSON.stringify({ overall: { score: 82 } }),
      },
    });

    // Verify analysis exists
    const foundAnalysis = await prisma.analysis.findUnique({ where: { id: a.id } });
    expect(foundAnalysis).not.toBeNull();

    // Delete placement
    await prisma.placement.delete({ where: { id: p.id } });

    // Verify cascade deletion of analysis
    const deletedAnalysis = await prisma.analysis.findUnique({ where: { id: a.id } });
    expect(deletedAnalysis).toBeNull();
  });

  it("persists placement type updates, custom parameters, and full analysis report snapshots", async () => {
    const p = await prisma.placement.create({
      data: {
        userId: user1Id,
        scenarioId: user1ScenarioId,
        type: "Hospital",
        lat: 18.5204,
        lng: 73.8567,
        lengthM: 120,
        widthM: 80,
        params: JSON.stringify({ bedCapacity: 250 }),
      },
    });

    // Switch type to Solar Farm and replace parameters
    const updated = await prisma.placement.update({
      where: { id: p.id },
      data: {
        type: "Solar Farm",
        lengthM: 250,
        widthM: 200,
        params: JSON.stringify({ targetCapacityMw: 5, panelTiltDeg: 19 }),
      },
    });

    expect(updated.type).toBe("Solar Farm");
    expect(JSON.parse(updated.params)).toEqual({ targetCapacityMw: 5, panelTiltDeg: 19 });

    // Persist an analysis record with analysisId matching id
    const analysisId = crypto.randomUUID();
    const savedAnalysis = await prisma.analysis.create({
      data: {
        id: analysisId,
        userId: user1Id,
        placementId: updated.id,
        engineVersion: "1.0.0",
        overallScore: 88,
        scoreBand: "High Suitability",
        input: JSON.stringify({ placementId: updated.id, type: "Solar Farm" }),
        result: JSON.stringify({
          analysisId,
          overall: { score: 88, band: "High Suitability", confidence: 100 },
          recommendations: ["Proceed to preliminary municipal zoning verification."],
        }),
      },
    });

    const retrieved = await prisma.analysis.findFirst({
      where: {
        userId: user1Id,
        OR: [{ id: updated.id }, { placementId: updated.id }],
      },
      orderBy: { createdAt: "desc" },
    });

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(analysisId);
    expect(JSON.parse(retrieved!.result).analysisId).toBe(analysisId);
  });

  it("resolves report and generates PDF whether accessed by analysisId or placementId", async () => {
    const { GET: getAnalysis } = await import("@/app/api/analyses/[id]/route");
    const { GET: getAnalysisPdf } = await import("@/app/api/analyses/[id]/pdf/route");
    const { NextRequest } = await import("next/server");

    const placement = await prisma.placement.create({
      data: {
        userId: user1Id,
        scenarioId: user1ScenarioId,
        type: "Hospital",
        lat: 28.6139,
        lng: 77.2090,
        lengthM: 100,
        widthM: 80,
      },
    });

    const analysis = await prisma.analysis.create({
      data: {
        userId: user1Id,
        placementId: placement.id,
        overallScore: 85,
        scoreBand: "High Suitability",
        input: JSON.stringify({ lat: 28.6139, lng: 77.2090 }),
        result: JSON.stringify({
          engineVersion: "1.0.0",
          timestamp: new Date().toISOString(),
          placementSnapshot: {
            id: placement.id,
            type: "Hospital",
            lat: 28.6139,
            lng: 77.2090,
            lengthM: 100,
            widthM: 80,
            bearingDeg: 0,
            areaM2: 8000,
            params: {},
          },
          validation: { status: "pass", proposedAreaM2: 8000, allowedAreaRange: { minM2: 0, maxM2: 10000, reason: "" }, conflicts: [], messages: [] },
          criteria: [],
          overall: { score: 85, band: "High Suitability", tone: "positive", confidence: 0.9, verdictSummary: "Good" },
          supporting: [],
          risks: [],
          dataGaps: [],
          evidence: [],
          limitations: [],
          narrativeText: "",
        }),
      },
    });

    // 1. Fetch by analysisId
    const reqByAnalysisId = new NextRequest(`http://localhost:3000/api/analyses/${analysis.id}`, {
      headers: { cookie: `urjasetu_session=${user1Token}` },
    });
    const res1 = await getAnalysis(reqByAnalysisId, { params: { id: analysis.id } });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.analysis.id).toBe(analysis.id);

    // 2. Fetch by placementId
    const reqByPlacementId = new NextRequest(`http://localhost:3000/api/analyses/${placement.id}`, {
      headers: { cookie: `urjasetu_session=${user1Token}` },
    });
    const res2 = await getAnalysis(reqByPlacementId, { params: { id: placement.id } });
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.analysis.id).toBe(analysis.id);

    // 3. Fetch PDF by placementId
    const reqPdfByPlacementId = new NextRequest(`http://localhost:3000/api/analyses/${placement.id}/pdf`, {
      headers: { cookie: `urjasetu_session=${user1Token}` },
    });
    const resPdf = await getAnalysisPdf(reqPdfByPlacementId, { params: { id: placement.id } });
    expect(resPdf.status).toBe(200);
    expect(resPdf.headers.get("Content-Type")).toBe("application/pdf");
  });

  afterAll(async () => {
    const testUsers = await prisma.user.findMany({
      where: { email: { contains: "urjasetu.local" } },
      select: { id: true },
    });
    const testUserIds = testUsers.map((u) => u.id);
    if (testUserIds.length > 0) {
      await prisma.analysis.deleteMany({ where: { userId: { in: testUserIds } } });
      await prisma.placement.deleteMany({ where: { userId: { in: testUserIds } } });
      await prisma.scenario.deleteMany({ where: { userId: { in: testUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    }
  });
});

