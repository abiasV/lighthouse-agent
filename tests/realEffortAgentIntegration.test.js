import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";

import runAgent from "../src/agent/runAgent.js";

import applyUserInput from "../src/state/applyUserInput.js";

test("agent collects real effort inputs and calculates effort score", async () => {
  let state = createInitialState("Birthday Invitation");

  const options = {
    useRealProfitability: true,
    useRealEffort: true,
    sleepFn: async () => {},
  };

  // Run until Profitability asks for input.
  state = await runAgent(state, options);

  assert.equal(state.pendingInput?.field, "currency");

  // Complete Real Profitability inputs.
  state = applyUserInput(state, "CAD");

  state = applyUserInput(state, "50");

  state = applyUserInput(state, "8");

  state = applyUserInput(state, "1");

  // Resume Agent.
  // It should evaluate Profitability
  // and then ask for Real Effort input.
  state = await runAgent(state, options);

  assert.equal(state.criteria.profitability.status, "COMPLETE");

  assert.equal(state.criteria.profitability.score, 9);

  assert.equal(state.agentStatus, "PAUSED");

  assert.equal(state.pendingInput?.field, "minutesPerOrder");

  // First Effort input.
  state = applyUserInput(state, "15");

  assert.equal(state.criteria.effort.minutesPerOrder, 15);

  assert.equal(state.pendingInput?.field, "humanDependencyChoice");

  // Second Effort input.
  state = applyUserInput(state, "VERY LITTLE");

  assert.equal(state.criteria.effort.humanDependency, "LOW");

  assert.equal(state.pendingInput, null);

  assert.equal(state.tasks.effortEvaluation.status, "READY");

  // Resume Agent and calculate Effort.
  state = await runAgent(state, options);

  assert.equal(state.criteria.effort.score, 9);

  assert.equal(state.criteria.effort.status, "COMPLETE");

  assert.equal(state.criteria.effort.confidence, "HIGH");

  assert.equal(state.criteria.effort.effortInputs.minutesPerOrder, 15);

  assert.equal(state.criteria.effort.effortInputs.humanDependency, "LOW");

  assert.equal(state.tasks.effortEvaluation.status, "COMPLETE");

  assert.equal(state.agentStatus, "COMPLETE");
});
