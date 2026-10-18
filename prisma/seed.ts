import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { runAnalysisEngine } from "../src/server/analysis-engine/engine";
import { generateCacheKey } from "../src/server/providers/cache";
import {
  CityId,
  loadSnapshot,
  getSnapshotOverpass,
  getSnapshotElevation,
  getSnapshotSolar,
} from "../src/server/providers/snapshot-loader";

const prisma = new PrismaClient();

async function seedCityScenario(
  user: { id: string; email: string },
  city: CityId,
  scenarioName: string
) {
  console.log(`\n📌 Seeding Scenario for ${city.toUpperCase()}: "${scenarioName}"...`);

  // Check if scenario already exists for this user to avoid duplicates
  let scenario = await prisma.scenario.findFirst({
    where: { userId: user.id, name: scenarioName },
  });

  if (!scenario) {
    scenario = await prisma.scenario.create({
      data: {
        userId: user.id,
        name: scenarioName,
      },
    });
    console.log(`  ✓ Created Scenario: "${scenario.name}" (${scenario.id})`);
  } else {
    console.log(`  ✓ Scenario already exists: "${scenario.name}" (${scenario.id})`);
  }

  const snapshot = loadSnapshot(city);
  console.log(
    `  ✓ Loaded ${city.toUpperCase()} Snapshot: ${snapshot.candidateSites.length} candidates, ${snapshot.existingEvStations.length} existing EV stations.`
  );

  for (const cand of snapshot.candidateSites) {
    // Check if placement already exists
    const existing = await prisma.placement.findFirst({
      where: { scenarioId: scenario.id, label: cand.name },
    });
    if (existing) {
      console.log(`  ✓ Candidate placement already exists: "${cand.name}"`);
      continue;
    }

    const lengthM = cand.recommendedBays * 3.5;
    const widthM = 15;

    const placement = await prisma.placement.create({
      data: {
        userId: user.id,
        scenarioId: scenario.id,
        type: "EV Charging Station",
        lat: cand.lat,
        lng: cand.lng,
        lengthM,
        widthM,
        bearingDeg: 0,
        label: cand.name,
        params: JSON.stringify({
          bayCount: cand.recommendedBays,
          chargerPowerKw: String(cand.recommendedPowerKw),
          gridDedicatedTransformer: true,
        }),
      },
    });

    // Seed ProviderCache entries for Overpass, Open-Meteo, and NASA POWER
    const overpassData = getSnapshotOverpass(cand.lat, cand.lng, 2000);
    if (overpassData) {
      const keyR1 = generateCacheKey("overpass", { lat: cand.lat, lng: cand.lng, radiusM: 500 });
      const keyR2 = generateCacheKey("overpass", { lat: cand.lat, lng: cand.lng, radiusM: 2000 });
      const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);

      await prisma.providerCache.upsert({
        where: { key: keyR1 },
        update: { response: JSON.stringify(overpassData), expiresAt },
        create: { key: keyR1, response: JSON.stringify(overpassData), expiresAt },
      });
      await prisma.providerCache.upsert({
        where: { key: keyR2 },
        update: { response: JSON.stringify(overpassData), expiresAt },
        create: { key: keyR2, response: JSON.stringify(overpassData), expiresAt },
      });
    }

    const elevData = getSnapshotElevation(cand.lat, cand.lng);
    if (elevData) {
      const elevKey = generateCacheKey("open_meteo_elevation", { lat: cand.lat, lng: cand.lng });
      const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);
      await prisma.providerCache.upsert({
        where: { key: elevKey },
        update: { response: JSON.stringify(elevData), expiresAt },
        create: { key: elevKey, response: JSON.stringify(elevData), expiresAt },
      });
    }

    const solarData = getSnapshotSolar(cand.lat, cand.lng);
    if (solarData) {
      const solarKey = generateCacheKey("nasa_power_solar", { lat: cand.lat, lng: cand.lng });
      const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);
      await prisma.providerCache.upsert({
        where: { key: solarKey },
        update: { response: JSON.stringify(solarData), expiresAt },
        create: { key: solarKey, response: JSON.stringify(solarData), expiresAt },
      });
    }

    // Run Analysis Engine for this candidate
    const analysisReport = await runAnalysisEngine({
      placementId: placement.id,
      type: "EV Charging Station",
      lat: cand.lat,
      lng: cand.lng,
      lengthM,
      widthM,
      bearingDeg: 0,
      customParams: {
        bayCount: cand.recommendedBays,
        chargerPowerKw: String(cand.recommendedPowerKw),
        gridDedicatedTransformer: true,
      },
      label: cand.name,
    });

    const savedAnalysis = await prisma.analysis.create({
      data: {
        placementId: placement.id,
        userId: user.id,
        engineVersion: "1.0.0",
        overallScore: analysisReport.overall.score,
        scoreBand: analysisReport.overall.band,
        input: JSON.stringify(analysisReport.placementSnapshot),
        result: JSON.stringify(analysisReport),
      },
    });

    console.log(
      `  ✓ Candidate analyzed: "${cand.name}" -> Score: ${analysisReport.overall.score}/100 (${analysisReport.overall.band}) [Analysis: ${savedAnalysis.id}]`
    );
  }
}

async function main() {
  console.log("🌱 Seeding UrjaSetu database with Multi-City Master Plans (Pune, PCMC, Nashik)...");

  // 1. Create or retrieve demo user
  const demoEmail = "demo@urjasetu.gov.in";
  const passwordHash = await bcrypt.hash("UrjaSetuDemo2026!", 12);

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { passwordHash, name: "Urban Infrastructure Planner (Maharashtra)" },
    create: {
      email: demoEmail,
      passwordHash,
      name: "Urban Infrastructure Planner (Maharashtra)",
    },
  });
  console.log(`✓ Demo user ready: ${user.email} (${user.id})`);

  // 2. Seed scenarios for all 3 target regions
  await seedCityScenario(user, "pune", "Pune EV Infrastructure Master Plan 2026");
  await seedCityScenario(user, "pcmc", "PCMC Industrial & Transit Corridor Plan 2026");
  await seedCityScenario(user, "nashik", "Nashik Clean Energy & EV Master Plan 2026");

  console.log("\n🎉 Database seeded successfully with Multi-City Master Plans!");
  console.log(`Demo Credentials:`);
  console.log(`  Email:    ${demoEmail}`);
  console.log(`  Password: UrjaSetuDemo2026!`);
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
