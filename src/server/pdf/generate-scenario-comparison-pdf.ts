import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { ScenarioComparisonResult } from "../scenarios/types";

export async function generateScenarioComparisonPdf(
  comparison: ScenarioComparisonResult
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Executive Ranking, Metadata, and Impact Summary
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();
  let y = height - 40;

  // Header Bar
  page.drawRectangle({
    x: 30,
    y: y - 28,
    width: width - 60,
    height: 38,
    color: rgb(0.12, 0.44, 0.33), // UrjaSetu Emerald
  });

  page.drawText("URJASETU — SCENARIO IMPACT COMPARATOR", {
    x: 42,
    y: y - 14,
    size: 13,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText("MULTI-CANDIDATE INFRASTRUCTURE EVALUATION", {
    x: 42,
    y: y - 24,
    size: 7.5,
    font: helvetica,
    color: rgb(0.85, 0.95, 0.9),
  });

  page.drawText(
    comparison.scenarioName ? `Scenario: ${comparison.scenarioName}` : "Comparative Analysis",
    {
      x: width - 210,
      y: y - 18,
      size: 9,
      font: boldFont,
      color: rgb(1, 1, 1),
    }
  );

  y -= 45;

  // Metadata Card
  page.drawRectangle({
    x: 30,
    y: y - 48,
    width: width - 60,
    height: 48,
    color: rgb(0.96, 0.96, 0.95),
    borderColor: rgb(0.88, 0.88, 0.87),
    borderWidth: 1,
  });

  page.drawText(`Candidates Compared: ${comparison.candidates.length}`, {
    x: 42,
    y: y - 18,
    size: 9.5,
    font: boldFont,
    color: rgb(0.15, 0.15, 0.15),
  });

  page.drawText(
    `Mode: ${
      comparison.comparability.isCompatible
        ? "Identical Infrastructure Type (Direct Criteria Delta)"
        : "Cross-Type Comparison (Normalized Advisory)"
    }`,
    {
      x: 42,
      y: y - 32,
      size: 8,
      font: helvetica,
      color: rgb(0.35, 0.35, 0.35),
    }
  );

  page.drawText(`Generated: ${new Date(comparison.generatedAt).toLocaleString()}`, {
    x: 340,
    y: y - 18,
    size: 8,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });

  page.drawText("Engine: UrjaSetu Geospatial v1.0.0", {
    x: 340,
    y: y - 32,
    size: 8,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });

  y -= 62;

  // Executive Summary Box
  page.drawText("EXECUTIVE VERDICT & RECOMMENDATION", {
    x: 30,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0.12, 0.44, 0.33),
  });
  y -= 12;

  page.drawRectangle({
    x: 30,
    y: y - 45,
    width: width - 60,
    height: 45,
    color: rgb(0.98, 0.99, 0.98),
    borderColor: rgb(0.8, 0.9, 0.84),
    borderWidth: 1,
  });

  // Split summary across lines
  const summaryWords = comparison.executiveSummary.split(" ");
  let line = "";
  let textY = y - 14;
  for (const word of summaryWords) {
    if ((line + word).length > 85) {
      page.drawText(line, { x: 38, y: textY, size: 8.5, font: helvetica, color: rgb(0.1, 0.2, 0.15) });
      line = word + " ";
      textY -= 12;
      if (textY < y - 40) break;
    } else {
      line += word + " ";
    }
  }
  if (line && textY >= y - 40) {
    page.drawText(line, { x: 38, y: textY, size: 8.5, font: helvetica, color: rgb(0.1, 0.2, 0.15) });
  }

  y -= 58;

  // Candidate Ranking Table
  page.drawText("CANDIDATE RANKINGS & CONSTRAINT AUDIT", {
    x: 30,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0.12, 0.44, 0.33),
  });
  y -= 14;

  // Table header
  page.drawRectangle({
    x: 30,
    y: y - 18,
    width: width - 60,
    height: 18,
    color: rgb(0.9, 0.92, 0.9),
  });

  page.drawText("RANK", { x: 36, y: y - 13, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("CANDIDATE SITE", { x: 75, y: y - 13, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("TYPE", { x: 230, y: y - 13, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("SCORE", { x: 310, y: y - 13, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("CONSTRAINTS", { x: 380, y: y - 13, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("WINS", { x: 490, y: y - 13, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });

  y -= 20;

  // Table rows
  for (const r of comparison.ranking.slice(0, 6)) {
    const rowHeight = 22;
    page.drawRectangle({
      x: 30,
      y: y - rowHeight,
      width: width - 60,
      height: rowHeight,
      color: r.rank % 2 === 0 ? rgb(0.98, 0.98, 0.98) : rgb(1, 1, 1),
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 0.5,
    });

    page.drawText(`#${r.rank}`, {
      x: 38,
      y: y - 15,
      size: 9,
      font: boldFont,
      color: r.rank === 1 ? rgb(0.12, 0.44, 0.33) : rgb(0.3, 0.3, 0.3),
    });

    page.drawText(r.label.length > 25 ? r.label.substring(0, 24) + "..." : r.label, {
      x: 75,
      y: y - 15,
      size: 8,
      font: helvetica,
      color: rgb(0.1, 0.1, 0.1),
    });

    page.drawText(r.type, {
      x: 230,
      y: y - 15,
      size: 8,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });

    page.drawText(`${r.overallScore}/100`, {
      x: 310,
      y: y - 15,
      size: 8.5,
      font: boldFont,
      color: r.overallScore >= 75 ? rgb(0.12, 0.44, 0.33) : rgb(0.6, 0.3, 0.1),
    });

    page.drawText(
      r.hasMandatoryViolation ? `VIOLATION (${r.mandatoryViolationsCount})` : "Passed (0)",
      {
        x: 380,
        y: y - 15,
        size: 8,
        font: boldFont,
        color: r.hasMandatoryViolation ? rgb(0.8, 0.2, 0.2) : rgb(0.12, 0.44, 0.33),
      }
    );

    page.drawText(`${r.winningCriteriaCount} criteria`, {
      x: 490,
      y: y - 15,
      size: 8,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2),
    });

    y -= rowHeight;
  }

  y -= 18;

  // Spatial Impact & Proxy Assessment Box
  page.drawText("SPATIAL & DOMAIN IMPACT SIMULATION", {
    x: 30,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0.12, 0.44, 0.33),
  });
  y -= 14;

  for (const cand of comparison.candidates.slice(0, 3)) {
    const boxHeight = 44;
    page.drawRectangle({
      x: 30,
      y: y - boxHeight,
      width: width - 60,
      height: boxHeight,
      color: rgb(0.96, 0.97, 0.98),
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 1,
    });

    page.drawText(`Candidate: ${cand.label} (${cand.type})`, {
      x: 40,
      y: y - 14,
      size: 8.5,
      font: boldFont,
      color: rgb(0.1, 0.2, 0.3),
    });

    page.drawText(
      `Arterial Access: ${
        cand.impacts.arterialDistanceM !== null ? `${cand.impacts.arterialDistanceM}m` : "N/A"
      } (${cand.impacts.accessQuality})   |   Spatial Footprint: ${cand.footprintAreaM2.toLocaleString()} m²`,
      {
        x: 40,
        y: y - 26,
        size: 8,
        font: helvetica,
        color: rgb(0.3, 0.3, 0.3),
      }
    );

    const solarInfo =
      cand.type === "Solar Farm" && cand.impacts.solarPotentialAnnualMwh !== null
        ? `   |   Solar Screening Yield: ~${cand.impacts.solarPotentialAnnualMwh} MWh/yr`
        : "";

    page.drawText(
      `Euclidean Catchment: ${cand.impacts.serviceCatchmentProxy.nearbyAmenitiesCount} facilities in 500m radius${solarInfo}`,
      {
        x: 40,
        y: y - 37,
        size: 7.5,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      }
    );

    y -= boxHeight + 8;
  }

  // Key Tradeoffs
  if (comparison.baselineComparison.keyTradeoffs.length > 0) {
    y -= 6;
    page.drawText("KEY TRADE-OFFS & SEPARATION", {
      x: 30,
      y,
      size: 9.5,
      font: boldFont,
      color: rgb(0.12, 0.44, 0.33),
    });
    y -= 12;

    for (const trade of comparison.baselineComparison.keyTradeoffs.slice(0, 3)) {
      page.drawText(`• ${trade.length > 95 ? trade.substring(0, 94) + "..." : trade}`, {
        x: 35,
        y: y - 8,
        size: 7.5,
        font: helvetica,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 14;
    }
  }

  // Page 2: Detailed Criterion Differential Matrix & Disclaimers
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  let y2 = height - 40;

  // Page 2 Header
  page2.drawRectangle({
    x: 30,
    y: y2 - 20,
    width: width - 60,
    height: 25,
    color: rgb(0.92, 0.94, 0.93),
  });

  page2.drawText("CRITERION-LEVEL DIFFERENTIAL MATRIX", {
    x: 42,
    y: y2 - 13,
    size: 11,
    font: boldFont,
    color: rgb(0.12, 0.44, 0.33),
  });

  y2 -= 35;

  // Criteria Table Header
  page2.drawRectangle({
    x: 30,
    y: y2 - 18,
    width: width - 60,
    height: 18,
    color: rgb(0.88, 0.9, 0.88),
  });

  page2.drawText("CRITERION", { x: 36, y: y2 - 13, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page2.drawText("WT", { x: 190, y: y2 - 13, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page2.drawText("CANDIDATE VALUES / SCORES", { x: 230, y: y2 - 13, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page2.drawText("DELTA", { x: 440, y: y2 - 13, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page2.drawText("LEADER", { x: 495, y: y2 - 13, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });

  y2 -= 20;

  // Criteria Rows
  for (const crit of comparison.criteriaMatrix.slice(0, 14)) {
    const rowH = 26;
    page2.drawRectangle({
      x: 30,
      y: y2 - rowH,
      width: width - 60,
      height: rowH,
      color: rgb(0.99, 0.99, 0.99),
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 0.5,
    });

    page2.drawText(crit.label.length > 25 ? crit.label.substring(0, 24) + "..." : crit.label, {
      x: 36,
      y: y2 - 12,
      size: 8,
      font: boldFont,
      color: rgb(0.15, 0.15, 0.15),
    });

    page2.drawText(crit.benchmark.length > 30 ? crit.benchmark.substring(0, 29) + "..." : crit.benchmark, {
      x: 36,
      y: y2 - 21,
      size: 6.5,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });

    page2.drawText(`${crit.weight}%`, {
      x: 190,
      y: y2 - 15,
      size: 8,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Draw candidate scores inline
    let cX = 230;
    comparison.candidates.slice(0, 2).forEach((cand) => {
      const v = crit.valuesByPlacement[cand.placementId];
      const scText = v ? `${v.score ?? "--"}/100` : "--";
      page2.drawText(`${cand.label.substring(0, 10)}: ${scText}`, {
        x: cX,
        y: y2 - 15,
        size: 7.5,
        font: helvetica,
        color: rgb(0.2, 0.2, 0.2),
      });
      cX += 105;
    });

    page2.drawText(`${crit.deltaScore} pts`, {
      x: 440,
      y: y2 - 15,
      size: 8,
      font: boldFont,
      color: crit.deltaScore > 15 ? rgb(0.12, 0.44, 0.33) : rgb(0.4, 0.4, 0.4),
    });

    const winningCand = comparison.candidates.find((c) => c.placementId === crit.bestPlacementId);
    page2.drawText(winningCand ? winningCand.label.substring(0, 10) : "Tie", {
      x: 495,
      y: y2 - 15,
      size: 7.5,
      font: helvetica,
      color: rgb(0.1, 0.3, 0.2),
    });

    y2 -= rowH;
  }

  y2 -= 20;

  // Legal & Geotechnical Disclaimers
  page2.drawRectangle({
    x: 30,
    y: y2 - 75,
    width: width - 60,
    height: 75,
    color: rgb(0.96, 0.96, 0.96),
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 1,
  });

  page2.drawText("DATA PROVENANCE & METHODOLOGICAL DISCLAIMERS", {
    x: 40,
    y: y2 - 14,
    size: 8,
    font: boldFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  page2.drawText(
    "1. Service Catchment: Proximity calculations use straight-line Euclidean distance proxies. They do NOT calculate census population counts, demographic service equity, or dynamic travel routing.",
    { x: 40, y: y2 - 27, size: 7, font: helvetica, color: rgb(0.4, 0.4, 0.4) }
  );

  page2.drawText(
    "2. Authoritative Datasets: OpenStreetMap (ODbL 1.0), Open-Meteo Weather APIs, and NASA POWER solar climatology. Features reflect community and satellite mapping at retrieval time.",
    { x: 40, y: y2 - 40, size: 7, font: helvetica, color: rgb(0.4, 0.4, 0.4) }
  );

  page2.drawText(
    "3. Engineering & Legal Status: This decision-support comparison is for preliminary spatial planning and screening. It does not replace on-site geotechnical testing, utility locates, or environmental review.",
    { x: 40, y: y2 - 53, size: 7, font: helvetica, color: rgb(0.4, 0.4, 0.4) }
  );

  page2.drawText(
    "4. Modeled vs Observed: Distinguish modeled geospatial simulations from actual civil outcomes. UrjaSetu Decision Support System.",
    { x: 40, y: y2 - 66, size: 7, font: helvetica, color: rgb(0.4, 0.4, 0.4) }
  );

  return await pdfDoc.save();
}
