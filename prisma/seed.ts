import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { runAnalysisEngine } from "../src/server/analysis-engine/engine";
import { generateCacheKey } from "../src/server/providers/cache";
import {
  loadPuneSnapshot,
  getPuneSnapshotOverpass,
  getPuneSnapshotElevation,
  getPuneSnapshotSolar,
} from "../src/server/providers/snapshot-loader";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding UrjaSetu database with Pune EV Master Plan...");

  // 1. Create or retrieve demo user
  const demoEmail = "demo@urjasetu.gov.in";
  const passwordHash = await bcrypt.hash("UrjaSetuDemo2026!", 12);

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { passwordHash, name: "Urban Infrastructure Planner (PMC)" },
    create: {
      email: demoEmail,
      passwordHash,
      name: "Urban Infrastructure Planner (PMC)",
    },
  });
  console.log(`✓ Demo user ready: ${user.email} (${user.id})`);

  // 2. Create Pune EV Master Plan Scenario
  const scenario = await prisma.scenario.create({
    data: {
      userId: user.id,
      name: "Pune EV Infrastructure Master Plan 2026",
    },
  });
  console.log(`✓ Created Scenario: "${scenario.name}" (${scenario.id})`);

  // 3. Load verified Pune snapshot
  const snapshot = loadPuneSnapshot();
  console.log(
    `✓ Loaded Pune Snapshot: ${snapshot.candidateSites.length} candidates, ${snapshot.existingEvStations.length} existing EV stations.`
  );

  // 4. Create Placements, seed ProviderCache, and execute Analysis
  for (const cand of snapshot.candidateSites) {
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
    const overpassData = getPuneSnapshotOverpass(cand.lat, cand.lng, 2000);
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

    const elevData = getPuneSnapshotElevation(cand.lat, cand.lng);
    if (elevData) {
      const elevKey = generateCacheKey("open_meteo_elevation", { lat: cand.lat, lng: cand.lng });
      const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);
      await prisma.providerCache.upsert({
        where: { key: elevKey },
        update: { response: JSON.stringify(elevData), expiresAt },
        create: { key: elevKey, response: JSON.stringify(elevData), expiresAt },
      });
    }

    const solarData = getPuneSnapshotSolar(cand.lat, cand.lng);
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
      `✓ Candidate analyzed: "${cand.name}" -> Score: ${analysisReport.overall.score}/100 (${analysisReport.overall.band}) [Analysis: ${savedAnalysis.id}]`
    );
  }

  console.log("\n🎉 Database seeded successfully with Pune EV Master Plan scenario!");
  console.log(`Demo Credentials:`);
  console.log(`  Email:    ${demoEmail}`);
  console.log(`  Password: UrjaSetuDemo2026!`);
}

main()
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
