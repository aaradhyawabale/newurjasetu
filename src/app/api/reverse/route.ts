import { NextRequest } from "next/server";
import { NominatimProvider } from "@/server/providers/nominatim";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";

export const dynamic = "force-dynamic";

const nominatim = new NominatimProvider();

export async function GET(req: NextRequest) {
  try {
    await requireAuthUser(req);
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");

    if (!latStr || !lngStr) {
      return errorResponse("Parameters 'lat' and 'lng' are required", "BAD_REQUEST", 400);
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      return errorResponse("Invalid coordinate numbers", "BAD_REQUEST", 400);
    }

    const label = await nominatim.reverse(lat, lng);
    return successResponse({ label });
  } catch (err) {
    return handleRouteError(err);
  }
}
