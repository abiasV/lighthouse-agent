function evaluateProfitability(fixedCost, scenario = "GOOD_DATA") {
  console.log(`Evaluating profitability with fixed cost: ${fixedCost}`);

  if (scenario === "LOW_PROFITABILITY") {
    return {
      score: 3,
      confidence: "MEDIUM",

      evidence: [
        {
          type: "BREAK_EVEN_ESTIMATE",
          source: "MOCK_CALCULATION",
          value: "Weak profitability",

          quality: {
            sourceQuality: 80,
            relevance: 95,
            freshness: 85,
            completeness: 85,
          },
        },
      ],
    };
  }

  return {
    score: 7,
    confidence: "MEDIUM",

    evidence: [
      {
        type: "FIXED_COST",
        source: "USER",
        value: fixedCost,

        quality: {
          sourceQuality: 75,
          relevance: 100,
          freshness: 90,
          completeness: 80,
        },
      },

      {
        type: "BREAK_EVEN_ESTIMATE",
        source: "MOCK_CALCULATION",
        value: "Reasonable break-even range",

        quality: {
          sourceQuality: 70,
          relevance: 90,
          freshness: 85,
          completeness: 75,
        },
      },
    ],
  };
}

export default evaluateProfitability;