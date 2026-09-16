import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";

import runAgent from "../src/agent/runAgent.js";

test("agent uses real demand pipeline when useRealDemand is true", async () => {
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

  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.competition = "GOOD_DATA";

  state.mockScenarios.competitionFallback = "GOOD_DATA";

  state = await runAgent(state, {
    useRealDemand: true,

    demandResearchClient: fakeResearchClient,

    demandSignalClient: fakeSignalClient,

    sleepFn: async () => {},
  });

  assert.equal(state.criteria.demand.score, 8);

  assert.equal(state.criteria.demand.confidence, "MEDIUM");

  assert.equal(state.criteria.demand.status, "COMPLETE");

  assert.equal(state.criteria.demand.evidence.length, 1);

  assert.deepEqual(state.criteria.demand.signals, {
    strongSearchInterest: true,
    commercialIntent: true,
    marketplacePurchases: true,
    recentSales: true,
    positiveTrend: false,
    negativeTrend: true,
  });

  assert.equal(state.tasks.demandResearch.status, "COMPLETE");

  assert.equal(state.tasks.competitionResearch.status, "COMPLETE");

  assert.equal(state.agentStatus, "PAUSED");

  assert.equal(state.pendingInput?.field, "currency");
});
