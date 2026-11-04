import { describe, it, expect } from "vitest";
import { generateZoneDossierPdf } from "@/server/pdf/generate-zone-dossier-pdf";
import { getPriorityCellsSync, getPriorityModelCardSync, getCellEnsembleStats } from "@/server/priority/loader";
import { PriorityCell } from "@/server/priority/types";

describe("Zone Evidence Dossier PDF Generator", () => {
  it("should generate a valid PDF document for an authentic priority cell", async () => {
    const cells = getPriorityCellsSync();
    expect(cells.length).toBeGreaterThan(0);

    const zone = cells[0];
    const modelCard = getPriorityModelCardSync();
    const ensembleStats = getCellEnsembleStats(zone.id) || undefined;

    const enrichedZone = {
      ...zone,
      rank: 1,
      selection_frequency: 0.90,
    };

    const pdfBytes = await generateZoneDossierPdf({
      zone: enrichedZone,
      targetNdvi: 0.65,
      budgetHa: 10.0,
      modelCard,
      ensembleStats,
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    // Verify PDF header magic bytes: %PDF-
    const header = Buffer.from(pdfBytes.subarray(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("should handle null test cells with 'Not available' without throwing", async () => {
    const nullZone: PriorityCell = {
      id: "cell_null_test",
      centroid: [73.8567, 18.5204],
      ward: "Unassigned Ward",
      population: null,
      lst_mean: null,
      lst_std: null,
      n_obs: 0,
      ndvi: null,
      built_frac: null,
      greenable_ha: null,
      burden: null,
      cooling_mean: null,
      cooling_p10: null,
      cooling_p90: null,
    };

    const pdfBytes = await generateZoneDossierPdf({
      zone: nullZone,
      targetNdvi: 0.70,
      budgetHa: 5.0,
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    const header = Buffer.from(pdfBytes.subarray(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });
});
