function researchCompetitionFallback(
  idea,
  scenario = "GOOD_DATA",
) {
  console.log(
    `Running fallback competition research for: ${idea} | Scenario: ${scenario}`,
  );

  if (scenario === "GOOD_DATA") {
    return {
      score: 5,
      confidence: "MEDIUM",

      evidence: [
        {
          type: "FALLBACK_COMPETITOR_SIGNAL",
          source: "MOCK_COMPETITION_FALLBACK",
          value: "Limited but usable competition signal",

          quality: {
            sourceQuality: 70,
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

  throw new Error(
    `Unknown competition fallback scenario: ${scenario}`,
  );
}

export default researchCompetitionFallback;