import calculateEffortScore from "../utils/calculateEffortScore.js";

function buildEffortCriterion({ minutesPerOrder, humanDependency }) {
  const score = calculateEffortScore({
    minutesPerOrder,
    humanDependency,
  });

  return {
    score,
    confidence: "HIGH",
    status: "COMPLETE",

    evidence: [
      {
        type: "EFFORT_INPUTS",
        source: "USER_INPUT_AND_CALCULATION",

        value: {
          minutesPerOrder,
          humanDependency,
        },

        quality: {
          sourceQuality: 90,
          relevance: 100,
          freshness: 100,
          completeness: 100,
        },
      },
    ],

    effortInputs: {
      minutesPerOrder,
      humanDependency,
    },
  };
}

export default buildEffortCriterion;