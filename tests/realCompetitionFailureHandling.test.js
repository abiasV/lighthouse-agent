import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";

import runAgent from "../src/agent/runAgent.js";

test("real competition API failure becomes N_A and agent continues safely", async () => {
  const fakeDemandResearchClient = {
    responses: {
      create: async () => {
        return {
          output_text: `
Search interest is substantial.
Commercial intent is visible.
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

  const failingCompetitionResearchClient = {
    responses: {
      create: async () => {
        throw new Error("Competition API unavailable");
      },
    },
  };

  let state = createInitialState("Birthday Invitation");

  state = await runAgent(state, {
    useRealDemand: true,
    useRealCompetition: true,

    demandResearchClient: fakeDemandResearchClient,

    demandSignalClient: fakeDemandSignalClient,

    competitionResearchClient: failingCompetitionResearchClient,

    sleepFn: async () => {},
  });

  assert.equal(state.criteria.competition.status, "N_A");

  assert.equal(state.criteria.competition.confidence, "LOW");

  assert.equal(state.criteria.competition.score, null);

  assert.equal(
    state.criteria.competition.failureReason,
    "REAL_COMPETITION_RESEARCH_FAILED",
  );

  assert.equal(state.pendingInput?.field, "currency");
});

test("invalid competition signal JSON becomes N_A and agent continues safely", async () => {
  const fakeDemandResearchClient = {
    responses: {
      create: async () => {
        return {
          output_text: `
Search interest is substantial.
Commercial intent is visible.
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
Marketplace saturation is high.
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

  const badCompetitionSignalClient = {
    responses: {
      create: async () => {
        return {
          output_text: "this is not valid json",
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

    competitionSignalClient: badCompetitionSignalClient,

    sleepFn: async () => {},
  });

  assert.equal(state.criteria.competition.status, "N_A");

  assert.equal(state.criteria.competition.confidence, "LOW");

  assert.equal(state.criteria.competition.score, null);

  assert.equal(
    state.criteria.competition.failureReason,
    "REAL_COMPETITION_RESEARCH_FAILED",
  );

  assert.equal(state.pendingInput?.field, "currency");
});
