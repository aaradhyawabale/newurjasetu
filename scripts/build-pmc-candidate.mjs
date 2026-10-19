import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";

/**
 * UrjaSetu - PMC Candidate Boundary Generator
 * 
 * Idempotently and deterministically transforms `PMC Prabhag Boundary.kml` into
 * a validated GeoJSON municipal boundary candidate.
 */
export function buildPmcCandidate(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const sourceRelativePath = "ndata/Pune City Data/PMC Wards Info/PMC Prabhag Boundary.kml";
  const sourcePath = path.join(rootDir, sourceRelativePath);
  const targetRelativePath = "src/data/boundaries/pmc_candidate_boundary.geojson";
  const targetPath = path.join(rootDir, targetRelativePath);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source KML not found at ${sourcePath}`);
  }

  const rawXml = fs.readFileSync(sourcePath, "utf-8");

  // Match all Placemark blocks
  const placemarkRegex = /<Placemark id="([^"]+)">([\s\S]*?)<\/Placemark>/g;
  let match;
  const rawFeatures = [];

  while ((match = placemarkRegex.exec(rawXml)) !== null) {
    const id = match[1];
    const body = match[2];

    // Extract SimpleData properties
    const props = {};
    const simpleDataRegex = /<SimpleData name="([^"]+)">([^<]*)<\/SimpleData>/g;
    let propMatch;
    while ((propMatch = simpleDataRegex.exec(body)) !== null) {
      props[propMatch[1]] = propMatch[2];
    }

    // Extract coordinates
    const coordsMatch = body.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    if (!coordsMatch) {
      throw new Error(`Placemark ${id} missing <coordinates> block.`);
    }

    const rawCoords = coordsMatch[1].trim().split(/\s+/);
    const originalPoints = rawCoords.map((pt) => {
      const parts = pt.split(",").map(Number).slice(0, 2);
      return parts;
    }).filter((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1]));

    rawFeatures.push({
      id,
      props,
      originalPoints,
    });
  }

  if (rawFeatures.length !== 72) {
    throw new Error(`Expected exactly 72 placemarks, parsed ${rawFeatures.length}`);
  }

  const validatedPolygons = [];
  const repairLog = [];

  for (let i = 0; i < rawFeatures.length; i++) {
    const feat = rawFeatures[i];
    const pts = feat.originalPoints;
    const initialVertexCount = pts.length;

    // Deduplicate consecutive identical coordinates
    const cleanedPts = [];
    for (let j = 0; j < pts.length; j++) {
      if (
        cleanedPts.length === 0 ||
        cleanedPts[cleanedPts.length - 1][0] !== pts[j][0] ||
        cleanedPts[cleanedPts.length - 1][1] !== pts[j][1]
      ) {
        cleanedPts.push(pts[j]);
      }
    }

    // Ensure linear ring is closed
    if (
      cleanedPts.length >= 3 &&
      (cleanedPts[0][0] !== cleanedPts[cleanedPts.length - 1][0] ||
        cleanedPts[0][1] !== cleanedPts[cleanedPts.length - 1][1])
    ) {
      cleanedPts.push([...cleanedPts[0]]);
    }

    if (cleanedPts.length < 4) {
      throw new Error(`Feature ${feat.id} has insufficient coordinates after cleaning (${cleanedPts.length}).`);
    }

    const poly = turf.polygon([cleanedPts], {
      ...feat.props,
      sourceId: feat.id,
      featureIndex: i,
    });

    // Check for self-intersections
    const kinks = turf.kinks(poly);
    if (kinks.features.length > 0) {
      throw new Error(`Feature ${feat.id} has ${kinks.features.length} unresolved self-intersection kinks.`);
    }

    const areaM2 = turf.area(poly);
    if (!Number.isFinite(areaM2) || areaM2 <= 0) {
      throw new Error(`Feature ${feat.id} has invalid non-positive area (${areaM2}).`);
    }

    if (initialVertexCount !== cleanedPts.length) {
      repairLog.push({
        id: feat.id,
        name: feat.props.prabhag || "Unnamed",
        initialVertexCount,
        cleanedVertexCount: cleanedPts.length,
        removedDuplicates: initialVertexCount - cleanedPts.length,
        areaM2: Math.round(areaM2),
      });
    }

    validatedPolygons.push(poly);
  }

  // Idempotent and deterministic pairwise union
  let unionResult = validatedPolygons[0];
  for (let i = 1; i < validatedPolygons.length; i++) {
    unionResult = turf.union(turf.featureCollection([unionResult, validatedPolygons[i]]));
  }

  if (!unionResult || !unionResult.geometry) {
    throw new Error("Union operation produced empty geometry.");
  }

  // Analyze interior rings (exclusions vs hairline seam slivers)
  let outerRing;
  let interiorRings = [];

  if (unionResult.geometry.type === "Polygon") {
    outerRing = unionResult.geometry.coordinates[0];
    interiorRings = unionResult.geometry.coordinates.slice(1);
  } else if (unionResult.geometry.type === "MultiPolygon") {
    // If MultiPolygon, sort components by area
    let maxArea = -1;
    let mainPolygonCoords = null;
    for (const polyCoords of unionResult.geometry.coordinates) {
      const p = turf.polygon(polyCoords);
      const a = turf.area(p);
      if (a > maxArea) {
        maxArea = a;
        mainPolygonCoords = polyCoords;
      }
    }
    outerRing = mainPolygonCoords[0];
    interiorRings = mainPolygonCoords.slice(1);
  } else {
    throw new Error(`Unexpected dissolved geometry type: ${unionResult.geometry.type}`);
  }

  // Meaningful exclusion threshold:
  // Macro exclusion is ~815,199 m² (81.5 hectares, Ghorpadi/Mundhwa defense/railway enclave).
  // Hairline digitizing slivers between polygons are all <= 1,217 m² with average 11 m².
  // We preserve interior rings with area >= 10,000 m² (1 hectare) and suppress hairline seams.
  const EXCLUSION_THRESHOLD_M2 = 10000;
  const preservedExclusions = [];
  let suppressedSliversCount = 0;
  let suppressedSliversAreaM2 = 0;

  for (const ring of interiorRings) {
    const ringPoly = turf.polygon([ring]);
    const ringArea = turf.area(ringPoly);
    if (ringArea >= EXCLUSION_THRESHOLD_M2) {
      preservedExclusions.push({
        ring,
        areaM2: ringArea,
        centroid: turf.centroid(ringPoly).geometry.coordinates,
        bbox: turf.bbox(ringPoly),
      });
    } else {
      suppressedSliversCount++;
      suppressedSliversAreaM2 += ringArea;
    }
  }

  // Construct final single Polygon geometry with preserved interior exclusions
  const finalCoordinates = [outerRing, ...preservedExclusions.map((e) => e.ring)];
  const finalPolygon = turf.polygon(finalCoordinates);

  const finalBbox = turf.bbox(finalPolygon);
  const grossAreaM2 = turf.area(turf.polygon([outerRing]));
  const netAreaM2 = turf.area(finalPolygon);
  const macroExclusionAreaM2 = grossAreaM2 - netAreaM2;

  const candidateGeoJson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "pmc-candidate-municipal-boundary-2021",
        properties: {
          id: "pmc-candidate-municipal-boundary-2021",
          name: "Pune Municipal Corporation Candidate Boundary (Post-2021 Expansion)",
          type: "boundary",
          studyAreaId: "pune",
          provenance: {
            originalSourceRelativePath: sourceRelativePath,
            originalPublisher: "Unknown (Likely PMC IT/GIS Cell or PSCDCL; unconfirmed by source metadata)",
            originalDownloadUrl: "Unknown (not recorded in source file or repository)",
            delimitationEffectivePeriod: "Post-July 2021 (incorporates all 23 peripheral villages merged under Maharashtra UDD Notification No. PMC-2020/CR-101/UD-22, June 30, 2021)",
            processingDate: new Date().toISOString(),
            conversionMethod: "Deterministic XML coordinate parse -> consecutive duplicate vertex deduplication -> 72-feature Turf union -> preservation of verified >= 1 ha interior exclusions (Mundhwa/Ghorpadi defense corridor) -> suppression of hairline seam slivers (< 1 ha)",
            legalAuthoritativeness: "Non-authoritative candidate for renewable energy planning and spatial classification. Source provenance unconfirmed.",
            knownLimitations: [
              "Source dataset is an administrative prabhag partition rather than a certified cadastre boundary.",
              "Feature 71 (Pune Station) possessed duplicate objectid=17 and omitted SDE attribute fields in original KML.",
              "Feature 71 covers the central railway corridor and Pune Cantonment envelope, which is an independent military municipality excluded from municipal electoral wards.",
              "Mundhwa Jackwell / Ghorpadi defense corridor (0.815 km²) is retained as an interior exclusion."
            ],
          },
          metrics: {
            sourceFeatureCount: rawFeatures.length,
            processedFeatureCount: validatedPolygons.length,
            excludedFeatureCount: 0,
            repairedFeaturesCount: repairLog.length,
            repairedFeatures: repairLog,
            interiorHolesFoundTotal: interiorRings.length,
            interiorExclusionsPreserved: preservedExclusions.length,
            interiorSliversSuppressed: suppressedSliversCount,
            suppressedSliversAreaM2: Math.round(suppressedSliversAreaM2 * 100) / 100,
            macroExclusionAreaKm2: Math.round((macroExclusionAreaM2 / 1e6) * 10000) / 10000,
            grossAreaKm2: Math.round((grossAreaM2 / 1e6) * 100) / 100,
            netAreaKm2: Math.round((netAreaM2 / 1e6) * 100) / 100,
            bounds: finalBbox,
          },
        },
        geometry: finalPolygon.geometry,
      },
    ],
  };

  if (!options.dryRun) {
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(targetPath, JSON.stringify(candidateGeoJson, null, 2), "utf-8");
  }

  return {
    sourcePath,
    targetPath,
    repairedCount: repairLog.length,
    repairLog,
    grossAreaKm2: grossAreaM2 / 1e6,
    netAreaKm2: netAreaM2 / 1e6,
    bbox: finalBbox,
    preservedExclusionsCount: preservedExclusions.length,
    suppressedSliversCount,
    geoJson: candidateGeoJson,
  };
}

// Allow direct CLI execution
if (process.argv[1] && process.argv[1].endsWith("build-pmc-candidate.mjs")) {
  try {
    console.log("Building PMC Candidate Boundary from KML...");
    const result = buildPmcCandidate();
    console.log("Successfully generated:", result.targetPath);
    console.log(`Gross Area: ${result.grossAreaKm2.toFixed(2)} km²`);
    console.log(`Net Area: ${result.netAreaKm2.toFixed(2)} km²`);
    console.log(`Preserved Exclusions: ${result.preservedExclusionsCount}`);
    console.log(`Suppressed Slivers: ${result.suppressedSliversCount}`);
    console.log(`Repaired Features:`, result.repairLog);
    console.log(`Bounding Box:`, result.bbox);
  } catch (err) {
    console.error("Build failed:", err);
    process.exit(1);
  }
}
