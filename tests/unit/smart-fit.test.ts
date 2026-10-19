import { describe, it, expect } from "vitest";
import { smartFitFootprint } from "@/server/analysis-engine/smart-fit";
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

  it("aligns a park footprint to touch the road frontage without overlapping the roadway centerline", async () => {
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

    // Verify footprint polygon does not collide with the commercial building
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
          [73.8540, 18.5208],
          [73.8560, 18.5208],
          [73.8560, 18.5212],
          [73.8540, 18.5212],
          [73.8540, 18.5208],
        ],
      ],
    };

    expect(doesFootprintIntersect(poly, bldgGeom)).toBe(false);
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
});
