import { describe, it, expect } from "vitest";
import { GET, POST } from "@/app/api/zone/[id]/dossier-pdf/route";
import { NextRequest } from "next/server";
import { getPriorityCellsSync } from "@/server/priority/loader";

describe("GET /api/zone/[id]/dossier-pdf", () => {
  it("should return a 200 Response with application/pdf for a valid cell", async () => {
    const cells = getPriorityCellsSync();
    expect(cells.length).toBeGreaterThan(0);
    const cellId = cells[0].id;

    const req = new NextRequest(`http://localhost:3000/api/zone/${cellId}/dossier-pdf?target_ndvi=0.65&budget_ha=10.0&rank=1`);
    const paramsPromise = Promise.resolve({ id: cellId });

    const response = await GET(req, { params: paramsPromise });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain(`UrjaSetu-Zone-Dossier-${cellId}.pdf`);

    const arrayBuffer = await response.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(1000);

    const header = Buffer.from(arrayBuffer.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("should return 404 for an invalid cell ID", async () => {
    const req = new NextRequest("http://localhost:3000/api/zone/nonexistent_cell_9999/dossier-pdf");
    const paramsPromise = Promise.resolve({ id: "nonexistent_cell_9999" });

    const response = await GET(req, { params: paramsPromise });
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toContain("not found");
  });

  it("should handle POST request with json body parameters", async () => {
    const cells = getPriorityCellsSync();
    const cellId = cells[0].id;

    const req = new NextRequest(`http://localhost:3000/api/zone/${cellId}/dossier-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_ndvi: 0.70,
        budget_ha: 15.0,
        rank: 2,
        selection_frequency: 0.85,
      }),
    });
    const paramsPromise = Promise.resolve({ id: cellId });

    const response = await POST(req, { params: paramsPromise });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
  });
});
