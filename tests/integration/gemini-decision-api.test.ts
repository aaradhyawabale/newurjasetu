import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db/prisma";
import { hashPassword, createSessionToken } from "@/server/auth/session";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/analyses/[id]/decision/route";
import { AiPlanningInsights } from "@/server/ai/types";

describe("Gemini Decision API Integration & Security", () => {
  let user1Id: string;
  let user2Id: string;
  let user1Token: string;
  let user2Token: string;
  let user1ScenarioId: string;
  let user1AnalysisId: string;
  let user1PlacementId: string;

  const sampleCachedInsights: AiPlanningInsights = {
    executiveSummary: "Pre-computed strategic briefing for Shivajinagar terminal.",
    preliminaryAssessment: "FAVORABLE",
    assessmentRationale: "Optimal arterial access and high catchment density.",
    advantages: [
      {
        title: "Arterial Access",
        description: "Direct access to primary road.",
        category: "Accessibility",
        provenance: "VERIFIED_INPUT",
        sourceReference: "criteria:road_distance",
      },
    ],
    constraints: [],
    unresolvedDataGaps: [],
    recommendedMitigations: [
      {
        issue: "Peak hour traffic load",
        mitigation: "Staggered commercial entry lanes",
        supportingEvidence: "Traffic corridor analysis",
        provenance: "AI_INTERPRETATION",
        sourceReference: "evd_roads",
      },
    ],
    costDrivers: {
      civil: "Standard civil grading.",
      electrical: "Substation within 500m.",
      environmental: "Zero tree clearance required.",
      operational: "Direct municipal route.",
    },
    statutoryChecklist: [
      {
        authority: "PMC",
        clearanceName: "Building Plan Approval",
        triggerCondition: "Standard commercial development",
        isMandatory: true,
      },
    ],
    planningAlternatives: [],
    confidenceIndicator: {
      level: "HIGH",
      completenessPercent: 95,
      disclaimer: "Full dataset verification.",
    },
    assumptionsAndLimitations: ["Indicative decision support only."],
    meta: {
      modelUsed: "gemini-2.5-flash",
      generatedAt: "2026-10-19T11:00:00.000Z",
      disclaimer: "Indicative decision support only.",
    },
  };

  beforeEach(async () => {
    // Clear test-generated accounts
    const testUsers = await prisma.user.findMany({
      where: { email: { contains: "decision-test.local" } },
      select: { id: true },
    });
    const testUserIds = testUsers.map((u) => u.id);
    if (testUserIds.length > 0) {
      await prisma.analysis.deleteMany({ where: { userId: { in: testUserIds } } });
      await prisma.placement.deleteMany({ where: { userId: { in: testUserIds } } });
      await prisma.scenario.deleteMany({ where: { userId: { in: testUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    }

    const pwd = await hashPassword("securePassword123!");
    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // User 1
    const u1 = await prisma.user.create({
      data: {
        email: `u1-${unique}@decision-test.local`,
        passwordHash: pwd,
        name: "Planner One",
        scenarios: {
          create: { name: "Scenario 1" },
        },
      },
      include: { scenarios: true },
    });
    user1Id = u1.id;
    user1ScenarioId = u1.scenarios[0].id;
    user1Token = await createSessionToken({ userId: u1.id, email: u1.email, name: u1.name });

    // User 2
    const u2 = await prisma.user.create({
      data: {
        email: `u2-${unique}@decision-test.local`,
        passwordHash: pwd,
        name: "Planner Two",
        scenarios: {
          create: { name: "Scenario 2" },
        },
      },
      include: { scenarios: true },
    });
    user2Id = u2.id;
    user2Token = await createSessionToken({ userId: u2.id, email: u2.email, name: u2.name });

    // Placement for User 1
    const p1 = await prisma.placement.create({
      data: {
        userId: user1Id,
        scenarioId: user1ScenarioId,
        type: "EV Charging Station",
        lat: 18.5204,
        lng: 73.8567,
        lengthM: 35,
        widthM: 15,
        label: "Shivajinagar Test Station",
      },
    });
    user1PlacementId = p1.id;

    // Analysis for User 1 with cached insights
    const a1 = await prisma.analysis.create({
      data: {
        userId: user1Id,
        placementId: p1.id,
        overallScore: 92,
        scoreBand: "High Suitability",
        input: JSON.stringify({ type: "EV Charging Station", lat: 18.5204, lng: 73.8567 }),
        result: JSON.stringify({
          engineVersion: "1.0.0",
          timestamp: new Date().toISOString(),
          placementSnapshot: {
            id: p1.id,
            type: "EV Charging Station",
            lat: 18.5204,
            lng: 73.8567,
            lengthM: 35,
            widthM: 15,
            bearingDeg: 0,
            areaM2: 525,
            params: {},
          },
          validation: { isValid: true, conflicts: [], hardConstraintViolations: 0, softConstraintViolations: 0 },
          criteria: [],
          overall: { score: 92, band: "High Suitability", confidence: 95 },
          supporting: [],
          risks: [],
          dataGaps: [],
          evidence: [],
          limitations: [],
          narrativeText: "Initial narrative",
          aiInsights: sampleCachedInsights,
        }),
      },
    });
    user1AnalysisId = a1.id;
  });

  it("rejects unauthorized access with 401 when auth session is missing", async () => {
    const req = new NextRequest(`http://localhost:3000/api/analyses/${user1AnalysisId}/decision`);
    const res = await GET(req, { params: { id: user1AnalysisId } });
    expect(res.status).toBe(401);
  });

  it("enforces strict multi-tenant isolation: User 2 cannot access User 1 analysis decision", async () => {
    const req = new NextRequest(`http://localhost:3000/api/analyses/${user1AnalysisId}/decision`, {
      headers: { cookie: `urjasetu_session=${user2Token}` },
    });
    const res = await GET(req, { params: { id: user1AnalysisId } });
    expect(res.status).toBe(404);
  });

  it("retrieves cached AI planning insights for authorized owner", async () => {
    const req = new NextRequest(`http://localhost:3000/api/analyses/${user1AnalysisId}/decision`, {
      headers: { cookie: `urjasetu_session=${user1Token}` },
    });
    const res = await GET(req, { params: { id: user1AnalysisId } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.hasInsights).toBe(true);
    expect(body.aiInsights.preliminaryAssessment).toBe("FAVORABLE");
    expect(body.aiInsights.executiveSummary).toContain("Shivajinagar terminal");
  });

  it("serves cached insights on POST if already present without calling external API", async () => {
    const req = new NextRequest(`http://localhost:3000/api/analyses/${user1AnalysisId}/decision`, {
      method: "POST",
      headers: { cookie: `urjasetu_session=${user1Token}` },
    });
    const res = await POST(req, { params: { id: user1AnalysisId } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(body.aiInsights.preliminaryAssessment).toBe("FAVORABLE");
  });

  it("resolves analysis decision whether queried by analysisId or placementId", async () => {
    const req = new NextRequest(`http://localhost:3000/api/analyses/${user1PlacementId}/decision`, {
      headers: { cookie: `urjasetu_session=${user1Token}` },
    });
    const res = await GET(req, { params: { id: user1PlacementId } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.hasInsights).toBe(true);
    expect(body.aiInsights.preliminaryAssessment).toBe("FAVORABLE");
  });
});
