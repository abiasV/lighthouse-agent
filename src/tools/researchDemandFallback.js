function researchDemandFallback(idea, scenario = "GOOD_DATA") {
  console.log(
    `Running fallback demand research for: ${idea} | Scenario: ${scenario}`
  );

  if (scenario === "GOOD_DATA") {
    return {
      score: 6,
      confidence: "MEDIUM",
      evidence: [
        {
          type: "MARKETPLACE_FALLBACK_SIGNAL",
          source: "MOCK_FALLBACK_TOOL",
          value: "Moderate marketplace demand signal",

          quality: {
            sourceQuality: 75,
            relevance: 85,
            freshness: 75,
            completeness: 70,
          },
        },
      ],
    };
  }

  if (scenario === "NO_DATA") {
    return {
      score: null,
      confidence: null,
      evidence: [],
    };
  }

  throw new Error(`Unknown fallback scenario: ${scenario}`);
}

export default researchDemandFallback;