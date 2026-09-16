import test from "node:test";
import assert from "node:assert/strict";

import runRealCompetitionPipeline from "../src/tools/runRealCompetitionPipeline.js";

test("runRealCompetitionPipeline returns complete competition criterion", async () => {
  const fakeResearchClient = {
    responses: {
      create: async () => {
        return {
          output_text: `
There are many competing listings.
Several established sellers dominate the category.
Marketplace saturation is high.
Differentiation is difficult.
`,
          output: [
            {
              type: "web_search_call",
              action: {
                sources: [
                  {
                    type: "url",
                    url: "https://www.etsy.com/example",
                  },
                  {
                    type: "url",
                    url: "https://www.paperlesspost.com/example",
                  },
                  {
                    type: "url",
                    url: "https://www.apple.com/example",
                  },
                ],
              },
            },
          ],
        };
      },
    },
  };

  const fakeSignalClient = {
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

  const result = await runRealCompetitionPipeline(
    "Editable digital birthday invitation template",
    {
      researchClient: fakeResearchClient,

      signalClient: fakeSignalClient,
    },
  );

  assert.equal(result.score, 2);

  assert.equal(result.status, "COMPLETE");

  assert.equal(result.evidence.length, 1);

  assert.ok(["LOW", "MEDIUM", "HIGH"].includes(result.confidence));

  assert.deepEqual(result.signals, {
    highListingDensity: true,
    strongEstablishedCompetitors: true,
    highMarketplaceSaturation: true,
    difficultDifferentiation: true,
    clearDifferentiationOpportunity: false,
  });
});