import calculateUnitEconomics from "../utils/calculateUnitEconomics.js";

import calculateProfitabilityScore from "../utils/calculateProfitabilityScore.js";

function buildProfitabilityCriterion({
  fixedCost,
  sellingPrice,
  variableCost,
}) {
  const unitEconomics = calculateUnitEconomics({
    fixedCost,
    sellingPrice,
    variableCost,
  });

  const score = calculateProfitabilityScore(unitEconomics);

  return {
    score,
    confidence: "HIGH",
    status: "COMPLETE",

    evidence: [
      {
        type: "UNIT_ECONOMICS",
        source: "USER_INPUT_AND_CALCULATION",
        value: {
          fixedCost: unitEconomics.fixedCost,

          sellingPrice: unitEconomics.sellingPrice,

          variableCost: unitEconomics.variableCost,

          profitPerSale: unitEconomics.profitPerSale,

          breakEvenSales: unitEconomics.breakEvenSales,

          profitablePerSale: unitEconomics.profitablePerSale,
        },

        quality: {
          sourceQuality: 90,
          relevance: 100,
          freshness: 100,
          completeness: 100,
        },
      },
    ],

    unitEconomics,
  };
}

export default buildProfitabilityCriterion;