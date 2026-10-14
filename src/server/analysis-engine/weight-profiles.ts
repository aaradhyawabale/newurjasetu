import { InfrastructureTypeId, INFRASTRUCTURE_TYPES } from "@/config/infra-types";

export interface WeightProfile {
  id: string;
  name: string;
  description: string;
  weights: Record<string, number>; // criterionId -> weight (sums to 1.0)
  rationale: string;
}

/**
 * Standard alternative MCDA weighting profiles for sensitivity analysis.
 * Uses exact criterion IDs from INFRASTRUCTURE_TYPES[type].criteria.
 */
export const INFRASTRUCTURE_WEIGHT_PROFILES: Record<InfrastructureTypeId, WeightProfile[]> = {
  Hospital: [
    {
      id: "baseline",
      name: "Standard Balanced Planning",
      description: "Default balanced weighting reflecting URDPFI and emergency healthcare planning norms.",
      rationale: "Balances rapid emergency logistics, underserved catchment coverage, acoustic buffers, and flat grading.",
      weights: {
        arterial_access: 0.20,
        healthcare_gap: 0.20,
        residential_catchment: 0.20,
        hazard_noise_buffer: 0.15,
        terrain_slope: 0.15,
        osm_coverage: 0.10,
      },
    },
    {
      id: "emergency_access",
      name: "Emergency Logistics Priority",
      description: "Prioritizes immediate high-speed arterial connectivity and terrain access for ambulances.",
      rationale: "Critical trauma centers where 5-minute ambulance transit time overrides local gap margins.",
      weights: {
        arterial_access: 0.35,
        healthcare_gap: 0.15,
        residential_catchment: 0.15,
        hazard_noise_buffer: 0.10,
        terrain_slope: 0.15,
        osm_coverage: 0.10,
      },
    },
    {
      id: "equity_catchment",
      name: "Public Health Equity & Gap Priority",
      description: "Maximizes siting in medically underserved zones with dense residential populations.",
      rationale: "Focuses on providing new hospital beds where existing institutional deficits are highest.",
      weights: {
        arterial_access: 0.15,
        healthcare_gap: 0.35,
        residential_catchment: 0.25,
        hazard_noise_buffer: 0.10,
        terrain_slope: 0.10,
        osm_coverage: 0.05,
      },
    },
  ],
  School: [
    {
      id: "baseline",
      name: "Standard Balanced Planning",
      description: "Balanced educational planning norms across catchment, walkability, and safety.",
      rationale: "Balances student population reach, safe arterial buffers, and gentle topography for campus buildings.",
      weights: {
        residential_catchment: 0.25,
        education_gap: 0.20,
        highway_safety_buffer: 0.20,
        park_proximity: 0.15,
        terrain_slope: 0.10,
        osm_coverage: 0.10,
      },
    },
    {
      id: "child_safety",
      name: "Pedestrian Safety & Buffer Priority",
      description: "Prioritizes heavy setbacks from arterial traffic and high proximity to public parks.",
      rationale: "Ensures primary school children are fully insulated from traffic collisions and vehicular emissions.",
      weights: {
        residential_catchment: 0.20,
        education_gap: 0.15,
        highway_safety_buffer: 0.35,
        park_proximity: 0.15,
        terrain_slope: 0.10,
        osm_coverage: 0.05,
      },
    },
    {
      id: "walkability_reach",
      name: "Dense Catchment & Need Priority",
      description: "Maximizes pedestrian student enrollment coverage and unserved educational gaps.",
      rationale: "Targets dense urban wards where students must walk to neighborhood schools.",
      weights: {
        residential_catchment: 0.35,
        education_gap: 0.30,
        highway_safety_buffer: 0.15,
        park_proximity: 0.10,
        terrain_slope: 0.05,
        osm_coverage: 0.05,
      },
    },
  ],
  Park: [
    {
      id: "baseline",
      name: "Standard Balanced Planning",
      description: "Default open space distribution balancing population reach, deficit relief, and natural synergy.",
      rationale: "Optimizes urban greening near residential clusters and existing waterways while ensuring pedestrian access.",
      weights: {
        green_space_deficit: 0.30,
        residential_catchment: 0.25,
        waterway_synergy: 0.15,
        footpath_road_access: 0.15,
        terrain_slope: 0.05,
        osm_coverage: 0.10,
      },
    },
    {
      id: "environmental_restoration",
      name: "Riparian & Environmental Synergy",
      description: "Prioritizes natural waterway corridors and riparian floodplain buffer preservation.",
      rationale: "Focuses on ecological restoration and nature-based stormwater retention over street frontage.",
      weights: {
        green_space_deficit: 0.20,
        residential_catchment: 0.15,
        waterway_synergy: 0.35,
        footpath_road_access: 0.15,
        terrain_slope: 0.10,
        osm_coverage: 0.05,
      },
    },
    {
      id: "urban_equity",
      name: "High-Density Ward Relief",
      description: "Maximizes park delivery in dense urban concrete wards currently lacking any green cover.",
      rationale: "Provides immediate recreation and heat-island relief to dense residential areas.",
      weights: {
        green_space_deficit: 0.35,
        residential_catchment: 0.35,
        waterway_synergy: 0.10,
        footpath_road_access: 0.10,
        terrain_slope: 0.05,
        osm_coverage: 0.05,
      },
    },
  ],
  Road: [
    {
      id: "baseline",
      name: "Standard Balanced Planning",
      description: "Standard corridor planning balancing structural avoidance, gradient, and arterial links.",
      rationale: "Ensures constructible roadway alignment with minimal structure displacement.",
      weights: {
        grid_connectivity: 0.30,
        building_displacement_risk: 0.25,
        water_rail_crossings: 0.15,
        longitudinal_slope: 0.20,
        osm_coverage: 0.10,
      },
    },
    {
      id: "civil_cost_minimization",
      name: "Minimal Displacement & Earthwork",
      description: "Heavily penalizes building demolition, culverts, and steep grading.",
      rationale: "Optimizes for lowest civil construction capital expenditure and fastest right-of-way clearance.",
      weights: {
        grid_connectivity: 0.15,
        building_displacement_risk: 0.40,
        water_rail_crossings: 0.20,
        longitudinal_slope: 0.20,
        osm_coverage: 0.05,
      },
    },
    {
      id: "network_connectivity",
      name: "Arterial Network Efficiency",
      description: "Prioritizes direct connectivity to primary and trunk highway networks.",
      rationale: "Focuses on high-capacity bypass links and regional freight corridors.",
      weights: {
        grid_connectivity: 0.45,
        building_displacement_risk: 0.20,
        water_rail_crossings: 0.10,
        longitudinal_slope: 0.15,
        osm_coverage: 0.10,
      },
    },
  ],
  Bridge: [
    {
      id: "baseline",
      name: "Standard Balanced Planning",
      description: "Standard bridge siting balancing barrier traversal, approach roads, and structural clearances.",
      rationale: "Ensures hydraulic/rail span alignment while avoiding costly land acquisition at abutments.",
      weights: {
        span_barrier_alignment: 0.30,
        approach_road_classes: 0.25,
        crossing_redundancy: 0.15,
        abutment_clearance: 0.15,
        flood_elevation_profile: 0.05,
        osm_coverage: 0.10,
      },
    },
    {
      id: "bottleneck_relief",
      name: "Crossing Bottleneck Relief",
      description: "Prioritizes unserved barrier stretches with maximum distance to existing bridges.",
      rationale: "Targets high-impact river/rail crossings where regional detour distances are extreme.",
      weights: {
        span_barrier_alignment: 0.25,
        approach_road_classes: 0.20,
        crossing_redundancy: 0.35,
        abutment_clearance: 0.10,
        flood_elevation_profile: 0.05,
        osm_coverage: 0.05,
      },
    },
    {
      id: "abutment_feasibility",
      name: "Clear Abutment & Approach Priority",
      description: "Focuses on clear abutments and high-class approach road connectivity.",
      rationale: "Minimizes urban demolition and approach flyover construction costs.",
      weights: {
        span_barrier_alignment: 0.25,
        approach_road_classes: 0.35,
        crossing_redundancy: 0.10,
        abutment_clearance: 0.20,
        flood_elevation_profile: 0.05,
        osm_coverage: 0.05,
      },
    },
  ],
  "Water Canal": [
    {
      id: "baseline",
      name: "Standard Balanced Planning",
      description: "Standard open-channel gravity conveyance alignment.",
      rationale: "Ensures mild slope, safe water intake/outfall, and minimal corridor crossings.",
      weights: {
        gravity_gradient: 0.30,
        waterway_outfall_link: 0.25,
        structure_avoidance: 0.20,
        road_crossing_cost: 0.15,
        osm_coverage: 0.10,
      },
    },
    {
      id: "hydraulic_gravity",
      name: "Hydraulic Grade Priority",
      description: "Maximizes adherence to ideal 0.5%–2.0% gravity flow gradient.",
      rationale: "Prevents silting (too flat) and scour/lining erosion (too steep) in bulk water transport.",
      weights: {
        gravity_gradient: 0.45,
        waterway_outfall_link: 0.25,
        structure_avoidance: 0.15,
        road_crossing_cost: 0.10,
        osm_coverage: 0.05,
      },
    },
    {
      id: "minimum_displacement",
      name: "Right-of-Way Clearance Priority",
      description: "Prioritizes minimal building demolition and minimal road/rail siphon crossings.",
      rationale: "Reduces land acquisition friction and expensive underground culvert/siphon construction.",
      weights: {
        gravity_gradient: 0.20,
        waterway_outfall_link: 0.20,
        structure_avoidance: 0.35,
        road_crossing_cost: 0.20,
        osm_coverage: 0.05,
      },
    },
  ],
  Building: [
    {
      id: "baseline",
      name: "Standard Balanced Planning",
      description: "Standard civic/commercial building siting norms.",
      rationale: "Balances street frontage, foundation slope, land-use compatibility, and utility reach.",
      weights: {
        road_frontage: 0.25,
        landuse_compatibility: 0.25,
        utility_power_proximity: 0.20,
        slope_stability: 0.15,
        osm_coverage: 0.15,
      },
    },
    {
      id: "civil_foundation",
      name: "Foundation & Environmental Safety",
      description: "Prioritizes gentle terrain and buffer from incompatible/industrial land use.",
      rationale: "Minimizes structural piling, retaining walls, and airborne environmental nuisance.",
      weights: {
        road_frontage: 0.20,
        landuse_compatibility: 0.30,
        utility_power_proximity: 0.15,
        slope_stability: 0.30,
        osm_coverage: 0.05,
      },
    },
    {
      id: "infrastructure_access",
      name: "Frontage & Electrical Utility Priority",
      description: "Maximizes immediate road frontage and power grid connection.",
      rationale: "Ensures rapid commercial occupancy and utility energization.",
      weights: {
        road_frontage: 0.40,
        landuse_compatibility: 0.15,
        utility_power_proximity: 0.25,
        slope_stability: 0.15,
        osm_coverage: 0.05,
      },
    },
  ],
  "Transit Station": [
    {
      id: "baseline",
      name: "Standard Balanced Planning",
      description: "Transit-oriented development (TOD) balanced siting criteria.",
      rationale: "Balances pedestrian catchment, feeder street access, and intermodal connectivity.",
      weights: {
        density_catchment: 0.30,
        intermodal_connectivity: 0.25,
        road_arterial_access: 0.20,
        transit_network_gap: 0.15,
        osm_coverage: 0.10,
      },
    },
    {
      id: "first_last_mile",
      name: "First/Last-Mile Intermodal Priority",
      description: "Prioritizes integration with local bus routes, shared mobility, and feeder roads.",
      rationale: "Maximizes commuter transfer ease between regional rail/metro and local feeder networks.",
      weights: {
        density_catchment: 0.20,
        intermodal_connectivity: 0.40,
        road_arterial_access: 0.25,
        transit_network_gap: 0.10,
        osm_coverage: 0.05,
      },
    },
    {
      id: "unserved_walkshed",
      name: "Unserved Walkshed & Gap Priority",
      description: "Maximizes station delivery in dense residential zones lacking existing rapid transit.",
      rationale: "Expands mass transit coverage into unserved transit deserts.",
      weights: {
        density_catchment: 0.40,
        intermodal_connectivity: 0.15,
        road_arterial_access: 0.15,
        transit_network_gap: 0.25,
        osm_coverage: 0.05,
      },
    },
  ],
  Drainage: [
    {
      id: "baseline",
      name: "Standard Balanced Planning",
      description: "Standard stormwater drainage siting and hydraulic capacity norms.",
      rationale: "Balances Manning gravity flow, natural depression alignment, outfall link, runoff demand, and rainfall intensity.",
      weights: {
        topographic_depression: 0.25,
        outfall_proximity: 0.25,
        impervious_surface_proxy: 0.20,
        manning_capacity_check: 0.15,
        precipitation_intensity: 0.05,
        osm_coverage: 0.10,
      },
    },
    {
      id: "hydraulic_gravity",
      name: "Hydraulic Capacity & Outfall Priority",
      description: "Maximizes open-channel conveyance and immediate natural receiving water outfall.",
      rationale: "Prevents localized backwater flooding during high-intensity cloudbursts.",
      weights: {
        topographic_depression: 0.30,
        outfall_proximity: 0.30,
        impervious_surface_proxy: 0.10,
        manning_capacity_check: 0.20,
        precipitation_intensity: 0.05,
        osm_coverage: 0.05,
      },
    },
    {
      id: "urban_runoff_demand",
      name: "Runoff Hotspot Relief Priority",
      description: "Prioritizes heavily built catchments prone to high runoff volume.",
      rationale: "Focuses on intercepting runoff from impervious pavement in chronic flood zones.",
      weights: {
        topographic_depression: 0.15,
        outfall_proximity: 0.20,
        impervious_surface_proxy: 0.35,
        manning_capacity_check: 0.15,
        precipitation_intensity: 0.10,
        osm_coverage: 0.05,
      },
    },
  ],
  "Solar Farm": [
    {
      id: "baseline",
      name: "Standard Balanced Planning",
      description: "Standard utility-scale solar PV planning criteria.",
      rationale: "Balances high solar irradiance, clear solar horizon, gentle terrain, and grid connection.",
      weights: {
        solar_irradiance: 0.30,
        grid_substation_proximity: 0.25,
        slope_and_aspect: 0.20,
        road_maintenance_access: 0.10,
        shading_obstruction_proxy: 0.05,
        osm_coverage: 0.10,
      },
    },
    {
      id: "grid_interconnection",
      name: "Grid Interconnection & Capex Priority",
      description: "Prioritizes short distance to high-voltage substations and road access.",
      rationale: "Interconnection feeder lines and access roads represent major upfront capital and easement risks.",
      weights: {
        solar_irradiance: 0.20,
        grid_substation_proximity: 0.40,
        slope_and_aspect: 0.15,
        road_maintenance_access: 0.15,
        shading_obstruction_proxy: 0.05,
        osm_coverage: 0.05,
      },
    },
    {
      id: "yield_maximization",
      name: "Solar Resource & Flat Land Priority",
      description: "Maximizes annual GHI and guarantees optimal solar slope.",
      rationale: "Maximizes 25-year levelized cost of energy (LCOE) generation in utility power purchase agreements.",
      weights: {
        solar_irradiance: 0.45,
        grid_substation_proximity: 0.15,
        slope_and_aspect: 0.25,
        road_maintenance_access: 0.05,
        shading_obstruction_proxy: 0.05,
        osm_coverage: 0.05,
      },
    },
  ],
};

/**
 * Validates that custom or profile weights are valid:
 * 1. Contains numbers for all criteria of the infrastructure type.
 * 2. Every weight is non-negative.
 * 3. Normalizes weights so they sum exactly to 1.0.
 */
export function validateCriterionWeights(
  type: InfrastructureTypeId,
  weights: Record<string, number>,
  criterionIds: string[]
): { valid: boolean; normalizedWeights: Record<string, number>; reason?: string } {
  let sum = 0;
  const out: Record<string, number> = {};

  for (const cid of criterionIds) {
    const raw = weights[cid];
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
      return {
        valid: false,
        normalizedWeights: {},
        reason: `Criterion "${cid}" has invalid weight: ${String(raw)}. Must be a non-negative number.`,
      };
    }
    out[cid] = raw;
    sum += raw;
  }

  if (sum <= 0) {
    return {
      valid: false,
      normalizedWeights: {},
      reason: "Total criterion weights cannot sum to zero.",
    };
  }

  // Normalize so sum is exactly 1.0
  const normalized: Record<string, number> = {};
  for (const cid of criterionIds) {
    normalized[cid] = Math.round((out[cid] / sum) * 1000) / 1000;
  }

  return { valid: true, normalizedWeights: normalized };
}
