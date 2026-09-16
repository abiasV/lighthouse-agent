import test from "node:test";
import assert from "node:assert/strict";

import evaluateCompetitionFromResearch from "../src/tools/evaluateCompetitionFromResearch.js";

test("evaluateCompetitionFromResearch converts extracted signals into competition score", async () => {
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

  const competitionSummary = `
There are many competing listings.
Several established sellers dominate the category.
The marketplace is highly saturated.
Differentiation is difficult.
`;

  const result = await evaluateCompetitionFromResearch(
    competitionSummary,
    fakeClient,
  );

  assert.deepEqual(result.signals, {
    highListingDensity: true,
    strongEstablishedCompetitors: true,
    highMarketplaceSaturation: true,
    difficultDifferentiation: true,
    clearDifferentiationOpportunity: false,
  });

  assert.equal(result.score, 2);
});