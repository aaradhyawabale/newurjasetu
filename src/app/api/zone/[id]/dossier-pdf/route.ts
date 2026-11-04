import { NextRequest, NextResponse } from "next/server";
import { getPriorityCellByIdSync, getModelCardSync, getCellEnsembleStats } from "@/server/priority/loader";
import { generateZoneDossierPdf } from "@/server/pdf/generate-zone-dossier-pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const targetNdvi = parseFloat(searchParams.get("target_ndvi") || "0.65");
    const budgetHa = parseFloat(searchParams.get("budget_ha") || "10.0");
    const rankStr = searchParams.get("rank");
    const freqStr = searchParams.get("selection_frequency");

    const zone = getPriorityCellByIdSync(id);
    if (!zone) {
      return NextResponse.json(
        { error: `Priority zone not found with ID: ${id}` },
        { status: 404 }
      );
    }

    const ensembleStats = getCellEnsembleStats(id) || undefined;
    const modelCard = getModelCardSync() || undefined;

    const enrichedZone = {
      ...zone,
      rank: rankStr ? parseInt(rankStr, 10) : undefined,
      selection_frequency: freqStr ? parseFloat(freqStr) : undefined,
    };

    const pdfBytes = await generateZoneDossierPdf({
      zone: enrichedZone,
      targetNdvi,
      budgetHa,
      modelCard,
      ensembleStats,
    });

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="UrjaSetu-Zone-Dossier-${zone.id}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating zone dossier PDF:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate zone dossier PDF" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const targetNdvi = typeof body.target_ndvi === "number" ? body.target_ndvi : 0.65;
    const budgetHa = typeof body.budget_ha === "number" ? body.budget_ha : 10.0;
    const rank = typeof body.rank === "number" ? body.rank : undefined;
    const selection_frequency = typeof body.selection_frequency === "number" ? body.selection_frequency : undefined;

    const zone = getPriorityCellByIdSync(id);
    if (!zone) {
      return NextResponse.json(
        { error: `Priority zone not found with ID: ${id}` },
        { status: 404 }
      );
    }

    const ensembleStats = getCellEnsembleStats(id) || undefined;
    const modelCard = getModelCardSync() || undefined;

    const enrichedZone = {
      ...zone,
      rank,
      selection_frequency,
    };

    const pdfBytes = await generateZoneDossierPdf({
      zone: enrichedZone,
      targetNdvi,
      budgetHa,
      modelCard,
      ensembleStats,
    });

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="UrjaSetu-Zone-Dossier-${zone.id}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating zone dossier PDF:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate zone dossier PDF" },
      { status: 500 }
    );
  }
}
