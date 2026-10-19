import {
  InfrastructureTypeId,
  INFRASTRUCTURE_TYPES,
  INFRASTRUCTURE_SEPARATION_RULES,
} from "@/config/infra-types";
import {
  createFootprintPolygon,
  computeAreaM2,
  doesFootprintIntersect,
  computeFootprintDistanceToGeometryMeters,
  validateCoordinates,
  validatePolygonGeometry,
} from "../gis/geometry";
import { OverpassProvider, osmElementToGeoJson } from "../providers/overpass";
import { OsmElement } from "../providers/types";
import { analyzeBridgeConnectivity } from "./bridge-planner";

export interface ConflictingFeature {
  id: string;
  category:
    | "building"
    | "waterway"
    | "railway"
    | "restricted_landuse"
    | "major_road"
    | "separation_buffer"
    | "parameter_constraint";
  label: string;
  severity: "critical" | "warning";
  distanceM?: number;
  requiredBufferM?: number;
  description: string;
  geometry?: GeoJSON.Geometry;
}

export interface ValidationResult {
  status: "pass" | "warn" | "fail";
  geometryValid?: boolean;
  proposedAreaM2: number;
  allowedAreaRange: {
    minM2: number;
    maxM2: number;
    reason: string;
  };
  conflicts: ConflictingFeature[];
  messages: string[];
  evidenceComplete?: boolean;
}

const overpassProvider = new OverpassProvider();

export async function validateFootprint(
  type: InfrastructureTypeId,
  lat: number,
  lng: number,
  lengthM: number,
  widthM: number,
  bearingDeg = 0,
  preloadedElements?: OsmElement[],
  customParams?: Record<string, any>
): Promise<ValidationResult> {
  const config = INFRASTRUCTURE_TYPES[type];
  if (!config) {
    throw new Error(`Unknown infrastructure type: ${type}`);
  }

  const coordCheck = validateCoordinates(lat, lng);
  if (!coordCheck.valid) {
    throw new Error(`Invalid site coordinates: ${coordCheck.reason}`);
  }

  if (!Number.isFinite(lengthM) || !Number.isFinite(widthM) || lengthM <= 0 || widthM <= 0) {
    throw new Error("Footprint lengthM and widthM must be positive numbers.");
  }

  const separationRules = INFRASTRUCTURE_SEPARATION_RULES[type];
  const footprint = createFootprintPolygon(lat, lng, lengthM, widthM, bearingDeg);
  const geomCheck = validatePolygonGeometry(footprint);
  const proposedAreaM2 = geomCheck.valid ? geomCheck.areaM2 : computeAreaM2(footprint);

  const conflicts: ConflictingFeature[] = [];
  const messages: string[] = [];
  let evidenceComplete = true;

  if (!geomCheck.valid) {
    conflicts.push({
      id: "geom_invalid",
      category: "parameter_constraint",
      label: "Invalid Footprint Geometry",
      severity: "critical",
      description: geomCheck.reason || "Proposed footprint polygon geometry is invalid.",
    });
  }

  // 1. Check dimensional boundaries against type defaults
  let siteMaxArea = config.maxAreaM2;
  const siteMinArea = config.minAreaM2;
  let limitReason = `Standard regulatory design range for ${config.label} projects (${separationRules.standardReference})`;

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

  // 2. Infrastructure-specific parameter vs footprint area feasibility checks
  const params = customParams || {};
  if (type === "Solar Farm") {
    const targetMw = Number(params.targetCapacityMw ?? 5);
    const minSolarAreaM2 = Math.round(targetMw * 8000); // ~0.8 ha/MWp minimum packing factor
    if (proposedAreaM2 < minSolarAreaM2) {
      conflicts.push({
        id: "param_solar_density",
        category: "parameter_constraint",
        label: `PV Packing Constraint (${targetMw} MWp)`,
        severity: "warning",
        description: `Planned ${targetMw} MWp Solar Farm typically requires >= ${minSolarAreaM2.toLocaleString()} m² (~8,000 m²/MWp), but current footprint is ${proposedAreaM2.toLocaleString()} m².`,
      });
    }
  } else if (type === "Hospital") {
    const beds = Number(params.bedCapacity ?? 250);
    const minHospitalFootprintM2 = Math.round(beds * 15);
    if (proposedAreaM2 < minHospitalFootprintM2) {
      conflicts.push({
        id: "param_hospital_beds",
        category: "parameter_constraint",
        label: `Hospital Capacity Constraint (${beds} beds)`,
        severity: "warning",
        description: `Planned ${beds}-bed hospital typically requires at least ${minHospitalFootprintM2.toLocaleString()} m² ground footprint.`,
      });
    }
  } else if (type === "School") {
    const students = Number(params.studentCapacity ?? 600);
    const minSchoolAreaM2 = Math.round(students * 4);
    if (proposedAreaM2 < minSchoolAreaM2) {
      conflicts.push({
        id: "param_school_enrollment",
        category: "parameter_constraint",
        label: `Campus Area Constraint (${students} students)`,
        severity: "warning",
        description: `Enrollment of ${students} students typically requires >= ${minSchoolAreaM2.toLocaleString()} m² for classrooms and playfields.`,
      });
    }
  } else if (type === "Drainage") {
    const chWidth = Number(params.channelWidth ?? 3.5);
    if (chWidth > widthM) {
      conflicts.push({
        id: "param_drainage_width",
        category: "parameter_constraint",
        label: "Channel Width Exceeds Corridor",
        severity: "critical",
        description: `Configured channel bottom width (${chWidth}m) exceeds total proposed corridor width (${widthM}m).`,
      });
    }
  }

  // 3. Spatial intersection and infrastructure-specific separation buffer checks
  const maxBufferM = Math.max(
    separationRules.minHazardBufferM,
    separationRules.minRailwayBufferM,
    separationRules.minMotorwayBufferM,
    separationRules.minSameTypeSpacingM || 0,
    150
  );
  const searchRadius = Math.max(Math.round(Math.max(lengthM, widthM) / 2 + maxBufferM), 300);
  const seenConflictKeys = new Set<string>();

  const addConflict = (conf: ConflictingFeature, dedupeKey: string) => {
    if (seenConflictKeys.has(dedupeKey)) return;
    seenConflictKeys.add(dedupeKey);
    conflicts.push(conf);
  };

  try {
    const elements =
      preloadedElements !== undefined
        ? preloadedElements
        : (await overpassProvider.getFeaturesAround(lat, lng, searchRadius)).elements;

    if (elements.length === 0) {
      evidenceComplete = false;
      messages.push(
        "No mapped OpenStreetMap features found within the immediate site buffer. Spatial conflict verification may be incomplete in unmapped areas."
      );
    }

    for (const el of elements) {
      const feature = osmElementToGeoJson(el);
      if (!feature) continue;

      const intersects = doesFootprintIntersect(footprint, feature.geometry);
      const tags = el.tags || {};

      // A. Direct footprint intersection checks
      if (intersects) {
        // Existing buildings
        if (tags.building && tags.building !== "no") {
          const bName = tags.name || tags["building:name"] || `Building #${el.id}`;
          const isLinearCorridor = type === "Road" || type === "Water Canal";
          addConflict(
            {
              id: `osm_${el.id}`,
              category: "building",
              label: bName,
              severity: isLinearCorridor ? "warning" : "critical",
              distanceM: 0,
              description: `Footprint directly intersects existing mapped structure (${bName}).`,
              geometry: feature.geometry,
            },
            `building:${bName}`
          );
        }

        // Waterways / water bodies
        if (
          tags.waterway ||
          tags.natural === "water" ||
          tags.landuse === "reservoir" ||
          tags.water
        ) {
          const wName = tags.name || tags.waterway || "Water body";
          if (!separationRules.allowWaterwayIntersection) {
            addConflict(
              {
                id: `osm_${el.id}`,
                category: "waterway",
                label: wName,
                severity: "critical",
                distanceM: 0,
                description: `Footprint overlaps with active waterway or water body (${wName}), posing high flood / submersion risk.`,
                geometry: feature.geometry,
              },
              `waterway:${wName}`
            );
          }
        }

        // Railways
        if (tags.railway && tags.railway !== "abandoned" && tags.railway !== "disused") {
          const rLabel = `Railway line (${tags.name || tags.railway})`;
          addConflict(
            {
              id: `osm_${el.id}`,
              category: "railway",
              label: rLabel,
              severity: separationRules.allowRailwayIntersection ? "warning" : "critical",
              distanceM: 0,
              description: `Footprint intersects active railway tracks. Requires statutory grade-separated clearance.`,
              geometry: feature.geometry,
            },
            `railway:${rLabel}`
          );
        }

        // Restricted / incompatible landuses
        if (tags.landuse === "military" || tags.military) {
          addConflict(
            {
              id: `osm_${el.id}`,
              category: "restricted_landuse",
              label: "Military Restricted Zone",
              severity: "critical",
              distanceM: 0,
              description:
                "Footprint intersects restricted defense / military landuse with legal building prohibition.",
              geometry: feature.geometry,
            },
            "restricted:military"
          );
        }

        if (tags.landuse === "cemetery" || tags.amenity === "grave_yard") {
          addConflict(
            {
              id: `osm_${el.id}`,
              category: "restricted_landuse",
              label: "Cemetery / Burial Ground",
              severity: "critical",
              distanceM: 0,
              description: "Footprint intersects cemetery or memorial ground.",
              geometry: feature.geometry,
            },
            "restricted:cemetery"
          );
        }

        if (["landfill", "quarry"].includes(tags.landuse || "")) {
          addConflict(
            {
              id: `osm_${el.id}`,
              category: "restricted_landuse",
              label: `Hazardous Landuse (${tags.landuse})`,
              severity: "critical",
              distanceM: 0,
              description: `Footprint directly overlaps mapped ${tags.landuse} site.`,
              geometry: feature.geometry,
            },
            `restricted:${tags.landuse}`
          );
        }

        // Expressways / motorways
        if (tags.highway === "motorway" || tags.highway === "trunk") {
          if (type !== "Bridge" && type !== "Road") {
            const hLabel = `High-speed highway (${tags.name || tags.highway})`;
            addConflict(
              {
                id: `osm_${el.id}`,
                category: "major_road",
                label: hLabel,
                severity: "critical",
                distanceM: 0,
                description: "Direct collision with high-speed motorway right-of-way.",
                geometry: feature.geometry,
              },
              `major_road:${hLabel}`
            );
          }
        }
        continue;
      }

      // B. Infrastructure-specific separation buffer checks (for non-intersecting features)
      const isHazardousLanduse =
        ["industrial", "landfill", "quarry", "military"].includes(tags.landuse || "") ||
        Boolean(tags.military);
      const isActiveRailway =
        Boolean(tags.railway) &&
        tags.railway !== "abandoned" &&
        tags.railway !== "disused" &&
        tags.railway !== "station" &&
        tags.railway !== "subway_entrance";
      const isMotorwayOrTrunk = tags.highway === "motorway" || tags.highway === "trunk";

      if (
        (isHazardousLanduse && separationRules.minHazardBufferM > 0) ||
        (isActiveRailway && separationRules.minRailwayBufferM > 0) ||
        (isMotorwayOrTrunk && separationRules.minMotorwayBufferM > 0)
      ) {
        const edgeDistM = Math.round(
          computeFootprintDistanceToGeometryMeters(footprint, feature.geometry)
        );

        if (isHazardousLanduse && edgeDistM < separationRules.minHazardBufferM) {
          const hzName = tags.name || tags.landuse || "Industrial/Restricted zone";
          addConflict(
            {
              id: `buf_hz_${el.id}`,
              category: "separation_buffer",
              label: `Hazard Setback (${hzName})`,
              severity: edgeDistM < separationRules.minHazardBufferM * 0.4 ? "critical" : "warning",
              distanceM: edgeDistM,
              requiredBufferM: separationRules.minHazardBufferM,
              description: `${config.label} footprint edge is ${edgeDistM}m from ${hzName}, below the recommended ${separationRules.minHazardBufferM}m environmental setback.`,
              geometry: feature.geometry,
            },
            `buf_hz:${hzName}`
          );
        }

        if (isActiveRailway && edgeDistM < separationRules.minRailwayBufferM) {
          const rwName = tags.name || `Railway (${tags.railway})`;
          addConflict(
            {
              id: `buf_rw_${el.id}`,
              category: "separation_buffer",
              label: `Railway Setback (${rwName})`,
              severity: "warning",
              distanceM: edgeDistM,
              requiredBufferM: separationRules.minRailwayBufferM,
              description: `${config.label} footprint is ${edgeDistM}m from active railway (${rwName}), below the ${separationRules.minRailwayBufferM}m vibration/acoustic buffer.`,
              geometry: feature.geometry,
            },
            `buf_rw:${rwName}`
          );
        }

        if (isMotorwayOrTrunk && edgeDistM < separationRules.minMotorwayBufferM) {
          const mwName = tags.name || `Highway (${tags.highway})`;
          addConflict(
            {
              id: `buf_mw_${el.id}`,
              category: "separation_buffer",
              label: `Highway Safety Setback (${mwName})`,
              severity: "warning",
              distanceM: edgeDistM,
              requiredBufferM: separationRules.minMotorwayBufferM,
              description: `${config.label} footprint is ${edgeDistM}m from high-speed ${mwName}, below the ${separationRules.minMotorwayBufferM}m safety/air-quality setback.`,
              geometry: feature.geometry,
            },
            `buf_mw:${mwName}`
          );
        }
      }

      // C. Minimum same-type facility separation (URDPFI inter-facility spacing norm)
      const isSameTypeAmenity =
        (type === "Hospital" && (tags.amenity === "hospital" || tags.amenity === "clinic")) ||
        (type === "School" && (tags.amenity === "school" || tags.amenity === "college")) ||
        (type === "EV Charging Station" && tags.amenity === "charging_station");

      if (isSameTypeAmenity && separationRules.minSameTypeSpacingM > 0) {
        const edgeDistM = Math.round(
          computeFootprintDistanceToGeometryMeters(footprint, feature.geometry)
        );
        if (edgeDistM < separationRules.minSameTypeSpacingM) {
          const sameName = tags.name || `Existing ${config.label}`;
          const isSevereProximity = edgeDistM < separationRules.minSameTypeSpacingM * 0.35;
          addConflict(
            {
              id: `spacing_${el.id}`,
              category: "separation_buffer",
              label: `Inter-Facility Spacing (${sameName})`,
              severity: isSevereProximity ? "critical" : "warning",
              distanceM: edgeDistM,
              requiredBufferM: separationRules.minSameTypeSpacingM,
              description: `Proposed ${config.label} is only ${edgeDistM}m from existing ${sameName}, violating the URDPFI minimum inter-facility separation norm (${separationRules.minSameTypeSpacingM}m). Causes service cannibalization and emergency access congestion.`,
              geometry: feature.geometry,
            },
            `spacing:${sameName}`
          );
        }
      }
    }

    // D. Bridge Approach Road & Network Continuity Validation
    if (type === "Bridge") {
      const hasRoads = elements.some((el) => el.tags && el.tags.highway);
      if (hasRoads) {
        const bridgeAppraisal = analyzeBridgeConnectivity({
          lat,
          lng,
          lengthM,
          widthM,
          bearingDeg,
          osmElements: elements,
        });

        if (bridgeAppraisal.dualBankDisconnected) {
          conflicts.push({
            id: "bridge_dual_bank_disconnect",
            category: "separation_buffer",
            label: "Bridge Approach Missing (Both Banks Disconnected)",
            severity: "critical",
            distanceM: Math.round(
              Math.max(
                bridgeAppraisal.abutmentA.distanceToRoadM,
                bridgeAppraisal.abutmentB.distanceToRoadM
              )
            ),
            description: `Neither bridge abutment connects to a classified road network (Bank A: ${Math.round(
              bridgeAppraisal.abutmentA.distanceToRoadM
            )}m to ${bridgeAppraisal.abutmentA.targetRoad?.name || "road"}; Bank B: ${Math.round(
              bridgeAppraisal.abutmentB.distanceToRoadM
            )}m to ${bridgeAppraisal.abutmentB.targetRoad?.name || "road"}). Bridge cannot function without constructing dedicated approach corridors.`,
          });
        } else if (
          !bridgeAppraisal.abutmentA.isConnected ||
          !bridgeAppraisal.abutmentB.isConnected
        ) {
          const disBank = !bridgeAppraisal.abutmentA.isConnected
            ? bridgeAppraisal.abutmentA
            : bridgeAppraisal.abutmentB;
          conflicts.push({
            id: `bridge_single_bank_disconnect_${disBank.abutmentIndex}`,
            category: "separation_buffer",
            label: `Bridge Dead-End (${disBank.bankLabel})`,
            severity: "warning",
            distanceM: Math.round(disBank.distanceToRoadM),
            description: `${disBank.bankLabel} terminates in open ground without street frontage (${Math.round(
              disBank.distanceToRoadM
            )}m gap to ${disBank.targetRoad?.name || "unnamed road"}). Requires approach road extension.`,
          });
        }
      }
    }
  } catch (err: any) {
    evidenceComplete = false;
    console.warn("[Validation Feature Check Warning]", err.message);
    messages.push("Unable to verify local mapped features due to temporary provider unavailability.");
  }

  // 4. Determine overall validation status & adjust location-specific limit
  const criticalCount = conflicts.filter((c) => c.severity === "critical").length;
  const warningCount = conflicts.filter((c) => c.severity === "warning").length;
  const outOfBounds = proposedAreaM2 < config.minAreaM2 || proposedAreaM2 > config.maxAreaM2;

  let status: "pass" | "warn" | "fail" = "pass";

  if (criticalCount > 0) {
    status = "fail";
    const reductionFactor = Math.max(0.25, 1 - criticalCount * 0.25);
    siteMaxArea = Math.min(siteMaxArea, Math.round(proposedAreaM2 * reductionFactor));
    limitReason = `Severely constrained by ${criticalCount} critical spatial conflict(s) on site (${conflicts
      .filter((c) => c.severity === "critical")
      .map((c) => c.label)
      .slice(0, 2)
      .join(", ")}).`;
  } else if (warningCount > 0 || outOfBounds || !evidenceComplete) {
    status = "warn";
    if (warningCount > 0) {
      siteMaxArea = Math.min(siteMaxArea, Math.round(proposedAreaM2 * 0.85));
      limitReason = `Constrained by ${warningCount} setback or right-of-way warning(s) (${conflicts
        .map((c) => c.label)
        .slice(0, 2)
        .join(", ")}).`;
    } else if (proposedAreaM2 < config.minAreaM2) {
      limitReason = `Below minimum operational area (${config.minAreaM2.toLocaleString()} m²) for ${config.label}.`;
    } else if (proposedAreaM2 > config.maxAreaM2) {
      limitReason = `Exceeds typical single-phase envelope (${config.maxAreaM2.toLocaleString()} m²) for ${config.label}.`;
    } else {
      limitReason = `Incomplete OpenStreetMap coverage around site; field verification required for ${config.label}.`;
    }
  } else {
    limitReason = `Clear site: footprint satisfies spatial intersection and setback norms for ${config.label}.`;
  }

  return {
    status,
    geometryValid: geomCheck.valid,
    proposedAreaM2,
    allowedAreaRange: {
      minM2: siteMinArea,
      maxM2: Math.max(siteMaxArea, siteMinArea),
      reason: limitReason,
    },
    conflicts,
    messages,
    evidenceComplete,
  };
}

