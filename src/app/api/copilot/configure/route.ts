import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/server/auth/session";
import { successResponse, errorResponse, handleRouteError } from "@/server/utils/response";
import fs from "fs";
import path from "path";

/**
 * Endpoint to configure and persist the NuGen AI API Key
 * strictly to git-ignored .env.local.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuthUser(req);

    const body = await req.json().catch(() => ({}));
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "meta-llama/Llama-3.2-3B-Instruct";

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "NuGen API key cannot be empty", message: "NuGen API key cannot be empty" },
        { status: 400 }
      );
    }

    // Update in-memory runtime environment immediately
    process.env.NUGEN_API_KEY = apiKey;
    process.env.NUGEN_MODEL = model;
    process.env.LLM_PROVIDER = "nugen";

    // Persist strictly to git-ignored .env.local file
    try {
      const envPath = path.resolve(process.cwd(), ".env.local");
      let envContent = "";
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf-8");
      }

      if (envContent.includes("NUGEN_API_KEY=")) {
        envContent = envContent.replace(
          /NUGEN_API_KEY=.*(\r?\n|$)/g,
          `NUGEN_API_KEY="${apiKey}"$1`
        );
      } else {
        envContent += `\n# NuGen AI Model Key (Configured via Copilot)\nNUGEN_API_KEY="${apiKey}"\n`;
      }

      if (envContent.includes("NUGEN_MODEL=")) {
        envContent = envContent.replace(
          /NUGEN_MODEL=.*(\r?\n|$)/g,
          `NUGEN_MODEL="${model}"$1`
        );
      } else {
        envContent += `NUGEN_MODEL="${model}"\n`;
      }

      if (!envContent.includes("LLM_PROVIDER=")) {
        envContent += `LLM_PROVIDER="nugen"\n`;
      }

      fs.writeFileSync(envPath, envContent, "utf-8");
    } catch (fsErr) {
      console.warn("[Copilot Configure] Could not persist to .env.local file:", fsErr);
    }

    const maskedKey = apiKey.length > 8 ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "...";
    return successResponse({
      success: true,
      data: {
        configured: true,
        savedTo: ".env.local",
        configuredModel: model,
        maskedKey,
        message: "NuGen AI model credentials configured successfully.",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
