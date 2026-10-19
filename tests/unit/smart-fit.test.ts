import { describe, it, expect } from "vitest";
import * as turf from "@turf/turf";
import { smartFitFootprint, getRoadHalfWidthM, getStatutoryFrontageSetbackM } from "@/server/analysis-engine/smart-fit";
import { OsmElement } from "@/server/providers/types";
import { createFootprintPolygon, doesFootprintIntersect } from "@/server/gis/geometry";

describe("Township Planner Smart Fit Engine", () => {
  // Mock road running East-West at lat 18.5200, from lng 73.8500 to 73.8600
  const mockElements: OsmElement[] = [
    {
      type: "way",
      id: 101,
      nodes: [1, 2],
      tags: { highway: "secondary", name: "Main Avenue" },
      geometry: [
        { lat: 18.5200, lon: 73.8500 },
        { lat: 18.5200, lon: 73.8600 },
      ],
    },
    // Building located north of the road at lat 18.5208 (about 88m North of road)
    {
      type: "way",
      id: 201,
      nodes: [10, 11, 12, 13, 10],
      tags: { building: "commercial", name: "Tech Park Block A" },
      geometry: [
        { lat: 18.5208, lon: 73.8540 },
        { lat: 18.5208, lon: 73.8560 },
        { lat: 18.5212, lon: 73.8560 },
        { lat: 18.5212, lon: 73.8540 },
        { lat: 18.5208, lon: 73.8540 },
      ],
    },
  ];

  it("aligns a park footprint to touch the road frontage without overlapping the roadway centerline or road buffer", async () => {
    // User clicks slightly north of the road in the open parcel
    const clickLat = 18.5204;
    const clickLng = 73.8550;

    const result = await smartFitFootprint(
      "Park",
      clickLat,
      clickLng,
      120,
      80,
      0,
      mockElements
    );

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.roadName).toBe("Main Avenue");
    expect(result.roadDistanceM).toBeGreaterThanOrEqual(0);
    expect(result.bearingDeg).toBeCloseTo(90, 0); // East-West alignment
    expect(result.areaM2).toBeGreaterThan(0);

    const poly = createFootprintPolygon(
      result.lat,
      result.lng,
      result.lengthM,
      result.widthM,
      result.bearingDeg
    );

    // Verify footprint polygon does not collide with the commercial building
    const bldgGeom: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [73.8540, 18.5208],
          [73.8560, 18.5208],
          [73.8560, 18.5212],
          [73.8540, 18.5212],
          [73.8540, 18.5208],
        ],
      ],
    };

    expect(doesFootprintIntersect(poly, bldgGeom)).toBe(false);

    // Verify footprint does not intersect the road buffer (half width + 0.8m)
    const roadLine = turf.lineString([
      [73.8500, 18.5200],
      [73.8600, 18.5200],
    ]);
    const roadHalfW = getRoadHalfWidthM({ highway: "secondary" });
    const roadBuf = turf.buffer(roadLine, (roadHalfW + 0.8) / 1000, { units: "kilometers" });
    expect(roadBuf).not.toBeUndefined();
    if (roadBuf) {
      expect(doesFootprintIntersect(poly, roadBuf.geometry)).toBe(false);
    }
  });

  it("shifts along the corridor to dodge buildings directly at the road frontage", async () => {
    // Road running East-West
    // Building directly on the curb at lng 73.8550
    const elementsWithFrontageBuilding: OsmElement[] = [
      {
        type: "way",
        id: 101,
        nodes: [1, 2],
        tags: { highway: "residential", name: "Sector 4 Road" },
        geometry: [
          { lat: 18.5200, lon: 73.8500 },
          { lat: 18.5200, lon: 73.8600 },
        ],
      },
      // Building sitting directly on the north curb from lng 73.8545 to 73.8555
      {
        type: "way",
        id: 202,
        nodes: [20, 21, 22, 23, 20],
        tags: { building: "residential", name: "Curb Rowhouses" },
        geometry: [
          { lat: 18.52008, lon: 73.8545 },
          { lat: 18.52008, lon: 73.8555 },
          { lat: 18.52050, lon: 73.8555 },
          { lat: 18.52050, lon: 73.8545 },
          { lat: 18.52008, lon: 73.8545 },
        ],
      },
    ];

    // Click right where the building is located
    const result = await smartFitFootprint(
      "Hospital",
      18.5203,
      73.8550,
      80,
      50,
      0,
      elementsWithFrontageBuilding
    );

    expect(result).not.toBeNull();
    if (!result) return;

    const poly = createFootprintPolygon(
      result.lat,
      result.lng,
      result.lengthM,
      result.widthM,
      result.bearingDeg
    );

    const bldgGeom: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [73.8545, 18.52008],
          [73.8555, 18.52008],
          [73.8555, 18.52050],
          [73.8545, 18.52050],
          [73.8545, 18.52008],
        ],
      ],
    };

    // The engine must shift along the road corridor and NEVER overlap the building!
    expect(doesFootprintIntersect(poly, bldgGeom)).toBe(false);
  });

  it("avoids colliding with other existing placements in the same project scenario", async () => {
    const elements: OsmElement[] = [
      {
        type: "way",
        id: 101,
        nodes: [1, 2],
        tags: { highway: "primary", name: "Station Road" },
        geometry: [
          { lat: 18.5200, lon: 73.8500 },
          { lat: 18.5200, lon: 73.8600 },
        ],
      },
    ];

    // Suppose an existing Hospital was already placed at lat 18.5203, lng 73.8550
    const otherHospital = {
      id: "placement-hosp-1",
      type: "Hospital",
      lat: 18.5203,
      lng: 73.8550,
      lengthM: 80,
      widthM: 50,
      bearingDeg: 90,
    };

    // Now user clicks near it to place a Park
    const result = await smartFitFootprint(
      "Park",
      18.5203,
      73.8550,
      60,
      40,
      0,
      elements,
      [otherHospital]
    );

    expect(result).not.toBeNull();
    if (!result) return;

    const parkPoly = createFootprintPolygon(
      result.lat,
      result.lng,
      result.lengthM,
      result.widthM,
      result.bearingDeg
    );

    const hospPoly = createFootprintPolygon(
      otherHospital.lat,
      otherHospital.lng,
      otherHospital.lengthM,
      otherHospital.widthM,
      otherHospital.bearingDeg
    );

    // Park must NEVER overlap the existing Hospital!
    expect(doesFootprintIntersect(parkPoly, hospPoly.geometry)).toBe(false);
  });

  it("returns null when the entire road corridor is densely built up with zero open land", async () => {
    // Road running East-West with continuous unbroken buildings spanning the entire corridor on both sides
    const continuousBuildings: OsmElement[] = [
      {
        type: "way",
        id: 101,
        nodes: [1, 2],
        tags: { highway: "residential", name: "Dense Old Bazaar" },
        geometry: [
          { lat: 18.5200, lon: 73.8540 },
          { lat: 18.5200, lon: 73.8560 },
        ],
      },
      // Huge building block covering all north parcels
      {
        type: "way",
        id: 301,
        tags: { building: "yes" },
        geometry: [
          { lat: 18.52005, lon: 73.8530 },
          { lat: 18.52005, lon: 73.8570 },
          { lat: 18.52300, lon: 73.8570 },
          { lat: 18.52300, lon: 73.8530 },
          { lat: 18.52005, lon: 73.8530 },
        ],
      },
      // Huge building block covering all south parcels
      {
        type: "way",
        id: 302,
        tags: { building: "yes" },
        geometry: [
          { lat: 18.51700, lon: 73.8530 },
          { lat: 18.51700, lon: 73.8570 },
          { lat: 18.51995, lon: 73.8570 },
          { lat: 18.51995, lon: 73.8530 },
          { lat: 18.51700, lon: 73.8530 },
        ],
      },
    ];

    const result = await smartFitFootprint(
      "Hospital",
      18.5200,
      73.8550,
      100,
      60,
      0,
      continuousBuildings
    );

    // The engine must return null rather than placing an overlapping box over buildings!
    expect(result).toBeNull();
  });

  it("returns null when no road network is within search radius", async () => {
    const emptyElements: OsmElement[] = [
      {
        type: "way",
        id: 999,
        tags: { natural: "wood" },
        geometry: [
          { lat: 18.5200, lon: 73.8500 },
          { lat: 18.5210, lon: 73.8510 },
        ],
      },
    ];

    const result = await smartFitFootprint(
      "Park",
      18.5204,
      73.8550,
      100,
      60,
      0,
      emptyElements
    );

    expect(result).toBeNull();
  });

  it("computes appropriate statutory setbacks for different infrastructure types", () => {
    expect(getStatutoryFrontageSetbackM("Park")).toBe(1.0);
    expect(getStatutoryFrontageSetbackM("Hospital")).toBe(3.0);
    expect(getStatutoryFrontageSetbackM("School")).toBe(3.0);
    expect(getStatutoryFrontageSetbackM("EV Charging Station")).toBe(2.5);
    expect(getStatutoryFrontageSetbackM("Bridge")).toBe(0.0);
  });
});
