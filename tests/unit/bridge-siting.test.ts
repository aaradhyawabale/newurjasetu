import { describe, it, expect } from "vitest";
import {
  analyzeBridgeConnectivity,
  evaluateRoadCompatibility,
} from "@/server/analysis-engine/bridge-planner";
import { validateFootprint } from "@/server/analysis-engine/validation";
import { OsmElement } from "@/server/providers/types";

describe("Township Planner: Bridge Siting, Dual-Bank Continuity & Hierarchy Rules", () => {
  it("enforces IRC road width and hierarchy compatibility (disqualifies 'gulli' / narrow alley for wide bridges)", () => {
    // 13m bridge (multi-lane)
    const wideBridgeWidth = 13;
    const alleyResult = evaluateRoadCompatibility("service", wideBridgeWidth, "Narrow Society Lane");
    expect(alleyResult.isCompatible).toBe(false);
    expect(alleyResult.reason).toContain("cannot discharge into a narrow alley/service lane");
    expect(alleyResult.minRowRequiredM).toBeGreaterThanOrEqual(15);

    const footwayResult = evaluateRoadCompatibility("footway", wideBridgeWidth, "River Walkway");
    expect(footwayResult.isCompatible).toBe(false);

    const livingStreetResult = evaluateRoadCompatibility("living_street", wideBridgeWidth, "Residential Lane");
    expect(livingStreetResult.isCompatible).toBe(false);

    // Arterial / Secondary collector is compatible
    const secondaryResult = evaluateRoadCompatibility("secondary", wideBridgeWidth, "Ram Nagar Road");
    expect(secondaryResult.isCompatible).toBe(true);
    expect(secondaryResult.minRowRequiredM).toBe(15);

    // Narrow pedestrian footbridge (4m) CAN connect to pedestrian pathways
    const footbridgeResult = evaluateRoadCompatibility("footway", 4, "River Walkway");
    expect(footbridgeResult.isCompatible).toBe(true);
  });

  it("detects 'Bridge to Nowhere' when both bridge abutments terminate in unserviced land without roads", () => {
    // Bridge spanning across waterway at (18.4705, 73.8057), span 120m, width 13m, bearing 320°
    // With road elements placed far away (> 80m from abutments)
    const mockOsmElements: OsmElement[] = [
      // Waterway spanned by bridge
      {
        type: "way",
        id: 101,
        tags: { waterway: "river", name: "Mutha River" },
        geometry: [
          { lat: 18.4705, lon: 73.8052 },
          { lat: 18.4705, lon: 73.8062 },
        ],
      },
      // Road 1 (Ram Nagar Road) on Bank A, ~120m away from Abutment A
      {
        type: "way",
        id: 201,
        tags: { highway: "secondary", name: "Ram Nagar Road" },
        geometry: [
          { lat: 18.4688, lon: 73.8035 },
          { lat: 18.4695, lon: 73.8038 },
        ],
      },
      // Road 2 on Bank B, ~150m away from Abutment B
      {
        type: "way",
        id: 202,
        tags: { highway: "residential", name: "Sinhagad Residential Road" },
        geometry: [
          { lat: 18.4725, lon: 73.8075 },
          { lat: 18.4735, lon: 73.8078 },
        ],
      },
    ];

    const appraisal = analyzeBridgeConnectivity({
      lat: 18.4705,
      lng: 73.8057,
      lengthM: 100,
      widthM: 13,
      bearingDeg: 320,
      osmElements: mockOsmElements,
    });

    expect(appraisal.isBridge).toBe(true);
    expect(appraisal.dualBankDisconnected).toBe(true);
    expect(appraisal.networkConnectivityStatus).toBe("disconnected");

    // Both abutments should record a gap > 25m
    expect(appraisal.abutmentA.isConnected).toBe(false);
    expect(appraisal.abutmentA.distanceToRoadM).toBeGreaterThan(25);
    expect(appraisal.abutmentB.isConnected).toBe(false);
    expect(appraisal.abutmentB.distanceToRoadM).toBeGreaterThan(25);

    // Suggestion 1: Relocate to connected river crossing candidate
    expect(appraisal.recommendedActions.suggestion1_relocate.title).toContain("Option 1");
    expect(appraisal.recommendedActions.suggestion1_relocate.candidate).toBeDefined();

    // Suggestion 2: Construct Approach Road Corridors
    const sugg2 = appraisal.recommendedActions.suggestion2_approachRoads;
    expect(sugg2.title).toContain("Option 2");
    expect(sugg2.totalApproachLengthM).toBeGreaterThan(50);
    expect(sugg2.requiredRightOfWayM).toBe(15); // 13m bridge requires min 15m RoW
    expect(sugg2.totalLandAreaM2).toBeGreaterThan(0);
    expect(sugg2.corridorsGeoJson.features.length).toBe(2);
  });

  it("fails spatial validation and caps score at <= 24 for a disconnected bridge", async () => {
    const mockOsmElements: OsmElement[] = [
      {
        type: "way",
        id: 101,
        tags: { waterway: "river", name: "Mutha River" },
        geometry: [
          { lat: 18.4705, lon: 73.8052 },
          { lat: 18.4705, lon: 73.8062 },
        ],
      },
      // Road 1 on Bank A, far away (~120m)
      {
        type: "way",
        id: 201,
        tags: { highway: "secondary", name: "Ram Nagar Road" },
        geometry: [
          { lat: 18.4688, lon: 73.8035 },
          { lat: 18.4695, lon: 73.8038 },
        ],
      },
      // Road 2 on Bank B, far away (~140m)
      {
        type: "way",
        id: 202,
        tags: { highway: "residential", name: "Sinhagad Residential Road" },
        geometry: [
          { lat: 18.4725, lon: 73.8075 },
          { lat: 18.4735, lon: 73.8078 },
        ],
      },
    ];

    const validation = await validateFootprint(
      "Bridge",
      18.4705,
      73.8057,
      100,
      13,
      320,
      mockOsmElements
    );

    // Must FAIL validation due to critical approach disconnect
    expect(validation.status).toBe("fail");
    const disconnectConflict = validation.conflicts.find(
      (c) => c.id === "bridge_dual_bank_disconnect"
    );
    expect(disconnectConflict).toBeDefined();
    expect(disconnectConflict?.severity).toBe("critical");
    expect(disconnectConflict?.description).toContain("Neither bridge abutment connects to a classified road network");
  });

  it("passes validation and scores optimal when bridge abutments touch existing road network on both banks", async () => {
    // Bridge with abutments landing right on road geometry
    // Center at 18.4705, 73.8057, length 100m, bearing 0° (North-South)
    // Abutment A is ~50m South (18.47005), Abutment B is ~50m North (18.47095)
    const connectedOsmElements: OsmElement[] = [
      {
        type: "way",
        id: 101,
        tags: { waterway: "river", name: "Mutha River" },
        geometry: [
          { lat: 18.4705, lon: 73.8040 },
          { lat: 18.4705, lon: 73.8070 },
        ],
      },
      // Road directly touching South Abutment (< 10m)
      {
        type: "way",
        id: 301,
        tags: { highway: "secondary", name: "South River Boulevard" },
        geometry: [
          { lat: 18.4700, lon: 73.8050 },
          { lat: 18.4700, lon: 73.8065 },
        ],
      },
      // Road directly touching North Abutment (< 10m)
      {
        type: "way",
        id: 302,
        tags: { highway: "secondary", name: "North River Boulevard" },
        geometry: [
          { lat: 18.4710, lon: 73.8050 },
          { lat: 18.4710, lon: 73.8065 },
        ],
      },
    ];

    const appraisal = analyzeBridgeConnectivity({
      lat: 18.4705,
      lng: 73.8057,
      lengthM: 100,
      widthM: 13,
      bearingDeg: 0,
      osmElements: connectedOsmElements,
    });

    expect(appraisal.dualBankDisconnected).toBe(false);
    expect(appraisal.abutmentA.isConnected).toBe(true);
    expect(appraisal.abutmentB.isConnected).toBe(true);
    expect(appraisal.networkConnectivityStatus).toBe("fully_connected");

    const validation = await validateFootprint(
      "Bridge",
      18.4705,
      73.8057,
      100,
      13,
      0,
      connectedOsmElements
    );
    expect(validation.status).toBe("pass");
    expect(validation.conflicts.some((c) => c.id === "bridge_dual_bank_disconnect")).toBe(false);
  });
});
