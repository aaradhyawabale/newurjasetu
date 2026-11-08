/**
 * UrjaSetu Climate Copilot - Heat Planner Deterministic Responder
 *
 * Dedicated natural-language responder for Heat Planner concepts:
 * 1. Greetings & capabilities
 * 2. Heat burden & metrics
 * 3. Robustness & uncertainty (30-member bootstrap ensemble, CV RMSE 0.91°C, [p10, p90])
 * 4. The four chips: Measured, Modelled, Assumed, Input
 * 5. Surface vs air temperature distinction
 * 6. Alpha (α) and Gamma (γ) model parameters
 * 7. Current plan / scenario summary
 * 8. Zone lookup (name, ward, LST mean, NDVI, population, cooling range)
 * 9. Compare budgets (diminishing marginal returns)
 * 10. Run optimization / budget evaluation
 * 11. Data status (real Pune data vs demo data, Green Loss status)
 * 12. Out-of-scope refusals (carbon, kWh, ambient air temperature, fake scores, general chatter)
 * 13. Unknown intent with 3 suggested questions
 *
 * No emojis, no boilerplate markdown headings, conversational plain English.
 *
 * @license Apache-2.0
 */

import {
  executeRunOptimizationTool,
  executeGetZoneTool,
  CopilotChatContext,
  CopilotChatMessage,
  CopilotResponseResult,
} from "./advisor";
import { getPriorityCellById, getCellEnsembleStats } from "../priority/loader";

export function generateHeatPlannerResponse(
  message: string,
  context?: CopilotChatContext,
  history?: CopilotChatMessage[]
): CopilotResponseResult {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // Helper for consistent result structure
  const makeResult = (
    reply: string,
    suggestedQuestions: string[] = [
      "What is heat burden and how is it calculated?",
      "How does a 40 ha greening budget perform?",
      "Explain the difference between surface temperature and air temperature.",
    ],
    toolCalls: Array<{ tool: string; args: any; result: any }> = [],
    referencedMetrics: Record<string, any> = {}
  ): CopilotResponseResult => ({
    reply,
    modelUsed: "urjasetu-heat-planner-responder",
    engineSource: "local_gis_engine",
    statutoryStatus: "VERIFIED_GEOMETRIC",
    assumptions: [
      "Counterfactual cooling modelled via 30-member spatial-block bootstrap LightGBM ensemble.",
      "LST is radiometric skin surface temperature from Landsat 9 Band 10.",
    ],
    missingEvidence: [
      "In-situ aspirated ambient micrometeorological sensor logging.",
    ],
    suggestedQuestions,
    referencedInterventions: [],
    referencedWards: ["Pune Urban Study Area (PMC)"],
    referencedMetrics,
    toolCalls,
    proposedAdjustment: null,
  });

  // -------------------------------------------------------------
  // 12. Out-of-scope Refusals & Fabrications
  // -------------------------------------------------------------
  const isCarbonOrKwh =
    lower.includes("carbon") ||
    lower.includes("co2") ||
    lower.includes("kwh") ||
    lower.includes("electricity saving") ||
    lower.includes("energy saving");

  const isFakeScoreOrGuess =
    lower.includes("arbitrary score") ||
    lower.includes("fake score") ||
    lower.includes("invent a score") ||
    lower.includes("invent score") ||
    lower.includes("make up a score") ||
    lower.includes("guess score") ||
    lower.includes("weighted composite score") ||
    lower.includes("weighted score");

  const isAirTempMeasurementQuery =
    (lower.includes("air temp") || lower.includes("ambient temp") || lower.includes("air temperature")) &&
    (lower.includes("what is the air temperature") ||
     lower.includes("exact air temperature") ||
     lower.includes("measure air temperature") ||
     lower.includes("guess the temperature") ||
     lower.includes("can you guess") ||
     lower.includes("satellite measure air"));

  const isGeneralOutOfScope =
    lower.includes("chocolate cake") ||
    lower.includes("recipe") ||
    lower.includes("cricket");

  if (isCarbonOrKwh) {
    return makeResult(
      "UrjaSetu does not simulate carbon credits, CO2 offsets, or building electricity (kWh) savings. The physical model is strictly calibrated to Land Surface Temperature (LST) and empirical counterfactual cooling across Pune's 250m grid. Energy savings depend on building HVAC engineering and building envelope details not captured in satellite thermal data, so those figures remain Not available.",
      [
        "What cooling effect is modelled for greening?",
        "What is heat burden and how is it calculated?",
        "How are priority zones ranked?",
      ]
    );
  }

  if (isFakeScoreOrGuess) {
    return makeResult(
      "UrjaSetu does not use arbitrary weighted composite scores or subjective weight matrices. All prioritization is grounded in physical cooling benefits (predicted surface temperature reduction in °C via a 30-member spatial-block bootstrap ensemble) per greenable hectare. Where empirical data is absent, values strictly remain null and display as 'Not available'.",
      [
        "How are priority zones ranked?",
        "What is the model CV RMSE for Pune?",
        "What is heat burden and how is it calculated?",
      ]
    );
  }

  if (isAirTempMeasurementQuery) {
    return makeResult(
      "Satellites do not measure air temperature: spaceborne sensors like Landsat 9 TIRS-2 measure surface temperature (radiometric skin temperature of ground, roofs, and vegetation), not ambient 2m air temperature. Atmospheric air temperature cannot be inferred directly from spaceborne radiometric sensors, requiring ground weather stations. UrjaSetu displays only measured surface temperature, never air temperature.",
      [
        "What is the difference between surface temperature and air temperature?",
        "What satellite instruments provide the temperature data?",
        "How does vegetation cooling affect surface temperature?",
      ]
    );
  }

  const isCertificationQuery =
    lower.includes("certif") ||
    lower.includes("officially approved") ||
    lower.includes("approved by") ||
    lower.includes("building commissioner");

  if (isCertificationQuery) {
    return makeResult(
      "UrjaSetu is an indicative decision support platform and does not provide statutory certification or official administrative sanctions. All analyses are decision support estimates and are not statutory approvals. Official sanction requires formal application to the Pune Municipal Corporation (PMC) town planning authority.",
      [
        "What are the statutory guidelines under UDCPR 2020 for setbacks?",
        "How are priority zones ranked?",
        "What is the model CV RMSE for Pune?",
      ]
    );
  }

  if (isGeneralOutOfScope) {
    return makeResult(
      "I am UrjaSetu's Climate Copilot, focused on urban heat resilience, surface temperatures, and cooling interventions across Pune. I cannot answer general topics like cooking recipes, sports results, or theoretical physics. Please ask me about greening budgets, heat burden, or zone lookups.",
      [
        "What is heat burden and how is it calculated?",
        "How does a 40 ha greening budget perform?",
        "Explain the difference between surface temperature and air temperature.",
      ]
    );
  }

  // -------------------------------------------------------------
  // 1. Greetings & Capabilities
  // -------------------------------------------------------------
  const isGreeting =
    /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|yo)\b/i.test(lower) ||
    lower === "help" ||
    lower.includes("who are you") ||
    lower.includes("what can you do") ||
    lower.includes("how can you help");

  if (isGreeting && lower.length < 50) {
    return makeResult(
      "Hello! I am your Climate Copilot for UrjaSetu. I can help you explore Pune's surface temperatures, analyze heat burden, evaluate cooling intervention budgets, inspect individual 250m priority zones, and explain the machine learning model metrics.",
      [
        "What is heat burden and how is it calculated?",
        "How does a 40 ha greening budget perform?",
        "Explain the difference between surface temperature and air temperature.",
      ]
    );
  }

  // -------------------------------------------------------------
  // 2. Heat Burden & Metrics
  // -------------------------------------------------------------
  const isHeatBurdenQuery =
    lower.includes("heat burden") ||
    lower.includes("burden formula") ||
    lower.includes("how is burden calculated") ||
    lower.includes("what is burden");

  if (isHeatBurdenQuery) {
    return makeResult(
      "Heat burden in UrjaSetu measures thermal exposure across a neighborhood. It is defined as resident population multiplied by the surface temperature excess above the rural baseline: Heat Burden = Population × (Surface Temperature - Baseline). In this calculation, surface temperature is Measured by Landsat 9 TIRS-2 satellite thermal imagery, while population is Assumed from downscaled WorldPop demographic projections. This prioritizes cooling interventions where elevated temperatures coincide with dense residential populations.",
      [
        "Why is population labelled as Assumed?",
        "What is the baseline surface temperature?",
        "How are priority zones ranked?",
      ]
    );
  }

  // -------------------------------------------------------------
  // 3. Robustness & Uncertainty (Ensemble, CV RMSE, P10/P90)
  // -------------------------------------------------------------
  const isRobustnessQuery =
    lower.includes("robustness") ||
    lower.includes("uncertainty") ||
    lower.includes("cv rmse") ||
    lower.includes("rmse") ||
    lower.includes("confidence interval") ||
    lower.includes("p10") ||
    lower.includes("p90") ||
    lower.includes("bootstrap") ||
    lower.includes("ensemble");

  if (isRobustnessQuery) {
    return makeResult(
      "UrjaSetu evaluates cooling predictions using a 30-member spatial-block bootstrap LightGBM ensemble. The model achieves a Spatial Cross-Validation RMSE of 0.91°C (held-out scene RMSE of 0.96°C) and an R² of 0.70. For every candidate cell, the ensemble outputs an expected mean cooling benefit along with an 80% confidence interval [p10, p90] representing model variance. Robustness reflects the percentage of bootstrap ensemble runs in which a cell is selected under the target budget.",
      [
        "What is the model CV RMSE for Pune?",
        "What do the p10 and p90 confidence bounds mean?",
        "How are priority zones ranked?",
      ]
    );
  }

  // -------------------------------------------------------------
  // 4. The Four Chips (Measured, Modelled, Assumed, Input)
  // -------------------------------------------------------------
  const isChipsQuery =
    lower.includes("chip") ||
    lower.includes("four chips") ||
    lower.includes("provenance") ||
    lower.includes("data used chip") ||
    (lower.includes("measured") && lower.includes("modelled") && lower.includes("assumed"));

  if (isChipsQuery) {
    return makeResult(
      "UrjaSetu classifies every number into one of four provenance categories:\n" +
      "- Measured: Direct instrument observations, such as surface temperature from Landsat 9 TIRS-2 and vegetation index from Sentinel-2B.\n" +
      "- Modelled: Predictions produced by the machine learning ensemble, such as counterfactual cooling benefits and 80% confidence intervals.\n" +
      "- Assumed: Scenario parameters, coupling constants, or downscaled population figures from external statistical models.\n" +
      "- Input: Values directly controlled by you, such as the target hectare budget and target vegetation index.",
      [
        "Why is population labelled as Assumed?",
        "What is the difference between surface temperature and air temperature?",
        "What is heat burden and how is it calculated?",
      ]
    );
  }

  const isNdviExplanationQuery =
    (lower.includes("ndvi") || lower.includes("vegetation index")) &&
    (lower.includes("what is") ||
     lower.includes("what does") ||
     lower.includes("explain") ||
     lower.includes("represent") ||
     lower.includes("definition") ||
     lower.includes("meaning") ||
     lower.includes("satellite layer") ||
     lower === "ndvi" ||
     lower === "vegetation index");

  if (isNdviExplanationQuery) {
    return makeResult(
      "NDVI (Normalized Difference Vegetation Index) is a spectral reflectance index measuring the difference between near-infrared and red surface reflectance. It is a unitless vegetation index bounded between -1.0 and 1.0, derived from Sentinel-2B optical imagery (surface temperature, not air temperature; vegetation index, not canopy cover). In UrjaSetu, NDVI identifies areas with low vegetation cover where greening interventions can reduce Land Surface Temperature.",
      [
        "What is the difference between surface temperature and air temperature?",
        "What satellite instruments provide the temperature data?",
        "How are priority zones ranked?",
      ]
    );
  }

  // -------------------------------------------------------------
  // 5. Surface Temperature vs Air Temperature
  // -------------------------------------------------------------
  const isSurfaceVsAirQuery =
    (lower.includes("surface") && lower.includes("air")) ||
    lower.includes("surface vs air") ||
    lower.includes("skin temp") ||
    lower.includes("why surface temperature") ||
    lower.includes("air temp vs surface");

  if (isSurfaceVsAirQuery) {
    return makeResult(
      "Surface temperature is not air temperature: Landsat 9 satellites capture radiometric skin surface temperature (the thermal radiation emitted by roofs, pavements, and vegetation), rather than ambient 2m air temperature. Atmospheric air temperature requires shielded ground weather stations, so satellites do not measure air temperature. Surface temperatures drive the conductive and radiative heat felt in dense urban environments.",
      [
        "What satellite instruments measure surface temperature?",
        "How does vegetation cooling affect surface temperature?",
        "What is the model CV RMSE for Pune?",
      ]
    );
  }

  // -------------------------------------------------------------
  // 6. Alpha (α) and Gamma (γ) Parameters
  // -------------------------------------------------------------
  const isAlphaGammaQuery =
    lower.includes("alpha") ||
    lower.includes("gamma") ||
    lower.includes("coupling parameter") ||
    lower.includes("sensitivity coefficient");

  if (isAlphaGammaQuery) {
    return makeResult(
      "In UrjaSetu's model formulations, alpha and gamma represent physical sensitivity and baseline parameters. Alpha (α) is the baseline coupling parameter (with an assumed default of 0.5, bounded between 0.2 and 0.8), representing how strongly local surface conditions couple with adjoining microclimate layers. Gamma (γ) is the empirical sensitivity coefficient: in the solar model, gamma is -0.533% per °C (90% CI: -0.744 to -0.295% per °C), representing the observed rate of photovoltaic efficiency loss associated with elevated operating temperatures.",
      [
        "What is the solar model card summary?",
        "What does the cooling model predict for vegetation?",
        "How does a 40 ha greening budget perform?",
      ]
    );
  }

  // -------------------------------------------------------------
  // 7. Current Plan / Scenario Summary
  // -------------------------------------------------------------
  const isPlanSummaryQuery =
    lower.includes("current plan") ||
    lower.includes("scenario summary") ||
    lower.includes("plan summary") ||
    lower.includes("my plan") ||
    lower.includes("how is my plan") ||
    lower.includes("what are my totals");

  if (isPlanSummaryQuery) {
    const currentPlan = context?.currentPlan;
    if (currentPlan && currentPlan.allocatedHa) {
      const coolingText = currentPlan.meanCooling !== undefined
        ? `with an estimated mean surface cooling of ${currentPlan.meanCooling.toFixed(1)}°C`
        : "";
      const popText = currentPlan.totalPopulation
        ? `shielding an estimated ${currentPlan.totalPopulation.toLocaleString()} residents [Assumed]`
        : "";
      return makeResult(
        `The current plan allocates ${currentPlan.allocatedHa.toFixed(1)} hectares across ${currentPlan.selectedCount || 0} priority zones, ${popText} ${coolingText}. All cooling figures represent modelled surface temperature changes derived from the 30-member spatial-block bootstrap ensemble.`,
        [
          "How does a 40 ha greening budget perform?",
          "How are priority zones ranked?",
          "Can we compare 20 ha versus 40 ha?",
        ],
        [],
        {
          allocated_ha: currentPlan.allocatedHa,
          selected_count: currentPlan.selectedCount,
        }
      );
    }

    return makeResult(
      "No custom plan has been configured yet. In the default baseline scenario, UrjaSetu optimizes a 10-hectare budget across Pune's priority cells, targeting zones with elevated surface temperatures, low vegetation indices, and dense populations.",
      [
        "Run an optimization for a 25 ha budget.",
        "What is heat burden and how is it calculated?",
        "How are priority zones ranked?",
      ]
    );
  }

  // -------------------------------------------------------------
  // 8. Zone Lookup
  // -------------------------------------------------------------
  const zoneIdMatch =
    trimmed.match(/\b(cell_250m_\d{4,5})\b/i) ||
    trimmed.match(/\bzone\s+(\d+)\b/i) ||
    trimmed.match(/\bcell\s+(\d+)\b/i);

  const isZoneQuery =
    Boolean(zoneIdMatch) ||
    lower.includes("this zone") ||
    lower.includes("selected zone") ||
    lower.includes("selected cell");

  if (isZoneQuery) {
    let targetId: string | undefined;
    if (zoneIdMatch) {
      if (zoneIdMatch[1].startsWith("cell_250m_")) {
        targetId = zoneIdMatch[1].toLowerCase();
      } else {
        const num = parseInt(zoneIdMatch[1], 10);
        targetId = `cell_250m_${num.toString().padStart(4, "0")}`;
      }
    } else if (context?.selectedZone?.id) {
      targetId = context.selectedZone.id;
    }

    if (targetId) {
      const zoneData = executeGetZoneTool({ id: targetId });
      if (zoneData.found) {
        const lst = zoneData.lst_mean !== null ? `${zoneData.lst_mean}°C` : "Not available";
        const ndvi = zoneData.ndvi !== null && zoneData.ndvi !== undefined ? zoneData.ndvi.toString() : "Not available";
        const pop = zoneData.population !== null ? zoneData.population.toLocaleString() : "Not available";
        const cooling = zoneData.cooling_mean !== null ? `${zoneData.cooling_mean}°C` : "Not available";
        const ci = zoneData.cooling_p10 !== null && zoneData.cooling_p90 !== null
          ? `[${zoneData.cooling_p10}°C to ${zoneData.cooling_p90}°C]`
          : "Not available";
        const greenable = zoneData.greenable_ha !== null ? `${zoneData.greenable_ha} ha` : "Not available";

        return makeResult(
          `Zone ${zoneData.id} is located in ${zoneData.ward}. Measured Land Surface Temperature is ${lst} and the Measured vegetation index (NDVI) is ${ndvi}. The resident population is ${pop} [Assumed]. Greening the ${greenable} of available unbuilt land is [Modelled] to achieve an estimated mean surface cooling of ${cooling} (80% confidence interval: ${ci}), evaluated against Pune's 30-member spatial-block bootstrap ensemble.`,
          [
            `What is the heat burden in ${zoneData.ward}?`,
            "How does increasing the budget change which zones are selected?",
            "What is the difference between surface temperature and air temperature?",
          ],
          [{ tool: "get_zone", args: { id: targetId }, result: zoneData }],
          {
            zone_id: zoneData.id,
            lst_mean: zoneData.lst_mean,
            cooling_mean: zoneData.cooling_mean,
          }
        );
      }
    }
  }

  // -------------------------------------------------------------
  // 9. Compare Budgets (Checked BEFORE single run optimization)
  // -------------------------------------------------------------
  const isCompareBudgets =
    lower.includes("compare") ||
    lower.includes("difference between") ||
    lower.includes("trade-off") ||
    lower.includes("diminishing");

  if (isCompareBudgets) {
    return makeResult(
      "When expanding the greening budget (for example, from 20 ha to 40 ha), the optimizer incorporates additional priority cells in descending order of cooling benefit per hectare. While total protected population and overall geographic coverage increase with budget size, the marginal cooling relief per added hectare diminishes as lower-ranked parcels are selected. You can test multiple budget values using the budget slider to inspect these trade-offs.",
      [
        "Run an optimization for a 20 ha budget.",
        "Run an optimization for a 40 ha budget.",
        "How are priority zones ranked?",
      ]
    );
  }

  // -------------------------------------------------------------
  // 10. Run Optimization / Budget Evaluation
  // -------------------------------------------------------------
  const budgetMatch =
    trimmed.match(/(?:budget|allocate|spend)?\s*(\d+(?:\.\d+)?)\s*(?:ha|hectare|hectares)\b/i) ||
    trimmed.match(/\b(\d+(?:\.\d+)?)\s*ha\b/i);

  const isOptQuery =
    Boolean(budgetMatch) &&
    (lower.includes("run") ||
     lower.includes("optimize") ||
     lower.includes("plan") ||
     lower.includes("what if") ||
     lower.includes("allocate") ||
     lower.includes("budget"));

  if (isOptQuery && budgetMatch) {
    const budgetHa = parseFloat(budgetMatch[1]);
    const optResult = executeRunOptimizationTool({ budget_ha: budgetHa, target_ndvi: 0.65 });

    const allocated = optResult.allocated_ha.toFixed(1);
    const count = optResult.selected_cells_count;
    const cooling = optResult.cooling_mean !== null ? `${optResult.cooling_mean.toFixed(2)}°C` : "Not available";
    const ci = optResult.cooling_p10 !== null && optResult.cooling_p90 !== null
      ? `[${optResult.cooling_p10.toFixed(2)}°C to ${optResult.cooling_p90.toFixed(2)}°C]`
      : "Not available";
    const pop = optResult.population_benefited.toLocaleString();

    return makeResult(
      `An optimization with a ${budgetHa} ha budget allocates ${allocated} hectares [Modelled] across ${count} priority cells (priority zones). This intervention portfolio is [Modelled] to achieve an estimated mean surface cooling of ${cooling} (80% confidence interval: ${ci}) across target zones, benefiting an estimated ${pop} residents [Assumed]. Priority parcels are ranked by cooling efficiency per greenable hectare using Pune's 30-member ensemble.`,
      [
        "How does this compare to a 20 ha budget?",
        "What are the top three selected priority cells?",
        "What is the model CV RMSE for Pune?",
      ],
      [{ tool: "run_optimization", args: { budget_ha: budgetHa, target_ndvi: 0.65 }, result: optResult }],
      {
        budget_ha: budgetHa,
        allocated_ha: optResult.allocated_ha,
        cooling_mean: optResult.cooling_mean,
        population_benefited: optResult.population_benefited,
      }
    );
  }

  // -------------------------------------------------------------
  // 11. Data Status (Real vs Demo, Green Loss)
  // -------------------------------------------------------------
  const isDataStatusQuery =
    lower.includes("data status") ||
    lower.includes("real vs demo") ||
    lower.includes("demo data") ||
    lower.includes("green loss") ||
    lower.includes("where does the data come from") ||
    lower.includes("data source");

  if (isDataStatusQuery) {
    return makeResult(
      "UrjaSetu uses real satellite observations for Pune: Land Surface Temperature from USGS Landsat 9 TIRS-2 (acquired 2023-04-22) and NDVI from Copernicus Sentinel-2B MSI (acquired 2023-04-24), integrated with official Pune Municipal Corporation ward registries. If any API endpoint is unavailable, the application clearly displays a persistent DEMO DATA banner to prevent unverified claims. Green Loss tracks multi-year vegetative transitions across Pune's wards.",
      [
        "What satellite instruments measure surface temperature?",
        "What is heat burden and how is it calculated?",
        "What is the model CV RMSE for Pune?",
      ]
    );
  }

  // -------------------------------------------------------------
  // 12. Statutory & Planning Context (UDCPR 2020 & Road Access)
  // -------------------------------------------------------------
  const isStatutoryOrSetbackQuery =
    lower.includes("udcpr") ||
    lower.includes("setback") ||
    lower.includes("statutory");

  if (isStatutoryOrSetbackQuery) {
    return makeResult(
      "Under Maharashtra UDCPR 2020, statutory guidelines mandate boundary setbacks and front road margins based on abutting road width and plot depth. For municipal infrastructure and utilities, minimum statutory setbacks ensure structural safety, fire tender turning radii, and road right-of-way (ROW) clearance. UrjaSetu checks footprint geometry against mapped road centerlines under UDCPR 2020 regulations.",
      [
        "How are road setbacks evaluated?",
        "What are the statutory clearances for solar and EV installations?",
        "What is the model CV RMSE for Pune?",
      ]
    );
  }

  const isRoadAccessQuery =
    lower.includes("road network") ||
    lower.includes("road access") ||
    lower.includes("accessibility for this placement");

  if (isRoadAccessQuery) {
    return makeResult(
      "Road network accessibility is evaluated by measuring the perpendicular distance from the site footprint to the nearest mapped OpenStreetMap road centerline. Under Maharashtra UDCPR regulations, direct vehicular road access is required for emergency ingress and operations, while landlocked parcels require a designated access road corridor.",
      [
        "What are the statutory guidelines under UDCPR 2020 for setbacks?",
        "How does greening affect surface temperature?",
        "What is heat burden and how is it calculated?",
      ]
    );
  }

  // -------------------------------------------------------------
  // 13. Unknown Intent Fallback
  // -------------------------------------------------------------
  return makeResult(
    "I am not sure about that specific question, but I can help you analyze urban surface temperatures, evaluate cooling intervention budgets, explain model uncertainty metrics, or look up individual priority zones across Pune.",
    [
      "What is heat burden and how is it calculated?",
      "How does a 40 ha greening budget perform?",
      "Explain the difference between surface temperature and air temperature.",
    ]
  );
}
