import { InfrastructureTypeId } from "@/config/infra-types";
import { 
  queryHeatPoint, 
  getHeatDiagnostics, 
  isHeatDataAvailable 
} from "@/server/heat-engine/loader";
import {
  HeatPointQueryResult,
  HeatDiagnosticsReport,
  ProvenanceCategory
} from "@/server/heat-engine/types";

export type EvidenceClassification =
  | 'SATELLITE_OBSERVATION'
  | 'DETERMINISTIC_CALCULATION'
  | 'VERIFIED_TECHNICAL_REFERENCE'
  | 'GENERAL_ENGINEERING_GUIDANCE'
  | 'AI_INTERPRETATION'
  | 'UNVERIFIED_REQUIRES_ADDITIONAL_DATA';

export interface StructuredEvidenceItem {
  claim: string;
  category: EvidenceClassification;
  sourceOrStandard?: string;
  notes?: string;
}

export interface HeatInfrastructureContext {
  available: boolean;
  provenance: ProvenanceCategory;
  siteObservations: {
    lstCelsius: number | null;
    lstKelvin: number | null;
    stQaUncertaintyK: number | null;
    ndvi30m: number | null;
    sclClassId: number;
    sclClassName: string;
    isInsideStudyArea: boolean;
  };
  citywideBaselines: {
    meanLSTCelsius: number;
    meanNDVI: number;
    thermalDeltaCelsius: number | null;
    ndviDelta: number | null;
  };
  disciplineInsights: {
    category: string;
    headline: string;
    observations: string[];
    planningRecommendations: string[];
    engineeringConsiderations: string[];
    scientificLimitations: string[];
    evidenceLedger: StructuredEvidenceItem[];
  };
}

/**
 * Evaluates satellite thermal and vegetation context for a candidate infrastructure site.
 * 
 * METHODOLOGICAL GOVERNANCE:
 * 1. Does NOT arbitrarily alter MCDA criteria weights or suitability scores.
 * 2. Uses verified Landsat 9 TIRS-2 calibrated LST (100m native resampled to 30m).
 * 3. Uses verified Sentinel-2B MSI Level-2A BOA NDVI (10m native aggregated to 30m).
 * 4. Strictly separates radiometric skin temperature (LST) from ambient air temperature.
 * 5. Strictly separates NDVI spectral reflectance index from tree canopy percentage.
 * 6. Does NOT calculate actual PV derating or battery temperatures directly from satellite LST.
 * 7. Replaces arbitrary priority thresholds (e.g. LST >= 48°C / NDVI < 0.35) with independent continuous observations.
 * 8. Documents verified statutory standards (BEE ECBC 2017) and distinguishes them from voluntary green ratings.
 */
export function evaluateHeatInfrastructureContext(
  type: InfrastructureTypeId,
  lat: number,
  lng: number
): HeatInfrastructureContext {
  if (!isHeatDataAvailable()) {
    return {
      available: false,
      provenance: 'DETERMINISTIC_RESULT',
      siteObservations: {
        lstCelsius: null,
        lstKelvin: null,
        stQaUncertaintyK: null,
        ndvi30m: null,
        sclClassId: 0,
        sclClassName: 'Data Unavailable',
        isInsideStudyArea: false,
      },
      citywideBaselines: {
        meanLSTCelsius: 46.3,
        meanNDVI: 0.514,
        thermalDeltaCelsius: null,
        ndviDelta: null,
      },
      disciplineInsights: {
        category: 'Thermal Context',
        headline: 'Satellite Heat Intelligence Products Unavailable',
        observations: ['Satellite raster products have not been loaded into server memory.'],
        planningRecommendations: ['Run Phase 3 satellite preprocessing pipeline to ingest Landsat 9 and Sentinel-2 data.'],
        engineeringConsiderations: [],
        scientificLimitations: ['No empirical satellite observations available for this site.'],
        evidenceLedger: [],
      },
    };
  }

  const diag: HeatDiagnosticsReport = getHeatDiagnostics();
  const point: HeatPointQueryResult = queryHeatPoint(lng, lat);

  const cityMeanLST = Math.round(diag.landsat9.calibratedLSTCelsius.mean * 10) / 10;
  const cityMeanNDVI = Math.round(diag.sentinel2b.ndvi30mDistribution.mean * 1000) / 1000;

  const siteLST = point.lst.celsius;
  const siteNDVI = point.ndvi.aggregated30m;

  const thermalDelta = siteLST !== null ? Math.round((siteLST - cityMeanLST) * 10) / 10 : null;
  const ndviDelta = siteNDVI !== null ? Math.round((siteNDVI - cityMeanNDVI) * 1000) / 1000 : null;

  const observations: string[] = [];
  const planningRecommendations: string[] = [];
  const engineeringConsiderations: string[] = [];
  const scientificLimitations: string[] = [
    'Land Surface Temperature (LST) measures radiometric skin temperature from Landsat 9 TIRS-2 Band 10; it does NOT measure 2-meter ambient air temperature or human physiological heat stress (UTCI).',
    'NDVI is a unitless mathematical index of spectral reflectance [-1.0, 1.0]; it does NOT quantify tree canopy cover percentage, leaf area index, or total vegetation fraction directly.',
    'Landsat 9 thermal observations have a 100m native sensor spatial resolution resampled to the 30m delivery grid; resampling does not increase native spatial resolving power.',
    'Satellite overpass represents an instantaneous clear-sky morning snapshot (~10:57 AM local solar time); it does NOT capture diurnal temperature extremes or nighttime urban heat island dynamics.',
  ];
  const evidenceLedger: StructuredEvidenceItem[] = [];

  let headline = '';
  const category = `${type} Microclimate & Thermal Appraisal`;

  if (siteLST !== null) {
    const deltaStr = thermalDelta !== null && thermalDelta > 0 ? `+${thermalDelta}°C` : `${thermalDelta}°C`;
    observations.push(
      `Site radiometric surface temperature (Landsat 9 LST 30m): ${siteLST}°C (Uncertainty: ±${point.lst.stQaUncertaintyKelvin} K; Study area baseline mean: ${cityMeanLST}°C; Relative deviation: ${deltaStr}).`
    );
    evidenceLedger.push({
      claim: `Site Land Surface Temperature: ${siteLST}°C (±${point.lst.stQaUncertaintyKelvin} K)`,
      category: 'SATELLITE_OBSERVATION',
      sourceOrStandard: 'USGS Landsat 9 Collection 2 Level-2 ST_B10 (LC09_L2SP_147047_20230422_02_T1)',
      notes: 'Instantaneous radiometric skin surface temperature resampled from 100m native thermal resolution.'
    });
  } else {
    observations.push('Site falls outside the active Pune regional grid or within a masked NoData cell.');
  }

  if (siteNDVI !== null) {
    observations.push(
      `Surface vegetation index (Sentinel-2B NDVI 30m area-weighted): ${siteNDVI} (Terrestrial baseline mean: ${cityMeanNDVI}; SCL Class: ${point.ndvi.sclClassName}).`
    );
    evidenceLedger.push({
      claim: `Site NDVI (30m area-weighted): ${siteNDVI} (SCL: ${point.ndvi.sclClassName})`,
      category: 'SATELLITE_OBSERVATION',
      sourceOrStandard: 'ESA Sentinel-2B Level-2A BOA (S2B_MSIL2A_20230424T052649_N0510_R105_T43QCA)',
      notes: 'Aggregated from 10m native BOA reflectance using 4x4 area-weighted matrix preserving negative reflectance.'
    });
  }

  switch (type) {
    case 'Solar Farm':
      headline = 'Photovoltaic Microclimate Context & Thermal Parameter Guidance';
      
      engineeringConsiderations.push(
        'Documented Module Parameter: Standard crystalline silicon (c-Si) PV modules exhibit a factory-certified maximum power temperature coefficient (γ_Pmp) typically between -0.35%/°C and -0.45%/°C relative to Standard Test Conditions (STC, 25°C cell temperature) (Source: IEC 61215:2021).'
      );
      evidenceLedger.push({
        claim: 'Crystalline silicon PV module temperature coefficient: -0.35% to -0.45%/°C relative to 25°C STC',
        category: 'VERIFIED_TECHNICAL_REFERENCE',
        sourceOrStandard: 'IEC 61215:2021 / Sandia PV Array Performance Model (SAND2004-5235)',
        notes: 'Module-specific datasheet parameter under standard test conditions.'
      });

      engineeringConsiderations.push(
        'Methodological Boundary: Satellite LST measures ground skin radiometric temperature during morning overpass; it does NOT establish operating solar panel cell temperature. Actual PV thermal derating cannot be calculated from satellite LST alone without on-site ambient air temperature, plane-of-array irradiance, wind speed, and thermal mounting coefficients (e.g., King/Faiman cell thermal model).'
      );
      evidenceLedger.push({
        claim: 'Actual PV thermal derating cannot be derived directly from satellite LST',
        category: 'UNVERIFIED_REQUIRES_ADDITIONAL_DATA',
        sourceOrStandard: 'NREL PVWatts / King Cell Temperature Formulation',
        notes: 'Requires in-situ meteorological measurements (Tamb, POA irradiance, wind speed) and module racking configuration.'
      });

      planningRecommendations.push(
        'Incorporate elevated open-rack mounting structures (minimum 0.8m ground clearance) to facilitate sub-module natural convective airflow and mitigate thermal derating.'
      );
      evidenceLedger.push({
        claim: 'Elevated open-rack mounting (≥ 0.8m ground clearance) improves convective sub-panel cooling',
        category: 'GENERAL_ENGINEERING_GUIDANCE',
        sourceOrStandard: 'Best Practices for Operation and Maintenance of Photovoltaic Systems (NREL/TP-7A40-67553)',
        notes: 'Open racking reduces thermal resistance compared to close-roof or flush installations.'
      });

      planningRecommendations.push(
        'Consider agrivoltaic groundcover or light native grasses beneath PV arrays to mitigate ground surface heating compared to bare dry soil or asphalt.'
      );
      evidenceLedger.push({
        claim: 'Vegetated groundcover limits ground albedo heating beneath solar arrays',
        category: 'GENERAL_ENGINEERING_GUIDANCE',
        sourceOrStandard: 'Agrivoltaics in India: Overview of Operational Projects (TERI / Indo-German Energy Forum)',
        notes: 'Microclimate transpiration can lower ground surface temperature beneath arrays.'
      });
      break;

    case 'EV Charging Station':
      headline = 'Charging Station Microclimate & Thermal Management Guidance';
      
      engineeringConsiderations.push(
        'Thermal Environment Context: High ambient thermal environments can increase vehicle battery thermal management system (BTMS) parasitic energy consumption during DC fast-charging sessions and accelerate thermal cycling stress on power electronics (rectifiers/inverters) (Source: EPRI Report 3002016335 / SAE J1772).'
      );
      evidenceLedger.push({
        claim: 'Elevated ambient heat increases DC fast charger thermal management overhead',
        category: 'VERIFIED_TECHNICAL_REFERENCE',
        sourceOrStandard: 'EPRI Report 3002016335 (DC Fast Charging Infrastructure Thermal Management) / SAE J1772',
        notes: 'Battery thermal management system draws auxiliary power during extreme heat to prevent cell overheating.'
      });

      engineeringConsiderations.push(
        'Methodological Boundary: Satellite LST represents ground skin surface temperature at satellite overpass time; it does NOT establish vehicle battery core temperature, coolant loop temperature, or charging dispenser internal operating temperatures.'
      );
      evidenceLedger.push({
        claim: 'Satellite LST does not establish vehicle battery or charger operating temperatures',
        category: 'UNVERIFIED_REQUIRES_ADDITIONAL_DATA',
        sourceOrStandard: 'SAE J2954 / IEC 61851-23',
        notes: 'Equipment thermal state requires on-site telemetry and electrical enclosure temperature sensors.'
      });

      planningRecommendations.push(
        'Deploy dedicated solar photovoltaic or tensile shading canopies over DC fast-charging bays to shield vehicles from direct solar insolation during high-power charging.'
      );
      evidenceLedger.push({
        claim: 'Shading canopies protect vehicles and charging equipment from direct solar radiant heating',
        category: 'GENERAL_ENGINEERING_GUIDANCE',
        sourceOrStandard: 'U.S. Department of Energy / Clean Cities EV Infrastructure Siting Guidelines',
        notes: 'Reduces vehicle cabin and battery pack pre-charging solar heat soaking.'
      });

      planningRecommendations.push(
        'Utilize light-colored permeable concrete pavers (Solar Reflectance Index SRI ≥ 29 per IGBC guidelines) for charging station aprons to limit localized ground heat absorption.'
      );
      evidenceLedger.push({
        claim: 'High-SRI permeable pavers mitigate apron surface heat retention',
        category: 'GENERAL_ENGINEERING_GUIDANCE',
        sourceOrStandard: 'IGBC Green New Buildings Rating System (Heat Island Reduction - Non-Roof)',
        notes: 'Permeable pavement provides both evaporative cooling and stormwater infiltration.'
      });
      break;

    case 'Park':
      headline = 'Urban Greening & Microclimate Appraisal';
      
      if (siteNDVI !== null && siteNDVI < cityMeanNDVI) {
        planningRecommendations.push(
          `Site exhibits a below-average vegetation index (NDVI ${siteNDVI} vs terrestrial study area mean ${cityMeanNDVI}). Civic greening and canopy expansion can enhance localized pedestrian shade and microclimatic comfort.`
        );
      } else if (siteNDVI !== null) {
        planningRecommendations.push(
          `Site exhibits an above-average vegetation index (NDVI ${siteNDVI} vs terrestrial study area mean ${cityMeanNDVI}). Park planning should prioritize the preservation of mature trees and established ecological continuity.`
        );
      }
      evidenceLedger.push({
        claim: `Vegetation comparison: site NDVI ${siteNDVI ?? 'N/A'} relative to study area mean ${cityMeanNDVI}`,
        category: 'DETERMINISTIC_CALCULATION',
        sourceOrStandard: 'UrjaSetu Satellite Raster Diagnostics (Sentinel-2B BOA NDVI 30m)',
        notes: 'Continuous empirical observation; no arbitrary regulatory threshold applied.'
      });

      planningRecommendations.push(
        'Prioritize native drought-tolerant broadleaf tree species (e.g., Azadirachta indica / Neem, Ficus religiosa / Peepal, Tamarindus indica / Tamarind) with high crown density to maximize microclimate shade in accordance with municipal landscape guidelines.'
      );
      evidenceLedger.push({
        claim: 'Native broadleaf tree species provide durable microclimatic shading and low water requirements',
        category: 'GENERAL_ENGINEERING_GUIDANCE',
        sourceOrStandard: 'CPWD Landscape Specifications / Maharashtra Urban Forestry Manual',
        notes: 'Species selection optimized for semi-arid Deccan plateau climatic conditions.'
      });
      break;

    case 'Hospital':
    case 'School':
    case 'Building':
      headline = 'Building Envelope Microclimate Context & Cool-Roof Standards';
      
      engineeringConsiderations.push(
        'Statutory Building Code Reference: Under the Bureau of Energy Efficiency (BEE) Energy Conservation Building Code (ECBC 2017) Section 4.3.1.1, low-slope roofs (≤ 9.5°) in Composite/Warm climates specify Cool Roof performance: Initial Solar Reflectance ≥ 0.70, Thermal Emittance ≥ 0.75, and Solar Reflectance Index SRI ≥ 78 (Source: BEE ECBC 2017 Table 4.1).'
      );
      evidenceLedger.push({
        claim: 'BEE ECBC 2017 Section 4.3.1.1 specifies Cool Roof minimum: Initial Reflectance ≥ 0.70, Emittance ≥ 0.75, SRI ≥ 78',
        category: 'VERIFIED_TECHNICAL_REFERENCE',
        sourceOrStandard: 'Bureau of Energy Efficiency (BEE), Ministry of Power, Govt. of India: ECBC 2017 Table 4.1',
        notes: 'Statutory standard adopted in Maharashtra ECBC rules for commercial and institutional buildings.'
      });

      engineeringConsiderations.push(
        'Advisory Rating Distinction: Voluntary green building standards (LEED v4 / IGBC Green Buildings) specify an advisory target of SRI ≥ 82 for low-sloped roofs. This is an advisory credit for green certification, not a mandatory statutory building bylaw requirement.'
      );
      evidenceLedger.push({
        claim: 'SRI ≥ 82 is an advisory voluntary green building credit (LEED / IGBC), not a statutory mandate',
        category: 'VERIFIED_TECHNICAL_REFERENCE',
        sourceOrStandard: 'USGBC LEED v4 BD+C / IGBC Green New Buildings Rating System',
        notes: 'Distinguishes voluntary rating targets from statutory ECBC requirements.'
      });

      engineeringConsiderations.push(
        'HVAC Engineering Principle: General HVAC design literature indicates that air-cooled chiller condensing unit COP degrades by approximately 1.5% to 3.0% per °C rise in entering air dry-bulb temperature above standard design ratings (e.g., 35°C/40°C per ASHRAE Handbook - Fundamentals). Methodological boundary: Satellite roof radiometric LST cannot be directly equated to chiller entering air dry-bulb temperature.'
      );
      evidenceLedger.push({
        claim: 'Air-cooled chiller efficiency degrades ~1.5% to 3% per °C rise in entering air dry-bulb temperature',
        category: 'GENERAL_ENGINEERING_GUIDANCE',
        sourceOrStandard: 'ASHRAE Handbook - Fundamentals (Chapter on Climatic Design Information) & Equipment',
        notes: 'Empirical rule of thumb for ambient entering air temperature, not satellite skin surface temperature.'
      });

      planningRecommendations.push(
        'Implement high-reflectance "Cool Roof" coatings meeting or exceeding ECBC 2017 specifications (Initial Solar Reflectance ≥ 0.70, SRI ≥ 78) on expanses of flat roof to reduce solar heat ingress.'
      );
      evidenceLedger.push({
        claim: 'High-reflectance cool roof coatings reduce building conductive solar heat gain',
        category: 'GENERAL_ENGINEERING_GUIDANCE',
        sourceOrStandard: 'Bureau of Energy Efficiency (BEE) / Cool Roof Guidelines for Indian Cities',
        notes: 'Reduces rooftop surface temperatures and lowers indoor cooling electrical demand.'
      });

      planningRecommendations.push(
        'Incorporate external architectural shading (brise-soleil) and perimeter vegetation along western and southern facades to buffer afternoon solar irradiance.'
      );
      evidenceLedger.push({
        claim: 'Architectural and landscape shading on western/southern facades buffers peak afternoon heat load',
        category: 'GENERAL_ENGINEERING_GUIDANCE',
        sourceOrStandard: 'National Building Code of India (NBC 2016) Part 8: Building Services',
        notes: 'Mitigates solar thermal gain through vertical fenestration.'
      });
      break;

    case 'Road':
    case 'Bridge':
    case 'Transit Station':
      headline = 'Transportation Infrastructure Microclimate & Pavement Guidance';
      
      engineeringConsiderations.push(
        'Thermal Mass & Nocturnal Re-radiation: Dense asphalt roadway pavements absorb solar irradiance and release sensible heat into the urban canopy layer during evening hours, contributing to nocturnal urban heat retention (Source: EPA Heat Island Compendium).'
      );
      evidenceLedger.push({
        claim: 'Asphalt pavement thermal mass contributes to nighttime urban heat retention',
        category: 'VERIFIED_TECHNICAL_REFERENCE',
        sourceOrStandard: 'U.S. EPA Heat Island Compendium (Cool Pavements Chapter)',
        notes: 'Lower albedo materials store thermal energy during daytime insolation.'
      });

      engineeringConsiderations.push(
        'Methodological Boundary: OpenStreetMap records 1D road centerlines, not 2D carriageway polygons, curb alignments, or pavement surface materials. Ground survey is required to verify actual pavement dimensions and thermal characteristics.'
      );
      evidenceLedger.push({
        claim: 'OSM 1D road centerlines do not represent 2D pavement widths or materials',
        category: 'UNVERIFIED_REQUIRES_ADDITIONAL_DATA',
        sourceOrStandard: 'OpenStreetMap Data Model Specification',
        notes: 'Geometric centerlines lack statutory right-of-way and surface material attributes.'
      });

      planningRecommendations.push(
        'For passenger waiting platforms and transit shelters, provide well-ventilated shade roofs with high-reflectance exterior finishes.'
      );
      evidenceLedger.push({
        claim: 'Ventilated reflective shading over transit platforms improves passenger thermal comfort',
        category: 'GENERAL_ENGINEERING_GUIDANCE',
        sourceOrStandard: 'Ministry of Housing and Urban Affairs (MoHUA) Transit Facility Guidelines',
        notes: 'Protects commuters from direct radiative heat load.'
      });
      break;

    default:
      headline = 'Urban Microclimate Context';
      planningRecommendations.push(
        'Consider local thermal environment and vegetation context when selecting exterior envelope materials, building orientation, and site landscaping.'
      );
      evidenceLedger.push({
        claim: 'Site microclimatic context should inform building orientation and landscaping',
        category: 'GENERAL_ENGINEERING_GUIDANCE',
        sourceOrStandard: 'National Building Code of India (NBC 2016)',
        notes: 'Passive design principles for semi-arid/composite climate zone.'
      });
      break;
  }

  return {
    available: true,
    provenance: 'DETERMINISTIC_RESULT',
    siteObservations: {
      lstCelsius: siteLST,
      lstKelvin: point.lst.kelvin,
      stQaUncertaintyK: point.lst.stQaUncertaintyKelvin,
      ndvi30m: siteNDVI,
      sclClassId: point.ndvi.sclClassId,
      sclClassName: point.ndvi.sclClassName,
      isInsideStudyArea: point.gridCell.isInsideGrid,
    },
    citywideBaselines: {
      meanLSTCelsius: cityMeanLST,
      meanNDVI: cityMeanNDVI,
      thermalDeltaCelsius: thermalDelta,
      ndviDelta: ndviDelta,
    },
    disciplineInsights: {
      category,
      headline,
      observations,
      planningRecommendations,
      engineeringConsiderations,
      scientificLimitations,
      evidenceLedger,
    },
  };
}
