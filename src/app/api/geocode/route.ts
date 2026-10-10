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
    const q = searchParams.get("q");

    if (!q || !q.trim()) {
      return errorResponse("Search query 'q' is required", "BAD_REQUEST", 400);
    }

    const results = await nominatim.geocode(q.trim());
    return successResponse({ results });
  } catch (err) {
    return handleRouteError(err);
  }
}
