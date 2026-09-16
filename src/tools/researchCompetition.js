function researchCompetition(
  idea,
  scenario = "GOOD_DATA",
) {
  console.log(
    `Researching competition for: ${idea} | Scenario: ${scenario}`,
  );

  if (scenario === "GOOD_DATA") {
    return {
      score: 6,
      confidence: "MEDIUM",

      evidence: [
        {
          type: "COMPETITOR_SIGNAL",
          source: "MOCK_MARKETPLACE_TOOL",
          value: "Moderate competition",

          quality: {
            sourceQuality: 85,
            relevance: 95,
            freshness: 90,
            completeness: 85,
          },
        },
      ],
    };
  }

  if (scenario === "LOW_RELEVANCE") {
    return {
      score: 6,
      confidence: "MEDIUM",

      evidence: [
        {
          type: "COMPETITOR_SIGNAL",
          source: "MOCK_MARKETPLACE_TOOL",
          value: "Mostly unrelated invitation products",

          quality: {
            sourceQuality: 85,
            relevance: 25,
            freshness: 90,
            completeness: 85,
          },
        },
      ],
    };
  }

  if (scenario === "PARTIAL_DATA") {
    return {
      score: 6,
      confidence: "MEDIUM",

      evidence: [
        {
          type: "COMPETITOR_SIGNAL",
          source: "MOCK_MARKETPLACE_TOOL",
          value: "Limited competitor sample",

          quality: {
            sourceQuality: 85,
            relevance: 90,
            freshness: 80,
            completeness: 35,
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

  if (scenario === "RATE_LIMIT") {
    const error = new Error("Competition rate limit reached");
    error.status = 429;
    throw error;
  }

  if (scenario === "TEMPORARY_ERROR") {
    const error = new Error("Competition server error");
    error.status = 503;
    throw error;
  }

  if (scenario === "INVALID_INPUT") {
    const error = new Error("Invalid competition input");
    error.status = 400;
    throw error;
  }

  throw new Error(
    `Unknown competition scenario: ${scenario}`,
  );
}

export default researchCompetition;