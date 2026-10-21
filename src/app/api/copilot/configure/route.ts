import { NextRequest } from "next/server";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import fs from "fs";
import path from "path";

/**
 * Endpoint to configure and persist the Google Gemini API Key
 * directly from the Copilot Drawer UI on the user's laptop.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuthUser(req);

    const body = await req.json().catch(() => ({}));
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "gemini-2.5-flash";

    if (!apiKey) {
      return errorResponse("Gemini API key cannot be empty", "INVALID_KEY", 400);
    }

    // Update in-memory runtime environment immediately
    process.env.GEMINI_API_KEY = apiKey;
    process.env.GEMINI_MODEL = model;

    // Persist to .env file so it survives dev server restarts
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      let envContent = "";
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf-8");
      }

      if (envContent.includes("GEMINI_API_KEY=")) {
        envContent = envContent.replace(
          /GEMINI_API_KEY=.*(\r?\n|$)/g,
          `GEMINI_API_KEY="${apiKey}"$1`
        );
      } else {
        envContent += `\n# Google Gemini AI Key (Configured via Copilot)\nGEMINI_API_KEY="${apiKey}"\n`;
      }

      if (envContent.includes("GEMINI_MODEL=")) {
        envContent = envContent.replace(
          /GEMINI_MODEL=.*(\r?\n|$)/g,
          `GEMINI_MODEL="${model}"$1`
        );
      } else {
        envContent += `GEMINI_MODEL="${model}"\n`;
      }

      fs.writeFileSync(envPath, envContent, "utf-8");
    } catch (fsErr) {
      console.warn("[Copilot Configure] Could not persist to .env file:", fsErr);
    }

    return successResponse({
      configured: true,
      model,
      message: "Gemini API key configured and activated successfully.",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
