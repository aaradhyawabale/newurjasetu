import { InfrastructureTypeId, INFRASTRUCTURE_TYPES } from "@/config/infra-types";
import { createFootprintPolygon, computeAreaM2, doesFootprintIntersect } from "../gis/geometry";
import { OverpassProvider, osmElementToGeoJson } from "../providers/overpass";

export interface ConflictingFeature {
  id: string;
  category: "building" | "waterway" | "railway" | "restricted_landuse" | "major_road";
  label: string;
  severity: "critical" | "warning";
  description: string;
}

export interface ValidationResult {
  status: "pass" | "warn" | "fail";
  proposedAreaM2: number;
  allowedAreaRange: {
    minM2: number;
    maxM2: number;
    reason: string;
  };
  conflicts: ConflictingFeature[];
  messages: string[];
}

const overpassProvider = new OverpassProvider();

export async function validateFootprint(
  type: InfrastructureTypeId,
  lat: number,
  lng: number,
  lengthM: number,
  widthM: number,
  bearingDeg = 0
): Promise<ValidationResult> {
  const config = INFRASTRUCTURE_TYPES[type];
  if (!config) {
    throw new Error(`Unknown infrastructure type: ${type}`);
  }

  const footprint = createFootprintPolygon(lat, lng, lengthM, widthM, bearingDeg);
  const proposedAreaM2 = computeAreaM2(footprint);

  const conflicts: ConflictingFeature[] = [];
  const messages: string[] = [];

  // 1. Check dimensional boundaries against type defaults
  let siteMaxArea = config.maxAreaM2;
  let siteMinArea = config.minAreaM2;
  let limitReason = `Standard regulatory design range for ${config.label} projects`;

  if (proposedAreaM2 < config.minAreaM2) {
    messages.push(
      `Proposed area (${proposedAreaM2.toLocaleString()} m²) is below the minimum operational envelope (${config.minAreaM2.toLocaleString()} m²) for ${config.label}.`
    );
  }

  if (proposedAreaM2 > config.maxAreaM2) {
    messages.push(
      `Proposed area (${proposedAreaM2.toLocaleString()} m²) exceeds the recommended scale (${config.maxAreaM2.toLocaleString()} m²) for a single ${config.label} phase.`
    );
  }

  // 2. Fetch nearby OSM features to test for spatial overlap
  const searchRadius = Math.max(Math.round(Math.max(lengthM, widthM) / 2 + 150), 200);

  try {
    const osmData = await overpassProvider.getFeaturesAround(lat, lng, searchRadius);

    for (const el of osmData.elements) {
      const feature = osmElementToGeoJson(el);
      if (!feature) continue;

      const intersects = doesFootprintIntersect(footprint, feature.geometry);
      if (!intersects) continue;

      const tags = el.tags || {};

      // Check existing buildings
      if (tags.building && tags.building !== "no") {
        const bName = tags.name || tags["building:name"] || `Building #${el.id}`;
        // Bridges and Roads may have demolition / right-of-way warnings; hospitals/schools/parks have critical conflicts
        const isLinearCorridor = type === "Road" || type === "Water Canal";
        conflicts.push({
          id: `osm_${el.id}`,
          category: "building",
          label: bName,
          severity: isLinearCorridor ? "warning" : "critical",
          description: `Footprint directly intersects existing mapped structure (${bName}).`,
        });
      }

      // Check waterways / water bodies
      if (tags.waterway || tags.natural === "water" || tags.landuse === "reservoir" || tags.water) {
        const wName = tags.name || tags.waterway || "Water body";
        const isWaterExpected = type === "Bridge" || type === "Water Canal" || type === "Drainage";
        if (!isWaterExpected) {
          conflicts.push({
            id: `osm_${el.id}`,
            category: "waterway",
            label: wName,
            severity: "critical",
            description: `Footprint overlaps with active waterway or water body (${wName}), posing high flood / submersion risk.`,
          });
        }
      }

      // Check railways
      if (tags.railway && tags.railway !== "abandoned" && tags.railway !== "disused") {
        const isCrossingExpected = type === "Bridge" || type === "Transit Station";
        conflicts.push({
          id: `osm_${el.id}`,
          category: "railway",
          label: `Railway line (${tags.railway})`,
          severity: isCrossingExpected ? "warning" : "critical",
          description: `Footprint intersects active railway tracks. Requires grade-separated clearance.`,
        });
      }

      // Check restricted / incompatible landuses
      if (tags.landuse === "military" || tags.military) {
        conflicts.push({
          id: `osm_${el.id}`,
          category: "restricted_landuse",
          label: "Military Restricted Zone",
          severity: "critical",
          description: "Footprint intersects restricted defense / military landuse with legal building prohibition.",
        });
      }

      if (tags.landuse === "cemetery" || tags.amenity === "grave_yard") {
        conflicts.push({
          id: `osm_${el.id}`,
          category: "restricted_landuse",
          label: "Cemetery / Burial Ground",
          severity: "critical",
          description: "Footprint intersects cemetery or memorial ground.",
        });
      }

      // Check expressways / motorways
      if (tags.highway === "motorway" || tags.highway === "trunk") {
        if (type !== "Bridge" && type !== "Road") {
          conflicts.push({
            id: `osm_${el.id}`,
            category: "major_road",
            label: `High-speed highway (${tags.highway})`,
            severity: "critical",
            description: "Direct collision with high-speed motorway right-of-way.",
          });
        }
      }
    }
  } catch (err: any) {
    console.warn("[Validation Feature Check Warning]", err.message);
    messages.push("Unable to verify local mapped features due to temporary provider unavailability.");
  }

  // 3. Determine overall validation status & adjust location-specific limit
  const hasCritical = conflicts.some((c) => c.severity === "critical");
  const hasWarning = conflicts.some((c) => c.severity === "warning");
  const outOfBounds = proposedAreaM2 < config.minAreaM2 || proposedAreaM2 > config.maxAreaM2;

  let status: "pass" | "warn" | "fail" = "pass";

  if (hasCritical) {
    status = "fail";
    limitReason = "Severely constrained by critical spatial conflicts on site (buildings, water bodies, or restricted land).";
    siteMaxArea = Math.min(siteMaxArea, Math.round(proposedAreaM2 * 0.6));
  } else if (hasWarning || outOfBounds) {
    status = "warn";
    if (hasWarning) {
      limitReason = "Constrained by existing structures or crossings in right-of-way.";
      siteMaxArea = Math.min(siteMaxArea, Math.round(proposedAreaM2 * 0.85));
    }
  } else {
    limitReason = `Clear site: footprint satisfies spatial clearance norms for ${config.label}`;
  }

  return {
    status,
    proposedAreaM2,
    allowedAreaRange: {
      minM2: siteMinArea,
      maxM2: Math.max(siteMaxArea, siteMinArea),
      reason: limitReason,
    },
    conflicts,
    messages,
  };
}
