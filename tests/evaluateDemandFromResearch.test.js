import test from "node:test";
import assert from "node:assert/strict";

import evaluateDemandFromResearch from "../src/tools/evaluateDemandFromResearch.js";

test("evaluateDemandFromResearch converts extracted signals into demand score", async () => {
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

  const demandSummary = `
Search interest is substantial.
Commercial intent is visible.
Marketplace purchases are evident.
Recent sales continue.
Trend direction is slightly negative.
`;

  const result = await evaluateDemandFromResearch(demandSummary, fakeClient);

  assert.deepEqual(result.signals, {
    strongSearchInterest: true,
    commercialIntent: true,
    marketplacePurchases: true,
    recentSales: true,
    positiveTrend: false,
    negativeTrend: true,
  });

  assert.equal(result.score, 8);
});