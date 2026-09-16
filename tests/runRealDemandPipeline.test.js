import test from "node:test";
import assert from "node:assert/strict";

import runRealDemandPipeline from "../src/tools/runRealDemandPipeline.js";

test("runRealDemandPipeline returns complete demand criterion", async () => {
  const fakeResearchClient = {
    responses: {
      create: async () => {
        return {
          output_text: `
Search interest is substantial.
Commercial intent is visible.
Marketplace purchases are evident.
Recent sales continue.
Trend direction is slightly negative.
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
                    url: "https://trends.google.com/example",
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
            strongSearchInterest: true,
            commercialIntent: true,
            marketplacePurchases: true,
            recentSales: true,
            positiveTrend: false,
            negativeTrend: true,
          }),
        };
      },
    },
  };

  const result = await runRealDemandPipeline("Birthday Invitation", {
    researchClient: fakeResearchClient,

    signalClient: fakeSignalClient,
  });

  assert.equal(result.score, 8);

  assert.equal(result.confidence, "MEDIUM");

  assert.equal(result.status, "COMPLETE");

  assert.equal(result.evidence.length, 1);

  assert.deepEqual(result.signals, {
    strongSearchInterest: true,
    commercialIntent: true,
    marketplacePurchases: true,
    recentSales: true,
    positiveTrend: false,
    negativeTrend: true,
  });
});