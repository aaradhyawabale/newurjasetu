import { describe, it, expect } from "vitest";
import { validateFootprint, resolveOfficialPlanningContext } from "@/server/analysis-engine/validation";
import { OsmElement } from "@/server/providers/types";

describe("Geospatial Validation: Road Overlap Detection, Access Road Analysis & Official Planning Context", () => {
  it("detects direct collision between non-corridor facility footprint and active street/roadway", async () => {
    const roadElements: OsmElement[] = [
      {
        type: "way",
        id: 901,
        tags: { highway: "primary", name: "Jangali Maharaj Road" },
        geometry: [
          { lat: 18.520, lon: 73.856 },
          { lat: 18.521, lon: 73.857 },
        ],
      },
    ];

    // Hospital placed directly over the road (18.5205, 73.8565)
    const result = await validateFootprint(
      "Hospital",
      18.5205,
      73.8565,
      100,
      80,
      0,
      roadElements
    );

    expect(result.status).toBe("fail");
    const roadConflict = result.conflicts.find(
      (c) => c.category === "road_collision" || c.category === "major_road"
    );
    expect(roadConflict).toBeDefined();
    expect(roadConflict?.severity).toBe("critical");
    expect(roadConflict?.label).toContain("Road");
    expect(roadConflict?.description).toContain("carriage-way");
  });

  it("permits linear corridor infrastructure (Road, Bridge) to cross road features without collision failure", async () => {
    const roadElements: OsmElement[] = [
      {
        type: "way",
        id: 902,
        tags: { highway: "secondary", name: "FC Road" },
        geometry: [
          { lat: 18.520, lon: 73.856 },
          { lat: 18.521, lon: 73.857 },
        ],
      },
    ];

    // Road placed across secondary road (intersection/junction)
    const result = await validateFootprint(
      "Road",
      18.5205,
      73.8565,
      120,
      20,
      45,
      roadElements
    );

    const roadConflict = result.conflicts.find(
      (c) => c.category === "road_collision"
    );
    expect(roadConflict).toBeUndefined();
  });

  it("evaluates road access and generates preliminary access road alignment for setback sites", async () => {
    const roadElements: OsmElement[] = [
      {
        type: "way",
        id: 903,
        tags: { highway: "secondary", name: "Karve Road" },
        geometry: [
          { lat: 18.510, lon: 73.830 },
          { lat: 18.510, lon: 73.840 },
        ],
      },
    ];

    // Site placed ~75m north of Karve Road
    // 18.510 + 0.00067 degrees lat ≈ 75m
    const siteLat = 18.5107;
    const siteLng = 73.8350;

    const result = await validateFootprint(
      "Hospital",
      siteLat,
      siteLng,
      60,
      40,
      0,
      roadElements
    );

    expect(result.roadAccess).toBeDefined();
    expect(result.roadAccess?.nearestRoadName).toBe("Karve Road");
    expect(result.roadAccess?.requiresNewAccessRoad).toBe(true);
    expect(result.roadAccess?.distanceM).toBeGreaterThan(40);
    expect(result.roadAccess?.alignmentGeoJson).toBeDefined();
    expect(result.roadAccess?.alignmentGeoJson?.geometry.type).toBe("LineString");
    expect(result.roadAccess?.preliminaryNotice).toContain("Preliminary concept alignment only");
    expect(result.roadAccess?.crossesObstacle).toBe(false);
  });

  it("detects obstacles crossing the proposed preliminary access road corridor", async () => {
    const elements: OsmElement[] = [
      // Road 80m South
      {
        type: "way",
        id: 904,
        tags: { highway: "primary", name: "Pune-Satara Road" },
        geometry: [
          { lat: 18.4900, lon: 73.850 },
          { lat: 18.4900, lon: 73.860 },
        ],
      },
      // Building situated between site (18.4907, 73.855) and road (18.4900, 73.855)
      {
        type: "way",
        id: 905,
        tags: { building: "commercial", name: "Commercial Plaza" },
        geometry: [
          { lat: 18.4903, lon: 73.8548 },
          { lat: 18.4905, lon: 73.8548 },
          { lat: 18.4905, lon: 73.8552 },
          { lat: 18.4903, lon: 73.8552 },
          { lat: 18.4903, lon: 73.8548 },
        ],
      },
    ];

    const result = await validateFootprint(
      "School",
      18.4908,
      73.8550,
      50,
      40,
      0,
      elements
    );

    expect(result.roadAccess).toBeDefined();
    expect(result.roadAccess?.crossesObstacle).toBe(true);
    expect(result.roadAccess?.obstacleDetails).toContain("Commercial Plaza");
    const obstacleConflict = result.conflicts.find((c) => c.category === "access_obstacle");
    expect(obstacleConflict).toBeDefined();
    expect(obstacleConflict?.description).toContain("Commercial Plaza");
  });

  it("resolves official planning context and discloses verified vs unverified statutory records", () => {
    // Pune coordinates
    const puneContext = resolveOfficialPlanningContext(18.5204, 73.8567);
    expect(puneContext.jurisdiction).toBe("Pune Municipal Corporation (PMC)");
    expect(puneContext.masterPlan).toContain("DP 2007-2027");
    expect(puneContext.statutoryRules).toContain("UDCPR 2020");
    expect(puneContext.verifiedSources.length).toBeGreaterThan(0);
    expect(puneContext.unverifiedAttributes).toContain(
      "Cadastral Revenue Survey / CTS Number and Title Ownership (7/12 Extract)"
    );
    expect(puneContext.complianceDisclaimer).toContain("Town Planning Department");

    // PCMC coordinates (Nigdi / Akurdi)
    const pcmcContext = resolveOfficialPlanningContext(18.6548, 73.7695);
    expect(pcmcContext.jurisdiction).toBe("Pimpri Chinchwad Municipal Corporation (PCMC)");

    // Nashik coordinates
    const nashikContext = resolveOfficialPlanningContext(19.9975, 73.7898);
    expect(nashikContext.jurisdiction).toBe("Nashik Municipal Corporation (NMC)");
  });
});
