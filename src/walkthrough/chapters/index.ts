/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TourChapter } from '../types';

export const CHAPTERS: TourChapter[] = [
  // CHAPTER 0: The Big Picture
  {
    id: 'ch0_big_picture',
    number: 0,
    title: 'The Big Picture',
    subtitle: 'How UrjaSetu connects satellite heat data to municipal cooling decisions',
    route: '/walkthrough',
    steps: [
      {
        id: 'ch0_s1_overview',
        targetSelector: '[data-tour="walkthrough-map"]',
        placement: 'bottom',
        copy: {
          title: 'Where Pune Should Cool First',
          simple: 'UrjaSetu evaluates satellite surface temperature, population density, and municipal budget constraints to rank urban cooling priorities.',
          technical: 'UrjaSetu integrates satellite thermal radiometry and population exposure into a constrained optimization engine, resolving optimal cooling allocations without heuristic assumptions.',
          chip: 'Modelled',
          chipLabel: 'Planning Engine',
        },
      },
      {
        id: 'ch0_s2_tools',
        targetSelector: '[data-tour="walkthrough-tools"]',
        placement: 'top',
        copy: {
          title: 'Interconnected Climate Tools',
          simple: 'Five specialized tools support your workflow: heat planning, loss monitoring, scenario comparisons, infrastructure shading, and solar thermal analysis.',
          technical: 'The suite connects empirical satellite observations with predictive machine learning models, linking ward-level heat mitigation directly to solar efficiency and public health protection.',
          chip: 'Measured',
          chipLabel: 'Integrated Suite',
        },
      },
      {
        id: 'ch0_s3_flow',
        targetSelector: '[data-tour="walkthrough-flow"]',
        placement: 'bottom',
        copy: {
          title: 'The Municipal Decision Flow',
          simple: 'Start with citywide heat intelligence, evaluate intervention scenarios, inspect individual zones, and export an auditable municipal brief.',
          technical: 'The decision workflow progresses from macro-level raster screening down to individual cell dossiers, maintaining mathematical provenance and confidence intervals throughout.',
          chip: 'Assumed',
          chipLabel: 'Workflow Guide',
        },
      },
      {
        id: 'ch0_s4_limits',
        targetSelector: '[data-tour="walkthrough-limits"]',
        placement: 'top',
        isLimits: true,
        copy: {
          title: 'Platform Scope and Limits',
          simple: 'UrjaSetu provides planning decision support. It does not replace on-site civil engineering surveys or automated municipal permit approvals.',
          technical: 'All predictions reflect statistical models subject to spatial error bounds. Recommendations provide comparative prioritization and require site-level feasibility verification.',
          chip: 'Assumed',
          chipLabel: 'Platform Boundaries',
        },
      },
    ],
  },

  // CHAPTER 1: Reading the Numbers
  {
    id: 'ch1_reading_numbers',
    number: 1,
    title: 'Reading the Numbers',
    subtitle: 'Understanding provenance chips, confidence ranges, and surface temperature',
    route: '/method',
    steps: [
      {
        id: 'ch1_s1_chips',
        targetSelector: '[data-tour="method-truth-chips"]',
        placement: 'bottom',
        copy: {
          title: 'Four Clear Provenance Labels',
          simple: 'Every metric displays one of four labels: Measured from satellites, Modelled by algorithms, Assumed from standards, or Input by you.',
          technical: 'Strict semantic tagging distinguishes empirical observations from synthetic estimates. Measured values stem from registered sensors, Modelled values feature uncertainty intervals, and Assumed values denote fixed parameters.',
          chip: 'Measured',
          chipLabel: 'Tagging Standard',
        },
      },
      {
        id: 'ch1_s2_error',
        targetSelector: '[data-tour="method-cv-error"]',
        placement: 'bottom',
        copy: {
          title: 'Quantified Uncertainty Ranges',
          simple: 'Modelled cooling numbers show expected ranges alongside our spatial cross-validation error of {{model.cv_rmse_c}}.',
          technical: 'Model predictions display confidence intervals derived from {{model.ensemble_members}} bootstrap ensemble members, evaluated against a spatial cross-validation root mean square error of {{model.cv_rmse_c}}.',
          chip: 'Modelled',
          chipLabel: 'Error Quantified',
        },
      },
      {
        id: 'ch1_s3_surface_vs_air',
        targetSelector: '[data-tour="method-surface-vs-air"]',
        placement: 'top',
        copy: {
          title: 'Surface Temperature is Not Air Temperature',
          simple: 'Our satellites measure surface skin temperature of rooftops and pavement, which differs significantly from ambient air temperature.',
          technical: 'Landsat thermal infrared radiometry captures land surface skin temperature rather than ambient two-meter air temperature. Convective airflow and shade create substantial localized temperature differences.',
          chip: 'Measured',
          chipLabel: 'Thermal Radiometry',
        },
      },
      {
        id: 'ch1_s4_limits',
        targetSelector: '[data-tour="method-limits"]',
        placement: 'top',
        isLimits: true,
        copy: {
          title: 'Scientific Interpretation Limits',
          simple: 'Predictions represent statistical associations rather than guaranteed cooling outcomes. Local microclimates and wind patterns may alter actual outcomes.',
          technical: 'Reported intervals represent parameter variance across training partitions. Unmodeled microclimatic factors such as anthropogenic heat emissions and atmospheric inversions fall outside model scope.',
          chip: 'Assumed',
          chipLabel: 'Methodological Bounds',
        },
      },
    ],
  },

  // CHAPTER 2: Heat Intelligence Planner
  {
    id: 'ch2_heat_planner',
    number: 2,
    title: 'Heat Intelligence Planner',
    subtitle: 'Setting municipal constraints and optimizing cooling allocation across Pune',
    route: '/heat-planner',
    steps: [
      {
        id: 'ch2_s1_layers',
        targetSelector: '[data-tour="heat-layer-selector"]',
        placement: 'bottom',
        copy: {
          title: 'Five Spatial Grid Layers',
          simple: 'Switch between heat burden, surface temperature, vegetation index, population density, and historic green loss across Pune.',
          technical: 'The map interface renders five normalized raster layers covering {{cells.total_count}} grid cells, allowing immediate spatial comparison of heat anomalies and vulnerable communities.',
          chip: 'Measured',
          chipLabel: 'Raster Layers',
        },
      },
      {
        id: 'ch2_s2_burden',
        targetSelector: '[data-tour="heat-map"]',
        placement: 'left',
        copy: {
          title: 'Heat Burden Definition',
          simple: 'Heat burden identifies areas combining elevated surface temperature with high population density, highlighting vulnerable residents.',
          technical: 'The burden index multiplies normalized daytime land surface temperature excess by residential population counts, isolating areas where intense thermal exposure coincides with human vulnerability.',
          chip: 'Modelled',
          chipLabel: 'Exposure Index',
        },
      },
      {
        id: 'ch2_s3_budget',
        targetSelector: '[data-tour="heat-budget-slider"]',
        placement: 'right',
        copy: {
          title: 'Greening Budget Constraint',
          simple: 'Specify available municipal hectares for planting. The optimizer allocates this budget to maximize overall cooling benefit.',
          technical: 'The greening target slider enforces an upper bound constraint on total unbuilt land conversion, serving as the budget ceiling during greedy knapsack optimization.',
          chip: 'Input',
          chipLabel: 'Municipal Constraint',
        },
      },
      {
        id: 'ch2_s4_ndvi',
        targetSelector: '[data-tour="heat-ndvi-slider"]',
        placement: 'right',
        copy: {
          title: 'Target Vegetation Index',
          simple: 'Set the desired vegetation index level. Higher values reflect denser vegetative planting and stronger estimated surface cooling.',
          technical: 'The parameter specifies the post-intervention normalized difference vegetation index, with values between indicative shrubs and dense vegetation driving the counterfactual cooling model.',
          chip: 'Input',
          chipLabel: 'Vegetation Target',
        },
      },
      {
        id: 'ch2_s5_ward',
        targetSelector: '[data-tour="heat-ward-filter"]',
        placement: 'right',
        copy: {
          title: 'Geographic Scope Selection',
          simple: 'Filter allocations to an individual administrative ward or run citywide across all municipal wards simultaneously.',
          technical: 'Ward filtering subsets candidate cells to municipal administrative boundaries, enabling ward-specific budget optimization alongside macro-level city allocations.',
          chip: 'Assumed',
          chipLabel: 'Administrative Boundary',
        },
      },
      {
        id: 'ch2_s6_run',
        targetSelector: '[data-tour="heat-run-button"]',
        placement: 'right',
        copy: {
          title: 'Greedy Benefit Optimization',
          simple: 'Executing optimization runs our greedy allocation algorithm, ranking zones by cooling benefit per hectare.',
          technical: 'The engine solves a fractional knapsack problem by ranking candidate cells according to marginal cooling benefit per greenable hectare, terminating once budget constraints are satisfied.',
          chip: 'Modelled',
          chipLabel: 'Knapsack Optimizer',
        },
      },
      {
        id: 'ch2_s7_summary',
        targetSelector: '[data-tour="heat-summary-strip"]',
        placement: 'top',
        copy: {
          title: 'Portfolio Impact Summary',
          simple: 'Review total priority zones, estimated people protected, cooling impact, and model robustness across all bootstrap iterations.',
          technical: 'The summary dashboard aggregates total hectares, benefited residents, mean surface cooling with confidence bounds, and consensus selection stability across {{model.ensemble_members}} bootstrap runs.',
          chip: 'Modelled',
          chipLabel: 'Portfolio Metrics',
        },
      },
      {
        id: 'ch2_s8_drawer',
        targetSelector: '[data-tour="heat-zone-drawer"]',
        placement: 'left',
        actionId: 'select_top_zone',
        copy: {
          title: 'Evidence Dossier for Selected Zone',
          simple: 'Select any cell to inspect satellite overpass dates, baseline surface temperatures, vegetation index, and selection robustness.',
          technical: 'The evidence panel displays full provenance for the active cell, detailing sensor dates, confidence distributions, unbuilt area feasibility, and bootstrap selection frequency.',
          chip: 'Measured',
          chipLabel: 'Cell Dossier',
        },
      },
      {
        id: 'ch2_s9_compare',
        targetSelector: '[data-tour="heat-compare-scenario"]',
        placement: 'right',
        copy: {
          title: 'Side-by-Side Budget Scenarios',
          simple: 'Enable Scenario B to test how varying municipal budgets or targets alters cooling coverage and priority locations.',
          technical: 'Comparative mode evaluates two independent parameter configurations simultaneously, highlighting trade-offs in population coverage and marginal cooling per additional hectare.',
          chip: 'Modelled',
          chipLabel: 'Scenario Comparison',
        },
      },
      {
        id: 'ch2_s10_dossier',
        targetSelector: '[data-tour="heat-dossier-button"]',
        placement: 'top',
        copy: {
          title: 'Auditable PDF Dossier Export',
          simple: 'Export an official evidence brief with complete calculations, sensor timestamps, and municipal parameters ready for review.',
          technical: 'Client-side generation compiles a signed PDF dossier containing geographic coordinates, model confidence intervals, and provenance tags for municipal procurement records.',
          chip: 'Assumed',
          chipLabel: 'Audit Export',
        },
      },
      {
        id: 'ch2_s11_limits',
        targetSelector: '[data-tour="heat-limits"]',
        placement: 'top',
        isLimits: true,
        copy: {
          title: 'Heat Planner Model Limits',
          simple: 'Cooling predictions apply solely to surface vegetation. Soil suitability, underground utilities, and water availability require field inspection.',
          technical: 'The cooling engine predicts daytime surface temperature reduction. It assumes sapling survival and does not account for subterranean utilities or seasonal water scarcity.',
          chip: 'Assumed',
          chipLabel: 'Model Limitations',
        },
      },
    ],
  },

  // CHAPTER 3: Green Loss Watch
  {
    id: 'ch3_green_loss',
    number: 3,
    title: 'Green Loss Watch',
    subtitle: 'Tracking multi-year vegetation index depletion across Pune wards',
    route: '/green-loss',
    steps: [
      {
        id: 'ch3_s1_header',
        targetSelector: '[data-tour="greenloss-header"]',
        placement: 'bottom',
        copy: {
          title: 'Same-Season Satellite Comparison',
          simple: 'We compare pre-monsoon satellite observations across years to isolate true vegetation loss from natural seasonal cycles.',
          technical: 'Multi-temporal Sentinel and Landsat overpasses are normalized across identical pre-monsoon baseline windows, eliminating false positives associated with annual phenological leaf shedding.',
          chip: 'Measured',
          chipLabel: 'Seasonal Baseline',
        },
      },
      {
        id: 'ch3_s2_metrics',
        targetSelector: '[data-tour="greenloss-metrics"]',
        placement: 'bottom',
        copy: {
          title: 'Verified Depletion Metrics',
          simple: 'Track net hectares of verified vegetation loss and the associated increase in daytime surface temperature.',
          technical: 'Aggregate statistics report cumulative hectares experiencing statistically significant vegetation index decline, alongside estimated thermal penalties relative to historical baselines.',
          chip: 'Measured',
          chipLabel: 'Loss Metrics',
        },
      },
      {
        id: 'ch3_s3_map',
        targetSelector: '[data-tour="greenloss-map"]',
        placement: 'left',
        copy: {
          title: 'Spatial Loss Identification',
          simple: 'Red highlights indicate areas where vegetation index dropped significantly between satellite observation windows.',
          technical: 'The raster layer displays classified difference anomalies, highlighting contiguous parcels where spectral reflectance indicates severe loss of vegetative cover.',
          chip: 'Measured',
          chipLabel: 'Loss Layer',
        },
      },
      {
        id: 'ch3_s4_table',
        targetSelector: '[data-tour="greenloss-ward-table"]',
        placement: 'top',
        copy: {
          title: 'Ward-by-Ward Loss Breakdown',
          simple: 'Review which wards suffered the highest vegetation loss to prioritize municipal restoration budgets effectively.',
          technical: 'Administrative tabular breakdown summarizes lost hectares, percentage decline, and mean temperature shift per ward, ranking locations by restoration urgency.',
          chip: 'Measured',
          chipLabel: 'Ward Breakdown',
        },
      },
      {
        id: 'ch3_s5_limits',
        targetSelector: '[data-tour="greenloss-limits"]',
        placement: 'top',
        isLimits: true,
        copy: {
          title: 'Vegetation Index Limitations',
          simple: 'Vegetation index measures photosynthetic greenness. It does not measure tree height, trunk diameter, or crown volume.',
          technical: 'Spectral vegetation indices reflect chlorophyll absorption rather than physical biomass structure. Grassland greening may exhibit high index values without providing tree shade.',
          chip: 'Assumed',
          chipLabel: 'Sensor Limits',
        },
      },
    ],
  },

  // CHAPTER 4: Intervention Scenarios
  {
    id: 'ch4_interventions',
    number: 4,
    title: 'Intervention Scenarios',
    subtitle: 'Evaluating greening, cool roofs, and shade structures with honest evidence',
    route: '/interventions',
    steps: [
      {
        id: 'ch4_s1_matrix',
        targetSelector: '[data-tour="interventions-comparison"]',
        placement: 'bottom',
        copy: {
          title: 'Cooling Options Comparison',
          simple: 'Compare urban greening, reflective cool roofs, and engineered solar shading across costs, feasibility, and cooling benefits.',
          technical: 'A multi-criteria evaluation framework contrasts vegetative interventions against reflective high-albedo coatings and shade structures across capital outlay and physical constraints.',
          chip: 'Assumed',
          chipLabel: 'Comparative Matrix',
        },
      },
      {
        id: 'ch4_s2_chips',
        targetSelector: '[data-tour="interventions-cooling-chips"]',
        placement: 'bottom',
        copy: {
          title: 'Modelled vs Not Modelled Cooling',
          simple: 'Only vegetation cooling has an empirical machine learning model. Cool roofs and shade display Not Modelled with qualitative guidance.',
          technical: 'To prevent fabricated science, numeric temperature drops are restricted strictly to vegetative interventions. Cool roofs and shade structures show Not Modelled alongside qualitative literature benchmarks.',
          chip: 'Modelled',
          chipLabel: 'Evidence Gate',
        },
      },
      {
        id: 'ch4_s3_inputs',
        targetSelector: '[data-tour="interventions-cost-inputs"]',
        placement: 'right',
        copy: {
          title: 'Adjustable Cost Parameters',
          simple: 'Modify estimated capital and maintenance costs per square meter to reflect current municipal contractor tenders.',
          technical: 'User-configurable financial inputs allow planners to adjust baseline capital expenditures and ongoing maintenance assumptions without altering underlying biophysical models.',
          chip: 'Input',
          chipLabel: 'Cost Parameters',
        },
      },
      {
        id: 'ch4_s4_rec',
        targetSelector: '[data-tour="interventions-recommendation"]',
        placement: 'top',
        copy: {
          title: 'Balanced Intervention Strategy',
          simple: 'Review synthesized recommendations matching appropriate cooling solutions to specific neighborhood physical typologies.',
          technical: 'The decision logic recommends tailored combinations, prioritizing unbuilt ground greening where open space exists and reflective coatings in dense built environments.',
          chip: 'Assumed',
          chipLabel: 'Strategy Card',
        },
      },
      {
        id: 'ch4_s5_limits',
        targetSelector: '[data-tour="interventions-limits"]',
        placement: 'top',
        isLimits: true,
        copy: {
          title: 'Intervention Scope Boundaries',
          simple: 'Non-vegetation cooling effects cannot be predicted numerically without calibrated local urban boundary layer sensors.',
          technical: 'Reflective and shading alternatives lack localized empirical validation in Pune. Quantitative cooling estimates for non-vegetative strategies remain deliberately unmodelled.',
          chip: 'Assumed',
          chipLabel: 'Intervention Bounds',
        },
      },
    ],
  },

  // CHAPTER 5: Green Cover Plan
  {
    id: 'ch5_green_cover',
    number: 5,
    title: 'Green Cover Plan',
    subtitle: 'Screening roadside corridors and public park expansion sites',
    route: '/green-cover',
    steps: [
      {
        id: 'ch5_s1_header',
        targetSelector: '[data-tour="greencover-header"]',
        placement: 'bottom',
        copy: {
          title: 'Corridor and Park Identification',
          simple: 'Explore public land opportunities and transit corridors suitable for urban greening and microclimate buffering.',
          technical: 'The catalog aggregates municipal park extensions, boulevard corridors, and vacant unbuilt public easements ranked by thermal exposure indices.',
          chip: 'Measured',
          chipLabel: 'Corridor Planning',
        },
      },
      {
        id: 'ch5_s2_list',
        targetSelector: '[data-tour="greencover-list"]',
        placement: 'left',
        copy: {
          title: 'Prioritized Planting Opportunities',
          simple: 'Review candidate sites sorted by surface heat exposure, surrounding population density, and available land area.',
          technical: 'Individual candidate parcels are scored based on thermal anomaly intensity and unbuilt ground area, supporting targeted municipal greening tenders.',
          chip: 'Modelled',
          chipLabel: 'Candidate List',
        },
      },
      {
        id: 'ch5_s3_filters',
        targetSelector: '[data-tour="greencover-filters"]',
        placement: 'right',
        copy: {
          title: 'Administrative Filtering',
          simple: 'Filter opportunities by ward or intervention type to assemble actionable departmental work orders.',
          technical: 'Dynamic faceted filters narrow candidate sites by administrative jurisdiction and corridor typology, facilitating phased municipal implementation schedules.',
          chip: 'Input',
          chipLabel: 'Filter Controls',
        },
      },
      {
        id: 'ch5_s4_limits',
        targetSelector: '[data-tour="greencover-limits"]',
        placement: 'top',
        isLimits: true,
        copy: {
          title: 'Land Ownership and Utilities',
          simple: 'Candidate parcels require cadastral title confirmation and utility clearance prior to ground excavation.',
          technical: 'Spatial screening identifies unbuilt land from satellite imagery but does not confirm municipal land ownership, right-of-way permissions, or buried utility alignments.',
          chip: 'Assumed',
          chipLabel: 'Feasibility Notice',
        },
      },
    ],
  },

  // CHAPTER 6: Infrastructure Upgrades
  {
    id: 'ch6_infrastructure',
    number: 6,
    title: 'Infrastructure Upgrades',
    subtitle: 'Protecting hospitals, transit terminals, and public schools from heat stress',
    route: '/infrastructure',
    steps: [
      {
        id: 'ch6_s1_header',
        targetSelector: '[data-tour="infra-header"]',
        placement: 'bottom',
        copy: {
          title: 'Critical Facility Heat Resilience',
          simple: 'Assess extreme heat exposure surrounding critical public infrastructure, including healthcare facilities and bus depots.',
          technical: 'This tool maps public infrastructure assets against localized thermal hotspots, prioritizing climate adaptation retrofits where community exposure is most acute.',
          chip: 'Measured',
          chipLabel: 'Asset Resilience',
        },
      },
      {
        id: 'ch6_s2_hospitals',
        targetSelector: '[data-tour="infra-hospitals"]',
        placement: 'left',
        copy: {
          title: 'Healthcare Heat Exposure',
          simple: 'Identify hospitals located in high surface temperature zones requiring shaded ambulance bays and emergency cooling.',
          technical: 'Hospitals are evaluated based on surrounding thermal anomalies to guide priority installation of exterior shading, reflective coatings, and emergency backup cooling.',
          chip: 'Modelled',
          chipLabel: 'Hospital Risk',
        },
      },
      {
        id: 'ch6_s3_transit',
        targetSelector: '[data-tour="infra-transit"]',
        placement: 'right',
        copy: {
          title: 'Transit Shelter Shading',
          simple: 'Evaluate bus stops and transit stations where daily commuters experience intense solar radiation during peak hours.',
          technical: 'Transit hubs with high footfall and minimal vegetative shade are flagged for solar shade structure installation and high-albedo pavement retrofits.',
          chip: 'Modelled',
          chipLabel: 'Transit Shelters',
        },
      },
      {
        id: 'ch6_s4_limits',
        targetSelector: '[data-tour="infra-limits"]',
        placement: 'top',
        isLimits: true,
        copy: {
          title: 'Internal Building Performance',
          simple: 'We assess outdoor surface temperatures surrounding facilities, not indoor air conditioning or clinical HVAC operations.',
          technical: 'Thermal metrics describe exterior microclimate exposure. Indoor cooling loads depend on architectural thermal mass, window-to-wall ratios, and mechanical plant efficiency.',
          chip: 'Assumed',
          chipLabel: 'Facility Boundaries',
        },
      },
    ],
  },

  // CHAPTER 7: Solar & Shadow Simulator
  {
    id: 'ch7_solar',
    number: 7,
    title: 'Solar & Shadow Simulator',
    subtitle: 'Geometric shadow modeling and empirical solar temperature penalty analysis',
    route: '/solar',
    steps: [
      {
        id: 'ch7_s1_simulator',
        targetSelector: '[data-tour="solar-simulator"]',
        placement: 'bottom',
        copy: {
          title: 'Geometric Shadow Projection',
          simple: 'Simulate building shadow angles across seasons using astronomical solar positioning formulas.',
          technical: 'Astronomical algorithms compute precise solar azimuth and altitude angles to project rooftop shadow polygons across hourly and seasonal variations.',
          chip: 'Measured',
          chipLabel: 'Solar Geometry',
        },
      },
      {
        id: 'ch7_s2_penalty_tab',
        targetSelector: '[data-tour="solar-penalty-tab"]',
        placement: 'top',
        actionId: 'switch_to_solar_penalty_tab',
        copy: {
          title: 'Solar Heat Penalty Model',
          simple: 'Extreme surface heat reduces solar panel efficiency. This tool quantifies thermal output losses using real operating data.',
          technical: 'High ambient and surface temperatures impair photovoltaic semiconductor performance. Our empirical model quantifies output derating under extreme urban heat.',
          chip: 'Measured',
          chipLabel: 'Thermal Penalty',
        },
      },
      {
        id: 'ch7_s3_gamma',
        targetSelector: '[data-tour="solar-gamma"]',
        placement: 'bottom',
        copy: {
          title: 'Empirical Penalty Coefficient Gamma',
          simple: 'Real utility SCADA data shows output decreases by {{solar.gamma}} per degree of temperature excess above baseline.',
          technical: 'Regression on utility-scale operational plant data yields an empirical derating coefficient of {{solar.gamma}}, accounting for real-world inverter clipping and wiring resistance.',
          chip: 'Measured',
          chipLabel: 'SCADA Derived',
        },
      },
      {
        id: 'ch7_s4_alpha',
        targetSelector: '[data-tour="solar-alpha-slider"]',
        placement: 'right',
        copy: {
          title: 'Microclimate Coupling Factor Alpha',
          simple: 'The assumed alpha parameter scales radiometric surface temperature excess to rooftop panel operating temperatures.',
          technical: 'Alpha serves as an assumed microclimatic coupling coefficient, scaling surface temperature excess down to rooftop boundary layer operating conditions.',
          chip: 'Assumed',
          chipLabel: 'Coupling Factor',
        },
      },
      {
        id: 'ch7_s5_curve',
        targetSelector: '[data-tour="solar-derate-curve"]',
        placement: 'left',
        copy: {
          title: 'Operational vs Datasheet Loss',
          simple: 'Compare empirical losses against manufacturer specifications to evaluate the true economic penalty of urban heat.',
          technical: 'The response curve contrasts empirical SCADA operational losses against standard factory datasheet coefficients of {{solar.gamma_datasheet}}, revealing balance-of-system thermal bottlenecks.',
          chip: 'Modelled',
          chipLabel: 'Loss Comparison',
        },
      },
      {
        id: 'ch7_s6_limits',
        targetSelector: '[data-tour="solar-limits"]',
        placement: 'top',
        isLimits: true,
        copy: {
          title: 'Relative Loss vs Absolute Energy',
          simple: 'This model calculates percentage efficiency derating. It does not predict absolute energy generation without panel specifications.',
          technical: 'Predictions describe percentage derating relative to baseline. Absolute energy generation requires detailed panel tilt, string inverter sizing, and atmospheric optical depth measurements.',
          chip: 'Assumed',
          chipLabel: 'Solar Scope Limits',
        },
      },
    ],
  },

  // CHAPTER 8: Municipal Climate Plans
  {
    id: 'ch8_plans',
    number: 8,
    title: 'Municipal Climate Plans',
    subtitle: 'Managing saved cooling portfolios, snapshots, and departmental hand-offs',
    route: '/plans',
    steps: [
      {
        id: 'ch8_s1_list',
        targetSelector: '[data-tour="plans-list"]',
        placement: 'bottom',
        copy: {
          title: 'Portfolio Plan Management',
          simple: 'Access your saved cooling plans, inspect allocated greening hectares, and review benefiting resident counts.',
          technical: 'The plans directory organizes municipal intervention portfolios, displaying stored budget constraints, ward allocations, and creation timestamps.',
          chip: 'Assumed',
          chipLabel: 'Plan Management',
        },
      },
      {
        id: 'ch8_s2_version',
        targetSelector: '[data-tour="plans-save-version"]',
        placement: 'left',
        copy: {
          title: 'Immutable Version Snapshots',
          simple: 'Freeze plan milestones as version snapshots to preserve calculation parameters across municipal review cycles.',
          technical: 'Version snapshots create immutable audit records capturing exact budget parameters, selected cell coordinates, and model metrics at time of saving.',
          chip: 'Assumed',
          chipLabel: 'Version Snapshot',
        },
      },
      {
        id: 'ch8_s3_forward',
        targetSelector: '[data-tour="plans-forward"]',
        placement: 'top',
        copy: {
          title: 'Departmental Hand-Off Briefings',
          simple: 'Forward plan packages to garden, engineering, or health departments accompanied by administrative handover notes.',
          technical: 'The forwarding dialog records internal departmental routing, attaching technical parameters and reviewer commentary for inter-agency coordination.',
          chip: 'Assumed',
          chipLabel: 'Departmental Routing',
        },
      },
      {
        id: 'ch8_s4_limits',
        targetSelector: '[data-tour="plans-limits"]',
        placement: 'top',
        isLimits: true,
        copy: {
          title: 'Administrative Status Disclaimer',
          simple: 'Saving or forwarding plans records internal municipal drafts. It does not constitute statutory financial expenditure approval.',
          technical: 'The workflow functions as a technical documentation system. Formal budget authorization requires statutory approval from the Pune Municipal Corporation general body.',
          chip: 'Assumed',
          chipLabel: 'Administrative Status',
        },
      },
    ],
  },

  // CHAPTER 9: Method and Validation Gate
  {
    id: 'ch9_method',
    number: 9,
    title: 'Method and Validation Gate',
    subtitle: 'Inspecting spatial cross-validation, direction gates, and satellite provenance',
    route: '/method',
    steps: [
      {
        id: 'ch9_s1_model_card',
        targetSelector: '[data-tour="method-model-card"]',
        placement: 'bottom',
        copy: {
          title: 'Model Card and Architecture',
          simple: 'Review our model architecture trained across {{model.ensemble_members}} bootstrap ensemble members to quantify parameter uncertainty.',
          technical: 'The model card documents gradient boosted tree ensembles evaluated on independent spatial partitions to prevent overfitting and ensure reproducible estimates.',
          chip: 'Modelled',
          chipLabel: 'Model Architecture',
        },
      },
      {
        id: 'ch9_s2_cv',
        targetSelector: '[data-tour="method-cross-validation"]',
        placement: 'top',
        copy: {
          title: 'Spatial-Block Cross-Validation',
          simple: 'We validate accuracy across {{model.spatial_blocks}} geographic blocks, achieving an error of {{model.cv_rmse_c}}.',
          technical: 'Spatial block validation clusters cells into contiguous {{model.block_size_km}} km spatial blocks, preventing spatial autocorrelation leakage between training and evaluation folds.',
          chip: 'Modelled',
          chipLabel: 'Spatial Validation',
        },
      },
      {
        id: 'ch9_s3_gate',
        targetSelector: '[data-tour="method-direction-gate"]',
        placement: 'top',
        copy: {
          title: 'Unconstrained Diagnostic Direction Gate',
          simple: 'Our model demonstrates that increasing vegetation reduces surface temperature without enforcing synthetic monotone constraints.',
          technical: 'The validation gate confirms negative temperature response rates under unconstrained training, proving the physical integrity of learned biophysical relationships.',
          chip: 'Measured',
          chipLabel: 'Validation Gate',
        },
      },
      {
        id: 'ch9_s4_sources',
        targetSelector: '[data-tour="method-sources"]',
        placement: 'top',
        copy: {
          title: 'Verified Satellite Data Sources',
          simple: 'All observations link directly to public Landsat and Sentinel overpasses with verified acquisition dates.',
          technical: 'The pipeline reconciles USGS Landsat thermal infrared and ESA Sentinel optical reflectance overpasses, maintaining full sensor metadata transparency.',
          chip: 'Measured',
          chipLabel: 'Satellite Sources',
        },
      },
      {
        id: 'ch9_s5_limits',
        targetSelector: '[data-tour="method-limits"]',
        placement: 'top',
        isLimits: true,
        copy: {
          title: 'What the Science Did Not Model',
          simple: 'The model predicts surface temperature response. It does not model convective wind patterns, humidity shifts, or monsoon precipitation.',
          technical: 'The empirical model estimates daytime surface temperature response. It explicitly excludes computational fluid dynamics, urban boundary layer turbulence, and microclimatic humidity feedback loops.',
          chip: 'Assumed',
          chipLabel: 'Scientific Limitations',
        },
      },
    ],
  },
];

export function getChapter(id: string): TourChapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

export function getAvailableChapters(): TourChapter[] {
  return CHAPTERS.filter((c) => !c.featureFlag);
}
