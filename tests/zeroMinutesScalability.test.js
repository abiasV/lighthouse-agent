import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";
import runAgent from "../src/agent/runAgent.js";
import applyUserInput from "../src/state/applyUserInput.js";

test("zero manual minutes does not block scalability evaluation", async () => {
  let state = createInitialState("Automated Digital Product");

  const options = {
    useRealProfitability: true,
    useRealEffort: true,
    useRealScalability: true,
    sleepFn: async () => {},
  };

  // Run until the agent asks for profitability input.
  state = await runAgent(state, options);

  assert.equal(state.pendingInput?.field, "currency");

  // Complete profitability inputs.
  state = applyUserInput(state, "CAD");
  state = applyUserInput(state, "50");
  state = applyUserInput(state, "8");
  state = applyUserInput(state, "1");

  // Resume until effort input.
  state = await runAgent(state, options);

  assert.equal(state.pendingInput?.field, "minutesPerOrder");

  // Zero minutes is valid for an automated product.
  state = applyUserInput(state, "0");

  assert.equal(state.criteria.effort.minutesPerOrder, 0);
  assert.equal(
    state.pendingInput?.field,
    "humanDependencyChoice",
  );

  state = applyUserInput(state, "VERY LITTLE");

  // Resume until scalability input.
  state = await runAgent(state, options);

  assert.equal(state.criteria.effort.status, "COMPLETE");
  assert.equal(state.pendingInput?.field, "parallelOrders");

  // The exact parallel count should not cause division-by-zero
  // when manual work per order is zero.
  state = applyUserInput(state, "5");

  assert.equal(state.criteria.scalability.parallelOrders, 5);

  assert.equal(
    state.criteria.scalability.ordersPerHourWithoutExtraHelp,
    20,
  );

  assert.equal(
    state.criteria.scalability.manualBottleneckLevel,
    "LOW",
  );

  assert.equal(state.pendingInput, null);

  assert.equal(
    state.tasks.scalabilityEvaluation.status,
    "READY",
  );

  // Resume and complete scalability + final evaluation.
  state = await runAgent(state, options);

  assert.equal(state.criteria.scalability.status, "COMPLETE");
  assert.equal(state.criteria.scalability.score, 10);

  assert.equal(
    state.tasks.scalabilityEvaluation.status,
    "COMPLETE",
  );

  assert.equal(state.tasks.finalEvaluation.status, "COMPLETE");

  assert.equal(state.agentStatus, "COMPLETE");
});