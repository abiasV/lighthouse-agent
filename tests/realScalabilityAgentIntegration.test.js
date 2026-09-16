import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";

import runAgent from "../src/agent/runAgent.js";

import applyUserInput from "../src/state/applyUserInput.js";

test("agent collects real scalability inputs and calculates scalability score", async () => {
  let state = createInitialState("Birthday Invitation");

  const options = {
    useRealProfitability: true,
    useRealEffort: true,
    useRealScalability: true,
    sleepFn: async () => {},
  };

  // Run until Profitability asks for input.
  state = await runAgent(state, options);

  assert.equal(state.pendingInput?.field, "currency");

  // Complete Real Profitability.
  state = applyUserInput(state, "CAD");

  state = applyUserInput(state, "50");

  state = applyUserInput(state, "8");

  state = applyUserInput(state, "1");

  // Resume until Real Effort input.
  state = await runAgent(state, options);

  assert.equal(state.pendingInput?.field, "minutesPerOrder");

  // Complete Real Effort.
  state = applyUserInput(state, "15");

  state = applyUserInput(state, "VERY LITTLE");

  // Resume until Real Scalability input.
  state = await runAgent(state, options);

  assert.equal(state.criteria.effort.status, "COMPLETE");

  assert.equal(state.pendingInput?.field, "parallelOrders");

  // User says 5 orders can be handled in parallel.
  state = applyUserInput(state, "5");

  assert.equal(state.criteria.scalability.parallelOrders, 5);

  assert.equal(state.criteria.scalability.ordersPerHourWithoutExtraHelp, 20);

  assert.equal(state.criteria.scalability.manualBottleneckLevel, "LOW");

  assert.equal(state.pendingInput, null);

  assert.equal(state.tasks.scalabilityEvaluation.status, "READY");

  // Resume Agent.
  // Scalability should be calculated,
  // followed by Final Evaluation.
  state = await runAgent(state, options);

  assert.equal(state.criteria.scalability.score, 10);

  assert.equal(state.criteria.scalability.status, "COMPLETE");

  assert.equal(state.criteria.scalability.confidence, "HIGH");

  assert.equal(
    state.criteria.scalability.scalabilityInputs.ordersPerHourWithoutExtraHelp,
    20,
  );

  assert.equal(
    state.criteria.scalability.scalabilityInputs.manualBottleneckLevel,
    "LOW",
  );

  assert.equal(state.tasks.scalabilityEvaluation.status, "COMPLETE");

  assert.equal(state.tasks.finalEvaluation.status, "COMPLETE");

  assert.equal(state.agentStatus, "COMPLETE");
});
