/**
 * UrjaSetu Phase 6.2 - Engineering Standards Applicability Registry
 * 
 * Classifies all cited codes, testing protocols, and specifications by their 
 * legal, contractual, and technical applicability in Pune, Maharashtra.
 */

export type StandardApplicabilityStatus =
  | 'STATUTORY_REQUIREMENT'      // Legally mandated by national act, state rules, or municipal bylaws
  | 'CONTRACTUAL_REQUIREMENT'    // Mandatory when explicitly incorporated into PMC/CPWD tender specifications
  | 'TECHNICAL_REFERENCE'        // Internationally or nationally recognized laboratory/field test method
  | 'RECOMMENDED_PRACTICE'       // Voluntary guidelines, green building rating targets, or advisory codes
  | 'NOT_APPLICABLE'             // Foreign standard without legal force in India unless contractually cited
  | 'UNVERIFIED';                // Legal status unconfirmed for specific municipal asset class

export type StandardCategory =
  | 'STRUCTURAL_DESIGN'
  | 'ENERGY_EFFICIENCY'
  | 'PEDESTRIAN_AND_HIGHWAY'
  | 'SUBSURFACE_UTILITIES'
  | 'MATERIALS_AND_TESTING'
  | 'ENVIRONMENTAL_AND_HEALTH'
  | 'ELECTRICAL_SAFETY';

export interface EngineeringStandardRecord {
  identifier: string;
  title: string;
  issuingOrganization: string;
  countryOfOrigin: string;
  publicationOrRevisionDate: string;
  category: StandardCategory;
  applicabilityStatus: StandardApplicabilityStatus;
  jurisdiction: 'NATIONAL_INDIA' | 'STATE_MAHARASHTRA' | 'MUNICIPAL_PMC' | 'INTERNATIONAL';
  statutoryBasis?: string;
  applicabilityConditions: string;
  urjaSetuUsageContext: string;
  riskOfMisrepresentation: string;
}

export const ENGINEERING_STANDARDS_REGISTRY: Record<string, EngineeringStandardRecord> = {
  'BEE_ECBC_2017': {
    identifier: 'BEE ECBC 2017 Table 4.1',
    title: 'Energy Conservation Building Code 2017 - Envelope Performance Requirements',
    issuingOrganization: 'Bureau of Energy Efficiency (BEE), Ministry of Power, Government of India',
    countryOfOrigin: 'India',
    publicationOrRevisionDate: '2017',
    category: 'ENERGY_EFFICIENCY',
    applicabilityStatus: 'STATUTORY_REQUIREMENT',
    jurisdiction: 'NATIONAL_INDIA',
    statutoryBasis: 'Energy Conservation Act 2001; Maharashtra Energy Conservation Building Rules',
    applicabilityConditions: 'Commercial and institutional buildings with connected electrical load >= 100 kW or contract demand >= 120 kVA. Specifically mandates cool roofs for low-slope roofs in Warm-Humid and Composite climates: Initial Solar Reflectance >= 0.70, Thermal Emittance >= 0.75, SRI >= 78.',
    urjaSetuUsageContext: 'Specifies minimum solar reflectance index (SRI >= 78) for cool roof interventions on public and commercial institutional buildings.',
    riskOfMisrepresentation: 'Must not be represented as mandatory for unorganized residential dwellings or existing non-commercial municipal facilities below the connected load threshold.'
  },

  'IS_875_PART_3': {
    identifier: 'IS 875 (Part 3): 2015',
    title: 'Code of Practice for Design Loads (Other Than Earthquake) For Buildings and Structures - Part 3: Wind Loads',
    issuingOrganization: 'Bureau of Indian Standards (BIS)',
    countryOfOrigin: 'India',
    publicationOrRevisionDate: '2015 (Third Revision)',
    category: 'STRUCTURAL_DESIGN',
    applicabilityStatus: 'STATUTORY_REQUIREMENT',
    jurisdiction: 'NATIONAL_INDIA',
    statutoryBasis: 'National Building Code of India (NBC 2016); Unified Development Control and Promotion Regulations (UDCPR) for Maharashtra State',
    applicabilityConditions: 'Mandatory structural standard for all permanent and temporary building superstructures, solar canopies, pergolas, and roof-mounted frames. Pune basic wind speed Vb = 39 m/s (Zone 2).',
    urjaSetuUsageContext: 'Design criteria for solar PV carports, lightweight shading canopies, and vertical green screen structural frames against cyclonic uplift forces.',
    riskOfMisrepresentation: 'Must be verified by a registered structural engineer with formal wind load calculation sheets; software proximity checks cannot certify structural safety.'
  },

  'IRC_103_2012': {
    identifier: 'IRC:103-2012',
    title: 'Guidelines for Pedestrian Facilities',
    issuingOrganization: 'Indian Roads Congress (IRC)',
    countryOfOrigin: 'India',
    publicationOrRevisionDate: '2012',
    category: 'PEDESTRIAN_AND_HIGHWAY',
    applicabilityStatus: 'RECOMMENDED_PRACTICE',
    jurisdiction: 'NATIONAL_INDIA',
    statutoryBasis: 'Advisory national guideline; becomes mandatory only when adopted in state PWD manuals, PMC urban street design guidelines, or Smart Cities tender documents.',
    applicabilityConditions: 'Recommends minimum unobstructed pedestrian clear walking zone of 1.8m in commercial/institutional zones (1.5m minimum absolute) and universal accessibility ramps.',
    urjaSetuUsageContext: 'Used to filter urban green corridor tree pits and sidewalk canopy interventions to ensure tree grates do not obstruct pedestrian right-of-way.',
    riskOfMisrepresentation: 'Citing IRC:103 as a statutory criminal code or automatic disqualification is incorrect; it is a normative engineering design guideline adopted at municipal discretion.'
  },

  'IRC_SP_73_2018': {
    identifier: 'IRC:SP:73-2018',
    title: 'Manual of Specifications and Standards for Two-Laning of Highways with Paved Shoulder',
    issuingOrganization: 'Indian Roads Congress (IRC)',
    countryOfOrigin: 'India',
    publicationOrRevisionDate: '2018',
    category: 'PEDESTRIAN_AND_HIGHWAY',
    applicabilityStatus: 'CONTRACTUAL_REQUIREMENT',
    jurisdiction: 'NATIONAL_INDIA',
    statutoryBasis: 'Standard concession/EPC contract reference under Ministry of Road Transport and Highways (MoRTH)',
    applicabilityConditions: 'Applies to two-lane highway corridors and bridge approaches executed under public tender.',
    urjaSetuUsageContext: 'Used by the bridge planning engine to verify highway lane compatibility and approach corridor capacity.',
    riskOfMisrepresentation: 'Applies to state and national highway geometries, not narrow interior municipal lanes unless explicitly adopted by PMC.'
  },

  'IS_516_2021': {
    identifier: 'IS 516 (Part 5): 2021',
    title: 'Hardened Concrete - Methods of Test - Non-Destructive Testing of Concrete',
    issuingOrganization: 'Bureau of Indian Standards (BIS)',
    countryOfOrigin: 'India',
    publicationOrRevisionDate: '2021',
    category: 'MATERIALS_AND_TESTING',
    applicabilityStatus: 'TECHNICAL_REFERENCE',
    jurisdiction: 'NATIONAL_INDIA',
    statutoryBasis: 'Rebound hammer and ultrasonic pulse velocity testing standards referenced in CPWD specification schedules.',
    applicabilityConditions: 'Required prior to adding dead load (e.g., intensive green roofs or rooftop solar frames) to existing reinforced concrete slabs.',
    urjaSetuUsageContext: 'Recommended non-destructive testing (NDT) protocol to ascertain compressive strength and structural soundess of hospital and institutional roof slabs before cool roof or solar mounting.',
    riskOfMisrepresentation: 'Software cannot certify slab integrity; field NDT testing with calibrated physical sensors is non-negotiable.'
  },

  'CPWD_SPEC_2019': {
    identifier: 'CPWD Specifications 2019 (Vol 1 & 2)',
    title: 'Central Public Works Department Specifications for Civil and Electrical Works',
    issuingOrganization: 'Directorate General, CPWD, Ministry of Housing and Urban Affairs',
    countryOfOrigin: 'India',
    publicationOrRevisionDate: '2019',
    category: 'MATERIALS_AND_TESTING',
    applicabilityStatus: 'CONTRACTUAL_REQUIREMENT',
    jurisdiction: 'NATIONAL_INDIA',
    statutoryBasis: 'Standard contractual specification for central government civil engineering projects, often adopted by municipal corporations.',
    applicabilityConditions: 'Binding when stipulated in PMC public works tender contracts and bill of quantities (BOQ).',
    urjaSetuUsageContext: 'Defines surface preparation, crack filling, priming, and application methodology for liquid-applied polymer waterproof roof membranes.',
    riskOfMisrepresentation: 'Not universally applicable to private real estate unless adopted by owner contract.'
  },

  'ASTM_D4541': {
    identifier: 'ASTM D4541-22',
    title: 'Standard Test Method for Pull-Off Strength of Coatings Using Portable Adhesion Testers',
    issuingOrganization: 'ASTM International',
    countryOfOrigin: 'United States',
    publicationOrRevisionDate: '2022',
    category: 'MATERIALS_AND_TESTING',
    applicabilityStatus: 'TECHNICAL_REFERENCE',
    jurisdiction: 'INTERNATIONAL',
    statutoryBasis: 'Foreign standard. No statutory force in India. Used strictly as a referenced technical testing method in performance tenders.',
    applicabilityConditions: 'Used in quality control to measure tensile pull-off bond strength (typically >= 1.5 MPa on prepared concrete) for elastomeric cool roof coatings.',
    urjaSetuUsageContext: 'Referenced as the industry standard testing protocol for verifying roof coating adhesion prior to sign-off.',
    riskOfMisrepresentation: 'Must NEVER be cited as an Indian statutory requirement. It is an international technical test method.'
  },

  'GREEN_SEAL_GS_11': {
    identifier: 'Green Seal GS-11',
    title: 'Standard for Paints, Coatings, Stains, and Sealers',
    issuingOrganization: 'Green Seal, Inc.',
    countryOfOrigin: 'United States',
    publicationOrRevisionDate: '2021 (Edition 4.0)',
    category: 'ENVIRONMENTAL_AND_HEALTH',
    applicabilityStatus: 'RECOMMENDED_PRACTICE',
    jurisdiction: 'INTERNATIONAL',
    statutoryBasis: 'Voluntary international ecolabel. No statutory standing under Indian environmental law.',
    applicabilityConditions: 'Establishes low-VOC thresholds (e.g., < 50 g/L for architectural coatings) and restricts toxic solvents (benzene, phthalates). Relevant for sensitive receptors like hospitals and schools.',
    urjaSetuUsageContext: 'Referenced as a voluntary specification guideline to protect indoor air quality during coating application on occupied hospital rooftops.',
    riskOfMisrepresentation: 'Must NOT be claimed as an Indian statutory environmental regulation. Indian statutory VOC regulations (if any) stem from CPCB/MoEFCC.'
  },

  'ASCE_38_02': {
    identifier: 'ASCE 38-02 / ASCE 38-22',
    title: 'Standard Guideline for Investigating and Documenting Existing Subsurface Utilities',
    issuingOrganization: 'American Society of Civil Engineers (ASCE)',
    countryOfOrigin: 'United States',
    publicationOrRevisionDate: '2002 / 2022',
    category: 'SUBSURFACE_UTILITIES',
    applicabilityStatus: 'TECHNICAL_REFERENCE',
    jurisdiction: 'INTERNATIONAL',
    statutoryBasis: 'Foreign voluntary consensus standard. No statutory basis in India.',
    applicabilityConditions: 'Defines Quality Levels (QL-D through QL-A) for utility depiction. UrjaSetu references QL-B (surface geophysical methods such as GPR and electromagnetic pipe locators).',
    urjaSetuUsageContext: 'Prescribed as the technical survey protocol before excavating street tree pits or deep foundation footings along utility-dense Pune road corridors.',
    riskOfMisrepresentation: 'Must NOT be portrayed as an Indian municipal law. Indian subsurface utility practices operate under local PMC road digging permissions.'
  },

  'CEA_SAFETY_REG_2010': {
    identifier: 'CEA Regulations 2010',
    title: 'Central Electricity Authority (Measures relating to Safety and Electric Supply) Regulations, 2010',
    issuingOrganization: 'Central Electricity Authority, Ministry of Power, Government of India',
    countryOfOrigin: 'India',
    publicationOrRevisionDate: '2010 (as amended)',
    category: 'ELECTRICAL_SAFETY',
    applicabilityStatus: 'STATUTORY_REQUIREMENT',
    jurisdiction: 'NATIONAL_INDIA',
    statutoryBasis: 'Electricity Act 2003 Section 53 and Section 177',
    applicabilityConditions: 'Mandatory statutory clearances for medium (11 kV), high (22/33 kV), and extra-high voltage installations. Regulates horizontal and vertical safety clearances between live conductors and urban structures.',
    urjaSetuUsageContext: 'Mandatory standard for reviewing EV fast charger grid ties, substation connections, and solar canopy placement near overhead 11/22 kV powerlines.',
    riskOfMisrepresentation: 'Cannot be waived. A spatial proximity buffer does not constitute electrical clearance inspection.'
  }
};

/**
 * Helper to retrieve a standard by its identifier key
 */
export function getEngineeringStandard(key: string): EngineeringStandardRecord | undefined {
  return ENGINEERING_STANDARDS_REGISTRY[key];
}

/**
 * Returns all standards filtered by status
 */
export function getStandardsByStatus(status: StandardApplicabilityStatus): EngineeringStandardRecord[] {
  return Object.values(ENGINEERING_STANDARDS_REGISTRY).filter(s => s.applicabilityStatus === status);
}

/**
 * Returns formatted citation text with legal qualification
 */
export function formatStandardCitation(key: string): string {
  const std = ENGINEERING_STANDARDS_REGISTRY[key];
  if (!std) return key;
  return `${std.identifier} [${std.applicabilityStatus.replace(/_/g, ' ')}] (${std.issuingOrganization})`;
}
