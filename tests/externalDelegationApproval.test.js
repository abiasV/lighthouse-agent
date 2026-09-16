import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";
import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";
import applyExternalDelegationDecision from "../src/state/applyExternalDelegationDecision.js";

function createDelegationState() {
  const state = createInitialState("Birthday Invitation");

  state.executionPlan = generateExecutionPlan("Birthday Invitation");

  return state;
}

function getExternalTask(state) {
  return state.executionPlan.tasks.find(
    (task) => task.executorType === "EXTERNAL",
  );
}

test("approving external delegation stores verified facts and prepares a freelancer brief", () => {
  const state = createDelegationState();

  const updatedState = applyExternalDelegationDecision(
    state,
    "task_3",
    "APPROVE",
    {
      dimensions: "8 x 10 inches",
      personalization: "Yes",
      material: "",
    },
  );

  const task = getExternalTask(updatedState);

  assert.equal(task.status, "APPROVED");

  assert.equal(task.delegation.status, "APPROVED");

  assert.equal(task.delegation.decision, "APPROVE");

  assert.deepEqual(task.delegation.verifiedFacts, {
    dimensions: "8 x 10 inches",
    personalization: "Yes",
    material: "UNKNOWN",
  });

  assert.ok(task.delegation.decidedAt);

  assert.ok(task.delegation.brief);

  assert.equal(task.delegation.brief.type, "EXTERNAL_DELEGATION_BRIEF");

  assert.equal(task.delegation.brief.source, "MOCK");

  assert.deepEqual(
    task.delegation.brief.verifiedFacts,
    task.delegation.verifiedFacts,
  );
});

test("delegation brief preserves the approved budget and explainability metadata", () => {
  const state = createDelegationState();

  const updatedState = applyExternalDelegationDecision(
    state,
    "task_3",
    "APPROVE",
    {
      dimensions: "8 x 10 inches",
    },
  );

  const task = getExternalTask(updatedState);

  const brief = task.delegation.brief;

  assert.deepEqual(brief.budget, {
    currency: "CAD",
    min: 60,
    max: 90,
  });

  assert.equal(brief.delegationReason, task.delegationReason);

  assert.equal(brief.detectedFrom, "THUMBNAIL_QUALITY_SIGNAL");
});

test("delegation brief explicitly prevents unverified product fact invention", () => {
  const state = createDelegationState();

  const updatedState = applyExternalDelegationDecision(
    state,
    "task_3",
    "APPROVE",
    {
      material: "",
    },
  );

  const task = getExternalTask(updatedState);

  const brief = task.delegation.brief;

  assert.equal(brief.verifiedFacts.material, "UNKNOWN");

  assert.equal(brief.safeguards.allowUnverifiedFacts, false);

  assert.equal(brief.safeguards.unknownValue, "UNKNOWN");

  assert.ok(
    brief.constraints.some((constraint) =>
      constraint.includes("do not invent"),
    ),
  );
});

test("rejecting external delegation does not create a freelancer brief", () => {
  const state = createDelegationState();

  const updatedState = applyExternalDelegationDecision(
    state,
    "task_3",
    "REJECT",
  );

  const task = getExternalTask(updatedState);

  assert.equal(task.status, "REJECTED");

  assert.equal(task.delegation.status, "REJECTED");

  assert.equal(task.delegation.decision, "REJECT");

  assert.equal(task.delegation.verifiedFacts, null);

  assert.equal(task.delegation.brief, null);
});

test("approving delegation without verified facts is rejected", () => {
  const state = createDelegationState();

  assert.throws(
    () => applyExternalDelegationDecision(state, "task_3", "APPROVE"),
    {
      message: "VERIFIED_FACTS_REQUIRED",
    },
  );
});

test("safe AI task cannot use external delegation approval", () => {
  const state = createDelegationState();

  assert.throws(
    () =>
      applyExternalDelegationDecision(state, "task_1", "APPROVE", {
        productType: "Digital",
      }),
    {
      message: "TASK_DOES_NOT_REQUIRE_EXTERNAL_DELEGATION",
    },
  );
});

test("an already decided delegation cannot be approved again", () => {
  const state = createDelegationState();

  const approvedState = applyExternalDelegationDecision(
    state,
    "task_3",
    "APPROVE",
    {
      dimensions: "8 x 10 inches",
    },
  );

  assert.throws(
    () =>
      applyExternalDelegationDecision(approvedState, "task_3", "APPROVE", {
        dimensions: "8 x 10 inches",
      }),
    {
      message: "TASK_NOT_AWAITING_APPROVAL",
    },
  );
});