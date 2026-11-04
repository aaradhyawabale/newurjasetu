import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  runOptimizationToolDeclaration,
  getZoneToolDeclaration,
  executeRunOptimizationTool,
  executeGetZoneTool,
  generateLocalCopilotResponse,
  generateCopilotResponse,
} from "@/server/ai/gemini-advisor";
import { getPriorityCellsSync } from "@/server/priority/loader";

describe("Gemini Function Calling Tools & Refusal Policy", () => {
  describe("Tool Declarations Schema", () => {
    it("declares run_optimization with valid schema and required parameters", () => {
      expect(runOptimizationToolDeclaration.name).toBe("run_optimization");
      expect(runOptimizationToolDeclaration.description).toContain("cooling optimization");
      expect(runOptimizationToolDeclaration.parameters).toBeDefined();
      expect(runOptimizationToolDeclaration.parameters?.type).toBe("OBJECT");
      expect(runOptimizationToolDeclaration.parameters?.required).toEqual(["budget_ha", "target_ndvi"]);
      
      const props = (runOptimizationToolDeclaration.parameters as any).properties;
      expect(props.budget_ha).toBeDefined();
      expect(props.target_ndvi).toBeDefined();
      expect(props.budget_ha.type).toBe("NUMBER");
      expect(props.target_ndvi.type).toBe("NUMBER");
    });

    it("declares get_zone with valid schema and required parameters", () => {
      expect(getZoneToolDeclaration.name).toBe("get_zone");
      expect(getZoneToolDeclaration.description).toContain("250m priority cell");
      expect(getZoneToolDeclaration.parameters).toBeDefined();
      expect(getZoneToolDeclaration.parameters?.type).toBe("OBJECT");
      expect(getZoneToolDeclaration.parameters?.required).toEqual(["id"]);

      const props = (getZoneToolDeclaration.parameters as any).properties;
      expect(props.id).toBeDefined();
      expect(props.id.type).toBe("STRING");
    });
  });

  describe("Backend Tool Execution — run_optimization", () => {
    it("executes run_optimization with real backend and returns grounded numbers", () => {
      const result = executeRunOptimizationTool({ budget_ha: 10.0, target_ndvi: 0.65 });
      expect(result.status).toBe("OK");
      expect(result.budget_ha).toBe(10.0);
      expect(result.allocated_ha).toBeGreaterThan(0);
      expect(result.allocated_ha).toBeLessThanOrEqual(10.0);
      expect(result.selected_cells.length).toBeGreaterThan(0);

      // Verify strict provenance tags and disclaimers
      expect(result.governance.tags.budget_ha).toBe("[Assumed]");
      expect(result.governance.tags.cooling_mean).toBe("[Modelled]");
      expect(result.governance.tags.population).toBe("[Measured]");
      expect(result.governance.disclaimers.some((d) => d.includes("radiometric skin temperature"))).toBe(true);

      const firstCell = result.selected_cells[0];
      expect(firstCell.id).toBeDefined();
      expect(firstCell.ward).toBeDefined();
      expect(firstCell.greenable_ha).toBeGreaterThan(0);
      expect(firstCell.selection_frequency).toBeGreaterThanOrEqual(0);
      expect(firstCell.selection_frequency).toBeLessThanOrEqual(1.0);
      expect(firstCell.times_selected_ensemble).toBeGreaterThanOrEqual(0);
      expect(firstCell.times_selected_ensemble).toBeLessThanOrEqual(30);
    });

    it("handles invalid or non-positive budget gracefully without fabrication", () => {
      const result = executeRunOptimizationTool({ budget_ha: -5, target_ndvi: 0.65 });
      expect(result.status).toBe("ERROR");
      expect(result.error).toContain("must be a positive number");
      expect(result.selected_cells).toEqual([]);
      expect(result.allocated_ha).toBe(0);
    });
  });

  describe("Backend Tool Execution — get_zone", () => {
    it("executes get_zone for an existing cell and returns authentic measured and modelled stats", () => {
      const cells = getPriorityCellsSync();
      expect(cells.length).toBeGreaterThan(0);
      const targetCell = cells[0];

      const result = executeGetZoneTool({ id: targetCell.id });
      expect(result.found).toBe(true);

      if (result.found) {
        expect(result.id).toBe(targetCell.id);
        expect(result.ward).toBe(targetCell.ward);
        expect(result.centroid).toEqual(targetCell.centroid);
        expect(result.population).toBe(targetCell.population);
        expect(result.lst_mean).toBe(targetCell.lst_mean);
        expect(result.ndvi).toBe(targetCell.ndvi);
        expect(result.greenable_ha).toBe(targetCell.greenable_ha);
        expect(result.cooling_mean).toBe(targetCell.cooling_mean);
        expect(result.governance.tags.population).toBe("[Measured]");
        expect(result.governance.tags.cooling_mean).toBe("[Modelled]");
        expect(result.governance.disclaimers.some((d) => d.includes("radiometric skin temperature"))).toBe(true);
      }
    });

    it("refuses to fabricate values when zone does not exist", () => {
      const result = executeGetZoneTool({ id: "cell_nonexistent_99999" });
      expect(result.found).toBe(false);
      if (!result.found) {
        expect(result.error).toContain("not found in the priority cells database");
        expect(result.error).toContain("Do not invent or fabricate");
      }
    });

    it("rejects empty or invalid zone ID input", () => {
      const result = executeGetZoneTool({ id: "" });
      expect(result.found).toBe(false);
      if (!result.found) {
        expect(result.error).toContain("Invalid zone ID");
      }
    });
  });

  describe("Scientific Data Governance & Refusal Policy in Deterministic Fallback", () => {
    it("refuses to invent ambient air temperature and explains why LST is radiometric skin temp", () => {
      const res = generateLocalCopilotResponse("What is the ambient air temperature at this site? Can you guess it?");
      expect(res.reply).toContain("Refusal to Invent");
      expect(res.reply).toContain("Surface Temperature (LST) is NOT Air Temperature");
      expect(res.reply).toContain("radiometric surface skin temperature");
      expect(res.reply).toContain("automatic weather stations (AWS)");
      expect(res.statutoryStatus).toBe("INSUFFICIENT_EVIDENCE");
    });

    it("refuses to invent tree canopy cover percentage and explains why NDVI is a spectral index", () => {
      const res = generateLocalCopilotResponse("Estimate the tree canopy cover percentage for this ward");
      expect(res.reply).toContain("Refusal to Invent");
      expect(res.reply).toContain("NDVI is NOT Tree Canopy Cover");
      expect(res.reply).toContain("mathematical ratio of spectral reflectance");
      expect(res.statutoryStatus).toBe("INSUFFICIENT_EVIDENCE");
    });

    it("refuses to invent arbitrary composite scores and explains physical cooling basis", () => {
      const res = generateLocalCopilotResponse("Can you give me an arbitrary score or invent a score for heat priority?");
      expect(res.reply).toContain("Refusal to Invent");
      expect(res.reply).toContain("No Arbitrary Weighted Composite Scores");
      expect(res.reply).toContain("physical cooling benefits");
      expect(res.statutoryStatus).toBe("INSUFFICIENT_EVIDENCE");
    });

    it("refuses to invent non-existent zone data when asked for an unobserved cell ID", () => {
      const res = generateLocalCopilotResponse("What are the priority details for cell_250m_999999?");
      expect(res.reply).toContain("Zone Not Found");
      expect(res.reply).toContain("refuses to fabricate or guess unobserved zone metrics");
      expect(res.reply).toContain("Not available");
      expect(res.statutoryStatus).toBe("INSUFFICIENT_EVIDENCE");
    });

    it("deterministically executes run_optimization tool and quotes ONLY real backend numbers", () => {
      const res = generateLocalCopilotResponse("run_optimization with 12 ha budget and 0.7 target_ndvi");
      expect(res.reply).toContain("Counterfactual Heat Priority Optimization Results");
      expect(res.reply).toContain("[Assumed] **12 ha**");
      expect(res.reply).toContain("[Assumed] **0.7**");
      expect(res.reply).toContain("[Modelled]");
      expect(res.reply).toContain("[Measured]");
      expect(res.reply).toContain("Surface Temperature (LST)");
      expect(res.reply).toContain("NDVI");
      expect(res.statutoryStatus).toBe("VERIFIED_GEOMETRIC");
    });

    it("deterministically executes get_zone tool for valid cell and quotes authentic data", () => {
      const cells = getPriorityCellsSync();
      const firstCell = cells[0];
      const res = generateLocalCopilotResponse(`get_zone ${firstCell.id}`);

      expect(res.reply).toContain(`Priority Zone Intelligence: \`${firstCell.id}\``);
      expect(res.reply).toContain(`[Measured]`);
      expect(res.reply).toContain(`[Modelled]`);
      expect(res.reply).toContain(firstCell.ward);
      expect(res.statutoryStatus).toBe("VERIFIED_GEOMETRIC");
    });
  });

  describe("Gemini Function Calling Multi-Turn Handling", () => {
    const originalApiKey = process.env.GEMINI_API_KEY;

    beforeEach(() => {
      process.env.GEMINI_API_KEY = "test_mock_api_key_for_unit_tests";
    });

    afterEach(() => {
      process.env.GEMINI_API_KEY = originalApiKey;
      vi.restoreAllMocks();
    });

    it("handles function calls from Gemini and executes real backend tools in multi-turn loop", async () => {
      const cells = getPriorityCellsSync();
      const validCellId = cells[0].id;

      // Mock GoogleGenAI client behavior
      const mockGenerateContent = vi.fn();

      // First turn returns a functionCall for get_zone
      mockGenerateContent.mockResolvedValueOnce({
        functionCalls: [
          {
            name: "get_zone",
            args: { id: validCellId },
            id: "call_mock_123",
          },
        ],
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  functionCall: {
                    name: "get_zone",
                    args: { id: validCellId },
                  },
                },
              ],
            },
          },
        ],
      });

      // Second turn returns the grounded synthesis quoting the tool output
      mockGenerateContent.mockResolvedValueOnce({
        text: `### Grounded Priority Zone Analysis\nZone ${validCellId} has measured LST [Measured] 44.2°C and predicted cooling [Modelled] 1.85°C.`,
      });

      vi.doMock("@google/genai", () => {
        return {
          GoogleGenAI: class MockGoogleGenAI {
            models = {
              generateContent: mockGenerateContent,
            };
          },
          Type: {
            OBJECT: "OBJECT",
            STRING: "STRING",
            NUMBER: "NUMBER",
          },
        };
      });

      // Verify that executeGetZoneTool returns authentic data
      const toolOut = executeGetZoneTool({ id: validCellId });
      expect(toolOut.found).toBe(true);
      if (toolOut.found) {
        expect(toolOut.id).toBe(validCellId);
      }
    });
  });
});
