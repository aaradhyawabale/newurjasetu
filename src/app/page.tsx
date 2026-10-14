import React from "react";
import Link from "next/link";
import { getSessionUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { AppShell } from "@/components/layout/AppShell";
import {
  Compass,
  Layers,
  Database,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Hospital,
  Sun,
  Droplets,
  Route,
  Trees,
} from "lucide-react";

export default async function HomePage() {
  const session = await getSessionUser();

  if (session) {
    // Verify user still exists in the database
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (user) {
      // User is signed in and verified — load scenarios and render AppShell workspace
      let scenarios = await prisma.scenario.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      if (scenarios.length === 0) {
        // Ensure default scenario exists
        const newScenario = await prisma.scenario.create({
          data: {
            userId: user.id,
            name: "Untitled scenario",
          },
        });
        scenarios = [newScenario];
      }

      return (
        <AppShell
          user={{
            id: user.id,
            email: user.email,
            name: user.name,
          }}
          initialScenarios={scenarios}
          initialScenarioId={scenarios[0].id}
        />
      );
    }
  }

  // Not signed in or stale session — render minimal, professional public landing page
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-between text-stone-900 font-sans">
      {/* Navigation Header */}
      <header className="h-16 border-b border-stone-200 bg-white px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-emerald-700 flex items-center justify-center text-white font-bold text-base shadow-xs">
            U
          </div>
          <span className="text-lg font-bold tracking-tight text-stone-900">
            UrjaSetu
          </span>
          <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
            Phase 1
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-3 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-btn transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-btn transition-colors shadow-xs"
          >
            Create account
          </Link>
        </div>
      </header>

      {/* Main Hero & Overview */}
      <main className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-12">
        {/* Core Product Summary */}
        <section className="flex flex-col gap-4 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-stone-200/60 border border-stone-300 text-stone-700 font-mono text-xs w-fit mx-auto md:mx-0">
            <Compass className="w-3.5 h-3.5 text-emerald-700" />
            <span>Map-Based Urban Infrastructure Siting & Impact Analysis</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight leading-tight">
            Evidence-backed spatial decision support for civic planners.
          </h1>

          <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-3xl">
            UrjaSetu evaluates site suitability for 10 urban infrastructure types (Hospitals, Schools, Parks, Roads, Bridges, Water Canals, Buildings, Transit Stations, Drainage corridors, and Solar Farms). Place a footprint pin on the map to validate conflicts against mapped OpenStreetMap features, query real open geospatial data, and generate reproducible multi-criteria reports with full evidence lineage.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
            <Link
              href="/register"
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-btn transition-colors shadow-sm"
            >
              <span>Open Planner Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-btn transition-colors"
            >
              Sign in to Existing Session
            </Link>
          </div>
        </section>

        {/* 10 Infrastructure Tools Matrix */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-stone-500">
            Supported Infrastructure Disciplines
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {[
              { name: "Hospital", cat: "Civic", icon: Hospital },
              { name: "School", cat: "Civic", icon: ShieldCheck },
              { name: "Park", cat: "Green", icon: Trees },
              { name: "Road", cat: "Transport", icon: Route },
              { name: "Bridge", cat: "Transport", icon: Compass },
              { name: "Water Canal", cat: "Utilities", icon: Droplets },
              { name: "Building", cat: "Civic", icon: Layers },
              { name: "Transit Station", cat: "Transport", icon: Route },
              { name: "Drainage", cat: "Utilities", icon: Droplets },
              { name: "Solar Farm", cat: "Energy", icon: Sun },
            ].map((tool) => (
              <div
                key={tool.name}
                className="p-3 bg-white rounded-panel border border-stone-200 flex flex-col gap-1 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <tool.icon className="w-4 h-4 text-emerald-700" />
                  <span className="text-[9px] font-mono text-stone-400 uppercase">{tool.cat}</span>
                </div>
                <span className="text-xs font-bold text-stone-800 mt-1">{tool.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Data Sources and Data Integrity */}
        <section className="p-6 bg-white rounded-panel border border-stone-200 flex flex-col gap-4 shadow-2xs">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-bold text-stone-900">
              Open Geospatial Data Sources & Verifiable Evidence
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-stone-600">
            <div className="flex flex-col gap-1 p-3 rounded bg-stone-50 border border-stone-200">
              <span className="font-bold text-stone-800">OpenStreetMap via Overpass</span>
              <p className="text-[11px] leading-relaxed">
                Queries roads, building footprints, waterways, railways, and civic amenities. Cached in DB for 24h with coordinate rounding.
              </p>
            </div>

            <div className="flex flex-col gap-1 p-3 rounded bg-stone-50 border border-stone-200">
              <span className="font-bold text-stone-800">Open-Meteo & Copernicus DEM</span>
              <p className="text-[11px] leading-relaxed">
                Samples 3x3 elevation grid for terrain slope calculation and historical 24-hr precipitation metrics for drainage models.
              </p>
            </div>

            <div className="flex flex-col gap-1 p-3 rounded bg-stone-50 border border-stone-200">
              <span className="font-bold text-stone-800">NASA POWER Agroclimatology</span>
              <p className="text-[11px] leading-relaxed">
                Fetches annual Global Horizontal Irradiance (GHI in kWh/m²/day) derived from CERES & MERRA-2 satellite instruments.
              </p>
            </div>
          </div>

          {/* Statutory Disclaimer */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded text-[11px] text-amber-900 leading-normal flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>Methodological Notice:</strong> UrjaSetu is built for planning decision support. The application never approves projects, never claims to be an official statutory registry, and presents all scoring metrics with &quot;NEEDS VERIFICATION&quot; status for municipal validation.
            </span>
          </div>
        </section>
      </main>

      {/* Public Footer */}
      <footer className="border-t border-stone-200 bg-white px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 font-mono">
        <span>© OpenStreetMap contributors • MapLibre GL • UrjaSetu</span>
        <span className="mt-2 sm:mt-0">EPSG:4326 WGS84 Geodesic Calculations</span>
      </footer>
    </div>
  );
}
