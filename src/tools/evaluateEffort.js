function evaluateEffort() {
  console.log("Evaluating effort...");

  return {
    score: 8,
    confidence: "MEDIUM",

    evidence: [
      {
        type: "RECURRING_EFFORT",
        source: "MOCK_USER_ESTIMATE",
        value: "15 minutes per order",

        quality: {
          sourceQuality: 70,
          relevance: 95,
          freshness: 90,
          completeness: 80,
        },
      },

      {
        type: "HUMAN_DEPENDENCY",
        source: "MOCK_USER_INPUT",
        value: "Can be partially outsourced",

        quality: {
          sourceQuality: 75,
          relevance: 90,
          freshness: 90,
          completeness: 80,
        },
      },
    ],
  };
}

export default evaluateEffort;