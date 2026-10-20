import { describe, it, expect } from "vitest";
import {
  getStudyArea,
  loadSnapshot,
  getSnapshotOverpass,
  getSnapshotElevation,
  getSnapshotSolar,
  getSnapshotReverseGeocode,
  getSnapshotGeocode,
  isInsidePuneStudyArea,
  isInsidePcmcStudyArea,
  isInsideNashikStudyArea,
} from "@/server/providers/snapshot-loader";
import { runAnalysisEngine } from "@/server/analysis-engine/engine";
import fs from "fs";

describe("Multi-City GIS Integration & Snapshot Provider (Pune, PCMC, Nashik)", () => {
  describe("1. Geographic Containment & Study Area Routing", () => {
    it("routes Pune coordinates to 'pune' study area", () => {
      expect(getStudyArea(18.5204, 73.8567)).toBe("pune");
      expect(isInsidePuneStudyArea(18.5204, 73.8567)).toBe(true);
      expect(isInsidePcmcStudyArea(18.5204, 73.8567)).toBe(false);
      expect(isInsideNashikStudyArea(18.5204, 73.8567)).toBe(false);
    });

    it("routes PCMC coordinates to 'pcmc' study area", () => {
      expect(getStudyArea(18.6548, 73.7695)).toBe("pcmc");
      expect(isInsidePcmcStudyArea(18.6548, 73.7695)).toBe(true);
      expect(isInsidePuneStudyArea(18.6548, 73.7695)).toBe(false);
      expect(isInsideNashikStudyArea(18.6548, 73.7695)).toBe(false);
    });

    it("routes Nashik coordinates to 'nashik' study area", () => {
      expect(getStudyArea(19.9975, 73.7898)).toBe("nashik");
      expect(isInsideNashikStudyArea(19.9975, 73.7898)).toBe(true);
      expect(isInsidePuneStudyArea(19.9975, 73.7898)).toBe(false);
      expect(isInsidePcmcStudyArea(19.9975, 73.7898)).toBe(false);
    });

    it("returns null for out-of-study-area coordinates to prevent synthetic fabrication", () => {
      expect(getStudyArea(28.6139, 77.2090)).toBeNull(); // New Delhi
      expect(getStudyArea(12.9716, 77.5946)).toBeNull(); // Bengaluru
      expect(getStudyArea(18.9438, 72.8232)).toBeNull(); // Mumbai
      expect(getStudyArea(18.7557, 73.4091)).toBeNull(); // Lonavala
      expect(getSnapshotOverpass(28.6139, 77.2090, 1000)).toBeNull();
      expect(getSnapshotElevation(28.6139, 77.2090)).toBeNull();
      expect(getSnapshotSolar(28.6139, 77.2090)).toBeNull();
      expect(getSnapshotReverseGeocode(28.6139, 77.2090)).toBeNull();
    });

    it("enforces PMC polygon precedence over PCMC bounding box in northern Pune", () => {
      // Kalas in northern Pune (lat 18.585) lies inside PMC candidate polygon despite lat > 18.58
      expect(isInsidePuneStudyArea(18.5850, 73.8700)).toBe(true);
      expect(isInsidePcmcStudyArea(18.5850, 73.8700)).toBe(false);
      expect(getStudyArea(18.5850, 73.8700)).toBe("pune");

      // Dhanori in northern Pune (lat 18.590)
      expect(isInsidePuneStudyArea(18.5900, 73.8800)).toBe(true);
      expect(isInsidePcmcStudyArea(18.5900, 73.8800)).toBe(false);
      expect(getStudyArea(18.5900, 73.8800)).toBe("pune");
    });

    it("correctly routes 2021 merged peripheral villages to Pune", () => {
      // Mahalunge (western peripheral village merged June 2021)
      expect(isInsidePuneStudyArea(18.5510, 73.7550)).toBe(true);
      expect(getStudyArea(18.5510, 73.7550)).toBe("pune");

      // Wagholi (eastern peripheral village merged June 2021)
      expect(isInsidePuneStudyArea(18.5800, 73.9850)).toBe(true);
      expect(getStudyArea(18.5800, 73.9850)).toBe("pune");

      // Kirkatwadi (southwestern peripheral village merged June 2021)
      expect(isInsidePuneStudyArea(18.4200, 73.7850)).toBe(true);
      expect(getStudyArea(18.4200, 73.7850)).toBe("pune");
    });

    it("punches out the Mundhwa macro exclusion hole from PMC classification", () => {
      // Macro exclusion centroid (0.815 km² non-PMC defense/railway enclave)
      expect(isInsidePuneStudyArea(18.5241, 73.9120)).toBe(false);
      expect(getStudyArea(18.5241, 73.9120)).toBeNull();

      // Adjacent Mundhwa urban ward area is classified as Pune
      expect(isInsidePuneStudyArea(18.5350, 73.9250)).toBe(true);
      expect(getStudyArea(18.5350, 73.9250)).toBe("pune");
    });

    it("handles missing, invalid, or non-finite coordinates safely without crashing", () => {
      expect(getStudyArea(NaN as any, 73.8567)).toBeNull();
      expect(getStudyArea(18.5204, NaN as any)).toBeNull();
      expect(getStudyArea(Infinity as any, 73.8567)).toBeNull();
      expect(isInsidePuneStudyArea(NaN as any, 73.8567)).toBe(false);
      expect(isInsidePcmcStudyArea(NaN as any, 73.8567)).toBe(false);
      expect(isInsideNashikStudyArea(NaN as any, 73.8567)).toBe(false);
    });
  });

  describe("2. Authentic Snapshot Data Integrity for Each City", () => {
    it("loads Pune snapshot with 13 verified EV stations and 4 candidates", () => {
      const snap = loadSnapshot("pune");
      expect(snap.metadata.studyAreaName).toContain("Pune");
      expect(snap.existingEvStations.length).toBe(13);
      expect(snap.candidateSites.length).toBe(4);
    });

    it("loads PCMC snapshot with verified transit corridor features and 4 candidates", () => {
      const snap = loadSnapshot("pcmc");
      expect(snap.metadata.studyAreaName).toContain("Pimpri-Chinchwad");
      expect(snap.existingEvStations.length).toBeGreaterThanOrEqual(5);
      expect(snap.candidateSites.length).toBe(4);
      expect(snap.candidateSites.some((c) => c.name.includes("Nigdi"))).toBe(true);
      expect(snap.candidateSites.some((c) => c.name.includes("Akurdi"))).toBe(true);
      expect(snap.candidateSites.some((c) => c.name.includes("Bhosari"))).toBe(true);
    });

    it("loads Nashik snapshot with verified MSEDCL grid and 4 candidates", () => {
      const snap = loadSnapshot("nashik");
      expect(snap.metadata.studyAreaName).toContain("Nashik");
      expect(snap.existingEvStations.length).toBeGreaterThanOrEqual(5);
      expect(snap.candidateSites.length).toBe(4);
      expect(snap.candidateSites.some((c) => c.name.includes("Govardhan"))).toBe(true);
      expect(snap.candidateSites.some((c) => c.name.includes("Satpur"))).toBe(true);
    });
  });

  describe("3. Offline Provider Fallbacks across Cities", () => {
    it("generates authentic Overpass elements for PCMC Nigdi candidate", () => {
      const res = getSnapshotOverpass(18.6548, 73.7695, 1000);
      expect(res).not.toBeNull();
      expect(res!.elements.length).toBeGreaterThan(5);
      expect(res!.source).toContain("Pimpri-Chinchwad");
      expect(res!.license).toContain("ODbL");
      // Check presence of arterial road, parking, and power substation
      const tags = res!.elements.map((e) => JSON.stringify(e.tags));
      expect(tags.some((t) => t.includes("primary"))).toBe(true);
      expect(tags.some((t) => t.includes("parking"))).toBe(true);
      expect(tags.some((t) => t.includes("substation"))).toBe(true);
    });

    it("generates authentic Overpass elements for Nashik Govardhan candidate", () => {
      const res = getSnapshotOverpass(19.9975, 73.7898, 1000);
      expect(res).not.toBeNull();
      expect(res!.elements.length).toBeGreaterThan(5);
      expect(res!.source).toContain("Nashik");
      expect(res!.license).toContain("ODbL");
    });

    it("returns Copernicus DEM elevation for PCMC and Nashik", () => {
      const pcmcElev = getSnapshotElevation(18.6548, 73.7695);
      expect(pcmcElev).not.toBeNull();
      expect(pcmcElev!.centerElevationM).toBe(568);
      expect(pcmcElev!.slopePercent).toBe(1.3);

      const nskElev = getSnapshotElevation(19.9975, 73.7898);
      expect(nskElev).not.toBeNull();
      expect(nskElev!.centerElevationM).toBe(582);
      expect(nskElev!.slopePercent).toBe(1.4);
    });

    it("returns NASA POWER solar climatology for PCMC and Nashik", () => {
      const pcmcSolar = getSnapshotSolar(18.6548, 73.7695);
      expect(pcmcSolar).not.toBeNull();
      expect(pcmcSolar!.annualAverageGhiKwhM2Day).toBe(5.13);

      const nskSolar = getSnapshotSolar(19.9975, 73.7898);
      expect(nskSolar).not.toBeNull();
      expect(nskSolar!.annualAverageGhiKwhM2Day).toBe(5.14);
    });
  });

  describe("4. End-to-End Engine Execution for Nashik and PCMC", () => {
    it("runs complete analysis for Nashik Govardhan Bus Depot candidate", async () => {
      const report = await runAnalysisEngine({
        placementId: "test-nsk-1",
        type: "EV Charging Station",
        lat: 19.9975,
        lng: 73.7898,
        lengthM: 30,
        widthM: 20,
        bearingDeg: 0,
        label: "Nashik Govardhan Bus Depot EV Hub",
      });

      expect(report.engineVersion).toBe("1.0.0");
      expect(report.overall.score).toBeGreaterThan(50);
      expect(report.overall.score).toBeLessThanOrEqual(100);
      expect(report.criteria.length).toBe(6);
      expect(report.limitations.some((l) => l.includes("MSEDCL"))).toBe(true);
    });

    it("runs complete analysis for PCMC Nigdi Pradhikaran candidate", async () => {
      const report = await runAnalysisEngine({
        placementId: "test-pcmc-1",
        type: "EV Charging Station",
        lat: 18.6548,
        lng: 73.7695,
        lengthM: 35,
        widthM: 25,
        bearingDeg: 90,
        label: "PCMC Nigdi Pradhikaran Multimodal Hub",
      });

      expect(report.engineVersion).toBe("1.0.0");
      expect(report.overall.score).toBeGreaterThan(50);
      expect(report.overall.score).toBeLessThanOrEqual(100);
      expect(report.criteria.length).toBe(6);
      expect(report.limitations.some((l) => l.includes("MSEDCL"))).toBe(true);
    });
  });

  describe("5. Dataset Manifest Verification", () => {
    it("validates that all datasets in dataset-manifest.json point to valid source and output paths", () => {
      const manifestRaw = JSON.parse(
        fs.readFileSync("src/data/manifests/dataset-manifest.json", "utf8")
      );
      expect(manifestRaw.datasets.length).toBeGreaterThanOrEqual(10);

      for (const ds of manifestRaw.datasets) {
        expect(ds.id).toBeDefined();
        expect(ds.originalPath).toBeDefined();
        expect(ds.license).toBeDefined();
        expect(ds.consumedBy.length).toBeGreaterThan(0);
        // Verify original source exists if local ndata directory is present
        if (fs.existsSync("ndata")) {
          expect(fs.existsSync(ds.originalPath)).toBe(true);
        }
      }
    });
  });
});
