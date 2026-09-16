// tests/effortInputValidation.test.js

import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";
import runAgent from "../src/agent/runAgent.js";
import applyUserInput from "../src/state/applyUserInput.js";

async function reachEffortInput() {
  let state = createInitialState("Birthday Invitation");

  const options = {
    useRealProfitability: true,
    useRealEffort: true,
    sleepFn: async () => {},
  };

  state = await runAgent(state, options);

  state = applyUserInput(state, "CAD");
  state = applyUserInput(state, "50");
  state = applyUserInput(state, "8");
  state = applyUserInput(state, "1");

  state = await runAgent(state, options);

  return state;
}

test("negative minutes per order is rejected", async () => {
  let state = await reachEffortInput();

  state = applyUserInput(state, "-5");

  assert.equal(state.pendingInput?.field, "minutesPerOrder");
  assert.equal(state.criteria.effort.minutesPerOrder, undefined);
});

test("invalid human dependency choice is rejected", async () => {
  let state = await reachEffortInput();

  state = applyUserInput(state, "15");

  state = applyUserInput(state, "VERY_HIGH");

  assert.equal(state.pendingInput?.field, "humanDependencyChoice");
  assert.equal(state.criteria.effort.humanDependency, undefined);
});
