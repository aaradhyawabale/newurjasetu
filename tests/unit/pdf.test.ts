import { describe, it, expect } from "vitest";
import { generateReportPdf } from "@/server/pdf/generate-report-pdf";
import { AnalysisReportResult } from "@/server/analysis-engine/engine";

describe("PDF Report Generator", () => {
  const dummyReport: AnalysisReportResult = {
    engineVersion: "1.0.0",
    timestamp: new Date().toISOString(),
    placementSnapshot: {
      id: "plc_123",
      type: "Hospital",
      lat: 28.6139,
      lng: 77.2090,
      lengthM: 120,
      widthM: 80,
      bearingDeg: 30,
      areaM2: 9600,
      params: { bedCapacity: 300 },
      label: "Hospital in New Delhi",
    },
    validation: {
      status: "pass",
      proposedAreaM2: 9600,
      allowedAreaRange: { minM2: 2500, maxM2: 50000, reason: "Site clear" },
      conflicts: [],
      messages: [],
    },
    criteria: [
      {
        id: "arterial_access",
        label: "Arterial Road Proximity",
        value: "85 m",
        rawMetric: 85,
        score: 95,
        weight: 0.25,
        status: "optimal",
        benchmark: "Distance < 400m (NEEDS VERIFICATION)",
        evidenceIds: ["evd_1"],
        description: "Emergency vehicles require swift access.",
      },
    ],
    overall: {
      score: 88,
      band: "High Suitability",
      tone: "positive",
      confidence: 100,
      verdictSummary: "Strongly supported location.",
    },
    supporting: ["Arterial road frontage at 85m.", "Quiet acoustic zone."],
    risks: ["Routine utility connection application required."],
    dataGaps: [],
    evidence: [
      {
        id: "evd_1",
        provider: "OpenStreetMap",
        params: {},
        retrievedAt: new Date().toISOString(),
        summary: "Mapped features query.",
      },
    ],
    limitations: ["Indicative heuristics only.", "Not statutory clearance."],
    narrativeText: "UrjaSetu evaluation indicates High Suitability score of 88/100.",
  };

  it("generates a valid, non-empty PDF byte buffer", async () => {
    const pdfBytes = await generateReportPdf(dummyReport);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    // Verify PDF header %PDF-
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString("utf-8");
    expect(header).toBe("%PDF-");
  });
});
