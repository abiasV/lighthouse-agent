function researchDemand(idea, scenario = "GOOD_DATA") {
  console.log(`Researching demand for: ${idea} | Scenario: ${scenario}`);

  if (scenario === "GOOD_DATA") {
    return {
      score: 8,
      confidence: "HIGH",
      evidence: [
        {
          type: "TREND_SIGNAL",
          source: "MOCK_TREND_TOOL",
          value: "Growing demand",
          quality: {
            sourceQuality: 90,
            relevance: 95,
            freshness: 90,
            completeness: 85,
          },
        },
      ],
    };
  }

  if (scenario === "LOW_DEMAND") {
    return {
      score: 3,
      confidence: "HIGH",

      evidence: [
        {
          type: "TREND_SIGNAL",
          source: "MOCK_TREND_TOOL",
          value: "Weak demand",

          quality: {
            sourceQuality: 90,
            relevance: 95,
            freshness: 90,
            completeness: 90,
          },
        },
      ],
    };
  }

  if (scenario === "LOW_RELEVANCE") {
    return {
      score: 8,
      confidence: "HIGH",
      evidence: [
        {
          type: "TREND_SIGNAL",
          source: "MOCK_TREND_TOOL",
          value: "Growing wedding invitation demand",
          quality: {
            sourceQuality: 90,
            relevance: 25,
            freshness: 90,
            completeness: 85,
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

  if (scenario === "PARTIAL_DATA") {
    return {
      score: 6,
      confidence: "MEDIUM",
      evidence: [
        {
          type: "TREND_SIGNAL",
          source: "MOCK_TREND_TOOL",
          value: "Limited trend signal",
          quality: {
            sourceQuality: 80,
            relevance: 85,
            freshness: 70,
            completeness: 35,
          },
        },
      ],
    };
  }

  if (scenario === "RATE_LIMIT") {
    const error = new Error("Rate limit reached");
    error.status = 429;
    throw error;
  }

  if (scenario === "TEMPORARY_ERROR") {
    const error = new Error("Temporary server error");
    error.status = 503;
    throw error;
  }

  if (scenario === "INVALID_INPUT") {
    const error = new Error("Invalid input");
    error.status = 400;
    throw error;
  }

  throw new Error(`Unknown demand scenario: ${scenario}`);
}

export default researchDemand;
