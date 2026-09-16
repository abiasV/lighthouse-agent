import test from "node:test";
import assert from "node:assert/strict";

import buildCompetitionCriterion from "../src/tools/buildCompetitionCriterion.js";

test("buildCompetitionCriterion combines score confidence evidence and signals", async () => {
  const fakeClient = {
    responses: {
      create: async () => {
        return {
          output_text: JSON.stringify({
            highListingDensity: true,
            strongEstablishedCompetitors: true,
            highMarketplaceSaturation: true,
            difficultDifferentiation: true,
            clearDifferentiationOpportunity: false,
          }),
        };
      },
    },
  };

  const researchResult = {
    summary: `
There are many competing listings.
Several established sellers dominate the category.
Marketplace saturation is high.
Differentiation appears difficult.
`,
    confidence: "HIGH",
    evidence: [
      {
        type: "REAL_COMPETITION_RESEARCH",
        source: "OPENAI_WEB_SEARCH",
        value: "Competition research summary",
        sources: ["https://www.etsy.com/example"],
        quality: {
          sourceQuality: 90,
          relevance: 90,
          freshness: 90,
          completeness: 90,
        },
      },
    ],
  };

  const criterion = await buildCompetitionCriterion(researchResult, fakeClient);

  assert.equal(criterion.score, 2);

  assert.equal(criterion.confidence, "HIGH");

  assert.equal(criterion.status, "COMPLETE");

  assert.equal(criterion.evidence, researchResult.evidence);

  assert.deepEqual(criterion.signals, {
    highListingDensity: true,
    strongEstablishedCompetitors: true,
    highMarketplaceSaturation: true,
    difficultDifferentiation: true,
    clearDifferentiationOpportunity: false,
  });
});