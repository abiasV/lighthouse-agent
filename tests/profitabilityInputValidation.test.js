// tests/profitabilityInputValidation.test.js

import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";
import runAgent from "../src/agent/runAgent.js";
import applyUserInput from "../src/state/applyUserInput.js";

async function reachProfitabilityInput() {
  let state = createInitialState("Birthday Invitation");

  state = await runAgent(state, {
    useRealProfitability: true,
    sleepFn: async () => {},
  });

  state = applyUserInput(state, "CAD");

  return state;
}

test("negative fixed cost is rejected", async () => {
  let state = await reachProfitabilityInput();

  state = applyUserInput(state, "-50");

  assert.equal(state.pendingInput?.field, "fixedCost");
  assert.equal(state.criteria.profitability.fixedCost, null);
});

test("zero selling price is rejected", async () => {
  let state = await reachProfitabilityInput();

  state = applyUserInput(state, "50");

  state = applyUserInput(state, "0");

  assert.equal(state.pendingInput?.field, "sellingPrice");
  assert.equal(state.criteria.profitability.sellingPrice, null);
});

test("negative variable cost is rejected", async () => {
  let state = await reachProfitabilityInput();

  state = applyUserInput(state, "50");

  state = applyUserInput(state, "8");

  state = applyUserInput(state, "-1");

  assert.equal(state.pendingInput?.field, "variableCost");
  assert.equal(state.criteria.profitability.variableCost, null);
});
