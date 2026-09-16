import calculateScalabilityScore from "../utils/calculateScalabilityScore.js";

function buildScalabilityCriterion({
  ordersPerHourWithoutExtraHelp,
  manualBottleneckLevel,
}) {
  const score = calculateScalabilityScore({
    ordersPerHourWithoutExtraHelp,
    manualBottleneckLevel,
  });

  return {
    score,
    confidence: "HIGH",
    status: "COMPLETE",

    evidence: [
      {
        type: "SCALABILITY_INPUTS",
        source: "USER_INPUT_AND_CALCULATION",

        value: {
          ordersPerHourWithoutExtraHelp,
          manualBottleneckLevel,
        },

        quality: {
          sourceQuality: 90,
          relevance: 100,
          freshness: 100,
          completeness: 100,
        },
      },
    ],

    scalabilityInputs: {
      ordersPerHourWithoutExtraHelp,
      manualBottleneckLevel,
    },
  };
}

export default buildScalabilityCriterion;