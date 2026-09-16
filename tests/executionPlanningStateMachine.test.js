import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";
import runAgent from "../src/agent/runAgent.js";

function createValidationReadyState() {
  const state = createInitialState("Birthday Invitation");

  state.tasks.copyrightCheck.status = "COMPLETE";
  state.tasks.demandResearch.status = "COMPLETE";
  state.tasks.competitionResearch.status = "COMPLETE";
  state.tasks.profitabilityInput.status = "COMPLETE";
  state.tasks.profitabilityEvaluation.status = "COMPLETE";
  state.tasks.effortInput.status = "COMPLETE";
  state.tasks.effortEvaluation.status = "COMPLETE";
  state.tasks.scalabilityInput.status = "COMPLETE";
  state.tasks.scalabilityEvaluation.status = "COMPLETE";

  state.tasks.finalEvaluation.status = "READY";
  state.tasks.finalEvaluation.blockedBy = null;

  state.criteria.demand = {
    ...state.criteria.demand,
    score: 8,
    confidence: "HIGH",
    status: "COMPLETE",
    evidence: ["Demand evidence"],
  };

  state.criteria.competition = {
    ...state.criteria.competition,
    score: 8,
    confidence: "HIGH",
    status: "COMPLETE",
    evidence: ["Competition evidence"],
  };

  state.criteria.profitability = {
    ...state.criteria.profitability,
    score: 8,
    confidence: "HIGH",
    status: "COMPLETE",
    evidence: ["Profitability evidence"],
  };

  state.criteria.effort = {
    ...state.criteria.effort,
    score: 8,
    confidence: "HIGH",
    status: "COMPLETE",
    evidence: ["Effort evidence"],
  };

  state.criteria.scalability = {
    ...state.criteria.scalability,
    score: 8,
    confidence: "HIGH",
    status: "COMPLETE",
    evidence: ["Scalability evidence"],
  };

  return state;
}

test("WORTH_TESTING continues from validation into execution planning", async () => {
  const state = createValidationReadyState();

  const result = await runAgent(state, {
    sleepFn: async () => {},
  });

  assert.equal(result.finalStatus, "WORTH_TESTING");
  assert.equal(result.finalScore, 8);

  assert.equal(result.tasks.finalEvaluation.status, "COMPLETE");

  assert.equal(result.tasks.executionPlanning.status, "COMPLETE");

  assert.equal(result.tasks.executionPlanning.blockedBy, null);

  assert.equal(result.tasks.executionPlanning.blockedReason, null);

  assert.equal(result.agentStatus, "COMPLETE");

  assert.ok(result.executionPlan);

  assert.ok(Array.isArray(result.executionPlan.tasks));

  assert.ok(result.executionPlan.tasks.length > 0);
});

test("NEEDS_MORE_RESEARCH keeps execution planning blocked with a reason", async () => {
  const state = createValidationReadyState();

  state.criteria.competition.score = 2;

  const result = await runAgent(state, {
    sleepFn: async () => {},
  });

  assert.equal(result.finalStatus, "NEEDS_MORE_RESEARCH");

  assert.equal(result.finalReason, "SOFT_FLOOR_TRIGGERED");

  assert.equal(result.tasks.finalEvaluation.status, "COMPLETE");

  assert.equal(result.tasks.executionPlanning.status, "BLOCKED");

  assert.equal(result.tasks.executionPlanning.blockedBy, null);

  assert.equal(
    result.tasks.executionPlanning.blockedReason,
    "SOFT_FLOOR_TRIGGERED",
  );

  assert.equal(result.tasks.executionPlanning.failureReason, undefined);

  assert.equal(result.executionPlan, null);

  assert.equal(result.agentStatus, "COMPLETE");
});

test("invalid execution plan ends in PLANNING_FAILED", async () => {
  const state = createValidationReadyState();

  state.mockScenarios.executionPlan = "MISSING_ACCEPTANCE_CRITERIA";

  const result = await runAgent(state, {
    sleepFn: async () => {},
  });

  assert.equal(result.finalStatus, "WORTH_TESTING");

  assert.equal(result.tasks.finalEvaluation.status, "COMPLETE");

  assert.equal(result.tasks.executionPlanning.status, "FAILED");

  assert.equal(result.tasks.executionPlanning.blockedBy, null);

  assert.equal(result.tasks.executionPlanning.blockedReason, null);

  assert.equal(
    result.tasks.executionPlanning.failureReason,
    "ACCEPTANCE_CRITERIA_MISSING",
  );

  assert.equal(result.executionPlan, null);

  assert.equal(result.agentStatus, "PLANNING_FAILED");
});