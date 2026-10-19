import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/server/utils/response";
import { loadPmcCandidateBoundary } from "@/server/providers/snapshot-loader";

/**
 * GET /api/boundaries
 * Returns verified or candidate municipal boundary GeoJSON for spatial visualization.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || "pune";

  if (city === "pune") {
    const boundary = loadPmcCandidateBoundary();
    if (!boundary) {
      return errorResponse("PMC candidate boundary asset not found.", "NOT_FOUND", 404);
    }
    return successResponse({ boundary });
  }

  if (city === "pcmc") {
    return successResponse({
      boundary: null,
      message: "Authoritative PCMC municipal boundary polygon is unavailable in repository. Falling back to analytical corridor bounding bounds without rendering unverified rectangular borders as municipal limits.",
    });
  }

  if (city === "nashik") {
    return successResponse({
      boundary: null,
      message: "NMC boundary is currently audited as coarse polygonal sectors.",
    });
  }

  return errorResponse(`Unknown city parameter: ${city}`, "BAD_REQUEST", 400);
}
