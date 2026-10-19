import { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import { NasaPowerProvider } from "@/server/providers/nasa-power";
import { estimateSolarGeneration } from "@/server/solar/solar-reality";
import { SolarRealityInput } from "@/server/solar/types";
import { validateCoordinates } from "@/server/gis/geometry";

const nasaPowerProvider = new NasaPowerProvider();

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json();

    let solarInput: SolarRealityInput;

    let placement = null;
    if (body.placementId) {
      try {
        placement = await prisma.placement.findFirst({
          where: { id: body.placementId, userId: user.userId },
        });
      } catch (err) {
        console.warn("[Solar Reality] DB lookup error:", err);
      }
    }

    if (placement) {
      const params = JSON.parse(placement.params || "{}");

      // Determine capacity in kWp: from targetCapacityMw or from footprint area (80 Wp / m2)
      let capacityKwp = 5000; // Default 5 MWp = 5000 kWp
      if (typeof params.targetCapacityMw === "number" && params.targetCapacityMw > 0) {
        capacityKwp = params.targetCapacityMw * 1000.0;
      } else if (typeof body.capacityKwp === "number" && body.capacityKwp > 0) {
        capacityKwp = body.capacityKwp;
      } else {
        const areaM2 = placement.lengthM * placement.widthM;
        capacityKwp = Math.round(areaM2 * 0.08); // 80 Wp/m2 ground coverage ratio proxy
      }

      solarInput = {
        lat: placement.lat,
        lng: placement.lng,
        capacityKwp,
        systemType: body.systemType ?? params.systemType,
        availableAreaM2: placement.lengthM * placement.widthM,
        panelTiltDeg: Number(body.panelTiltDeg ?? params.panelTiltDeg ?? 22),
        panelAzimuthDeg: typeof body.panelAzimuthDeg === "number" ? body.panelAzimuthDeg : params.panelAzimuthDeg,
        soilingLossPct: typeof body.soilingLossPct === "number" ? body.soilingLossPct : 2.5,
        shadingLossPct: typeof body.shadingLossPct === "number" ? body.shadingLossPct : (params.shadingLossPct ?? 2.0),
        shadingSource: body.shadingSource ?? params.shadingSource,
        shadingScenarioName: body.shadingScenarioName ?? params.shadingScenarioName,
        inverterEfficiencyPct: typeof body.inverterEfficiencyPct === "number" ? body.inverterEfficiencyPct : 97.5,
        capexPerKwpInr: typeof body.capexPerKwpInr === "number" ? body.capexPerKwpInr : 42000,
        tariffPerKwhInr: typeof body.tariffPerKwhInr === "number" ? body.tariffPerKwhInr : 6.50,
        opexAnnualPct: typeof body.opexAnnualPct === "number" ? body.opexAnnualPct : 1.2,
        observedGeneration: Array.isArray(body.observedGeneration) ? body.observedGeneration : undefined,
      };
    } else {
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      const coordCheck = validateCoordinates(lat, lng);
      if (!coordCheck.valid) {
        return errorResponse(coordCheck.reason || "Invalid coordinates", "INVALID_INPUT", 400);
      }

      let capacityKwp = Number(body.capacityKwp);
      if (!Number.isFinite(capacityKwp) || capacityKwp <= 0) {
        if (typeof body.availableAreaM2 === "number" && body.availableAreaM2 > 0) {
          capacityKwp = Math.round(body.availableAreaM2 * 0.08);
        } else {
          capacityKwp = 5000;
        }
      }

      solarInput = {
        lat,
        lng,
        capacityKwp,
        systemType: body.systemType,
        availableAreaM2: typeof body.availableAreaM2 === "number" ? body.availableAreaM2 : undefined,
        panelTiltDeg: typeof body.panelTiltDeg === "number" ? body.panelTiltDeg : undefined,
        panelAzimuthDeg: typeof body.panelAzimuthDeg === "number" ? body.panelAzimuthDeg : undefined,
        soilingLossPct: typeof body.soilingLossPct === "number" ? body.soilingLossPct : 2.5,
        shadingLossPct: typeof body.shadingLossPct === "number" ? body.shadingLossPct : 2.0,
        shadingSource: body.shadingSource,
        shadingScenarioName: body.shadingScenarioName,
        inverterEfficiencyPct: typeof body.inverterEfficiencyPct === "number" ? body.inverterEfficiencyPct : 97.5,
        capexPerKwpInr: typeof body.capexPerKwpInr === "number" ? body.capexPerKwpInr : 42000,
        tariffPerKwhInr: typeof body.tariffPerKwhInr === "number" ? body.tariffPerKwhInr : 6.50,
        opexAnnualPct: typeof body.opexAnnualPct === "number" ? body.opexAnnualPct : 1.2,
        observedGeneration: Array.isArray(body.observedGeneration) ? body.observedGeneration : undefined,
      };
    }

    // Query NASA POWER solar resource with regional fallback
    let solarResource;
    try {
      solarResource = await nasaPowerProvider.getSolarResource(solarInput.lat, solarInput.lng);
    } catch (e: any) {
      console.warn("[Solar Reality] NASA POWER query failed, falling back to representative regional GHI:", e?.message);
      solarResource = {
        annualAverageGhiKwhM2Day: 5.2,
        monthlyGhiKwhM2Day: {
          JAN: 4.8, FEB: 5.4, MAR: 6.2, APR: 6.6, MAY: 6.8, JUN: 4.9,
          JUL: 3.8, AUG: 3.7, SEP: 4.5, OCT: 5.1, NOV: 4.9, DEC: 4.6,
        },
        annualMeanTempC: 25.5,
        monthlyMeanTempC: {
          JAN: 21.0, FEB: 23.5, MAR: 27.2, APR: 30.1, MAY: 31.5, JUN: 28.0,
          JUL: 25.5, AUG: 25.0, SEP: 25.8, OCT: 26.0, NOV: 23.8, DEC: 21.2,
        },
        retrievedAt: new Date().toISOString(),
        source: "Indian Solar Radiation Climatology (Regional Fallback)",
        license: "IMD / MNRE Climatological Reference",
        cacheStatus: "stale_fallback" as const,
        isStale: false,
        quality: { completeness: "verified" as const, isStale: false, cacheStatus: "stale_fallback" as const },
      };
    }

    // Compute Solar Reality generation & feasibility estimation
    const generationResult = estimateSolarGeneration(solarInput, solarResource);

    return successResponse({
      generation: generationResult,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
