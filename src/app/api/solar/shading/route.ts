import { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import { OverpassProvider } from "@/server/providers/overpass";
import { simulateSolarShading } from "@/server/solar/shadow-engine";
import {
  SolarPlacementInput,
  SimulationTimeInput,
  ShadingScenarioConfig,
} from "@/server/solar/types";
import { validateCoordinates } from "@/server/gis/geometry";
import { StandardizedGeoFeature } from "@/server/providers/types";

const overpassProvider = new OverpassProvider();

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json();

    let solarPlacement: SolarPlacementInput;
    let cachedFeatures: StandardizedGeoFeature[] | null = null;

    if (body.placementId) {
      const placement = await prisma.placement.findFirst({
        where: { id: body.placementId, userId: user.userId },
        include: {
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!placement) {
        return errorResponse("Placement not found or unauthorized", "NOT_FOUND", 404);
      }

      const params = JSON.parse(placement.params || "{}");
      solarPlacement = {
        lat: placement.lat,
        lng: placement.lng,
        lengthM: placement.lengthM,
        widthM: placement.widthM,
        bearingDeg: placement.bearingDeg,
        panelTiltDeg: params.panelTiltDeg ?? 22,
      };

      // Check if latest analysis already cached surrounding features
      if (placement.analyses.length > 0) {
        try {
          const report = JSON.parse(placement.analyses[0].result);
          if (Array.isArray(report.analyzedFeatures) && report.analyzedFeatures.length > 0) {
            cachedFeatures = report.analyzedFeatures;
          }
        } catch {
          // ignore cache parse error
        }
      }
    } else if (body.solarPlacement) {
      const sp = body.solarPlacement;
      const coordCheck = validateCoordinates(sp.lat, sp.lng);
      if (!coordCheck.valid) {
        return errorResponse(coordCheck.reason || "Invalid coordinates", "INVALID_INPUT", 400);
      }

      solarPlacement = {
        lat: sp.lat,
        lng: sp.lng,
        lengthM: Number(sp.lengthM) || 250,
        widthM: Number(sp.widthM) || 200,
        bearingDeg: Number(sp.bearingDeg) || 0,
        panelTiltDeg: Number(sp.panelTiltDeg) || 22,
      };
    } else {
      return errorResponse(
        "Either 'placementId' or 'solarPlacement' must be provided.",
        "INVALID_INPUT",
        400
      );
    }

    const simulationTime: SimulationTimeInput = {
      isoDate: body.simulationTime?.isoDate || new Date().toISOString(),
      timezoneOffsetMinutes:
        typeof body.simulationTime?.timezoneOffsetMinutes === "number"
          ? body.simulationTime.timezoneOffsetMinutes
          : 330, // Default to IST (+05:30)
    };

    const scenarioConfig: ShadingScenarioConfig = {
      includeExistingBuildings: body.scenarioConfig?.includeExistingBuildings ?? true,
      defaultUnknownBuildingHeightM: body.scenarioConfig?.defaultUnknownBuildingHeightM,
      hypotheticalBuildings: Array.isArray(body.scenarioConfig?.hypotheticalBuildings)
        ? body.scenarioConfig.hypotheticalBuildings
        : [],
      modifiedExistingBuildingHeights: body.scenarioConfig?.modifiedExistingBuildingHeights ?? {},
    };

    // Retrieve or reuse surrounding building features (search radius: 800m)
    let surroundingFeatures: StandardizedGeoFeature[] = cachedFeatures || [];
    if (surroundingFeatures.length === 0) {
      const overpassRes = await overpassProvider.getFeaturesAround(solarPlacement.lat, solarPlacement.lng, 800);
      surroundingFeatures = overpassRes.normalizedFeatures || [];
    }

    // Run future-aware shading simulation
    const simulationResult = simulateSolarShading(
      solarPlacement,
      simulationTime,
      surroundingFeatures,
      scenarioConfig
    );

    return successResponse({
      shading: simulationResult,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
