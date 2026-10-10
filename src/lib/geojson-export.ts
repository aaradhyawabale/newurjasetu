import { createFootprintPolygon } from "@/server/gis/geometry";

export function exportPlacementsToGeoJson(placements: any[], scenarioName: string): string {
  const features = placements.map((p) => {
    const poly = createFootprintPolygon(
      p.lat,
      p.lng,
      p.lengthM,
      p.widthM,
      p.bearingDeg || 0
    );

    return {
      type: "Feature",
      geometry: poly.geometry,
      properties: {
        id: p.id,
        type: p.type,
        label: p.label,
        lengthM: p.lengthM,
        widthM: p.widthM,
        bearingDeg: p.bearingDeg,
        areaM2: Math.round(p.lengthM * p.widthM),
        params: p.params,
        scenario: scenarioName,
      },
    };
  });

  const featureCollection = {
    type: "FeatureCollection",
    properties: {
      exportedAt: new Date().toISOString(),
      scenario: scenarioName,
      source: "UrjaSetu Urban Infrastructure Siting Tool",
    },
    features,
  };

  return JSON.stringify(featureCollection, null, 2);
}

export function downloadJsonFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
