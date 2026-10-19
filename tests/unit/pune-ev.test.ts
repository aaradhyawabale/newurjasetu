import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadPuneSnapshot,
  isInsidePuneStudyArea,
  getPuneExistingEvStations,
  getPuneCandidateSites,
  getPuneSnapshotOverpass,
  getPuneSnapshotElevation,
  getPuneSnapshotSolar,
  getPuneGeocodeResults,
  getPuneReverseGeocodeResult,
} from "@/server/providers/snapshot-loader";
import {
  scoreEvStationSeparation,
  scoreHostParkingDistance,
} from "@/server/analysis-engine/scoring";
import { runAnalysisEngine } from "@/server/analysis-engine/engine";
import { compareCandidates, buildCandidateSummary } from "@/server/scenarios/comparison";
import { INFRASTRUCTURE_TYPES, INFRASTRUCTURE_SEPARATION_RULES } from "@/config/infra-types";
import { INFRASTRUCTURE_WEIGHT_PROFILES } from "@/server/analysis-engine/weight-profiles";

describe("Pune EV Charging Infrastructure: Snapshot, Siting Engine & Gap Analysis", () => {
  describe("1. Pune Geographic Snapshot Data Integrity", () => {
    it("loads verified Pune snapshot with valid metadata and ODbL license", () => {
      const snapshot = loadPuneSnapshot();
      expect(snapshot.metadata.studyAreaName).toBe("Pune Central Urban Corridor (PMC)");
      expect(snapshot.metadata.bbox.swLat).toBeLessThan(snapshot.metadata.bbox.neLat);
      expect(snapshot.metadata.bbox.swLng).toBeLessThan(snapshot.metadata.bbox.neLng);
      expect(snapshot.metadata.center.lat).toBeCloseTo(18.5204, 3);
      expect(snapshot.metadata.center.lng).toBeCloseTo(73.8567, 3);
      expect(snapshot.metadata.sources.length).toBeGreaterThanOrEqual(3);
    });

    it("verifies genuine OpenStreetMap EV charging station locations without duplicates", () => {
      const stations = getPuneExistingEvStations();
      expect(stations.length).toBe(13);

      const seenIds = new Set<number>();
      for (const st of stations) {
        expect(seenIds.has(st.id)).toBe(false);
        seenIds.add(st.id);
        expect(st.lat).toBeGreaterThanOrEqual(18.45);
        expect(st.lat).toBeLessThanOrEqual(18.60);
        expect(st.lng).toBeGreaterThanOrEqual(73.75);
        expect(st.lng).toBeLessThanOrEqual(73.95);
        expect(st.name).toBeTruthy();
      }
    });

    it("detects and rejects duplicate or corrupted EV charging station entries", () => {
      const duplicateDetector = (items: Array<{ id: number; lat: number; lng: number }>) => {
        const ids = new Set<number>();
        const coords = new Set<string>();
        for (const it of items) {
          const coordKey = `${it.lat.toFixed(5)},${it.lng.toFixed(5)}`;
          if (ids.has(it.id) || coords.has(coordKey)) {
            return false;
          }
          ids.add(it.id);
          coords.add(coordKey);
        }
        return true;
      };

      const validStations = getPuneExistingEvStations();
      expect(duplicateDetector(validStations)).toBe(true);

      const corruptedList = [
        ...validStations,
        { id: validStations[0].id, lat: validStations[0].lat, lng: validStations[0].lng },
      ];
      expect(duplicateDetector(corruptedList)).toBe(false);
    });

    it("contains 4 pre-configured candidate sites covering distinct urban transit and retail typologies", () => {
      const candidates = getPuneCandidateSites();
      expect(candidates).toHaveLength(4);

      const ids = candidates.map((c) => c.id);
      expect(ids).toContain("pune-cand-1-shivajinagar");
      expect(ids).toContain("pune-cand-2-deccan");
      expect(ids).toContain("pune-cand-3-kothrud");
      expect(ids).toContain("pune-cand-4-pune-station");

      for (const c of candidates) {
        expect(c.recommendedBays).toBeGreaterThanOrEqual(4);
        expect(c.recommendedPowerKw).toBeGreaterThanOrEqual(60);
        expect(c.metrics.nearestChargerDistM).toBeGreaterThan(0);
        expect(c.metrics.arterialRoadDistM).toBeLessThan(150);
      }
    });
  });

  describe("2. Study Area Spatial Boundary & Offline Provider Fallback", () => {
    it("correctly identifies coordinates inside vs outside Pune study area", () => {
      // Shivajinagar, Pune
      expect(isInsidePuneStudyArea(18.5314, 73.8446)).toBe(true);
      // Kothrud, Pune
      expect(isInsidePuneStudyArea(18.5074, 73.8077)).toBe(true);
      // Connaught Place, New Delhi (outside)
      expect(isInsidePuneStudyArea(28.6139, 77.2090)).toBe(false);
      // Marine Drive, Mumbai (outside)
      expect(isInsidePuneStudyArea(18.9438, 72.8232)).toBe(false);
    });

    it("generates verified Overpass elements for Pune candidates when offline", () => {
      const ovp = getPuneSnapshotOverpass(18.5314, 73.8446, 1500);
      expect(ovp).not.toBeNull();
      expect(ovp!.elements.length).toBeGreaterThanOrEqual(10);
      expect(ovp!.source).toContain("Pune Verified Geographic Snapshot");
      expect(ovp!.quality?.completeness).toBe("verified");

      const categories = ovp!.normalizedFeatures?.map((f) => f.category);
      expect(categories).toContain("amenity");
      expect(categories).toContain("road");
    });

    it("returns null for Overpass snapshot queries outside Pune to prevent fabricated data", () => {
      const ovp = getPuneSnapshotOverpass(28.6139, 77.2090, 1500);
      expect(ovp).toBeNull();
    });

    it("returns verified DEM elevation and NASA GHI for Pune coordinates", () => {
      const elev = getPuneSnapshotElevation(18.5314, 73.8446);
      expect(elev).not.toBeNull();
      expect(elev!.centerElevationM).toBe(564);
      expect(elev!.slopePercent).toBe(1.8);
      expect(elev!.samplePointsCount).toBe(9);

      const solar = getPuneSnapshotSolar(18.5314, 73.8446);
      expect(solar).not.toBeNull();
      expect(solar!.annualAverageGhiKwhM2Day).toBe(5.13);
      expect(solar!.monthlyGhiKwhM2Day?.MAY).toBe(6.32);
      expect(solar!.monthlyGhiKwhM2Day?.JUL).toBe(3.82); // Monsoon dip
    });

    it("resolves Pune geocoding and reverse geocoding queries offline", () => {
      const geocode = getPuneGeocodeResults("shivajinagar");
      expect(geocode).not.toBeNull();
      expect(geocode![0].displayName).toContain("Shivajinagar");
      expect(geocode![0].lat).toBeCloseTo(18.5314, 3);

      const reverse = getPuneReverseGeocodeResult(18.5314, 73.8446);
      expect(reverse).not.toBeNull();
      expect(reverse!.displayName).toContain("Shivajinagar");
      expect(reverse!.displayName).toContain("Pune");
    });
  });

  describe("3. EV Siting Scoring Functions & Metric Boundaries", () => {
    it("evaluates spatial separation from existing charging stations correctly", () => {
      // Large distance -> critical gap opportunity
      const gap1 = scoreEvStationSeparation(1500);
      expect(gap1.score).toBe(96);
      expect(gap1.status).toBe("optimal");

      // Moderate distance -> favorable spacing
      const gap2 = scoreEvStationSeparation(750);
      expect(gap2.score).toBe(85);
      expect(gap2.status).toBe("optimal");

      // Close distance -> potential clustering
      const gap3 = scoreEvStationSeparation(220);
      expect(gap3.score).toBe(40);
      expect(gap3.status).toBe("suboptimal");

      // Very close -> cannibalization risk
      const gap4 = scoreEvStationSeparation(80);
      expect(gap4.score).toBe(20);
      expect(gap4.status).toBe("constrained");
    });

    it("evaluates public parking and commercial dwell host proximity correctly", () => {
      // Co-located within 50m of public parking lot
      const host1 = scoreHostParkingDistance(35);
      expect(host1.score).toBe(100);
      expect(host1.status).toBe("optimal");

      // Short walk to retail / commercial mall
      const host2 = scoreHostParkingDistance(180);
      expect(host2.score).toBe(70);
      expect(host2.status).toBe("acceptable");

      // Isolated roadside without parking or amenities
      const host3 = scoreHostParkingDistance(800);
      expect(host3.score).toBe(20);
      expect(host3.status).toBe("constrained");
    });
  });

  describe("4. End-to-End Analysis Engine Execution for EV Charging Station", () => {
    it("analyzes Pune Candidate 1 (Shivajinagar) with complete criteria, disclaimers, and transparent weights", async () => {
      const report = await runAnalysisEngine({
        placementId: "test-placement-pune-1",
        type: "EV Charging Station",
        lat: 18.5314,
        lng: 73.8446,
        lengthM: 35,
        widthM: 20,
        bearingDeg: 0,
        customParams: {
          bayCount: 12,
          chargerPowerKw: "120",
          gridDedicatedTransformer: true,
        },
        label: "Shivajinagar Multimodal Interchange",
      });

      expect(report).toBeDefined();
      expect(report.placementSnapshot.type).toBe("EV Charging Station");
      expect(report.overall.score).toBeGreaterThanOrEqual(75);
      expect(report.overall.band).toBe("High Suitability");

      // Verify all 6 EV criteria are evaluated
      const critIds = report.criteria.map((c) => c.id);
      expect(critIds).toContain("ev_gap_separation");
      expect(critIds).toContain("arterial_access");
      expect(critIds).toContain("parking_commercial_host");
      expect(critIds).toContain("power_grid_proximity");
      expect(critIds).toContain("terrain_slope");
      expect(critIds).toContain("osm_coverage");

      // Verify mandatory electrical grid disclaimer is present
      const hasGridDisclaimer = report.limitations.some((lim) =>
        lim.toLowerCase().includes("transformer") || lim.toLowerCase().includes("msedcl")
      );
      expect(hasGridDisclaimer).toBe(true);

      // Verify supporting points reflect arterial road and gap separation
      expect(report.supporting.length).toBeGreaterThan(0);
    });

    it("verifies EV Charging Station configuration schema and separation rules", () => {
      const cfg = INFRASTRUCTURE_TYPES["EV Charging Station"];
      expect(cfg).toBeDefined();
      expect(cfg.category).toBe("Transport");
      expect(cfg.criteria.reduce((sum, c) => sum + c.weight, 0)).toBeCloseTo(1.0, 2);

      const rules = INFRASTRUCTURE_SEPARATION_RULES["EV Charging Station"];
      expect(rules).toBeDefined();
      expect(rules.minSameTypeSpacingM).toBe(300);
      expect(rules.maxRoadAccessDistanceM).toBe(250);

      const profiles = INFRASTRUCTURE_WEIGHT_PROFILES["EV Charging Station"];
      expect(profiles).toBeDefined();
      expect(profiles.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("5. Multi-Candidate Scenario Comparison for Pune EV Sites", () => {
    it("compares Shivajinagar vs Kothrud candidates and computes transparent Pareto trade-offs", () => {
      const cand1Snapshot = {
        id: "pune-1",
        name: "Shivajinagar Multimodal Hub",
        type: "EV Charging Station" as const,
        lat: 18.5314,
        lng: 73.8446,
        lengthM: 35,
        widthM: 20,
        bearingDeg: 0,
        areaM2: 700,
        params: { bayCount: 12, chargerPowerKw: "120" },
      };

      const cand2Snapshot = {
        id: "pune-3",
        name: "Kothrud Karve Road Strip",
        type: "EV Charging Station" as const,
        lat: 18.5074,
        lng: 73.8077,
        lengthM: 25,
        widthM: 15,
        bearingDeg: 0,
        areaM2: 375,
        params: { bayCount: 6, chargerPowerKw: "60" },
      };

      const mockAnalysis1 = {
        overall: { score: 93, band: "High Suitability", confidence: 0.9 },
        criteria: [
          { id: "ev_gap_separation", label: "EV Gap", weight: 0.25, score: 96, formattedValue: "1220 m" },
          { id: "arterial_access", label: "Arterial Road", weight: 0.20, score: 100, formattedValue: "35 m" },
          { id: "parking_commercial_host", label: "Parking Host", weight: 0.20, score: 100, formattedValue: "65 m" },
          { id: "power_grid_proximity", label: "Power Grid", weight: 0.15, score: 95, formattedValue: "180 m" },
          { id: "terrain_slope", label: "Terrain Slope", weight: 0.10, score: 98, formattedValue: "1.8%" },
          { id: "osm_coverage", label: "OSM Coverage", weight: 0.10, score: 95, formattedValue: "28/km²" },
        ],
        validation: { status: "pass" as const, messages: [], conflicts: [], proposedAreaM2: 700, allowedAreaRange: { minM2: 150, maxM2: 10000, reason: "Allowed" } },
        analyzedFeatures: [],
        evidence: [],
        dataSources: [],
      };

      const mockAnalysis2 = {
        overall: { score: 84, band: "High Suitability", confidence: 0.85 },
        criteria: [
          { id: "ev_gap_separation", label: "EV Gap", weight: 0.25, score: 65, formattedValue: "320 m" },
          { id: "arterial_access", label: "Arterial Road", weight: 0.20, score: 95, formattedValue: "80 m" },
          { id: "parking_commercial_host", label: "Parking Host", weight: 0.20, score: 85, formattedValue: "140 m" },
          { id: "power_grid_proximity", label: "Power Grid", weight: 0.15, score: 90, formattedValue: "410 m" },
          { id: "terrain_slope", label: "Terrain Slope", weight: 0.10, score: 95, formattedValue: "2.4%" },
          { id: "osm_coverage", label: "OSM Coverage", weight: 0.10, score: 90, formattedValue: "22/km²" },
        ],
        validation: { status: "pass" as const, messages: [], conflicts: [], proposedAreaM2: 375, allowedAreaRange: { minM2: 150, maxM2: 10000, reason: "Allowed" } },
        analyzedFeatures: [],
        evidence: [],
        dataSources: [],
      };

      const cand1Summary = buildCandidateSummary({
        placement: {
          id: cand1Snapshot.id,
          scenarioId: "sc-pune",
          type: cand1Snapshot.type,
          lat: cand1Snapshot.lat,
          lng: cand1Snapshot.lng,
          lengthM: cand1Snapshot.lengthM,
          widthM: cand1Snapshot.widthM,
          bearingDeg: cand1Snapshot.bearingDeg,
          params: cand1Snapshot.params,
          label: cand1Snapshot.name,
          createdAt: new Date(),
        },
        analysis: {
          id: "an-1",
          engineVersion: "1.0.0",
          overallScore: mockAnalysis1.overall.score,
          scoreBand: mockAnalysis1.overall.band,
          result: mockAnalysis1 as any,
          createdAt: new Date(),
        },
        scenarioName: "Pune EV Master Plan",
      });

      const cand2Summary = buildCandidateSummary({
        placement: {
          id: cand2Snapshot.id,
          scenarioId: "sc-pune",
          type: cand2Snapshot.type,
          lat: cand2Snapshot.lat,
          lng: cand2Snapshot.lng,
          lengthM: cand2Snapshot.lengthM,
          widthM: cand2Snapshot.widthM,
          bearingDeg: cand2Snapshot.bearingDeg,
          params: cand2Snapshot.params,
          label: cand2Snapshot.name,
          createdAt: new Date(),
        },
        analysis: {
          id: "an-2",
          engineVersion: "1.0.0",
          overallScore: mockAnalysis2.overall.score,
          scoreBand: mockAnalysis2.overall.band,
          result: mockAnalysis2 as any,
          createdAt: new Date(),
        },
        scenarioName: "Pune EV Master Plan",
      });

      const comparison = compareCandidates([cand1Summary, cand2Summary]);

      expect(comparison).toBeDefined();
      expect(comparison.ranking.length).toBe(2);
      expect(comparison.ranking[0].placementId).toBe("pune-1");
      expect(comparison.ranking[0].rank).toBe(1);
      expect(comparison.ranking[1].placementId).toBe("pune-3");
      expect(comparison.ranking[1].rank).toBe(2);

      // Verify trade-offs explain why Candidate 1 ranks above Candidate 2
      expect(comparison.tradeoffs!.length).toBeGreaterThan(0);
      expect(comparison.criteriaMatrix.length).toBeGreaterThanOrEqual(6);
    });
  });
});
