import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";

import runAgent from "../src/agent/runAgent.js";

import applyUserInput from "../src/state/applyUserInput.js";

test("agent collects real profitability inputs and calculates unit economics", async () => {
  let state = createInitialState("Birthday Invitation");

  // First run:
  // Demand and Competition remain MOCK.
  // Only Profitability is REAL.
  state = await runAgent(state, {
    useRealProfitability: true,
    sleepFn: async () => {},
  });

  // Agent should ask for currency first.
  assert.equal(state.agentStatus, "PAUSED");

  assert.equal(state.pendingInput?.field, "currency");

  // User selects currency.
  state = applyUserInput(state, "CAD");

  assert.equal(state.criteria.profitability.currency, "CAD");

  assert.equal(state.pendingInput?.field, "fixedCost");

  // User answers fixed cost.
  state = applyUserInput(state, "50");

  // Agent should now ask for selling price.
  assert.equal(state.pendingInput?.field, "sellingPrice");

  assert.equal(state.criteria.profitability.fixedCost, 50);

  // User answers selling price.
  state = applyUserInput(state, "8");

  // Agent should now ask for variable cost.
  assert.equal(state.pendingInput?.field, "variableCost");

  assert.equal(state.criteria.profitability.sellingPrice, 8);

  // User answers variable cost.
  state = applyUserInput(state, "1");

  assert.equal(state.criteria.profitability.variableCost, 1);

  assert.equal(state.pendingInput, null);

  assert.equal(state.tasks.profitabilityEvaluation.status, "READY");

  // Resume Agent.
  // IMPORTANT:
  // Real Profitability must be enabled again.
  state = await runAgent(state, {
    useRealProfitability: true,
    sleepFn: async () => {},
  });

  assert.equal(state.criteria.profitability.score, 9);

  assert.equal(state.criteria.profitability.status, "COMPLETE");

  assert.equal(state.criteria.profitability.confidence, "HIGH");

  assert.equal(state.criteria.profitability.unitEconomics.profitPerSale, 7);

  assert.equal(state.criteria.profitability.unitEconomics.breakEvenSales, 8);

  assert.equal(
    state.criteria.profitability.unitEconomics.profitablePerSale,
    true,
  );

  assert.equal(state.agentStatus, "COMPLETE");
});
