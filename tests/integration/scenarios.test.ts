import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db/prisma";
import { hashPassword, createSessionToken } from "@/server/auth/session";
import { GET as getScenarioCompare } from "@/app/api/scenarios/[id]/compare/route";
import { POST as postMultiCompare } from "@/app/api/scenarios/compare/route";
import { generateScenarioComparisonPdf } from "@/server/pdf/generate-scenario-comparison-pdf";
import { NextRequest } from "next/server";

describe("Scenario Comparison & Simulator Integration Tests", () => {
  let user1Id: string;
  let user2Id: string;
  let user1Token: string;
  let user2Token: string;
  let user1ScenarioId: string;
  let user2ScenarioId: string;
  let user1Placement1Id: string;
  let user1Placement2Id: string;

  beforeEach(async () => {
    const pwd = await hashPassword("password123");
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // User 1
    const u1 = await prisma.user.create({
      data: {
        email: `planner1-${uniqueSuffix}@urjasetu.local`,
        passwordHash: pwd,
        name: "Planner One",
        scenarios: {
          create: { name: "Delhi Infrastructure Masterplan" },
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
        email: `planner2-${uniqueSuffix}@urjasetu.local`,
        passwordHash: pwd,
        name: "Planner Two",
        scenarios: {
          create: { name: "Private Scenario" },
        },
      },
      include: { scenarios: true },
    });
    user2Id = u2.id;
    user2ScenarioId = u2.scenarios[0].id;
    user2Token = await createSessionToken({ userId: u2.id, email: u2.email, name: u2.name });

    // User 1 Candidate 1 (Hospital at Connaught Place)
    const p1 = await prisma.placement.create({
      data: {
        userId: user1Id,
        scenarioId: user1ScenarioId,
        type: "Hospital",
        lat: 28.6315,
        lng: 77.2167,
        lengthM: 80,
        widthM: 60,
        label: "Connaught Place Hospital",
      },
    });
    user1Placement1Id = p1.id;

    await prisma.analysis.create({
      data: {
        userId: user1Id,
        placementId: p1.id,
        overallScore: 84,
        scoreBand: "High Suitability",
        input: JSON.stringify({ lat: 28.6315, lng: 77.2167 }),
        result: JSON.stringify({
          engineVersion: "1.0.0",
          timestamp: new Date().toISOString(),
          placementSnapshot: {
            id: p1.id,
            type: "Hospital",
            lat: 28.6315,
            lng: 77.2167,
            lengthM: 80,
            widthM: 60,
            bearingDeg: 0,
            areaM2: 4800,
            params: {},
          },
          validation: { status: "pass", proposedAreaM2: 4800, allowedAreaRange: { minM2: 0, maxM2: 10000, reason: "" }, conflicts: [], messages: [] },
          criteria: [
            {
              id: "c_road_dist",
              label: "Arterial Road Proximity",
              value: "35 m",
              rawMetric: 35,
              unit: "m",
              score: 92,
              weight: 25,
              status: "optimal",
              benchmark: "Within 100m",
              evidenceIds: [],
              description: "Optimal road access",
            },
          ],
          overall: { score: 84, band: "High Suitability", tone: "positive", confidence: 0.85, verdictSummary: "High suitability" },
          supporting: [],
          risks: [],
          dataGaps: [],
          evidence: [],
          limitations: [],
          narrativeText: "",
        }),
      },
    });

    // User 1 Candidate 2 (Hospital at Karol Bagh)
    const p2 = await prisma.placement.create({
      data: {
        userId: user1Id,
        scenarioId: user1ScenarioId,
        type: "Hospital",
        lat: 28.6500,
        lng: 77.1900,
        lengthM: 80,
        widthM: 60,
        label: "Karol Bagh Hospital",
      },
    });
    user1Placement2Id = p2.id;

    await prisma.analysis.create({
      data: {
        userId: user1Id,
        placementId: p2.id,
        overallScore: 65,
        scoreBand: "Moderate Suitability",
        input: JSON.stringify({ lat: 28.6500, lng: 77.1900 }),
        result: JSON.stringify({
          engineVersion: "1.0.0",
          timestamp: new Date().toISOString(),
          placementSnapshot: {
            id: p2.id,
            type: "Hospital",
            lat: 28.6500,
            lng: 77.1900,
            lengthM: 80,
            widthM: 60,
            bearingDeg: 0,
            areaM2: 4800,
            params: {},
          },
          validation: { status: "pass", proposedAreaM2: 4800, allowedAreaRange: { minM2: 0, maxM2: 10000, reason: "" }, conflicts: [], messages: [] },
          criteria: [
            {
              id: "c_road_dist",
              label: "Arterial Road Proximity",
              value: "180 m",
              rawMetric: 180,
              unit: "m",
              score: 70,
              weight: 25,
              status: "acceptable",
              benchmark: "Within 100m",
              evidenceIds: [],
              description: "Acceptable road access",
            },
          ],
          overall: { score: 65, band: "Moderate Suitability", tone: "moderate", confidence: 0.8, verdictSummary: "Moderate suitability" },
          supporting: [],
          risks: [],
          dataGaps: [],
          evidence: [],
          limitations: [],
          narrativeText: "",
        }),
      },
    });
  });

  it("evaluates and returns structured scenario comparison for scenario candidates", async () => {
    const req = new NextRequest(`http://localhost:3000/api/scenarios/${user1ScenarioId}/compare`, {
      headers: {
        cookie: `urjasetu_session=${user1Token}`,
      },
    });

    const res = await getScenarioCompare(req, { params: { id: user1ScenarioId } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.comparison).toBeDefined();
    expect(body.comparison.candidates).toHaveLength(2);
    expect(body.comparison.ranking[0].placementId).toBe(user1Placement1Id);
    expect(body.comparison.ranking[0].rank).toBe(1);
    expect(body.comparison.ranking[1].placementId).toBe(user1Placement2Id);
    expect(body.comparison.ranking[1].rank).toBe(2);
    expect(body.comparison.criteriaMatrix).toHaveLength(1);
    expect(body.comparison.criteriaMatrix[0].deltaScore).toBe(22); // 92 - 70 = 22 pts delta
  });

  it("enforces strict user isolation: User 2 cannot compare User 1 scenario", async () => {
    const req = new NextRequest(`http://localhost:3000/api/scenarios/${user1ScenarioId}/compare`, {
      headers: {
        cookie: `urjasetu_session=${user2Token}`,
      },
    });

    const res = await getScenarioCompare(req, { params: { id: user1ScenarioId } });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  it("supports arbitrary placement candidate comparison via POST /api/scenarios/compare", async () => {
    const req = new NextRequest("http://localhost:3000/api/scenarios/compare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `urjasetu_session=${user1Token}`,
      },
      body: JSON.stringify({
        placementIds: [user1Placement1Id, user1Placement2Id],
      }),
    });

    const res = await postMultiCompare(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.comparison).toBeDefined();
    expect(body.comparison.candidates).toHaveLength(2);
    expect(body.comparison.comparability.isCompatible).toBe(true);
  });

  it("generates a valid binary PDF document for scenario comparisons", async () => {
    const req = new NextRequest(`http://localhost:3000/api/scenarios/${user1ScenarioId}/compare`, {
      headers: {
        cookie: `urjasetu_session=${user1Token}`,
      },
    });
    const res = await getScenarioCompare(req, { params: { id: user1ScenarioId } });
    const { comparison } = await res.json();

    const pdfBytes = await generateScenarioComparisonPdf(comparison);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    // Verify PDF header magic bytes %PDF-
    const header = Buffer.from(pdfBytes.subarray(0, 5)).toString("utf-8");
    expect(header).toBe("%PDF-");
  });
});
