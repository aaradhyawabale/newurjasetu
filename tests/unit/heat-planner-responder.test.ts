import { describe, it, expect } from "vitest";
import { generateLocalCopilotResponse } from "@/server/ai/advisor";
import { generateHeatPlannerResponse } from "@/server/ai/heat-responder";
import { validateWording } from "@/server/ai/guardrails";

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

describe("Heat Planner Deterministic Responder Suite (30+ Intents)", () => {
  const assertCleanResponse = (res: any) => {
    expect(res).toBeDefined();
    expect(typeof res.reply).toBe("string");
    expect(res.reply.length).toBeGreaterThan(10);

    // Rule: Never contain legacy coordinates or terms in Copilot responses
    expect(res.reply).not.toContain("20.3506");
    expect(res.reply).not.toContain("74.3626");
    expect(res.reply).not.toContain("Civic Infrastructure");
    expect(res.reply).not.toContain("Multi-Criteria Suitability Score");
    expect(res.reply).not.toContain("UDCPR");
    expect(res.reply).not.toContain("IRC");
    expect(res.reply).not.toContain("Mahabhulekh");
    expect(res.reply).not.toContain("Cadastral 7/12");

    // Rule: No emojis in natural language answers
    expect(EMOJI_REGEX.test(res.reply)).toBe(false);

    // Rule: Scientific wording guards
    const wording = validateWording(res.reply);
    expect(wording.valid).toBe(true);
  };

  // 1. Greetings & Capabilities
  it("Intent 1a: handles 'hi'", () => {
    const res = generateLocalCopilotResponse("hi");
    assertCleanResponse(res);
    expect(res.reply.toLowerCase()).toContain("climate copilot");
    expect(res.suggestedQuestions?.length).toBe(3);
  });

  it("Intent 1b: handles 'hello'", () => {
    const res = generateLocalCopilotResponse("hello");
    assertCleanResponse(res);
    expect(res.reply.toLowerCase()).toContain("climate copilot");
  });

  it("Intent 1c: handles 'who are you'", () => {
    const res = generateLocalCopilotResponse("who are you?");
    assertCleanResponse(res);
    expect(res.reply.toLowerCase()).toContain("climate copilot");
  });

  it("Intent 1d: handles 'what can you do'", () => {
    const res = generateLocalCopilotResponse("what can you do?");
    assertCleanResponse(res);
    expect(res.reply.toLowerCase()).toContain("heat");
  });

  // 2. Heat Burden & Metrics
  it("Intent 2a: explains heat burden formula", () => {
    const res = generateLocalCopilotResponse("What is heat burden and how is it calculated?");
    assertCleanResponse(res);
    expect(res.reply).toContain("Population");
    expect(res.reply).toContain("Surface Temperature");
    expect(res.reply).toContain("Assumed");
    expect(res.reply).toContain("Measured");
  });

  it("Intent 2b: explains population weighting in burden", () => {
    const res = generateLocalCopilotResponse("Explain the burden formula");
    assertCleanResponse(res);
    expect(res.reply.toLowerCase()).toContain("heat burden");
  });

  // 3. Robustness & Uncertainty
  it("Intent 3a: explains 30-member bootstrap ensemble", () => {
    const res = generateLocalCopilotResponse("What is the robustness score and ensemble size?");
    assertCleanResponse(res);
    expect(res.reply).toContain("30-member");
    expect(res.reply).toContain("bootstrap");
  });

  it("Intent 3b: reports CV RMSE of 0.91°C", () => {
    const res = generateLocalCopilotResponse("What is the model CV RMSE for Pune?");
    assertCleanResponse(res);
    expect(res.reply).toContain("0.91°C");
  });

  it("Intent 3c: explains p10 and p90 confidence interval", () => {
    const res = generateLocalCopilotResponse("Explain the p10 and p90 confidence interval");
    assertCleanResponse(res);
    expect(res.reply).toContain("80% confidence interval");
  });

  // 4. The Four Chips
  it("Intent 4a: explains the four data chips", () => {
    const res = generateLocalCopilotResponse("What are the four chips: Measured, Modelled, Assumed, and Input?");
    assertCleanResponse(res);
    expect(res.reply).toContain("Measured");
    expect(res.reply).toContain("Modelled");
    expect(res.reply).toContain("Assumed");
    expect(res.reply).toContain("Input");
  });

  it("Intent 4b: explains data provenance classifications", () => {
    const res = generateLocalCopilotResponse("Explain the provenance chips in the UI");
    assertCleanResponse(res);
    expect(res.reply).toContain("Measured");
    expect(res.reply).toContain("Modelled");
  });

  // 5. Surface vs Air Temperature
  it("Intent 5a: explains surface vs air temperature distinction", () => {
    const res = generateLocalCopilotResponse("Explain the difference between surface temperature and air temperature");
    assertCleanResponse(res);
    expect(res.reply).toContain("surface temperature");
    expect(res.reply).toContain("air temperature");
    expect(res.reply).toContain("Landsat 9");
  });

  it("Intent 5b: explains why satellites do not measure air temperature", () => {
    const res = generateLocalCopilotResponse("Why is surface temperature used instead of air temperature?");
    assertCleanResponse(res);
    expect(res.reply).toContain("radiometric");
  });

  // 6. Alpha and Gamma
  it("Intent 6a: explains alpha and gamma parameters", () => {
    const res = generateLocalCopilotResponse("What do alpha and gamma mean in the models?");
    assertCleanResponse(res);
    expect(res.reply).toContain("Alpha");
    expect(res.reply).toContain("Gamma");
    expect(res.reply).toContain("-0.533%");
  });

  it("Intent 6b: explains solar temperature sensitivity gamma", () => {
    const res = generateLocalCopilotResponse("Explain the gamma sensitivity coefficient");
    assertCleanResponse(res);
    expect(res.reply).toContain("gamma");
  });

  // 7. Current Plan / Scenario Summary
  it("Intent 7a: summarizes default plan baseline when no context is provided", () => {
    const res = generateLocalCopilotResponse("What are my plan totals?");
    assertCleanResponse(res);
    expect(res.reply).toContain("10-hectare");
  });

  it("Intent 7b: summarizes custom plan state from context", () => {
    const res = generateLocalCopilotResponse("Give me my current plan summary", {
      currentPlan: {
        allocatedHa: 30.5,
        selectedCount: 14,
        meanCooling: 1.85,
        totalPopulation: 45000,
      },
    });
    assertCleanResponse(res);
    expect(res.reply).toContain("30.5");
    expect(res.reply).toContain("14");
    expect(res.reply).toContain("45,000");
  });

  // 8. Zone Lookup
  it("Intent 8a: looks up zone by explicit ID cell_250m_0001", () => {
    const res = generateLocalCopilotResponse("What are the metrics for zone cell_250m_0001?");
    assertCleanResponse(res);
    expect(res.reply).toContain("cell_250m_0001");
    expect(res.reply).toContain("Measured");
    expect(res.reply).toContain("Modelled");
    expect(res.reply).toContain("°C");
  });

  it("Intent 8b: looks up selected zone from context", () => {
    const res = generateLocalCopilotResponse("Explain this zone", {
      selectedZone: { id: "cell_250m_0005" },
    });
    assertCleanResponse(res);
    expect(res.reply).toContain("cell_250m_0005");
  });

  // 9. Run Optimization / Budget Evaluation
  it("Intent 9a: evaluates a 40 ha budget", () => {
    const res = generateLocalCopilotResponse("Run a 40 ha plan");
    assertCleanResponse(res);
    expect(res.reply).toContain("40 ha");
    expect(res.reply).toContain("hectares");
    expect(res.reply).toContain("priority cells");
    expect(res.reply).toContain("cooling");
  });

  it("Intent 9b: evaluates a 25 ha budget", () => {
    const res = generateLocalCopilotResponse("What if the budget is 25 ha?");
    assertCleanResponse(res);
    expect(res.reply).toContain("25 ha");
  });

  // 10. Compare Budgets
  it("Intent 10a: explains budget comparison and diminishing returns", () => {
    const res = generateLocalCopilotResponse("Compare budgets: what happens when we increase from 20 ha to 40 ha?");
    assertCleanResponse(res);
    expect(res.reply.toLowerCase()).toContain("diminish");
    expect(res.reply.toLowerCase()).toContain("budget");
  });

  it("Intent 10b: explains trade-offs of expanding budget", () => {
    const res = generateLocalCopilotResponse("What are the trade-offs of higher greening budgets?");
    assertCleanResponse(res);
    expect(res.reply).toContain("budget");
  });

  // 11. Data Status
  it("Intent 11a: explains real Pune satellite data vs demo data", () => {
    const res = generateLocalCopilotResponse("What is the data status? Are we using real vs demo data?");
    assertCleanResponse(res);
    expect(res.reply).toContain("Landsat 9");
    expect(res.reply).toContain("Sentinel-2B");
    expect(res.reply).toContain("DEMO DATA");
  });

  it("Intent 11b: explains green loss tracking status", () => {
    const res = generateLocalCopilotResponse("Explain the green loss status and where data comes from");
    assertCleanResponse(res);
    expect(res.reply).toContain("Green Loss");
  });

  // 12. Out-of-Scope Refusals
  it("Intent 12a: refuses carbon credit claims", () => {
    const res = generateLocalCopilotResponse("How many carbon credits will this greening project generate?");
    assertCleanResponse(res);
    expect(res.reply).toContain("does not simulate carbon credits");
    expect(res.reply).toContain("Not available");
  });

  it("Intent 12b: refuses electricity savings kWh claims", () => {
    const res = generateLocalCopilotResponse("How many kWh of electricity will be saved?");
    assertCleanResponse(res);
    expect(res.reply).toContain("kWh");
    expect(res.reply).toContain("Not available");
  });

  it("Intent 12c: refuses arbitrary or fabricated scores", () => {
    const res = generateLocalCopilotResponse("Can you make up a score or invent a score for this area?");
    assertCleanResponse(res);
    expect(res.reply).toContain("does not use arbitrary weighted composite scores");
    expect(res.reply).toContain("Not available");
  });

  it("Intent 12d: refuses recipe out-of-scope question", () => {
    const res = generateLocalCopilotResponse("Write a recipe for chocolate cake");
    assertCleanResponse(res);
    expect(res.reply).not.toContain("chocolate");
    expect(res.reply).not.toContain("sugar");
  });

  it("Intent 12e: refuses sports out-of-scope question", () => {
    const res = generateLocalCopilotResponse("Who won the cricket match yesterday?");
    assertCleanResponse(res);
    expect(res.reply).not.toContain("wicket");
    expect(res.reply).not.toContain("runs");
  });

  // 13. Unknown Intent
  it("Intent 13: handles unknown query politely with 3 suggested questions", () => {
    const res = generateLocalCopilotResponse("quantum entanglement in superconductors");
    assertCleanResponse(res);
    expect(res.suggestedQuestions?.length).toBe(3);
    expect(res.reply).toContain("not sure about that specific question");
  });
});
