import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuthUser } from "@/server/auth/session";
import { errorResponse, handleRouteError } from "@/server/utils/response";
import { generateReportPdf } from "@/server/pdf/generate-report-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser(req);

    const analysis = await prisma.analysis.findFirst({
      where: { id: params.id, userId: user.userId },
    });

    if (!analysis) {
      return errorResponse("Analysis report not found", "NOT_FOUND", 404);
    }

    const report = JSON.parse(analysis.result);
    const pdfBytes = await generateReportPdf(report);

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="UrjaSetu-Report-${report.placementSnapshot.type}-${params.id.substring(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthUser(req);
    const body = await req.json().catch(() => ({}));
    const mapPngBase64 = body.mapImage;

    const analysis = await prisma.analysis.findFirst({
      where: { id: params.id, userId: user.userId },
    });

    if (!analysis) {
      return errorResponse("Analysis report not found", "NOT_FOUND", 404);
    }

    const report = JSON.parse(analysis.result);
    const pdfBytes = await generateReportPdf(report, mapPngBase64);

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="UrjaSetu-Report-${report.placementSnapshot.type}-${params.id.substring(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
