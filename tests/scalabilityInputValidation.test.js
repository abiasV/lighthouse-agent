// tests/scalabilityInputValidation.test.js

import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";
import runAgent from "../src/agent/runAgent.js";
import applyUserInput from "../src/state/applyUserInput.js";

async function reachScalabilityInput() {
  let state = createInitialState("Birthday Invitation");

  const options = {
    useRealProfitability: true,
    useRealEffort: true,
    useRealScalability: true,
    sleepFn: async () => {},
  };

  state = await runAgent(state, options);

  state = applyUserInput(state, "CAD");
  state = applyUserInput(state, "50");
  state = applyUserInput(state, "8");
  state = applyUserInput(state, "1");

  state = await runAgent(state, options);

  state = applyUserInput(state, "15");
  state = applyUserInput(state, "VERY LITTLE");

  state = await runAgent(state, options);

  return state;
}

test("negative parallel orders is rejected", async () => {
  let state = await reachScalabilityInput();

  state = applyUserInput(state, "-5");

  assert.equal(state.pendingInput?.field, "parallelOrders");

  assert.equal(
    state.criteria.scalability.ordersPerHourWithoutExtraHelp,
    undefined,
  );
});

test("parallel orders calculate scalability inputs", async () => {
  let state = await reachScalabilityInput();

  state = applyUserInput(state, "5");

  assert.equal(state.criteria.scalability.parallelOrders, 5);

  assert.equal(state.criteria.scalability.ordersPerHourWithoutExtraHelp, 20);

  assert.equal(state.criteria.scalability.manualBottleneckLevel, "LOW");
});