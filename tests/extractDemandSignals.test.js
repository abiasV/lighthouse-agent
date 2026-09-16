import test from "node:test";
import assert from "node:assert/strict";

import extractDemandSignals from "../src/tools/extractDemandSignals.js";

test("extractDemandSignals returns parsed structured signals", async () => {
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

  const signals = await extractDemandSignals(demandSummary, fakeClient);

  assert.deepEqual(signals, {
    strongSearchInterest: true,
    commercialIntent: true,
    marketplacePurchases: true,
    recentSales: true,
    positiveTrend: false,
    negativeTrend: true,
  });
});