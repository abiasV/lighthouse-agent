// tests/happyPath.test.js

import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";
import runAgent from "../src/agent/runAgent.js";
import applyUserInput from "../src/state/applyUserInput.js";

const fastTestOptions = {
  sleepFn: async () => {},
};

function completeMockProfitabilityInput(state) {
  state = applyUserInput(state, "CAD");
  state = applyUserInput(state, "50");

  return state;
}

test("happy path returns WORTH_TESTING", async () => {
  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.demand = "GOOD_DATA";
  state.mockScenarios.demandFallback = "GOOD_DATA";

  state.mockScenarios.competition = "GOOD_DATA";
  state.mockScenarios.competitionFallback = "GOOD_DATA";

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.pendingInput?.field, "currency");

  state = applyUserInput(state, "CAD");

  assert.equal(state.pendingInput?.field, "fixedCost");

  state = applyUserInput(state, "50");

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.finalStatus, "WORTH_TESTING");
  assert.equal(state.finalScore, 7.4);
  assert.equal(state.evidenceCoverage, 100);
  assert.equal(state.incompleteAnalysis, false);
});

test("low competition confidence returns NEEDS_MORE_RESEARCH", async () => {
  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.demand = "GOOD_DATA";
  state.mockScenarios.demandFallback = "GOOD_DATA";

  state.mockScenarios.competition = "PARTIAL_DATA";
  state.mockScenarios.competitionFallback = "GOOD_DATA";

  state = await runAgent(state, fastTestOptions);

  state = completeMockProfitabilityInput(state);

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.criteria.competition.confidence, "LOW");

  assert.equal(state.finalStatus, "NEEDS_MORE_RESEARCH");

  assert.equal(state.finalReason, "LOW_CONFIDENCE_IN_CRITICAL_CRITERION");

  assert.equal(state.evidenceCoverage, 100);
});

test("missing competition evidence returns incomplete analysis", async () => {
  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.demand = "GOOD_DATA";
  state.mockScenarios.demandFallback = "GOOD_DATA";

  state.mockScenarios.competition = "RATE_LIMIT";
  state.mockScenarios.competitionFallback = "NO_DATA";

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.criteria.competition.status, "N_A");

  state = completeMockProfitabilityInput(state);

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.evidenceCoverage, 80);
  assert.equal(state.incompleteAnalysis, true);
  assert.equal(state.finalStatus, "NEEDS_MORE_RESEARCH");
  assert.equal(state.finalReason, "INCOMPLETE_ANALYSIS");
});

test("invalid competition input pauses and resumes after correction", async () => {
  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.demand = "GOOD_DATA";
  state.mockScenarios.demandFallback = "GOOD_DATA";

  state.mockScenarios.competition = "INVALID_INPUT";
  state.mockScenarios.competitionFallback = "GOOD_DATA";

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.agentStatus, "PAUSED");
  assert.equal(state.tasks.competitionResearch.status, "WAITING_FOR_USER");
  assert.equal(state.pendingInput?.field, "competitionQuery");

  state.mockScenarios.competition = "GOOD_DATA";

  state = applyUserInput(
    state,
    "Editable digital birthday invitation template",
  );

  assert.equal(
    state.researchInputs.competitionQuery,
    "Editable digital birthday invitation template",
  );

  assert.equal(state.tasks.competitionResearch.status, "READY");
  assert.equal(state.agentStatus, "RUNNING");

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.criteria.competition.status, "COMPLETE");
  assert.equal(state.pendingInput?.field, "currency");

  state = completeMockProfitabilityInput(state);

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.finalStatus, "WORTH_TESTING");
  assert.equal(state.agentStatus, "COMPLETE");
});

test("copyright failure rejects immediately", async () => {
  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.copyright = "FAIL";

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.agentStatus, "REJECTED");
  assert.equal(state.finalStatus, "REJECT");
  assert.equal(state.finalReason, "COPYRIGHT_HARD_CONSTRAINT");

  assert.equal(state.tasks.copyrightCheck.status, "COMPLETE");
  assert.equal(state.tasks.demandResearch.status, "BLOCKED");

  assert.equal(state.criteria.demand.status, "NOT_STARTED");
  assert.equal(state.criteria.competition.status, "NOT_STARTED");
});

test("low demand triggers hard floor rejection", async () => {
  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.demand = "LOW_DEMAND";
  state.mockScenarios.competition = "GOOD_DATA";

  state = await runAgent(state, fastTestOptions);

  state = completeMockProfitabilityInput(state);

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.criteria.demand.score, 3);
  assert.equal(state.finalStatus, "REJECT");
  assert.equal(state.finalReason, "DEMAND_HARD_FLOOR");
  assert.equal(state.agentStatus, "REJECTED");
});

test("low profitability triggers soft floor", async () => {
  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.demand = "GOOD_DATA";
  state.mockScenarios.competition = "GOOD_DATA";
  state.mockScenarios.profitability = "LOW_PROFITABILITY";

  state = await runAgent(state, fastTestOptions);

  state = completeMockProfitabilityInput(state);

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.criteria.profitability.score, 3);

  assert.equal(state.finalStatus, "NEEDS_MORE_RESEARCH");
  assert.equal(state.finalReason, "SOFT_FLOOR_TRIGGERED");
});

test("competition rate limit uses fallback successfully", async () => {
  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.demand = "GOOD_DATA";
  state.mockScenarios.demandFallback = "GOOD_DATA";

  state.mockScenarios.competition = "RATE_LIMIT";
  state.mockScenarios.competitionFallback = "GOOD_DATA";

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.criteria.competition.usedFallback, true);
  assert.equal(state.criteria.competition.score, 5);
  assert.equal(state.criteria.competition.status, "COMPLETE");

  state = completeMockProfitabilityInput(state);

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.finalStatus, "WORTH_TESTING");
});

test("temporary competition error uses fallback successfully", async () => {
  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.demand = "GOOD_DATA";
  state.mockScenarios.demandFallback = "GOOD_DATA";

  state.mockScenarios.competition = "TEMPORARY_ERROR";
  state.mockScenarios.competitionFallback = "GOOD_DATA";

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.criteria.competition.usedFallback, true);
  assert.equal(state.criteria.competition.status, "COMPLETE");
  assert.equal(state.criteria.competition.score, 5);
});

test("invalid competition input does not use fallback", async () => {
  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.demand = "GOOD_DATA";

  state.mockScenarios.competition = "INVALID_INPUT";
  state.mockScenarios.competitionFallback = "GOOD_DATA";

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.criteria.competition.usedFallback, undefined);

  assert.equal(state.tasks.competitionResearch.status, "WAITING_FOR_USER");

  assert.equal(state.pendingInput?.field, "competitionQuery");
  assert.equal(state.agentStatus, "PAUSED");
});

test("demand rate limit uses fallback successfully", async () => {
  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.demand = "RATE_LIMIT";
  state.mockScenarios.demandFallback = "GOOD_DATA";

  state.mockScenarios.competition = "GOOD_DATA";

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.criteria.demand.usedFallback, true);
  assert.equal(state.criteria.demand.score, 6);
  assert.equal(state.criteria.demand.status, "COMPLETE");

  assert.equal(state.pendingInput?.field, "currency");
});

test("missing demand evidence becomes N_A and incomplete analysis", async () => {
  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.demand = "RATE_LIMIT";
  state.mockScenarios.demandFallback = "NO_DATA";

  state.mockScenarios.competition = "GOOD_DATA";

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.criteria.demand.status, "N_A");
  assert.equal(state.criteria.demand.score, null);

  state = completeMockProfitabilityInput(state);

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.evidenceCoverage, 70);
  assert.equal(state.incompleteAnalysis, true);
  assert.equal(state.finalStatus, "NEEDS_MORE_RESEARCH");
  assert.equal(state.finalReason, "INCOMPLETE_ANALYSIS");
});

test("temporary demand error uses fallback successfully", async () => {
  let state = createInitialState("Birthday Invitation");

  state.mockScenarios.demand = "TEMPORARY_ERROR";
  state.mockScenarios.demandFallback = "GOOD_DATA";

  state.mockScenarios.competition = "GOOD_DATA";

  state = await runAgent(state, fastTestOptions);

  assert.equal(state.criteria.demand.usedFallback, true);
  assert.equal(state.criteria.demand.score, 6);
  assert.equal(state.criteria.demand.status, "COMPLETE");
});
