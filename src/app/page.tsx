import React from "react";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";
import { 
  getPriorityCellsSync, 
  isGreenLossDataAvailable, 
  getGreenLossDataSync 
} from "@/server/priority/loader";
import { optimizeInterventionBudget } from "@/server/priority/optimizer";
import { MainWorkspace } from "@/components/layout/MainWorkspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Load authentic 250m priority cells from the server cache / disk
  const initialCells = getPriorityCellsSync();

  // Load Green Loss Watch dataset if available
  const initialGreenLoss = isGreenLossDataAvailable() ? getGreenLossDataSync() : null;

  // Precompute initial baseline optimization on server for instant hydration
  const initialOptimization = optimizeInterventionBudget({
    budget_ha: 15.0,
    objective: "cooling",
    target_ndvi: 0.65,
  });

  // Retrieve existing user session if logged in
  const session = await getSessionUser();
  let user: { id: string; email: string; name?: string | null } | null = null;
  let scenarios: Array<{ id: string; name: string }> = [];

  if (session) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (dbUser) {
      user = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
      };

      scenarios = await prisma.scenario.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  // Provide fallback guest profile for instant public exploration
  if (!user) {
    user = {
      id: "public-planner",
      email: "planner@pune.gov.in",
      name: "PMC Civic Planning Analyst",
    };
  }

  // Ensure default scenario exists for manual siting workspace fallback
  if (scenarios.length === 0) {
    scenarios = [
      {
        id: "pune-heat-master-2026",
        name: "Pune Heat & Infrastructure Master Plan 2026",
      },
    ];
  }

  return (
    <MainWorkspace
      initialCells={initialCells}
      initialOptimization={initialOptimization}
      initialGreenLoss={initialGreenLoss}
      user={user}
      initialScenarios={scenarios}
    />
  );
}
