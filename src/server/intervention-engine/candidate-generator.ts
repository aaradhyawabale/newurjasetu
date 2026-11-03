import { 
  InterventionCandidate, 
  InterventionCategoryId, 
  EvidenceCompletenessLevel, 
  CandidateStatus, 
  EvidenceLedgerItem,
  SiteConstraint,
  MissingSurveyItem
} from './types';
import { queryHeatPoint } from '../heat-engine/loader';
import { INTERVENTION_CATEGORIES } from './intervention-registry';
import { getDynamicCandidates, getDynamicCandidateById } from './dynamic-discovery-engine';

interface CandidateRawSeed {
  id: string;
  categoryId: InterventionCategoryId;
  name: string;
  wardOrPrabhag: string;
  locationSummary: string;
  lng: number;
  lat: number;
  primaryFeatureType: string;
  nearestRoadDistanceM: number;
  nearestRoadName: string;
  nearestSubstationDistanceM?: number;
  nearestSubstationName?: string;
  nearestParkingDistanceM?: number;
  nearestTransitHubDistanceM?: number;
  estimatedTargetAreaM2?: number;
  status: CandidateStatus;
  statusRationale: string;
  constraints: SiteConstraint[];
  missingSurveyChecklist: MissingSurveyItem[];
  recommendedNextAction: string;
}

const CANDIDATE_SEEDS: CandidateRawSeed[] = [
  // 1. URBAN GREENING CORRIDOR
  {
    id: 'cand-green-karve-road',
    categoryId: 'URBAN_GREENING_CORRIDOR',
    name: 'Karve Road Arterial Greening Corridor',
    wardOrPrabhag: 'Prabhag 12 (Kothrud - Deccan)',
    locationSummary: 'High-density commercial and transit corridor connecting Kothrud to Deccan Gymkhana along the Metro Line 2 alignment.',
    lng: 73.8180,
    lat: 18.5085,
    primaryFeatureType: 'Primary Arterial Road / Metro Viaduct Corridor',
    nearestRoadDistanceM: 5,
    nearestRoadName: 'Karve Road',
    nearestSubstationDistanceM: 380,
    nearestSubstationName: 'MSEDCL Kothrud Substation',
    nearestParkingDistanceM: 140,
    nearestTransitHubDistanceM: 110,
    estimatedTargetAreaM2: 12500,
    status: 'ELIGIBLE_FOR_REVIEW',
    statusRationale: 'High vehicular throughput, pronounced asphalt thermal emission, and low vegetative cover along pedestrian footways.',
    constraints: [
      {
        id: 'c-karve-1',
        title: 'Metro Pier & Overhead Catenary Clearances',
        severity: 'CRITICAL_BLOCKER',
        description: 'MahaMetro Line 2 viaduct columns and overhead traction power lines restrict canopy tree heights to under 6.0m directly under track alignment.',
        mitigationRequirement: 'Specify columnar or multi-stem shrubs and small trees (Bauhinia, Tabebuia) maintaining 4m clearance from traction catenary.'
      },
      {
        id: 'c-karve-2',
        title: 'High-Density Underground Telecom & Gas Utilities',
        severity: 'MODERATE_CONSTRAINT',
        description: 'Dense underground optical fibre ducts, MNGL domestic gas pipelines, and MSEB 11kV cables occupy both northern and southern pedestrian footpaths.',
        mitigationRequirement: 'Ground-penetrating radar (GPR) utility survey required before excavating any continuous tree trench.'
      }
    ],
    missingSurveyChecklist: [
      {
        id: 'surv-karve-1',
        itemName: 'Underground Utility Cadastre Survey',
        requiredForPhase: 'TECHNICAL_FEASIBILITY',
        description: 'Non-destructive GPR scanning to locate buried gas, water, electric, and telecom lines along a 1.8km stretch.',
        surveyStandardOrMethodology: 'ASCE 38-02 Quality Level B GPR Mapping'
      },
      {
        id: 'surv-karve-2',
        itemName: 'Pedestrian Walkway Clear Width Measurement',
        requiredForPhase: 'DETAILED_PROJECT_REPORT',
        description: 'Verify IRC:103-2012 compliance ensuring minimum 1.8m unencumbered walking path remains after tree pit construction.',
        surveyStandardOrMethodology: 'IRC:103-2012 Walkability & Pedestrian Infrastructure Audit'
      }
    ],
    recommendedNextAction: 'Commission joint site survey with MahaMetro and PMC Road Department for footpath tree-basin demarcation.'
  },
  {
    id: 'cand-green-laxmi-road',
    categoryId: 'URBAN_GREENING_CORRIDOR',
    name: 'Laxmi Road Heritage Core Greening',
    wardOrPrabhag: 'Prabhag 15 (Kasba - Vishrambaug Wada)',
    locationSummary: 'Extremely dense traditional retail corridor with continuous shopfronts, zero building setbacks, and high pedestrian density.',
    lng: 73.8520,
    lat: 18.5165,
    primaryFeatureType: 'Commercial Corridor / Heritage Precinct',
    nearestRoadDistanceM: 2,
    nearestRoadName: 'Laxmi Road',
    nearestSubstationDistanceM: 420,
    nearestSubstationName: 'MSEDCL Rasta Peth Substation',
    nearestParkingDistanceM: 350,
    nearestTransitHubDistanceM: 520,
    estimatedTargetAreaM2: 6800,
    status: 'CONDITIONALLY_ELIGIBLE',
    statusRationale: 'Elevated urban heat and negligible vegetative cover, but narrow right-of-way (ROW < 12m) significantly limits standard in-ground tree planting.',
    constraints: [
      {
        id: 'c-laxmi-1',
        title: 'Severe Right-of-Way Width Restriction',
        severity: 'CRITICAL_BLOCKER',
        description: 'Carriageway is restricted to 9-11 metres total width with continuous on-street commercial loading, leaving footpaths under 1.2m wide in multiple sections.',
        mitigationRequirement: 'In-ground shade trees cannot be accommodated without violating IRC:103 pedestrian standards. Modular vertical green facades and awnings are required.'
      },
      {
        id: 'c-laxmi-2',
        title: 'Heritage Facade Preservation Constraints',
        severity: 'MODERATE_CONSTRAINT',
        description: 'Presence of historic wada facades and traditional timber architecture requiring PMC Heritage Committee clearance for wall attachments.',
        mitigationRequirement: 'Freestanding self-supporting green screens; no direct structural anchorage into heritage masonry.'
      }
    ],
    missingSurveyChecklist: [
      {
        id: 'surv-laxmi-1',
        itemName: 'Heritage Facade Structural Audit',
        requiredForPhase: 'TECHNICAL_FEASIBILITY',
        description: 'PMC Heritage Conservation Committee inspection of candidate building walls for green facade load capacity.',
        surveyStandardOrMethodology: 'PMC Heritage Regulations 2012 Compliance Inspection'
      },
      {
        id: 'surv-laxmi-2',
        itemName: 'Pedestrian Flow & Shopfront Egress Audit',
        requiredForPhase: 'DETAILED_PROJECT_REPORT',
        description: 'Peak pedestrian volume count and emergency egress clearance study during festive shopping hours.',
        surveyStandardOrMethodology: 'Highway Capacity Manual (HCM) Pedestrian Level of Service (LOS)'
      }
    ],
    recommendedNextAction: 'Present alternative modular vertical greening and hanging planter proposal to PMC Heritage Cell and Merchant Association.'
  },
  {
    id: 'cand-green-fc-road',
    categoryId: 'URBAN_GREENING_CORRIDOR',
    name: 'Fergusson College Road Pedestrian Avenue',
    wardOrPrabhag: 'Prabhag 09 (Shivajinagar - Model Colony)',
    locationSummary: 'Vibrant university commercial boulevard with wide sidewalks, mature rain trees, and continuous youth and shopper footfall.',
    lng: 73.8415,
    lat: 18.5240,
    primaryFeatureType: 'Secondary Arterial Road / Pedestrian Boulevard',
    nearestRoadDistanceM: 4,
    nearestRoadName: 'Fergusson College Road',
    nearestSubstationDistanceM: 310,
    nearestSubstationName: 'Deccan 11kV Distribution Transformer',
    nearestParkingDistanceM: 80,
    nearestTransitHubDistanceM: 320,
    estimatedTargetAreaM2: 15400,
    status: 'ELIGIBLE_FOR_REVIEW',
    statusRationale: 'High existing sidewalk width (> 2.5m) and substantial pedestrian volumes, with opportunities for canopy infill and permeable median bioswales.',
    constraints: [
      {
        id: 'c-fc-1',
        title: 'Existing Mature Tree Root Encroachment',
        severity: 'SURVEY_FLAG',
        description: 'Established mature Samanea saman (Rain Tree) roots have caused localized sidewalk heaving and pavement displacement.',
        mitigationRequirement: 'Install root deflector barriers during pavement repaving and enlarge unpaved permeable tree basins to 2m x 2m.'
      }
    ],
    missingSurveyChecklist: [
      {
        id: 'surv-fc-1',
        itemName: 'Arboricultural Health & Hazard Assessment',
        requiredForPhase: 'TECHNICAL_FEASIBILITY',
        description: 'Sonic tomography and visual health evaluation of 85 existing mature roadside trees along FC Road corridor.',
        surveyStandardOrMethodology: 'ISA Tree Risk Assessment Qualification (TRAQ)'
      }
    ],
    recommendedNextAction: 'Submit detailed tree basin enlargement and permeable paver proposal to PMC Garden and Road Departments.'
  },

  // 2. COOL ROOF FEASIBILITY
  {
    id: 'cand-roof-pmc-hq',
    categoryId: 'COOL_ROOF_FEASIBILITY',
    name: 'Pune Municipal Corporation Administrative HQ Complex',
    wardOrPrabhag: 'Prabhag 09 (Shivajinagar)',
    locationSummary: 'Civic headquarters complex in Shivajinagar featuring multiple interconnected multi-storey RCC institutional office wings.',
    lng: 73.8545,
    lat: 18.5284,
    primaryFeatureType: 'Municipal Administrative Building',
    nearestRoadDistanceM: 15,
    nearestRoadName: 'Mangala Theatre Road / Shivaji Bridge Approach',
    nearestSubstationDistanceM: 190,
    nearestSubstationName: 'MSEDCL Shivajinagar 11kV Substation',
    nearestParkingDistanceM: 20,
    nearestTransitHubDistanceM: 140,
    estimatedTargetAreaM2: 8200,
    status: 'ELIGIBLE_FOR_REVIEW',
    statusRationale: 'Large flat concrete roof footprint, continuous public occupancy, elevated surface temperature, and flagship municipal leadership potential.',
    constraints: [
      {
        id: 'c-pmc-1',
        title: 'Rooftop HVAC & Communication Antenna Congestion',
        severity: 'MODERATE_CONSTRAINT',
        description: 'Central air conditioning cooling towers, chiller ductwork, municipal wireless relays, and water storage tanks occupy ~35% of total roof slab.',
        mitigationRequirement: 'Usable cool-roof application area must be restricted to surveyed unobstructed roof bays (~5,300 m2 net).'
      },
      {
        id: 'c-pmc-2',
        title: 'Existing Waterproofing Membrane Age',
        severity: 'SURVEY_FLAG',
        description: 'Existing bitumen/APP waterproofing membrane applied over 7 years ago; surface adhesion test required prior to liquid high-SRI coating.',
        mitigationRequirement: 'Carry out pull-off adhesion testing (ASTM D4541) and repair substrate blistering before coating application.'
      }
    ],
    missingSurveyChecklist: [
      {
        id: 'surv-pmc-1',
        itemName: 'Roof Slab Structural Load & Core Testing',
        requiredForPhase: 'TECHNICAL_FEASIBILITY',
        description: 'Non-destructive ultrasonic pulse velocity and rebound hammer testing of roof slab concrete in accordance with IS 516.',
        surveyStandardOrMethodology: 'IS 516 / IS 13311 (Part 1 & 2)'
      },
      {
        id: 'surv-pmc-2',
        itemName: 'Unobstructed Rooftop Cadastral Area Survey',
        requiredForPhase: 'DETAILED_PROJECT_REPORT',
        description: 'Total station or drone photogrammetry mapping to delineate net usable roof area excluding parapets, plant rooms, and ductwork.',
        surveyStandardOrMethodology: 'BEE ECBC 2017 Rooftop Usability Audit'
      }
    ],
    recommendedNextAction: 'Execute non-destructive slab integrity test and prepare Tender Specification referencing BEE ECBC 2017 Table 4.1 (Initial SRI >= 78).'
  },
  {
    id: 'cand-roof-sassoon-hospital',
    categoryId: 'COOL_ROOF_FEASIBILITY',
    name: 'Sassoon General Hospital Ward Buildings',
    wardOrPrabhag: 'Prabhag 16 (Pune Station - Sassoon)',
    locationSummary: 'Premier government teaching hospital campus housing thousands of in-patients, ICU facilities, and administrative wings.',
    lng: 73.8715,
    lat: 18.5255,
    primaryFeatureType: 'Public Healthcare Hospital Campus',
    nearestRoadDistanceM: 20,
    nearestRoadName: 'Sassoon Road / Station Road',
    nearestSubstationDistanceM: 210,
    nearestSubstationName: 'Central Railway 22kV Traction Substation',
    nearestParkingDistanceM: 60,
    nearestTransitHubDistanceM: 180,
    estimatedTargetAreaM2: 14500,
    status: 'ELIGIBLE_FOR_REVIEW',
    statusRationale: 'High thermal exposure, medically vulnerable patient population on top floors, high non-AC patient ward density where cool roof retrofit can lower indoor heat gain.',
    constraints: [
      {
        id: 'c-sassoon-1',
        title: 'Occupied Hospital Ward Safety During Application',
        severity: 'CRITICAL_BLOCKER',
        description: 'Hospital wards directly beneath roof slabs remain fully occupied 24/7; zero volatile organic compound (VOC) emissions permitted.',
        mitigationRequirement: 'Specify water-borne, ultra-low VOC, non-odorous elastomeric acrylic or polyurethane coatings complying with Green Seal GS-11.'
      },
      {
        id: 'c-sassoon-2',
        title: 'Heritage Status of Historic David Sassoon Building Wing',
        severity: 'MODERATE_CONSTRAINT',
        description: 'Historic gothic revival stone hospital block (1867) has pitched clay tile roof; cool coating cannot be applied to heritage tile surfaces.',
        mitigationRequirement: 'Confine cool roof application strictly to modern flat RCC surgical, emergency, and 11-storey multi-speciality wings.'
      }
    ],
    missingSurveyChecklist: [
      {
        id: 'surv-sassoon-1',
        itemName: 'Indoor Top-Floor Thermal Comfort Assessment',
        requiredForPhase: 'TECHNICAL_FEASIBILITY',
        description: 'Multi-point data logger temperature and humidity profiling in non-air-conditioned top-floor hospital wards over a 7-day period.',
        surveyStandardOrMethodology: 'ASHRAE Standard 55-2020 Thermal Environmental Conditions'
      },
      {
        id: 'surv-sassoon-2',
        itemName: 'Waterproofing & Parapet Flashings Inspection',
        requiredForPhase: 'DETAILED_PROJECT_REPORT',
        description: 'Infrared thermography scan during dusk to locate dampness pockets and subsurface water entrapment under existing roof screed.',
        surveyStandardOrMethodology: 'ASTM C1153 Infrared Rooftop Moisture Survey'
      }
    ],
    recommendedNextAction: 'Request site access clearance from Sassoon Hospital Dean and Medical Superintendent for non-destructive roof diagnostics.'
  },
  {
    id: 'cand-roof-balgandharva',
    categoryId: 'COOL_ROOF_FEASIBILITY',
    name: 'Balgandharva Ranga Mandir & Art Gallery Complex',
    wardOrPrabhag: 'Prabhag 09 (Shivajinagar / JM Road)',
    locationSummary: 'Prestigious municipal performing arts auditorium, exhibition halls, and open cultural plaza situated along JM Road.',
    lng: 73.8480,
    lat: 18.5220,
    primaryFeatureType: 'Municipal Cultural & Auditorium Complex',
    nearestRoadDistanceM: 25,
    nearestRoadName: 'Jangali Maharaj (JM) Road',
    nearestSubstationDistanceM: 280,
    nearestSubstationName: 'Deccan 11kV Distribution Transformer',
    nearestParkingDistanceM: 15,
    nearestTransitHubDistanceM: 250,
    estimatedTargetAreaM2: 5600,
    status: 'ELIGIBLE_FOR_REVIEW',
    statusRationale: 'Expansive concrete fly-tower and auditorium roof with massive daytime solar radiation, adjacent to open cultural plaza.',
    constraints: [
      {
        id: 'c-bal-1',
        title: 'Acoustic Insulation & Roof Membrane Co-Existence',
        severity: 'MODERATE_CONSTRAINT',
        description: 'Auditorium roof features acoustic dampening layers beneath waterproofing that must not be punctured or chemically degraded by solvents.',
        mitigationRequirement: 'Water-based primer and elastomer coating only, strictly following manufacturer compatibility certifications.'
      }
    ],
    missingSurveyChecklist: [
      {
        id: 'surv-bal-1',
        itemName: 'Roof Screed & Parapet Water-Tightness Survey',
        requiredForPhase: 'TECHNICAL_FEASIBILITY',
        description: 'Visual survey and 24-hour flood testing on designated roof bays to confirm zero water ingress.',
        surveyStandardOrMethodology: 'ASTM D5957 Standard Guide for Flood Testing'
      }
    ],
    recommendedNextAction: 'Coordinate with PMC Cultural Cell and Auditorium Maintenance Division for off-season retrofit window.'
  },

  // 3. SOLAR CANOPY & EV COLOCATION
  {
    id: 'cand-solar-mandai-parking',
    categoryId: 'SOLAR_CANOPY_EV_COLOCATION',
    name: 'Mahatma Phule Mandai Multi-Level & Open Parking',
    wardOrPrabhag: 'Prabhag 15 (Mandai - Shukrawar Peth)',
    locationSummary: 'High-volume municipal commercial parking facility serving Pune’s historic central market district and nearby retail bazaars.',
    lng: 73.8570,
    lat: 18.5120,
    primaryFeatureType: 'Municipal Public Parking Facility',
    nearestRoadDistanceM: 10,
    nearestRoadName: 'Shivaji Road / Mandai Road',
    nearestSubstationDistanceM: 290,
    nearestSubstationName: 'MSEDCL Rasta Peth 33kV Substation',
    nearestParkingDistanceM: 0,
    nearestTransitHubDistanceM: 380,
    estimatedTargetAreaM2: 4200,
    status: 'ELIGIBLE_FOR_REVIEW',
    statusRationale: 'High vehicle dwell times, extreme exposed asphalt surface heat, unshaded top parking deck, and dense commercial traffic ideal for commercial EV charging.',
    constraints: [
      {
        id: 'c-mandai-1',
        title: 'Roof-Deck Structural Wind-Load Rating',
        severity: 'CRITICAL_BLOCKER',
        description: 'Top deck of the parking structure is elevated 14m above ground level; elevated solar canopy requires structural anchor calculations for Pune wind zone (Basic wind speed Vb = 39 m/s).',
        mitigationRequirement: 'Engineered lightweight steel truss canopy with IS 875 (Part 3) design calculations stamped by a licensed structural engineer.'
      },
      {
        id: 'c-mandai-2',
        title: 'Distribution Transformer Headroom Availability',
        severity: 'CRITICAL_BLOCKER',
        description: 'Mandai area commercial feeders operate near peak load during market hours (09:00 - 21:00); spare transformer capacity is unverified.',
        mitigationRequirement: 'Formal interconnection study with MSEDCL Rasta Peth Division to verify dedicated 11kV step-down transformer feasibility.'
      }
    ],
    missingSurveyChecklist: [
      {
        id: 'surv-mandai-1',
        itemName: 'MSEDCL Grid Interconnection & Feeder Capacity Study',
        requiredForPhase: 'TECHNICAL_FEASIBILITY',
        description: 'Formal load-flow, fault level, and reverse power flow analysis for 120kW EV charging hub + 150kWp solar PV canopy.',
        surveyStandardOrMethodology: 'CEA (Technical Standards for Connectivity of Distributed Generation Resources) Regulations 2019'
      },
      {
        id: 'surv-mandai-2',
        itemName: 'Parking Deck Concrete Anchor Pull-Out Testing',
        requiredForPhase: 'DETAILED_PROJECT_REPORT',
        description: 'Proof load testing of chemical epoxy anchor studs drilled into existing reinforced concrete columns.',
        surveyStandardOrMethodology: 'ASTM E488 Standard Test Methods for Strength of Anchors'
      }
    ],
    recommendedNextAction: 'Submit formal Grid Interconnection Application to MSEDCL and commission structural anchor analysis.'
  },
  {
    id: 'cand-solar-deccan-parking',
    categoryId: 'SOLAR_CANOPY_EV_COLOCATION',
    name: 'Sambhaji Park Surface Parking Lot & EV Hub',
    wardOrPrabhag: 'Prabhag 09 (Deccan Gymkhana)',
    locationSummary: 'Municipal surface parking facility situated adjacent to Sambhaji Park along JM Road and Deccan retail strip.',
    lng: 73.8415,
    lat: 18.5186,
    primaryFeatureType: 'Surface Public Parking Lot',
    nearestRoadDistanceM: 12,
    nearestRoadName: 'Jangali Maharaj Road',
    nearestSubstationDistanceM: 320,
    nearestSubstationName: 'Deccan 11kV Distribution Transformer',
    nearestParkingDistanceM: 0,
    nearestTransitHubDistanceM: 290,
    estimatedTargetAreaM2: 3800,
    status: 'ELIGIBLE_FOR_REVIEW',
    statusRationale: 'Unshaded blacktop surface parking with elevated surface heat, direct arterial access, and immediate catchment of commercial vehicles and private EVs.',
    constraints: [
      {
        id: 'c-dec-1',
        title: 'Overhead Tree Canopy Shading on Solar Panels',
        severity: 'MODERATE_CONSTRAINT',
        description: 'Peripheral mature tamarind and neem trees on Sambhaji Park boundary cast morning shade on western parking bays.',
        mitigationRequirement: 'Solar string inverter with multiple MPPT trackers or module-level power electronics (MLPE / microinverters) to prevent partial-shading losses.'
      }
    ],
    missingSurveyChecklist: [
      {
        id: 'surv-dec-1',
        itemName: 'Solar Shading 3D Obstruction Analysis',
        requiredForPhase: 'TECHNICAL_FEASIBILITY',
        description: 'Solar pathfinder or drone 3D point cloud shadow analysis across 12 months to optimize PV tilt and azimuth.',
        surveyStandardOrMethodology: 'IEC 61853 Photovoltaic Module Performance Testing'
      },
      {
        id: 'surv-dec-2',
        itemName: 'Geotechnical Soil Bearing Capacity for Canopy Piers',
        requiredForPhase: 'DETAILED_PROJECT_REPORT',
        description: 'Standard Penetration Test (SPT) boreholes to determine foundation footing depth for solar canopy steel uprights.',
        surveyStandardOrMethodology: 'IS 1892 Code of Practice for Subsurface Investigation for Foundations'
      }
    ],
    recommendedNextAction: 'Undertake 3D solar shade profiling and submit parking canopy proposal to PMC Traffic Engineering Department.'
  },
  {
    id: 'cand-solar-swargate-bus-station',
    categoryId: 'SOLAR_CANOPY_EV_COLOCATION',
    name: 'Swargate Multimodal Bus Terminal & Metro Forecourt',
    wardOrPrabhag: 'Prabhag 20 (Swargate - Parvati)',
    locationSummary: 'Massive regional intercity bus terminus (MSRTC) and urban bus hub (PMPML), integrated with the underground Swargate Metro terminus.',
    lng: 73.8580,
    lat: 18.5015,
    primaryFeatureType: 'Multimodal Transit Terminal & Bus Depot',
    nearestRoadDistanceM: 8,
    nearestRoadName: 'Satara Road / Shivaji Road Junction',
    nearestSubstationDistanceM: 220,
    nearestSubstationName: 'MSEDCL Parvati 132/33kV Substation',
    nearestParkingDistanceM: 25,
    nearestTransitHubDistanceM: 0,
    estimatedTargetAreaM2: 24000,
    status: 'ELIGIBLE_FOR_REVIEW',
    statusRationale: 'Massive open paved surface, extreme heat absorption, high heavy-vehicle dwell time, and ideal location for public e-bus and commercial fast EV charging infrastructure.',
    constraints: [
      {
        id: 'c-swar-1',
        title: 'Heavy Vehicle Vertical Clearance Requirement',
        severity: 'CRITICAL_BLOCKER',
        description: 'Bus lanes and maintenance bays require minimum 4.5m vertical clearance under canopy trusses for double-decker and AC electric buses.',
        mitigationRequirement: 'Canopy structural columns must be reinforced for heavy vehicular impact protection and achieve 5.0m clear height.'
      },
      {
        id: 'c-swar-2',
        title: 'High-Power Grid Headroom for Bus Megawatt Charging',
        severity: 'MODERATE_CONSTRAINT',
        description: 'Fleet bus charging requires 240kW - 360kW DC fast chargers; requires dedicated HT connection from Parvati 132kV substation.',
        mitigationRequirement: 'Coordinate with MSEDCL for dedicated 22kV express feeder line.'
      }
    ],
    missingSurveyChecklist: [
      {
        id: 'surv-swar-1',
        itemName: 'Fleet EV Charging Power Infrastructure Sizing',
        requiredForPhase: 'TECHNICAL_FEASIBILITY',
        description: 'Simultaneous maximum demand calculation for combined bus fleet depot charging and commuter passenger EV bays.',
        surveyStandardOrMethodology: 'CEA EV Charging Infrastructure Technical Guidelines 2021'
      },
      {
        id: 'surv-swar-2',
        itemName: 'Bus Maneuvering Swept-Path Analysis',
        requiredForPhase: 'DETAILED_PROJECT_REPORT',
        description: 'AutoTURN computer simulation of 12m and 18m electric bus turn radii around proposed canopy support columns.',
        surveyStandardOrMethodology: 'IRC:SP:112 Heavy Vehicle Geometric Turning Standards'
      }
    ],
    recommendedNextAction: 'Establish joint working group between PMPML, MahaMetro, MSEDCL, and PMC for integrated transit solar electrification.'
  },

  // 4. GREEN SPACE ENHANCEMENT
  {
    id: 'cand-park-saras-baug',
    categoryId: 'GREEN_SPACE_ENHANCEMENT',
    name: 'Saras Baug Historic Garden & Peshwe Park Precinct',
    wardOrPrabhag: 'Prabhag 20 (Parvati - Saras Baug)',
    locationSummary: 'Historic public park featuring a prominent lake temple, landscaped gardens, pedestrian walkways, and adjacent Peshwe Park conservation area.',
    lng: 73.8530,
    lat: 18.5010,
    primaryFeatureType: 'Municipal Historic Botanical Garden & Public Park',
    nearestRoadDistanceM: 30,
    nearestRoadName: 'Saras Baug Road / Sanas Ground Road',
    nearestSubstationDistanceM: 340,
    nearestSubstationName: 'MSEDCL Parvati 132/33kV Substation',
    nearestParkingDistanceM: 45,
    nearestTransitHubDistanceM: 310,
    estimatedTargetAreaM2: 48000,
    status: 'ELIGIBLE_FOR_REVIEW',
    statusRationale: 'Core urban lung in southern central Pune; opportunities for native shade tree infill, peripheral micro-forest, and artificial groundwater recharge.',
    constraints: [
      {
        id: 'c-saras-1',
        title: 'Heritage Waterbody Sedimentation & Depth Preservation',
        severity: 'MODERATE_CONSTRAINT',
        description: 'Central moat and lake surrounding the temple has experienced silt accumulation; stormwater runoff must be pre-filtered.',
        mitigationRequirement: 'Install reed-bed constructed wetlands and bioswale sediment traps before channeling park surface runoff into lake.'
      }
    ],
    missingSurveyChecklist: [
      {
        id: 'surv-saras-1',
        itemName: 'Botanical Census & Canopy Deficit Survey',
        requiredForPhase: 'TECHNICAL_FEASIBILITY',
        description: 'GPS tagging and taxonomic inventory of all existing trees > 10cm DBH; identification of unshaded pedestrian pathways.',
        surveyStandardOrMethodology: 'CPWD Horticultural Specifications 2019'
      },
      {
        id: 'surv-saras-2',
        itemName: 'Hydrogeological Water Table & Infiltration Test',
        requiredForPhase: 'DETAILED_PROJECT_REPORT',
        description: 'Double-ring infiltrometer testing to calculate soil percolation rate for design of rainwater recharge shafts.',
        surveyStandardOrMethodology: 'CGWA Guidelines for Artificial Ground Water Recharge 2020'
      }
    ],
    recommendedNextAction: 'Present ecological restoration and native Miyawaki micro-forest concept to PMC Garden Superintendent.'
  },
  {
    id: 'cand-park-kamala-nehru',
    categoryId: 'GREEN_SPACE_ENHANCEMENT',
    name: 'Kamala Nehru Park Shaded Pavilion & Bioswale',
    wardOrPrabhag: 'Prabhag 11 (Erandwane - Prabhat Road)',
    locationSummary: 'Highly popular urban neighbourhood park on Prabhat Road catering to senior citizens, morning walkers, and children.',
    lng: 73.8320,
    lat: 18.5140,
    primaryFeatureType: 'Urban Community Park',
    nearestRoadDistanceM: 15,
    nearestRoadName: 'Prabhat Road / Dr Ketkar Road',
    nearestSubstationDistanceM: 450,
    nearestSubstationName: 'Deccan 11kV Distribution Transformer',
    nearestParkingDistanceM: 20,
    nearestTransitHubDistanceM: 650,
    estimatedTargetAreaM2: 18500,
    status: 'ELIGIBLE_FOR_REVIEW',
    statusRationale: 'High community footfall, established tree canopy requiring selective understorey enrichment, and open paved plazas requiring permeable shade pergolas.',
    constraints: [
      {
        id: 'c-kamala-1',
        title: 'High Footfall Disruption During Construction',
        severity: 'SURVEY_FLAG',
        description: 'Park attracts over 3,000 visitors daily between 05:30-10:00 and 16:30-20:30; excavation work must be strictly phased.',
        mitigationRequirement: 'Barricaded sectoral execution outside morning and evening peak walking hours.'
      }
    ],
    missingSurveyChecklist: [
      {
        id: 'surv-kamala-1',
        itemName: 'Soil Organic Carbon & Nutrient Profiling',
        requiredForPhase: 'TECHNICAL_FEASIBILITY',
        description: 'Laboratory testing of soil samples across 10 points to determine N-P-K levels, pH, and organic matter content.',
        surveyStandardOrMethodology: 'ICAR Soil Testing Methods Handbook'
      }
    ],
    recommendedNextAction: 'Conduct stakeholder consultation with Prabhat Road Citizens Forum and PMC Ward Officer.'
  },

  // 5. INTEGRATED FACILITY UPGRADE
  {
    id: 'cand-integ-shivajinagar-hub',
    categoryId: 'INTEGRATED_FACILITY_UPGRADE',
    name: 'Shivajinagar Multimodal Interchange & Civic Hub',
    wardOrPrabhag: 'Prabhag 09 (Shivajinagar)',
    locationSummary: 'Comprehensive transport precinct comprising Old Mumbai-Pune Highway, Pune Metro Shivajinagar underground station, MSRTC bus stand, and PMT depot.',
    lng: 73.8446,
    lat: 18.5314,
    primaryFeatureType: 'Multimodal Transit Interchange & Commercial Precinct',
    nearestRoadDistanceM: 10,
    nearestRoadName: 'Old Mumbai-Pune Highway (NH 48)',
    nearestSubstationDistanceM: 180,
    nearestSubstationName: 'MSEDCL Shivajinagar 11kV Switching Station',
    nearestParkingDistanceM: 25,
    nearestTransitHubDistanceM: 0,
    estimatedTargetAreaM2: 32000,
    status: 'ELIGIBLE_FOR_REVIEW',
    statusRationale: 'Critical transport node with high transit interchange footfall, pronounced thermal footprint, multiple large bus sheds, and extensive open parking ideal for integrated solar canopies, cool roof sheds, and roadside buffer greening.',
    constraints: [
      {
        id: 'c-integ-1',
        title: 'Multi-Agency Jurisdiction & Coordinated Approvals',
        severity: 'CRITICAL_BLOCKER',
        description: 'Land ownership and operational authority divided among PMC, MahaMetro, MSRTC, and Central Railway.',
        mitigationRequirement: 'Convene High-Powered Steering Committee headed by Municipal Commissioner and Metro Managing Director.'
      },
      {
        id: 'c-integ-2',
        title: 'Heavy Traffic Diversion Logistics During Construction',
        severity: 'MODERATE_CONSTRAINT',
        description: 'Junction handles over 120,000 passenger-car units (PCU) per day along NH 48 corridor.',
        mitigationRequirement: 'Comprehensive traffic management plan approved by Pune City Traffic Police with nocturnal construction windows.'
      }
    ],
    missingSurveyChecklist: [
      {
        id: 'surv-integ-1',
        itemName: 'Comprehensive Energy & Heat Island Diagnostic Audit',
        requiredForPhase: 'TECHNICAL_FEASIBILITY',
        description: 'Integrated campus audit measuring transformer loads, rooftop heat flux, and bus parking surface temperature distribution.',
        surveyStandardOrMethodology: 'BEE Certified Energy Auditor Comprehensive Audit Protocol'
      },
      {
        id: 'surv-integ-2',
        itemName: 'Multimodal Pedestrian Micro-Climate Simulation',
        requiredForPhase: 'DETAILED_PROJECT_REPORT',
        description: 'Computational Fluid Dynamics (CFD) and thermal comfort (PET / UTCI) modeling of commuter transit walkways under shaded conditions.',
        surveyStandardOrMethodology: 'ENVI-met 3D Microclimate Modeling Standard'
      }
    ],
    recommendedNextAction: 'Draft Comprehensive Master Plan Concept Note for Joint Review by PMC, MahaMetro, and MSEDCL.'
  }
];

export function generateCuratedSampleCandidates(): InterventionCandidate[] {
  // Baseline constants for Pune Central Urban Corridor Study Area
  const BASELINE_STUDY_AREA_MEAN_LST = 46.3; // Celsius
  const BASELINE_TERRESTRIAL_MEAN_NDVI = 0.514;

  return CANDIDATE_SEEDS.map((seed) => {
    // Query actual satellite raster buffers via sub-microsecond probe
    const probe = queryHeatPoint(seed.lng, seed.lat);

    const lstCelsius = probe.lst.celsius;
    const ndvi = probe.ndvi.aggregated30m;
    const scl = probe.ndvi.sclClassId;
    const sclName = probe.ndvi.sclClassName;
    const rawDn = probe.lst.rawDn;
    const qaK = probe.lst.stQaUncertaintyKelvin;

    const lstDelta = lstCelsius !== null 
      ? Math.round((lstCelsius - BASELINE_STUDY_AREA_MEAN_LST) * 10) / 10 
      : null;

    const ndviDelta = ndvi !== null 
      ? Math.round((ndvi - BASELINE_TERRESTRIAL_MEAN_NDVI) * 1000) / 1000 
      : null;

    // Build evidence ledger items
    const nowIso = new Date().toISOString();
    const evidenceLedger: EvidenceLedgerItem[] = [
      {
        id: `ev-lst-${seed.id}`,
        category: 'SATELLITE_OBSERVATION',
        parameterName: 'Land Surface Temperature (LST)',
        observedValue: lstCelsius,
        unit: '°C',
        sourceDataset: 'Landsat 9 TIRS-2 (ST_B10) Collection 2 Level-2 (2023-04-22)',
        retrievalTimestamp: nowIso,
        uncertaintyOrDisclaimer: `USGS ST_QA estimated radiometric uncertainty: ±${qaK !== null ? qaK.toFixed(2) : '2.16 (study area mean)'} K. Native thermal resolution is 100m resampled to 30m.`
      },
      {
        id: `ev-ndvi-${seed.id}`,
        category: 'SATELLITE_OBSERVATION',
        parameterName: 'Normalized Difference Vegetation Index (NDVI)',
        observedValue: ndvi,
        unit: 'index (-1 to +1)',
        sourceDataset: 'Sentinel-2B MSI Level-2A BOA Reflectance (2023-04-24)',
        retrievalTimestamp: nowIso,
        uncertaintyOrDisclaimer: `Area-weighted 30m target cell aggregation from 10m B04/B08 bands. SCL Class: ${scl} (${sclName}).`
      },
      {
        id: `ev-delta-lst-${seed.id}`,
        category: 'DETERMINISTIC_CALCULATION',
        parameterName: 'LST Delta vs Pune Study Area Baseline',
        observedValue: lstDelta !== null ? `${lstDelta > 0 ? '+' : ''}${lstDelta}°C` : 'N/A',
        unit: 'Δ°C',
        sourceDataset: 'Calculated against 577,304 candidate boundary cells mean (46.3°C)',
        retrievalTimestamp: nowIso,
        uncertaintyOrDisclaimer: 'Continuous deterministic arithmetic difference; does not imply microclimate air temperature delta.'
      },
      {
        id: `ev-delta-ndvi-${seed.id}`,
        category: 'DETERMINISTIC_CALCULATION',
        parameterName: 'NDVI Delta vs Terrestrial Baseline',
        observedValue: ndviDelta !== null ? `${ndviDelta > 0 ? '+' : ''}${ndviDelta}` : 'N/A',
        unit: 'Δindex',
        sourceDataset: 'Calculated against terrestrial valid cell baseline (0.514)',
        retrievalTimestamp: nowIso,
        uncertaintyOrDisclaimer: 'Excludes SCL 6 (water) cells. Reflects relative green leaf density.'
      },
      {
        id: `ev-dist-road-${seed.id}`,
        category: 'DETERMINISTIC_CALCULATION',
        parameterName: 'Distance to Mapped Road Network',
        observedValue: seed.nearestRoadDistanceM,
        unit: 'm',
        sourceDataset: 'OpenStreetMap Planet Pune Highway Extract',
        retrievalTimestamp: nowIso,
        uncertaintyOrDisclaimer: `Nearest road: ${seed.nearestRoadName}. Spatial accuracy subject to OSM geometry precision (~3-5m).`
      }
    ];

    if (seed.nearestSubstationDistanceM !== undefined) {
      evidenceLedger.push({
        id: `ev-substation-${seed.id}`,
        category: 'DETERMINISTIC_CALCULATION',
        parameterName: 'Distance to Electrical Substation',
        observedValue: seed.nearestSubstationDistanceM,
        unit: 'm',
        sourceDataset: 'MSEDCL Pune Central Power Infrastructure Cadastre',
        retrievalTimestamp: nowIso,
        uncertaintyOrDisclaimer: `Nearest substation: ${seed.nearestSubstationName}. Proximity indicates physical layout suitability only; spare transformer headroom must be verified.`
      });
    }

    // Add standard references into evidence ledger
    const categoryMeta = INTERVENTION_CATEGORIES[seed.categoryId];
    categoryMeta.governingStandards.forEach((std, idx) => {
      evidenceLedger.push({
        id: `ev-std-${seed.id}-${idx}`,
        category: 'VERIFIED_TECHNICAL_REFERENCE',
        parameterName: std.standardName,
        observedValue: std.sectionOrClause,
        sourceDataset: std.issuingBody,
        retrievalTimestamp: nowIso,
        uncertaintyOrDisclaimer: std.keyThresholdOrRequirement
      });
    });

    // Add unverified missing survey items into evidence ledger
    seed.missingSurveyChecklist.forEach((survey, idx) => {
      evidenceLedger.push({
        id: `ev-missing-${seed.id}-${idx}`,
        category: 'UNVERIFIED_REQUIRES_ADDITIONAL_DATA',
        parameterName: survey.itemName,
        observedValue: 'MISSING_SURVEY_REQUIRED',
        sourceDataset: 'Site Engineering Validation Protocol',
        retrievalTimestamp: nowIso,
        uncertaintyOrDisclaimer: `Mandatory for phase: ${survey.requiredForPhase}. ${survey.description}`,
        actionRequiredIfUnverified: `Conduct on-site ${survey.surveyStandardOrMethodology}`
      });
    });

    // Determine evidence completeness level
    let evidenceCompleteness: EvidenceCompletenessLevel = 'MODERATE';
    if (lstCelsius !== null && ndvi !== null && seed.constraints.length > 0 && seed.missingSurveyChecklist.length >= 2) {
      evidenceCompleteness = 'STRONG';
    } else if (lstCelsius === null || ndvi === null) {
      evidenceCompleteness = 'PRELIMINARY';
    }

    return {
      id: seed.id,
      categoryId: seed.categoryId,
      name: seed.name,
      wardOrPrabhag: seed.wardOrPrabhag,
      locationSummary: seed.locationSummary,
      coordinates: {
        lng: seed.lng,
        lat: seed.lat,
        utmX: probe.coordinates.utmX,
        utmY: probe.coordinates.utmY
      },
      status: seed.status,
      statusRationale: seed.statusRationale,
      evidenceCompleteness,
      provenanceType: 'SAMPLE_LOCATION' as const,
      sourceFeatureId: `SAMPLE_${seed.id}`,
      sourceDatasetName: 'Curated Demonstration Locations (Phase 5 Baseline)',
      sourceGeometryType: 'Point' as const,
      thermalContext: {
        surfaceTemperatureCelsius: lstCelsius,
        baselineStudyAreaMeanLSTCelsius: BASELINE_STUDY_AREA_MEAN_LST,
        lstDeltaToBaselineCelsius: lstDelta,
        landsatStQaUncertaintyK: qaK,
        rawThermalDN: rawDn,
        nativeResolutionNotice: 'Landsat ST_B10 thermal band has 100m native spatial resolution (resampled to 30m grid by USGS Collection 2).'
      },
      vegetationContext: {
        ndvi30m: ndvi,
        baselineTerrestrialMeanNdvi: BASELINE_TERRESTRIAL_MEAN_NDVI,
        ndviDeltaToBaseline: ndviDelta,
        sclClassId: scl,
        sclClassName: sclName,
        isTerrestrialVegetation: probe.ndvi.isTerrestrialVegetation
      },
      infrastructureContext: {
        primaryFeatureType: seed.primaryFeatureType,
        nearestRoadDistanceM: seed.nearestRoadDistanceM,
        nearestRoadName: seed.nearestRoadName,
        nearestSubstationDistanceM: seed.nearestSubstationDistanceM,
        nearestSubstationName: seed.nearestSubstationName,
        nearestParkingDistanceM: seed.nearestParkingDistanceM,
        nearestTransitHubDistanceM: seed.nearestTransitHubDistanceM,
        footprintAreaM2: seed.estimatedTargetAreaM2
      },
      constraints: seed.constraints,
      missingSurveyChecklist: seed.missingSurveyChecklist,
      evidenceLedger,
      estimatedTargetAreaM2: seed.estimatedTargetAreaM2,
      recommendedNextAction: seed.recommendedNextAction
    };
  });
}

/**
 * Returns only the 12 curated demonstration sample locations.
 */
export function generateSampleCandidates(): InterventionCandidate[] {
  return generateCuratedSampleCandidates();
}

/**
 * Returns candidates for the planning workspace.
 * By default (includeSamples = false), returns ONLY genuine DATASET_DERIVED candidates.
 * Curated demonstration locations are only included if explicitly requested.
 */
export function generateInterventionCandidates(options?: { includeSamples?: boolean }): InterventionCandidate[] {
  const dynamicCandidates = getDynamicCandidates();

  if (options?.includeSamples) {
    const samples = generateSampleCandidates();
    return [...dynamicCandidates, ...samples];
  }

  return dynamicCandidates;
}

export function getCandidateById(id: string): InterventionCandidate | undefined {
  // First search dynamic dataset-derived candidates
  const dynamicCandidate = getDynamicCandidateById(id);
  if (dynamicCandidate) return dynamicCandidate;

  // Fallback to curated demonstration samples
  const samples = generateSampleCandidates();
  return samples.find(c => c.id === id);
}

export function listCandidatesByCategory(
  categoryId?: InterventionCategoryId, 
  options?: { includeSamples?: boolean }
): InterventionCandidate[] {
  const all = generateInterventionCandidates(options);
  if (!categoryId) return all;
  return all.filter(c => c.categoryId === categoryId);
}
