import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/server/utils/response";
import { runNuGenConnectionDiagnostic } from "@/server/ai/diagnostic";

export const dynamic = "force-dynamic";

/**
 * Developer and Frontend Diagnostic Endpoint
 * GET /api/copilot/health
 * 
 * Runs a live 5-stage verification:
 * 1. DNS resolution for api.nugen.in
 * 2. HTTPS reachability on port 443
 * 3. API key presence and authentication check
 * 4. Model availability
 * 5. Live test generation
 */
export async function GET(req: NextRequest) {
  try {
    const diagnostic = await runNuGenConnectionDiagnostic();
    return successResponse({
      ...diagnostic,
      success: true,
      data: diagnostic,
    });
  } catch (err: unknown) {
    return handleRouteError(err);
  }
}
