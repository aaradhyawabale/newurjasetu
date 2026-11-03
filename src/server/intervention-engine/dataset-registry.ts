import { DatasetRegistryItem } from './types';

export const DATASET_REGISTRY: Record<string, DatasetRegistryItem> = {
  'ds-landsat-9-tirs2': {
    id: 'ds-landsat-9-tirs2',
    name: 'Landsat 9 TIRS-2 Collection 2 Level-2 Surface Temperature (ST_B10)',
    sourceOrganization: 'U.S. Geological Survey (USGS) / NASA',
    sourceUrl: 'https://planetarycomputer.microsoft.com/dataset/landsat-c2-l2',
    acquisitionDate: '2023-04-22T05:27:39Z',
    publicationDate: '2023-04-22T14:00:00Z',
    lastUpdate: '2023-04-22T14:00:00Z',
    applicationRefreshDate: '2026-11-01T12:46:00Z',
    geographicCoverage: 'Pune Regional Grid (Path 147, Row 47; 1012x871 cells; 30.36km x 26.13km)',
    crs: 'EPSG:32643 (WGS 84 / UTM Zone 43N)',
    geometryTypeOrRasterResolution: '30m pixel resolution (USGS Collection 2 resampled from 100m native thermal detector)',
    featureOrPixelCount: '881,452 grid cells (577,304 within candidate municipal boundary)',
    verificationStatus: 'VERIFIED_OFFICIAL',
    provenanceCategory: 'SATELLITE_OBSERVATION',
    intendedUse: 'Radiometric Land Surface Temperature (LST) and surface thermal regime characterization across urban corridors and roof surfaces.',
    knownLimitations: 'Measures radiometric ground skin temperature at 100m native spatial resolution; does NOT measure 2m ambient air temperature or indoor wet-bulb globe temperature.',
    license: 'Public Domain (USGS / NASA Open Data Policy)',
    isAvailable: true,
  },

  'ds-sentinel-2b-msi': {
    id: 'ds-sentinel-2b-msi',
    name: 'Sentinel-2B MSI Level-2A Bottom-of-Atmosphere (BOA) Reflectance (B04, B08, SCL)',
    sourceOrganization: 'European Space Agency (ESA) / Copernicus Programme',
    sourceUrl: 'https://registry.opendata.aws/sentinel-2-l2a-cogs',
    acquisitionDate: '2023-04-24T05:26:49Z',
    publicationDate: '2023-04-24T16:00:00Z',
    lastUpdate: '2023-04-24T16:00:00Z',
    applicationRefreshDate: '2026-11-01T12:46:00Z',
    geographicCoverage: 'Tile 43QDC (Pune Urban Agglomeration)',
    crs: 'EPSG:32643 (WGS 84 / UTM Zone 43N)',
    geometryTypeOrRasterResolution: '10m optical (B04, B08) and 20m Scene Classification Layer (SCL); area-weighted 30m target grid aggregation',
    featureOrPixelCount: '881,452 target 30m cells (577,304 within candidate municipal boundary)',
    verificationStatus: 'VERIFIED_OFFICIAL',
    provenanceCategory: 'SATELLITE_OBSERVATION',
    intendedUse: 'Normalized Difference Vegetation Index (NDVI) and automated cloud/shadow/water screening via SCL.',
    knownLimitations: 'NDVI is a spectral reflectance index [-1.0, 1.0]; does NOT directly measure tree canopy percentage or biological health.',
    license: 'Open Access (Copernicus Open Access Hub)',
    isAvailable: true,
  },

  'ds-pmc-candidate-boundary': {
    id: 'ds-pmc-candidate-boundary',
    name: 'Pune Municipal Corporation (PMC) Candidate Study Area Boundary',
    sourceOrganization: 'Pune Municipal Corporation (PMC) Prabhag Ward Delineation / OpenStreetMap',
    sourceUrl: 'src/data/boundaries/pmc_candidate_boundary.geojson',
    acquisitionDate: '2022-03-15T00:00:00Z',
    lastUpdate: '2026-10-19T14:43:00Z',
    applicationRefreshDate: '2026-11-01T13:43:00Z',
    geographicCoverage: 'Pune Municipal Corporation (23 Prabhag Administrative Wards)',
    crs: 'EPSG:4326 / EPSG:32643',
    geometryTypeOrRasterResolution: 'MultiPolygon (Vector)',
    featureOrPixelCount: '577,304 rasterized 30m grid cells (~519.57 km²)',
    verificationStatus: 'RESEARCH_DERIVED',
    provenanceCategory: 'DETERMINISTIC_CALCULATION',
    intendedUse: 'Study area spatial containment masking and zonal baseline statistical calculations.',
    knownLimitations: 'Non-authoritative research boundary synthesized from Prabhag ward polygons; does NOT constitute a statutory cadastral demarcation.',
    license: 'ODbL 1.0 — © OpenStreetMap contributors & PMC Open Data',
    isAvailable: true,
  },

  'ds-pmc-official-gardens': {
    id: 'ds-pmc-official-gardens',
    name: 'PMC Municipal Garden Department Official Register of Parks & Gardens',
    sourceOrganization: 'Pune Municipal Corporation (PMC) Garden Department',
    sourceUrl: 'ndata/Pune City Data/Pune City Data/Pune Parks and Gardens/Gardens with Locations.csv',
    acquisitionDate: '2019-06-01T00:00:00Z',
    publicationDate: '2021-12-31T00:00:00Z',
    lastUpdate: '2022-04-10T00:00:00Z',
    applicationRefreshDate: '2026-11-01T15:03:00Z',
    geographicCoverage: 'Pune Municipal Corporation Administrative Area',
    crs: 'EPSG:4326 (WGS 84)',
    geometryTypeOrRasterResolution: 'Point features with Prabhag and Ward attributes',
    featureOrPixelCount: 81,
    verificationStatus: 'VERIFIED_OFFICIAL',
    operationalStatus: 'OPERATIONAL_STATUTORY_DISCLOSURE',
    sourceAuthenticity: 'PMC Municipal Garden Department Master Register (81 valid geocoded entries)',
    freshness: '2022-04 (Statutory register)',
    transformationHistory: [
      'Ingested from Gardens with Locations.csv (85 rows: 1 title, 1 header, 81 data, 2 footnotes)',
      'Parsed lat/long bracket strings into WGS84 floats',
      'Phase 6.1 forensic verification confirmed 100% spatial coordinate bounds inside Pune'
    ],
    provenanceCategory: 'VERIFIED_TECHNICAL_REFERENCE',
    intendedUse: 'Dynamic spatial discovery of public parks, gardens, and botanical reserves eligible for ecological enrichment.',
    knownLimitations: 'Contains point centroid coordinates; parcel boundary cadastral polygons require City Survey Office (CTSO) demarcation.',
    license: 'Government Open Data License - India (GODL-India) / PMC Public Disclosure',
    isAvailable: true,
  },

  'ds-pmc-official-hospitals': {
    id: 'ds-pmc-official-hospitals',
    name: 'PMC Health Department Official Register of Government Hospitals & Health Centres',
    sourceOrganization: 'Pune Municipal Corporation (PMC) Health Department',
    sourceUrl: 'ndata/Pune City Data/Pune City Data/Pune Healthcare - Hospitals and Clinics/Pune - Ward-wise Government Hospitals.csv',
    acquisitionDate: '2018-04-01T00:00:00Z',
    publicationDate: '2021-08-15T00:00:00Z',
    lastUpdate: '2021-08-15T00:00:00Z',
    applicationRefreshDate: '2026-11-01T15:03:00Z',
    geographicCoverage: 'Pune Municipal Corporation Administrative Area',
    crs: 'EPSG:4326 (WGS 84)',
    geometryTypeOrRasterResolution: 'Point features with facility type and ward attributes',
    featureOrPixelCount: 50,
    verificationStatus: 'VERIFIED_OFFICIAL',
    operationalStatus: 'OPERATIONAL_STATUTORY_DISCLOSURE',
    sourceAuthenticity: 'PMC Health Department Master Register of Government Hospitals (50 facilities)',
    freshness: '2021-08 (Statutory register)',
    transformationHistory: [
      'Ingested from Pune - Ward-wise Government Hospitals.csv (51 rows: 1 header, 50 valid facilities)',
      'Validated facility types (Dispensaries, Dawakhana, Maternity Homes)',
      'Phase 6.1 forensic verification confirmed 100% coordinate compliance'
    ],
    provenanceCategory: 'VERIFIED_TECHNICAL_REFERENCE',
    intendedUse: 'Dynamic spatial discovery of municipal hospitals and health facilities eligible for cool roof investigation.',
    knownLimitations: 'Point coordinates of facility entrances; rooftop usable structural area must be verified through on-site architectural audits.',
    license: 'Government Open Data License - India (GODL-India) / PMC Public Disclosure',
    isAvailable: true,
  },

  'ds-msedcl-pune-grid': {
    id: 'ds-msedcl-pune-grid',
    name: 'MSEDCL High-Tension (HT) Electrical Substation Infrastructure Cadastre',
    sourceOrganization: 'Maharashtra State Electricity Distribution Company Limited (MSEDCL) Pune Circle',
    sourceUrl: 'ndata/data/geo/pune_msedcl_grid.geojson',
    acquisitionDate: '2023-01-15T00:00:00Z',
    lastUpdate: '2024-02-20T00:00:00Z',
    applicationRefreshDate: '2026-11-01T15:03:00Z',
    geographicCoverage: 'Pune Urban Core (Shivajinagar, Kothrud, Aundh, Hadapsar, Kharadi, Katraj)',
    crs: 'EPSG:4326 (WGS 84)',
    geometryTypeOrRasterResolution: 'Point features with voltage (kV) and MVA nameplate capacity ratings',
    featureOrPixelCount: 6,
    verificationStatus: 'VERIFIED_PUBLIC_DISCLOSURE',
    operationalStatus: 'OPERATIONAL_STATUTORY_DISCLOSURE',
    sourceAuthenticity: 'CEA / MSEDCL statutory public disclosure network map',
    freshness: '2024-02',
    transformationHistory: [
      'GeoJSON feature extraction from pune_msedcl_grid.geojson',
      'Phase 6.1 forensic clarification: capacityMva represents nameplate transformation rating, NOT available spare interconnect headroom'
    ],
    provenanceCategory: 'VERIFIED_TECHNICAL_REFERENCE',
    intendedUse: 'Grid proximity analysis for distributed solar PV canopies and high-power EV charging hubs.',
    knownLimitations: 'Physical proximity indicates layout feasibility only; available transformer headroom is NOT public and requires formal MSEDCL load-flow clearance.',
    license: 'Public Statutory Disclosure (Central Electricity Authority / MSEDCL)',
    isAvailable: true,
  },

  'ds-osm-pune-ev-stations': {
    id: 'ds-osm-pune-ev-stations',
    name: 'OpenStreetMap Planet Pune Electric Vehicle Charging Infrastructure',
    sourceOrganization: 'OpenStreetMap Contributors',
    sourceUrl: 'https://overpass-api.de/api/interpreter',
    acquisitionDate: '2024-09-01T00:00:00Z',
    lastUpdate: '2024-09-15T00:00:00Z',
    applicationRefreshDate: '2026-11-01T15:03:00Z',
    geographicCoverage: 'Pune Central Urban Corridor',
    crs: 'EPSG:4326 (WGS 84)',
    geometryTypeOrRasterResolution: 'Point nodes with operator, socket type, and capacity tags',
    featureOrPixelCount: 13,
    verificationStatus: 'VERIFIED_OPENSTREETMAP',
    operationalStatus: 'MAPPED_IN_OSM',
    sourceAuthenticity: 'OpenStreetMap Overpass API extract verified against pune-snapshot.json',
    freshness: '2024-09',
    transformationHistory: [
      'Overpass QL bounding box query for amenity=charging_station',
      'Phase 6.1 audit: sanitized all injected default assumptions (reverted placeholder capacity and operator to null/UNKNOWN)',
      'Separated spatial existence (MAPPED_IN_OSM) from real-time operational status (requires OCPP/CPO telemetry)'
    ],
    provenanceCategory: 'SATELLITE_OBSERVATION',
    intendedUse: 'Spatial identification of existing EV charging nodes for co-location expansion and solar canopy shading.',
    knownLimitations: 'Community voluntary data; real-time operational status (online/offline/fault) requires OCPP / CPO telemetry. Available transformer headroom requires formal MSEDCL load-flow sanction.',
    license: 'ODbL 1.0 — © OpenStreetMap contributors',
    isAvailable: true,
  },

  'ds-osm-pune-arterial-corridors': {
    id: 'ds-osm-pune-arterial-corridors',
    name: 'Curated Pune Arterial Highway Corridors Reference (Sample Alignments)',
    sourceOrganization: 'Pune Comprehensive Mobility Plan (CMP) & Curated Urban Planning References',
    sourceUrl: 'src/data/official/pmc_road_corridors.json',
    acquisitionDate: '2024-08-01T00:00:00Z',
    lastUpdate: '2024-09-20T00:00:00Z',
    applicationRefreshDate: '2026-11-01T15:03:00Z',
    geographicCoverage: 'Pune Urban Arterial Network',
    crs: 'EPSG:4326 (WGS 84)',
    geometryTypeOrRasterResolution: 'Point features (representative corridor sample centroids)',
    featureOrPixelCount: 10,
    verificationStatus: 'MANUALLY_CURATED',
    operationalStatus: 'OPERATIONAL_STATUS_UNVERIFIED',
    sourceAuthenticity: 'Manually curated corridor sample points based on Pune CMP corridors with synthetic OSM IDs',
    freshness: '2024-09',
    transformationHistory: [
      'Assembled from CMP priority transit corridors',
      'Phase 6.1 forensic audit: reclassified from VERIFIED_OPENSTREETMAP to MANUALLY_CURATED due to synthetic relation/way IDs',
      'Carriageway widths flagged as estimated planning assumptions rather than surveyed Right-of-Way (ROW)'
    ],
    provenanceCategory: 'MANUALLY_CURATED',
    intendedUse: 'Screening heat-stressed transit corridors for roadside canopy arboriculture planning concepts.',
    knownLimitations: 'Corridors are represented as single sample centroid points, not continuous linear vector geometries. Carriageway widths and lengths are manual planning assumptions requiring statutory CTSO cadastre and PMC Road Dept Right-of-Way (ROW) surveys.',
    license: 'Planning Reference (UrjaSetu Urban Research)',
    isAvailable: true,
  },

  'ds-copernicus-dem-30m': {
    id: 'ds-copernicus-dem-30m',
    name: 'Copernicus Global Digital Elevation Model (GLO-30)',
    sourceOrganization: 'European Space Agency (ESA) / Airbus Defence and Space',
    sourceUrl: 'https://registry.opendata.aws/copernicus-dem',
    acquisitionDate: '2021-04-01T00:00:00Z',
    lastUpdate: '2021-04-01T00:00:00Z',
    applicationRefreshDate: '2026-10-18T14:50:00Z',
    geographicCoverage: 'Pune Central Region (18.5204 N, 73.8567 E)',
    crs: 'EPSG:4326 (WGS 84)',
    geometryTypeOrRasterResolution: '30m post spacing (GLO-30)',
    verificationStatus: 'VERIFIED_OFFICIAL',
    provenanceCategory: 'SATELLITE_OBSERVATION',
    intendedUse: 'Topographical slope gradient and terrain aspect calculations for civil site grading.',
    knownLimitations: 'Satellite radar digital surface model; does not capture micro-drainage channels or roadside retaining walls.',
    license: 'CC BY 4.0 (Copernicus Open Access)',
    isAvailable: true,
  },

  'ds-nasa-power-climatology': {
    id: 'ds-nasa-power-climatology',
    name: 'NASA POWER Synoptic Surface Solar Resource Climatology (CERES SYN1deg)',
    sourceOrganization: 'NASA Langley Research Center (LaRC)',
    sourceUrl: 'https://power.larc.nasa.gov',
    acquisitionDate: '2023-12-31T00:00:00Z',
    lastUpdate: '2024-01-15T00:00:00Z',
    applicationRefreshDate: '2026-10-18T14:50:00Z',
    geographicCoverage: 'Global 1-degree climatological grid (Sampled at Pune: 5.13 kWh/m²/day annual mean GHI)',
    crs: 'EPSG:4326 (WGS 84)',
    geometryTypeOrRasterResolution: '1-degree synoptic grid point interpolation',
    verificationStatus: 'VERIFIED_OFFICIAL',
    provenanceCategory: 'VERIFIED_TECHNICAL_REFERENCE',
    intendedUse: 'Climatological baseline photovoltaic yield estimations for solar canopy structures.',
    knownLimitations: 'Regional climatological mean; does not account for localized urban building horizon shading or microclimatic aerosol extinction.',
    license: 'Public Domain (NASA Open Science Policy)',
    isAvailable: true,
  }
};

export function listRegisteredDatasets(): DatasetRegistryItem[] {
  return Object.values(DATASET_REGISTRY);
}

export function getDatasetById(id: string): DatasetRegistryItem | undefined {
  return DATASET_REGISTRY[id];
}

export function getDatasetAvailabilitySummary() {
  const all = listRegisteredDatasets();
  const available = all.filter(d => d.isAvailable);
  const officialCount = all.filter(d => d.verificationStatus === 'VERIFIED_OFFICIAL' || d.verificationStatus === 'VERIFIED_PUBLIC_DISCLOSURE').length;
  
  return {
    totalRegistered: all.length,
    availableCount: available.length,
    officialVerifiedCount: officialCount,
    missingDatasetsRoadmap: [
      {
        datasetName: 'PMC Municipal Right-of-Way (ROW) & Underground Utility Cadastre',
        issuingAgency: 'PMC Road Dept / City Engineer',
        priority: 'VERY_HIGH',
        status: 'UNAVAILABLE_PENDING_MUNICIPAL_SHARING',
        impact: 'Mandates on-site GPR scanning before any tree-basin or canopy foundation excavation.'
      },
      {
        datasetName: 'MSEDCL Distribution Transformer (DT) Headroom & Feeder Asset Map',
        issuingAgency: 'MSEDCL Urban Infrastructure Division',
        priority: 'VERY_HIGH',
        status: 'UNAVAILABLE_PENDING_UTILITY_CLEARANCE',
        impact: 'Requires individual site-specific interconnection studies for EV charging hubs.'
      },
      {
        datasetName: 'PMC Property Tax & Building Structural Asset Cadastre',
        issuingAgency: 'PMC Property Tax & Building Inspection Dept',
        priority: 'HIGH',
        status: 'RESTRICTED_ACCESS',
        impact: 'Mandates on-site non-destructive rebound hammer tests on candidate cool roofs.'
      }
    ]
  };
}
