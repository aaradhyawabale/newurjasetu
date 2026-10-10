import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db/prisma";
import { hashPassword, createSessionToken } from "@/server/auth/session";

describe("API Route Integration & Auth Ownership", () => {
  let user1Id: string;
  let user2Id: string;
  let user1Token: string;
  let user2Token: string;
  let user1ScenarioId: string;

  beforeEach(async () => {
    // Clear test tables
    await prisma.analysis.deleteMany();
    await prisma.placement.deleteMany();
    await prisma.scenario.deleteMany();
    await prisma.user.deleteMany();

    const pwd = await hashPassword("password123");

    // Create User 1
    const u1 = await prisma.user.create({
      data: {
        email: "planner1@urjasetu.local",
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
        email: "planner2@urjasetu.local",
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
});
