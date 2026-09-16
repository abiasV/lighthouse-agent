import test from "node:test";
import assert from "node:assert/strict";

import extractCompetitionSignals from "../src/tools/extractCompetitionSignals.js";

test("extractCompetitionSignals returns parsed structured signals", async () => {
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
Marketplace saturation is high.
Differentiation appears difficult.
`;

  const signals = await extractCompetitionSignals(
    competitionSummary,
    fakeClient,
  );

  assert.deepEqual(signals, {
    highListingDensity: true,
    strongEstablishedCompetitors: true,
    highMarketplaceSaturation: true,
    difficultDifferentiation: true,
    clearDifferentiationOpportunity: false,
  });
});
