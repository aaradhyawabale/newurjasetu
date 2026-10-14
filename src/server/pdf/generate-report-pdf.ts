import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { AnalysisReportResult } from "../analysis-engine/engine";

export async function generateReportPdf(
  report: AnalysisReportResult,
  mapPngBase64?: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const timesRoman = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Overview & Map & Executive Verdict
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();
  let y = height - 40;

  // Header Bar
  page.drawRectangle({
    x: 30,
    y: y - 25,
    width: width - 60,
    height: 35,
    color: rgb(0.12, 0.44, 0.33), // UrjaSetu Accent Green #1F6F54
  });

  page.drawText("URJASETU — INFRASTRUCTURE SITING REPORT", {
    x: 42,
    y: y - 13,
    size: 14,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText("DECISION SUPPORT SYSTEM", {
    x: width - 180,
    y: y - 12,
    size: 8,
    font: boldFont,
    color: rgb(0.85, 0.95, 0.9),
  });

  y -= 45;

  // Metadata Card
  page.drawRectangle({
    x: 30,
    y: y - 45,
    width: width - 60,
    height: 45,
    color: rgb(0.96, 0.96, 0.95),
    borderColor: rgb(0.88, 0.88, 0.87),
    borderWidth: 1,
  });

  page.drawText(`Type: ${report.placementSnapshot.type}`, {
    x: 42,
    y: y - 18,
    size: 11,
    font: boldFont,
    color: rgb(0.11, 0.11, 0.1),
  });

  page.drawText(
    `Coordinates: ${report.placementSnapshot.lat.toFixed(5)}, ${report.placementSnapshot.lng.toFixed(5)}`,
    {
      x: 42,
      y: y - 34,
      size: 9,
      font: timesRoman,
      color: rgb(0.4, 0.4, 0.38),
    }
  );

  page.drawText(
    `Footprint: ${report.placementSnapshot.lengthM}m × ${report.placementSnapshot.widthM}m (${report.placementSnapshot.areaM2.toLocaleString()} m²)`,
    {
      x: 250,
      y: y - 18,
      size: 9,
      font: timesRoman,
      color: rgb(0.2, 0.2, 0.2),
    }
  );

  page.drawText(`Generated: ${new Date(report.timestamp).toLocaleString()}`, {
    x: 250,
    y: y - 34,
    size: 8,
    font: timesRoman,
    color: rgb(0.4, 0.4, 0.38),
  });

  page.drawText(`Score: ${report.overall.score} / 100`, {
    x: 440,
    y: y - 18,
    size: 13,
    font: boldFont,
    color: rgb(0.12, 0.44, 0.33),
  });

  page.drawText(`${report.overall.band.toUpperCase()}`, {
    x: 440,
    y: y - 33,
    size: 8,
    font: boldFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  y -= 60;

  // Embedded Map Image (if provided)
  if (mapPngBase64) {
    try {
      const cleanBase64 = mapPngBase64.replace(/^data:image\/(png|jpeg);base64,/, "");
      const imageBytes = Buffer.from(cleanBase64, "base64");
      const embeddedImage = await pdfDoc.embedPng(imageBytes);

      const mapHeight = 180;
      page.drawImage(embeddedImage, {
        x: 30,
        y: y - mapHeight,
        width: width - 60,
        height: mapHeight,
      });

      // Attribution banner on map
      page.drawRectangle({
        x: 30,
        y: y - mapHeight,
        width: width - 60,
        height: 14,
        color: rgb(0.96, 0.96, 0.96),
      });

      page.drawText("© OpenStreetMap contributors | MapLibre GL", {
        x: 36,
        y: y - mapHeight + 3,
        size: 7,
        font: timesRoman,
        color: rgb(0.3, 0.3, 0.3),
      });

      y -= mapHeight + 15;
    } catch (imgErr) {
      console.warn("[PDF Map Image Embed Error]", imgErr);
    }
  }

  // Verdict Summary Section
  page.drawText("EXECUTIVE VERDICT & NARRATIVE", {
    x: 30,
    y: y,
    size: 10,
    font: boldFont,
    color: rgb(0.12, 0.44, 0.33),
  });
  y -= 14;

  const summaryLines = wrapText(report.overall.verdictSummary + " " + report.narrativeText, 95);
  for (const line of summaryLines.slice(0, 4)) {
    page.drawText(line, {
      x: 30,
      y,
      size: 8.5,
      font: timesRoman,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 12;
  }
  y -= 8;

  // Key Supporting Factors & Risks Columns
  const colWidth = (width - 70) / 2;

  // Supporting Box
  page.drawRectangle({
    x: 30,
    y: y - 85,
    width: colWidth,
    height: 85,
    color: rgb(0.95, 0.98, 0.96),
    borderColor: rgb(0.8, 0.92, 0.85),
    borderWidth: 1,
  });

  page.drawText("KEY SUPPORTING FACTORS", {
    x: 38,
    y: y - 14,
    size: 8,
    font: boldFont,
    color: rgb(0.12, 0.44, 0.33),
  });

  let supY = y - 28;
  for (const sup of report.supporting.slice(0, 3)) {
    const wrapped = wrapText(`• ${sup}`, 45);
    for (const wLine of wrapped.slice(0, 2)) {
      page.drawText(wLine, {
        x: 38,
        y: supY,
        size: 7.5,
        font: timesRoman,
        color: rgb(0.2, 0.2, 0.2),
      });
      supY -= 10;
    }
  }

  // Risks Box
  page.drawRectangle({
    x: 40 + colWidth,
    y: y - 85,
    width: colWidth,
    height: 85,
    color: rgb(0.99, 0.97, 0.97),
    borderColor: rgb(0.95, 0.82, 0.82),
    borderWidth: 1,
  });

  page.drawText("RISKS & CONSTRAINTS", {
    x: 48 + colWidth,
    y: y - 14,
    size: 8,
    font: boldFont,
    color: rgb(0.7, 0.15, 0.15),
  });

  let riskY = y - 28;
  for (const rsk of report.risks.slice(0, 3)) {
    const wrapped = wrapText(`• ${rsk}`, 45);
    for (const wLine of wrapped.slice(0, 2)) {
      page.drawText(wLine, {
        x: 48 + colWidth,
        y: riskY,
        size: 7.5,
        font: timesRoman,
        color: rgb(0.3, 0.1, 0.1),
      });
      riskY -= 10;
    }
  }

  y -= 100;

  // Criteria Scorecard Header
  page.drawText("CRITERIA SCORECARD (HEURISTIC BENCHMARKS)", {
    x: 30,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0.12, 0.44, 0.33),
  });
  y -= 15;

  // Table header
  page.drawRectangle({
    x: 30,
    y: y - 16,
    width: width - 60,
    height: 16,
    color: rgb(0.92, 0.92, 0.91),
  });

  page.drawText("CRITERION", { x: 36, y: y - 11, size: 7.5, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("MEASURED VALUE", { x: 190, y: y - 11, size: 7.5, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("SCORE", { x: 310, y: y - 11, size: 7.5, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("WEIGHT", { x: 360, y: y - 11, size: 7.5, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("STATUS", { x: 415, y: y - 11, size: 7.5, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("BENCHMARK", { x: 475, y: y - 11, size: 7.5, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  y -= 18;

  // Rows
  for (let i = 0; i < report.criteria.length; i++) {
    const c = report.criteria[i];
    if (y < 70) {
      // Add page 2 if needed
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - 40;
    }

    const rowBg = i % 2 === 0 ? rgb(0.99, 0.99, 0.99) : rgb(0.96, 0.96, 0.95);
    page.drawRectangle({
      x: 30,
      y: y - 15,
      width: width - 60,
      height: 15,
      color: rowBg,
    });

    page.drawText(c.label.substring(0, 30), { x: 36, y: y - 11, size: 7, font: timesRoman, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(c.value.substring(0, 22), { x: 190, y: y - 11, size: 7, font: timesRoman, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(
      c.score !== null && c.score !== undefined ? `${c.score}/100` : "N/A",
      { x: 310, y: y - 11, size: 7, font: boldFont, color: rgb(0.12, 0.44, 0.33) }
    );
    page.drawText(`${Math.round(c.weight * 100)}%`, { x: 360, y: y - 11, size: 7, font: timesRoman, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(c.status.toUpperCase(), { x: 415, y: y - 11, size: 6.5, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(c.benchmark.substring(0, 24), { x: 475, y: y - 11, size: 6, font: timesRoman, color: rgb(0.4, 0.4, 0.4) });

    y -= 16;
  }

  const ensureSpace = (neededHeight: number) => {
    if (y - neededHeight < 45) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - 45;
    }
  };

  // Engineering & Planning Recommendations
  if (report.recommendations && report.recommendations.length > 0) {
    y -= 12;
    ensureSpace(65);
    page.drawText("ENGINEERING & PLANNING RECOMMENDATIONS", {
      x: 30,
      y,
      size: 9,
      font: boldFont,
      color: rgb(0.12, 0.44, 0.33),
    });
    y -= 12;

    for (const rec of report.recommendations.slice(0, 4)) {
      const recLines = wrapText(`• ${rec}`, 95);
      ensureSpace(recLines.length * 10 + 4);
      for (const rLine of recLines) {
        page.drawText(rLine, {
          x: 34,
          y,
          size: 7.5,
          font: timesRoman,
          color: rgb(0.18, 0.18, 0.18),
        });
        y -= 10;
      }
    }
  }

  // Sensitivity Analysis & Weight Profiles
  if (report.sensitivity) {
    y -= 12;
    ensureSpace(60);
    page.drawText("SENSITIVITY ANALYSIS (ALTERNATIVE MCDA WEIGHT PROFILES)", {
      x: 30,
      y,
      size: 9,
      font: boldFont,
      color: rgb(0.12, 0.44, 0.33),
    });
    y -= 11;

    const sensSummaryLines = wrapText(
      `Rank Stability: ${report.sensitivity.rankStability.toUpperCase()} — ${report.sensitivity.sensitivitySummary}`,
      95
    );
    for (const sLine of sensSummaryLines) {
      page.drawText(sLine, {
        x: 34,
        y,
        size: 7.5,
        font: timesRoman,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 9.5;
    }

    // Profile pill summaries
    y -= 2;
    ensureSpace(20);
    let profX = 34;
    for (const prof of report.sensitivity.profiles.slice(0, 3)) {
      const profText = `${prof.profileName}: ${prof.score}/100 (${prof.scoreDeltaFromBaseline >= 0 ? `+${prof.scoreDeltaFromBaseline}` : prof.scoreDeltaFromBaseline} pts)`;
      page.drawText(profText, {
        x: profX,
        y,
        size: 7,
        font: boldFont,
        color: rgb(0.15, 0.35, 0.25),
      });
      profX += 175;
    }
    y -= 10;
  }

  // Calculation Assumptions & Evidence Provenance
  if (report.assumptions && report.assumptions.length > 0) {
    y -= 10;
    ensureSpace(55);
    page.drawText("CALCULATION ASSUMPTIONS & EVIDENCE PROVENANCE", {
      x: 30,
      y,
      size: 8.5,
      font: boldFont,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 11;

    for (const assump of report.assumptions.slice(0, 3)) {
      const aLines = wrapText(`- ${assump}`, 100);
      ensureSpace(aLines.length * 9 + 4);
      for (const aLine of aLines) {
        page.drawText(aLine, {
          x: 34,
          y,
          size: 7,
          font: timesRoman,
          color: rgb(0.35, 0.35, 0.35),
        });
        y -= 9;
      }
    }

    for (const ev of report.evidence.slice(0, 4)) {
      ensureSpace(12);
      const evLine = `[${ev.id}] ${ev.provider} (${ev.qualityStatus || "verified"}) — ${ev.summary}`;
      page.drawText(evLine.substring(0, 108), {
        x: 34,
        y,
        size: 6.5,
        font: timesRoman,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= 9;
    }
  }

  y -= 10;
  ensureSpace(55);

  // Limitations and Statutory Disclaimer at bottom
  page.drawText("METHODOLOGY & STATUTORY DISCLAIMER", {
    x: 30,
    y,
    size: 8,
    font: boldFont,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 10;

  for (const lim of report.limitations.slice(0, 3)) {
    page.drawText(`* ${lim}`, {
      x: 30,
      y,
      size: 6.5,
      font: timesRoman,
      color: rgb(0.45, 0.45, 0.45),
    });
    y -= 9;
  }

  // Footer attribution
  page.drawText(
    "UrjaSetu is an indicative decision-support tool. Base map & feature data: © OpenStreetMap contributors. Elevation: Copernicus DEM via Open-Meteo. Solar: NASA POWER.",
    {
      x: 30,
      y: 20,
      size: 6.5,
      font: timesRoman,
      color: rgb(0.5, 0.5, 0.5),
    }
  );

  return pdfDoc.save();
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";

  for (const w of words) {
    if ((cur + " " + w).trim().length > maxCharsPerLine) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur += " " + w;
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}
