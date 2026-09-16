import test from "node:test";
import assert from "node:assert/strict";

import buildDemandCriterion from "../src/tools/buildDemandCriterion.js";

test("buildDemandCriterion combines score confidence evidence and signals", async () => {
  const fakeClient = {
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

  const researchResult = {
    summary: `
Search interest is substantial.
Commercial intent is visible.
Marketplace purchases are evident.
Recent sales continue.
Trend direction is slightly negative.
`,

    confidence: "HIGH",

    evidence: [
      {
        type: "REAL_DEMAND_RESEARCH",
        source: "OPENAI_WEB_SEARCH",
        value: "Real demand evidence",
        quality: {
          sourceQuality: 90,
          relevance: 90,
          freshness: 85,
          completeness: 85,
        },
        sources: [
          "https://www.etsy.com/example",
          "https://trends.google.com/example",
        ],
      },
    ],
  };

  const result = await buildDemandCriterion(researchResult, fakeClient);

  assert.equal(result.score, 8);
  assert.equal(result.confidence, "HIGH");
  assert.equal(result.status, "COMPLETE");

  assert.deepEqual(result.evidence, researchResult.evidence);

  assert.deepEqual(result.signals, {
    strongSearchInterest: true,
    commercialIntent: true,
    marketplacePurchases: true,
    recentSales: true,
    positiveTrend: false,
    negativeTrend: true,
  });
});