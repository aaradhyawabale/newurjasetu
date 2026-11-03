import { InterventionCategoryId, InterventionCategoryMetadata } from './types';

export const INTERVENTION_CATEGORIES: Record<InterventionCategoryId, InterventionCategoryMetadata> = {
  URBAN_GREENING_CORRIDOR: {
    id: 'URBAN_GREENING_CORRIDOR',
    name: 'Urban Greening & Tree Corridors',
    shortDescription: 'Roadside canopy enhancement, median bioswales, and linear pedestrian shaded corridors along heat-stressed rights-of-way.',
    planningObjective: 'Identify heavily paved transit and arterial corridors displaying low Sentinel-2 NDVI and elevated Landsat-9 surface temperatures for priority roadside shading and urban arboriculture.',
    targetFeatures: ['Primary Arterial Roads', 'Secondary Arterial Roads', 'Public Transit Corridors', 'Pedestrian Walkways'],
    requiredDatasets: [
      'OpenStreetMap Highway Network (LineString geometries)',
      'Sentinel-2 L2A BOA 10m/30m NDVI',
      'Sentinel-2 Scene Classification Layer (SCL)',
      'Landsat-9 Collection 2 Level-2 Surface Temperature (ST_B10)',
      'Municipal Right-of-Way (ROW) and Underground Utility Cadastre (Missing)'
    ],
    mandatorySurveyChecklist: [
      'Subsurface utility clearance (optical fibre, high-tension electrical, water mains, gas pipelines)',
      'Clear Right-of-Way (ROW) and minimum pedestrian walkway width compliance (IRC:103-2012)',
      'Overhead power transmission and bus catenary line clearance',
      'Species selection review: indigenous, drought-resilient, non-invasive deep-rooting species (CPWD Urban Greenery Guidelines)',
      'Soil compaction, drainage permeability, and sub-base depth testing'
    ],
    governingStandards: [
      {
        standardName: 'Indian Road Congress IRC:103-2012',
        issuingBody: 'Indian Roads Congress (IRC)',
        sectionOrClause: 'Section 6: Pedestrian Facilities & Landscaping',
        keyThresholdOrRequirement: 'Clear pedestrian walkway minimum 1.8m width preserved without tree basin obstruction.'
      },
      {
        standardName: 'CPWD Guidelines for Landscaping and Tree Planting',
        issuingBody: 'Central Public Works Department (CPWD), Govt of India',
        sectionOrClause: 'Chapter 4: Avenue Planting & Root Zone Protection',
        keyThresholdOrRequirement: 'Tree pits minimum 1.2m x 1.2m with root barriers near road subgrade to prevent pavement lifting.'
      },
      {
        standardName: 'AMRUT 2.0 Urban Greening and Open Spaces Framework',
        issuingBody: 'Ministry of Housing and Urban Affairs (MoHUA)',
        sectionOrClause: 'Component 3: Rejuvenation of Water Bodies & Urban Green Spaces',
        keyThresholdOrRequirement: 'Prioritise climate-resilient native canopy species with local water-harvesting tree pits.'
      }
    ],
    scientificDisclaimers: [
      'Satellite NDVI indicates aggregate photosynthetic activity within a 30m cell and does NOT distinguish between street canopy, roadside weeds, private gardens, or potted plants.',
      'Surface temperature (LST) represents radiating skin temperature of pavement and does not measure ambient air temperature or mean radiant temperature (MRT) felt by pedestrians.',
      'Tree planting feasibility is strictly contingent on below-ground utility clearance and municipal ROW ownership.'
    ]
  },

  COOL_ROOF_FEASIBILITY: {
    id: 'COOL_ROOF_FEASIBILITY',
    name: 'Cool Roof Investigation Opportunities',
    shortDescription: 'Identification of municipal, commercial, and institutional roofs in elevated LST sectors for high-albedo cool roof retrofits.',
    planningObjective: 'Pinpoint large roof surfaces in high thermal zones suitable for high Solar Reflectance Index (SRI) coating or membrane retrofit to mitigate indoor heat gain.',
    targetFeatures: ['Municipal Administrative Buildings', 'Public Hospitals and Health Centres', 'Institutional Campuses', 'Commercial Transit Terminals'],
    requiredDatasets: [
      'OpenStreetMap Building Footprints (Polygon geometries)',
      'Landsat-9 Collection 2 Level-2 Surface Temperature (ST_B10)',
      'Sentinel-2 Scene Classification Layer (SCL)',
      'Building Structural Assessment and Roof Waterproofing Records (Missing)',
      'HVAC Chiller / Rooftop Equipment Asset Register (Missing)'
    ],
    mandatorySurveyChecklist: [
      'Structural load-bearing capacity assessment of roof slab (IS 456:2000)',
      'Existing roof waterproofing membrane condition and residual service life',
      'Usable unencumbered roof area survey (deducting HVAC chillers, water tanks, solar PV, access stairwells)',
      'Roof slope angle measurement: Low-sloped (<= 9.5 deg) vs Steep-sloped (> 9.5 deg)',
      'Periodic maintenance, washing, and cleaning access feasibility'
    ],
    governingStandards: [
      {
        standardName: 'BEE Energy Conservation Building Code (ECBC 2017)',
        issuingBody: 'Bureau of Energy Efficiency (BEE), Ministry of Power',
        sectionOrClause: 'Table 4.1: Building Envelope - Cool Roof Requirements',
        keyThresholdOrRequirement: 'Initial SRI >= 78 (3-year aged SRI >= 64) for low-sloped roofs (<= 9.5 deg); initial SRI >= 29 for steep roofs (> 9.5 deg).'
      },
      {
        standardName: 'ASTM E1980-11',
        issuingBody: 'American Society for Testing and Materials (ASTM)',
        sectionOrClause: 'Standard Practice for Calculating Solar Reflectance Index (SRI)',
        keyThresholdOrRequirement: 'Standard SRI calculation under low, medium, and high convective wind conditions.'
      },
      {
        standardName: 'National Building Code of India (NBC 2016)',
        issuingBody: 'Bureau of Indian Standards (BIS)',
        sectionOrClause: 'Part 8: Building Services, Section 2: Electrical and Allied Installations',
        keyThresholdOrRequirement: 'Fire safety clearance and thermal barrier compliance on occupied rooftop slabs.'
      }
    ],
    scientificDisclaimers: [
      'Building footprint polygon area is NOT equal to usable rooftop area. Typical usable roof area ranges between 45% and 75% of footprint after accounting for HVAC units, parapets, stairwell penthouses, and water reservoirs.',
      'Satellite LST is measured at 100m native resolution (resampled to 30m) and captures a spatial composite of the roof, surrounding tarmac, and adjacent trees.',
      'Cool roof application feasibility cannot be approved without on-site non-destructive testing of the slab structural integrity and water-tightness.'
    ]
  },

  SOLAR_CANOPY_EV_COLOCATION: {
    id: 'SOLAR_CANOPY_EV_COLOCATION',
    name: 'Solar Canopy & EV Charging Infrastructure Co-Location',
    shortDescription: 'Dual-purpose solar photovoltaic canopy structures over surface parking lots and transit hubs with co-located EV charging infrastructure.',
    planningObjective: 'Evaluate surface parking facilities and multimodal hubs where elevated surface heat and open parking bays permit solar shade canopies and localized EV charging.',
    targetFeatures: ['Public Surface Parking Lots', 'Metro Station Park-and-Ride Facilities', 'Bus Depots and Terminals', 'Railway Station Forecourts'],
    requiredDatasets: [
      'OpenStreetMap Amenity Parking & Transport Polygons',
      'Existing MSEDCL Substation Locations & Voltages',
      'NASA POWER Climatological Solar Resource (GHI)',
      'Landsat-9 Collection 2 Level-2 Surface Temperature (ST_B10)',
      'Distribution Transformer (DT) Capacity & Sanctioned Headroom (Missing)'
    ],
    mandatorySurveyChecklist: [
      'MSEDCL 11kV/33kV distribution feeder spare capacity and connection feasibility study',
      'Subsurface foundation geotechnical testing for wind-load uplift on elevated canopy structures',
      'Vehicle clearance height verification (minimum 3.5m clearance for standard parking; 4.5m for bus bays)',
      'Thermal safety separation between battery charging hardware and solar inverter bays',
      'Stormwater runoff routing and guttering integration on canopy structure'
    ],
    governingStandards: [
      {
        standardName: 'IEC 61215:2021 / IEC 61730',
        issuingBody: 'International Electrotechnical Commission (IEC)',
        sectionOrClause: 'Design qualification and type approval for terrestrial photovoltaic modules',
        keyThresholdOrRequirement: 'Module thermal qualification up to 85 deg C operating temperature and mechanical load testing.'
      },
      {
        standardName: 'EPRI 3002016335 & CEA Regulations 2019',
        issuingBody: 'Central Electricity Authority (CEA) / EPRI',
        sectionOrClause: 'Technical Standards for Connectivity of Distributed Generation Resources',
        keyThresholdOrRequirement: 'Grid interconnect protection, anti-islanding, and distribution transformer reverse power flow limits.'
      },
      {
        standardName: 'ARAI AIS-138 (Part 1 & 2)',
        issuingBody: 'Automotive Research Association of India (ARAI)',
        sectionOrClause: 'Electric Vehicle Conductive AC and DC Charging System Requirements',
        keyThresholdOrRequirement: 'Ingress protection IP54/IP55, emergency disconnect, and electrical isolation under tropical outdoor exposure.'
      }
    ],
    scientificDisclaimers: [
      'Landsat LST measures asphalt skin temperature, NOT the operating temperature of solar PV cells or EV battery pack internal temperatures.',
      'Solar generation estimates are theoretical climatological averages (NASA POWER) and do not account for localized micro-shading from adjacent tall buildings or flyovers.',
      'Grid connection feasibility is contingent on MSEDCL load-flow approval; proximity to a physical substation does NOT guarantee spare transformer capacity.'
    ]
  },

  GREEN_SPACE_ENHANCEMENT: {
    id: 'GREEN_SPACE_ENHANCEMENT',
    name: 'Urban Green-Space Improvement',
    shortDescription: 'Canopy infill, soil descaling, micro-forest development, and water-recharge enhancement in mapped public parks and gardens.',
    planningObjective: 'Identify established public recreational grounds and urban parks exhibiting lower-than-expected NDVI or hot thermal pockets for targeted ecological rehabilitation.',
    targetFeatures: ['Municipal Public Gardens', 'Recreational Playgrounds', 'Riverfront Buffer Zones', 'Urban Parks'],
    requiredDatasets: [
      'OpenStreetMap Leisure Park & Garden Polygons',
      'Sentinel-2 L2A 10m/30m NDVI Distribution',
      'Landsat-9 Collection 2 Level-2 Surface Temperature (ST_B10)',
      'PMC Municipal Garden Department Master Register',
      'Hydrogeological Borewell & Aquifer Recharge Survey (Missing)'
    ],
    mandatorySurveyChecklist: [
      'Park perimeter boundary demarcation and encroachment check against municipal cadastral maps',
      'Existing tree census: species, health, canopy spread, DBH (Diameter at Breast Height)',
      'Soil nutrient, organic matter, and moisture retention profiling',
      'Water source audit: recycled treated wastewater availability vs groundwater extraction limits',
      'Community accessibility and universal barrier-free entry compliance'
    ],
    governingStandards: [
      {
        standardName: 'Urban and Regional Development Plans Formulation and Implementation (URDPFI) 2014',
        issuingBody: 'Ministry of Urban Development, Govt of India',
        sectionOrClause: 'Volume 1, Chapter 8: Open Spaces and Environmental Planning',
        keyThresholdOrRequirement: '10-12 sq m open space per capita in urban municipal jurisdictions.'
      },
      {
        standardName: 'CPWD Specifications for Horticultural Works (2019)',
        issuingBody: 'Central Public Works Department (CPWD)',
        sectionOrClause: 'Section 30: Soil Preparation, Plantation, and Turf Establishment',
        keyThresholdOrRequirement: 'Minimum 300mm sweet soil top-layer for turfing; multi-tier native canopy stratification.'
      },
      {
        standardName: 'Central Ground Water Authority (CGWA) Guidelines 2020',
        issuingBody: 'Ministry of Jal Shakti',
        sectionOrClause: 'Rainwater Harvesting & Artificial Recharge in Public Parks',
        keyThresholdOrRequirement: 'Mandatory rainwater harvesting recharge shafts in all public green spaces exceeding 1,000 sq m.'
      }
    ],
    scientificDisclaimers: [
      'Satellite NDVI measures green leaf reflectance and may be suppressed by seasonal deciduous leaf drop in dry months without indicating poor park health.',
      'Urban green spaces do not produce uniform cooling bubbles; localized cooling microclimates depend on wind ventilation corridors and humidity.',
      'Public access restrictions or municipal garden development restrictions must be verified before implementing planting alterations.'
    ]
  },

  INTEGRATED_FACILITY_UPGRADE: {
    id: 'INTEGRATED_FACILITY_UPGRADE',
    name: 'Integrated Infrastructure & Heat-Mitigation',
    shortDescription: 'Comprehensive civic facility redevelopment combining high-albedo cool roofs, solar shade canopies, EV charging depots, and boundary tree buffers.',
    planningObjective: 'Formulate holistic municipal infrastructure upgrades for major public complexes, multi-modal interchanges, and civic headquarters facing compound thermal and energy demands.',
    targetFeatures: ['Civic Administrative Headquarters', 'Multimodal Transit Interchanges', 'District Public Hospitals', 'Major University Campuses'],
    requiredDatasets: [
      'OpenStreetMap Multi-polygon Civic & Institutional Parcels',
      'Landsat-9 Collection 2 Level-2 Surface Temperature (ST_B10)',
      'Sentinel-2 L2A 10m/30m NDVI Composite',
      'MSEDCL High-Tension (HT) Consumer Billing and Demand Profiles (Missing)',
      'PMC Comprehensive Mobility Plan (CMP) Traffic Counts'
    ],
    mandatorySurveyChecklist: [
      'Holistic building and campus energy audit (ASHRAE Level II / BEE Certified Energy Auditor)',
      'Comprehensive master plan zoning review with Pune Municipal Corporation (PMC)',
      'Multimodal traffic circulation and pedestrian safety impact assessment',
      'Structural and electrical integration assessment for simultaneous PV generation, EV charging, and roof coating',
      'Environmental Impact Screening for urban stormwater retention and heat-island reduction'
    ],
    governingStandards: [
      {
        standardName: 'GRIHA v2019 / IGBC Existing Buildings Rating',
        issuingBody: 'The Energy and Resources Institute (TERI) / Indian Green Building Council (IGBC)',
        sectionOrClause: 'Criterion 1 to 5: Sustainable Site Planning & Heat Island Reduction',
        keyThresholdOrRequirement: 'Minimum 75% of exposed roof covered with cool roof (SRI >= 78) or solar PV; minimum 30% parking shaded.'
      },
      {
        standardName: 'BEE Energy Conservation Building Code (ECBC 2017)',
        issuingBody: 'Bureau of Energy Efficiency (BEE)',
        sectionOrClause: 'Chapter 3: Mandatory Requirements & Whole Building Performance',
        keyThresholdOrRequirement: 'Integrated building energy performance compliance and maximum connected lighting/power loads.'
      },
      {
        standardName: 'IRC:103-2012 & MoHUA Transit-Oriented Development (TOD) Policy',
        issuingBody: 'Ministry of Housing and Urban Affairs (MoHUA)',
        sectionOrClause: 'Section 4: Multimodal Integration and Walkability',
        keyThresholdOrRequirement: 'Direct, shaded, barrier-free pedestrian connections within 500m radius of transit interchanges.'
      }
    ],
    scientificDisclaimers: [
      'Multi-component interventions require sequential phasing. Rooftop waterproofing must precede solar canopy and cool roof application.',
      'Aggregate campus LST represents both building roofs and adjacent paved surfaces and will not diminish instantaneously upon intervention.',
      'Project execution requires multi-departmental clearance across PMC Public Works, Garden Dept, Traffic Police, and MSEDCL.'
    ]
  }
};

export function getCategoryMetadata(id: InterventionCategoryId): InterventionCategoryMetadata {
  const meta = INTERVENTION_CATEGORIES[id];
  if (!meta) {
    throw new Error(`Unknown intervention category ID: ${id}`);
  }
  return meta;
}

export function listCategoryMetadata(): InterventionCategoryMetadata[] {
  return Object.values(INTERVENTION_CATEGORIES);
}
