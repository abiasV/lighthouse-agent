import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";

import runAgent from "../src/agent/runAgent.js";

test("agent uses real demand and real competition pipelines together", async () => {
  const fakeDemandResearchClient = {
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

  const fakeDemandSignalClient = {
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

  const fakeCompetitionResearchClient = {
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

  const fakeCompetitionSignalClient = {
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

  let state = createInitialState("Birthday Invitation");

  state = await runAgent(state, {
    useRealDemand: true,
    useRealCompetition: true,

    demandResearchClient: fakeDemandResearchClient,

    demandSignalClient: fakeDemandSignalClient,

    competitionResearchClient: fakeCompetitionResearchClient,

    competitionSignalClient: fakeCompetitionSignalClient,

    sleepFn: async () => {},
  });

  assert.equal(state.criteria.demand.score, 8);

  assert.equal(state.criteria.demand.status, "COMPLETE");

  assert.equal(state.criteria.competition.score, 2);

  assert.equal(state.criteria.competition.status, "COMPLETE");

  assert.equal(state.agentStatus, "PAUSED");

  assert.equal(state.pendingInput?.field, "currency");
});
