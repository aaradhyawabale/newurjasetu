import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/copilot/route";
import { GET as healthGET } from "@/app/api/copilot/health/route";
import { nuGenProvider } from "@/server/ai/llm/nugen-provider";
import { LLMAuthError } from "@/server/ai/llm/types";

describe("Climate Copilot — Verification & LLM Mock Flow", () => {
  const originalKey = process.env.NUGEN_API_KEY;

  beforeEach(() => {
    process.env.NUGEN_API_KEY = "nugen-test-valid-key-mock";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NUGEN_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("1. 'hi' returns a greeting from the LLM", async () => {
    const completeSpy = vi.spyOn(nuGenProvider, "complete").mockResolvedValueOnce({
      text: "Hello! I am your Climate Copilot for Pune. I can help you evaluate surface temperatures, cooling interventions, and greening budgets.",
      model: "meta-llama/Llama-3.2-3B-Instruct",
    });

    const req = new NextRequest("http://localhost:3000/api/copilot", {
      method: "POST",
      body: JSON.stringify({ message: "hi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(completeSpy).toHaveBeenCalled();
    const passedMessages = completeSpy.mock.calls[0][0];
    const lastUserMsg = passedMessages[passedMessages.length - 1];
    expect(lastUserMsg.role).toBe("user");
    expect(lastUserMsg.content).toBe("hi");

    expect(json.reply).toContain("Hello!");
    expect(json.reply).toContain("Pune");
    expect(json.degraded).toBeUndefined();
  });

  it("2. 'what is heat burden?' returns an educational definition from the LLM", async () => {
    const completeSpy = vi.spyOn(nuGenProvider, "complete").mockResolvedValueOnce({
      text: "Heat burden refers to the severe thermal stress experienced in urban environments, characterized by elevated radiometric surface temperatures in areas with low vegetation index and high thermal mass.",
      model: "meta-llama/Llama-3.2-3B-Instruct",
    });

    const req = new NextRequest("http://localhost:3000/api/copilot", {
      method: "POST",
      body: JSON.stringify({ message: "what is heat burden?" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(completeSpy).toHaveBeenCalled();
    expect(json.reply).toContain("Heat burden refers to");
    expect(json.degraded).toBeUndefined();
  });

  it("3. 'how should I allocate 20 ha?' grounds in scenario data within system prompt", async () => {
    let capturedSystemPrompt = "";

    const completeSpy = vi.spyOn(nuGenProvider, "complete").mockImplementation(async (messages) => {
      const sys = messages.find((m) => m.role === "system");
      if (sys) capturedSystemPrompt = sys.content;

      return {
        text: "Allocating 20 ha across high-heat parcels in Pune provides expected surface cooling relief of 2.1°C, shielding an estimated 14,489 residents [Assumed] under our 30-member Monte Carlo optimization run.",
        model: "meta-llama/Llama-3.2-3B-Instruct",
      };
    });

    const req = new NextRequest("http://localhost:3000/api/copilot", {
      method: "POST",
      body: JSON.stringify({
        message: "how should I allocate 20 ha?",
        context: {
          currentPlan: {
            allocatedHa: 20,
            selectedCount: 9,
            meanCooling: 2.1,
            totalPopulation: 14489,
          },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(completeSpy).toHaveBeenCalled();
    expect(capturedSystemPrompt).toContain("SCENARIO_DATA:");
    expect(capturedSystemPrompt).toContain("MODEL_CARD:");
    expect(capturedSystemPrompt).toContain("20");
    expect(json.reply).toContain("Allocating 20 ha");
    expect(json.degraded).toBeUndefined();
  });

  it("4. mocked 401 returns degraded: true with error LLM_UNAUTHORIZED and does NOT return canned summary as normal reply", async () => {
    vi.spyOn(nuGenProvider, "complete").mockRejectedValueOnce(
      new LLMAuthError("NuGen authentication failed (HTTP 401). Verify NUGEN_API_KEY in Render environment variables.")
    );

    const req = new NextRequest("http://localhost:3000/api/copilot", {
      method: "POST",
      body: JSON.stringify({ message: "hi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.degraded).toBe(true);
    expect(json.error).toBe("LLM_UNAUTHORIZED");
    expect(json.reply).toContain("The AI service is temporarily unavailable. Here is the static scenario summary:");

    // Verify it is NOT returned as if it were a normal answer
    expect(json.reply.startsWith("Current optimization scenario:")).toBe(false);
  });

  it("5. GET /api/copilot/health checks NuGen connectivity", async () => {
    vi.spyOn(nuGenProvider, "complete").mockResolvedValueOnce({
      text: "OK",
      model: "meta-llama/Llama-3.2-3B-Instruct",
    });

    const res = await healthGET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("6. GET /api/copilot/health reports 401 with helpful hint on auth error", async () => {
    vi.spyOn(nuGenProvider, "complete").mockRejectedValueOnce(
      new LLMAuthError("NuGen authentication failed (HTTP 401)")
    );

    const res = await healthGET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.status).toBe(401);
    expect(json.errorType).toBe("LLM_UNAUTHORIZED");
    expect(json.hint).toContain("invalid/expired key or wrong header");
  });
});
