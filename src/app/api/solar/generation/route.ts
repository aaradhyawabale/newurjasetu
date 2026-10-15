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

    if (body.placementId) {
      const placement = await prisma.placement.findFirst({
        where: { id: body.placementId, userId: user.userId },
      });

      if (!placement) {
        return errorResponse("Placement not found or unauthorized", "NOT_FOUND", 404);
      }

      const params = JSON.parse(placement.params || "{}");

      // Determine capacity in kWp: from targetCapacityMw or from footprint area (100 Wp / m2)
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

      const capacityKwp = Number(body.capacityKwp);
      if (!Number.isFinite(capacityKwp) || capacityKwp <= 0) {
        return errorResponse("Valid positive capacity in kWp is required.", "INVALID_INPUT", 400);
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

    // Query NASA POWER solar resource
    const solarResource = await nasaPowerProvider.getSolarResource(solarInput.lat, solarInput.lng);

    // Compute Solar Reality generation & feasibility estimation
    const generationResult = estimateSolarGeneration(solarInput, solarResource);

    return successResponse({
      generation: generationResult,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
