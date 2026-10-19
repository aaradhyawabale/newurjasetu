import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";
import type { Feature, Polygon, FeatureCollection } from "geojson";
import { buildPmcCandidate } from "../../scripts/build-pmc-candidate.mjs";

describe("PMC Candidate Boundary Verification & Regression Suite", () => {
  const candidatePath = path.join(process.cwd(), "src/data/boundaries/pmc_candidate_boundary.geojson");

  it("1. reads and validates the generated GeoJSON candidate boundary structure", () => {
    expect(fs.existsSync(candidatePath)).toBe(true);
    const raw = fs.readFileSync(candidatePath, "utf-8");
    const geojson = JSON.parse(raw) as FeatureCollection<Polygon>;

    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features).toHaveLength(1);

    const feature = geojson.features[0];
    expect(feature.type).toBe("Feature");
    expect(feature.geometry.type).toBe("Polygon");
    expect(feature.properties).toBeDefined();
    expect(feature.properties?.id).toBe("pmc-candidate-municipal-boundary-2021");
    expect(feature.properties?.studyAreaId).toBe("pune");

    // Provenance metadata checks
    const provenance = feature.properties?.provenance;
    expect(provenance).toBeDefined();
    expect(provenance.originalSourceRelativePath).toBe("ndata/Pune City Data/PMC Wards Info/PMC Prabhag Boundary.kml");
    expect(provenance.originalPublisher).toContain("Unknown");
    expect(provenance.originalDownloadUrl).toContain("Unknown");
    expect(provenance.delimitationEffectivePeriod).toContain("Post-July 2021");
    expect(provenance.knownLimitations.length).toBeGreaterThan(0);

    // Metrics checks
    const metrics = feature.properties?.metrics;
    expect(metrics).toBeDefined();
    expect(metrics.sourceFeatureCount).toBe(72);
    expect(metrics.processedFeatureCount).toBe(72);
    expect(metrics.excludedFeatureCount).toBe(0);
    expect(metrics.repairedFeaturesCount).toBe(1);
    expect(metrics.interiorExclusionsPreserved).toBe(1);
    expect(metrics.interiorSliversSuppressed).toBe(496);
  });

  it("2. confirms geometry validity, closure, and non-empty output", () => {
    const raw = fs.readFileSync(candidatePath, "utf-8");
    const geojson = JSON.parse(raw) as FeatureCollection<Polygon>;
    const feature = geojson.features[0];

    // Check OGC validity (zero self-intersection kinks)
    const kinks = turf.kinks(feature);
    expect(kinks.features).toHaveLength(0);

    // Verify outer ring and inner exclusion rings are strictly closed
    const rings = feature.geometry.coordinates;
    expect(rings.length).toBe(2); // 1 outer boundary ring + 1 macro exclusion ring

    const outerRing = rings[0];
    expect(outerRing.length).toBeGreaterThan(1000);
    expect(outerRing[0][0]).toBe(outerRing[outerRing.length - 1][0]);
    expect(outerRing[0][1]).toBe(outerRing[outerRing.length - 1][1]);

    const innerRing = rings[1];
    expect(innerRing.length).toBeGreaterThan(10);
    expect(innerRing[0][0]).toBe(innerRing[innerRing.length - 1][0]);
    expect(innerRing[0][1]).toBe(innerRing[innerRing.length - 1][1]);

    // Check surface area
    const netAreaKm2 = turf.area(feature) / 1e6;
    expect(netAreaKm2).toBeGreaterThan(521.0);
    expect(netAreaKm2).toBeLessThan(522.0);

    const grossAreaKm2 = turf.area(turf.polygon([outerRing])) / 1e6;
    expect(grossAreaKm2).toBeGreaterThan(522.0);
    expect(grossAreaKm2).toBeLessThan(523.0);

    // Check bounding box
    const bbox = turf.bbox(feature);
    expect(bbox[0]).toBeCloseTo(73.7318, 3);
    expect(bbox[1]).toBeCloseTo(18.3854, 3);
    expect(bbox[2]).toBeCloseTo(74.0185, 3);
    expect(bbox[3]).toBeCloseTo(18.6218, 3);
  });

  it("3. validates containment of recognized Pune core and 2021 merged peripheral locations", () => {
    const raw = fs.readFileSync(candidatePath, "utf-8");
    const feature = JSON.parse(raw).features[0] as Feature<Polygon>;

    const puneLocations = [
      { name: "Shaniwar Wada (Pune Core)", lng: 73.8553, lat: 18.5196 },
      { name: "Shivajinagar", lng: 73.8446, lat: 18.5314 },
      { name: "Kothrud", lng: 73.8077, lat: 18.5074 },
      { name: "Hadapsar", lng: 73.9260, lat: 18.5089 },
      { name: "Aundh", lng: 73.8074, lat: 18.5580 },
      { name: "Katraj", lng: 73.8588, lat: 18.4485 },
      // 2021 merged peripheral villages:
      { name: "Mahalunge (2021 Merged Village)", lng: 73.7550, lat: 18.5510 },
      { name: "Wagholi (2021 Merged Village)", lng: 73.9850, lat: 18.5800 },
      { name: "Kirkatwadi (2021 Merged Village)", lng: 73.7850, lat: 18.4200 },
      // Central Railway station:
      { name: "Pune Railway Station (Feature 71)", lng: 73.8735, lat: 18.5285 },
    ];

    for (const loc of puneLocations) {
      const pt = turf.point([loc.lng, loc.lat]);
      const isInside = turf.booleanPointInPolygon(pt, feature);
      expect(isInside, `Expected ${loc.name} at [${loc.lng}, ${loc.lat}] to be inside PMC candidate`).toBe(true);
    }
  });

  it("4. rejects locations clearly outside the Pune municipal boundary", () => {
    const raw = fs.readFileSync(candidatePath, "utf-8");
    const feature = JSON.parse(raw).features[0] as Feature<Polygon>;

    const externalLocations = [
      { name: "New Delhi", lng: 77.2090, lat: 28.6139 },
      { name: "Mumbai (Nariman Point)", lng: 72.8232, lat: 18.9438 },
      { name: "Nashik (Panchavati)", lng: 73.7898, lat: 19.9975 },
      { name: "PCMC (Bhosari MIDC)", lng: 73.7695, lat: 18.6548 },
      { name: "PCMC (Akurdi Railway Station)", lng: 73.7710, lat: 18.6490 },
      { name: "Lonavala", lng: 73.4091, lat: 18.7557 },
    ];

    for (const loc of externalLocations) {
      const pt = turf.point([loc.lng, loc.lat]);
      const isInside = turf.booleanPointInPolygon(pt, feature);
      expect(isInside, `Expected ${loc.name} at [${loc.lng}, ${loc.lat}] to be outside PMC candidate`).toBe(false);
    }
  });

  it("5. confirms the Mundhwa Jackwell / Ghorpadi defense macro exclusion hole is punched out", () => {
    const raw = fs.readFileSync(candidatePath, "utf-8");
    const feature = JSON.parse(raw).features[0] as Feature<Polygon>;

    // Macro hole centroid: should be FALSE (excluded from municipal coverage)
    const holeCentroidPt = turf.point([73.9120, 18.5241]);
    expect(
      turf.booleanPointInPolygon(holeCentroidPt, feature),
      "Point inside Mundhwa macro hole exclusion must be excluded (false)"
    ).toBe(false);

    // Adjacent urban ward location in Mundhwa: should be TRUE (inside PMC coverage)
    const mundhwaUrbanPt = turf.point([73.9250, 18.5350]);
    expect(
      turf.booleanPointInPolygon(mundhwaUrbanPt, feature),
      "Point in adjacent Mundhwa urban area must be included (true)"
    ).toBe(true);

    // Verify macro hole area is ~0.815 km²
    const innerRing = feature.geometry.coordinates[1];
    const holeAreaKm2 = turf.area(turf.polygon([innerRing])) / 1e6;
    expect(holeAreaKm2).toBeCloseTo(0.8152, 2);
  });

  it("6. verifies Feature 71 repair and preserved coverage", () => {
    const raw = fs.readFileSync(candidatePath, "utf-8");
    const feature = JSON.parse(raw).features[0] as Feature<Polygon>;

    const metrics = feature.properties?.metrics;
    expect(metrics.repairedFeaturesCount).toBe(1);
    const repaired = metrics.repairedFeatures[0];
    expect(repaired.id).toBe("pmc_prabhag.72");
    expect(repaired.initialVertexCount).toBe(432);
    expect(repaired.cleanedVertexCount).toBe(431);
    expect(repaired.removedDuplicates).toBe(1);
    expect(repaired.areaM2).toBe(10916334);

    // Point in Pune Station / Cantonment envelope is retained
    const stationPt = turf.point([73.8735, 18.5285]);
    expect(turf.booleanPointInPolygon(stationPt, feature)).toBe(true);
  });

  it("7. proves repeated conversion is strictly idempotent and deterministic", () => {
    const run1 = buildPmcCandidate({ dryRun: true });
    const run2 = buildPmcCandidate({ dryRun: true });

    expect(run1.grossAreaKm2).toBe(run2.grossAreaKm2);
    expect(run1.netAreaKm2).toBe(run2.netAreaKm2);
    expect(run1.repairedCount).toBe(run2.repairedCount);
    expect(run1.preservedExclusionsCount).toBe(run2.preservedExclusionsCount);
    expect(run1.suppressedSliversCount).toBe(run2.suppressedSliversCount);
    expect(run1.bbox).toEqual(run2.bbox);
  });
});
