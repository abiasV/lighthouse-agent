import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";
import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";

import applyExternalDelegationDecision from "../src/state/applyExternalDelegationDecision.js";
import applyExternalDelegationDelivery from "../src/state/applyExternalDelegationDelivery.js";

function createApprovedDelegationState() {
  const state = createInitialState("Birthday Invitation");

  state.executionPlan = generateExecutionPlan("Birthday Invitation");

  return applyExternalDelegationDecision(state, "task_3", "APPROVE", {
    dimensions: "8 x 10 inches",
    personalization: "Yes",
    material: "",
  });
}

function getExternalTask(state) {
  return state.executionPlan.tasks.find((task) => task.id === "task_3");
}

test("good freelancer deliverable completes the external task", async () => {
  const state = createApprovedDelegationState();

  const updatedState = await applyExternalDelegationDelivery(
    state,
    "task_3",
    "GOOD_DELIVERABLE",
  );

  const task = getExternalTask(updatedState);

  assert.equal(task.status, "COMPLETE");

  assert.equal(task.delegation.status, "COMPLETE");

  assert.equal(task.result.type, "EXTERNAL_FREELANCER_DELIVERABLE");

  assert.equal(task.delegation.delivery.verificationPassed, true);

  assert.deepEqual(task.delegation.delivery.failedCriteria, []);

  assert.ok(
    task.verificationResults.every(
      (verification) => verification.status === "PASSED",
    ),
  );
});

test("missing source file requires freelancer revision", async () => {
  const state = createApprovedDelegationState();

  const updatedState = await applyExternalDelegationDelivery(
    state,
    "task_3",
    "DELIVERABLE_MISSING_REQUIREMENT",
  );

  const task = getExternalTask(updatedState);

  assert.equal(task.status, "REVISION_REQUIRED");

  assert.equal(task.delegation.status, "REVISION_REQUIRED");

  assert.equal(task.delegation.delivery.verificationPassed, false);

  assert.equal(task.delegation.delivery.nextAction, "REVISION_REQUIRED");

  assert.ok(
    task.delegation.delivery.failedCriteria.some(
      (criterion) =>
        criterion.description === "Required source files are included",
    ),
  );
});

test("failed verification explains why revision is required", async () => {
  const state = createApprovedDelegationState();

  const updatedState = await applyExternalDelegationDelivery(
    state,
    "task_3",
    "DELIVERABLE_MISSING_REQUIREMENT",
  );

  const task = getExternalTask(updatedState);

  const failedCriterion = task.delegation.delivery.failedCriteria.find(
    (criterion) =>
      criterion.description === "Required source files are included",
  );

  assert.ok(failedCriterion);

  assert.equal(
    failedCriterion.reason,
    "The required editable source file is missing.",
  );
});

test("unverified product fact prevents deliverable acceptance", async () => {
  const state = createApprovedDelegationState();

  const updatedState = await applyExternalDelegationDelivery(
    state,
    "task_3",
    "UNVERIFIED_PRODUCT_FACT",
  );

  const task = getExternalTask(updatedState);

  assert.equal(task.status, "REVISION_REQUIRED");

  assert.ok(
    task.delegation.delivery.failedCriteria.some(
      (criterion) =>
        criterion.description ===
        "All product facts used in the brief and accepted deliverable come from verified facts",
    ),
  );
});

test("revision-required task can accept a corrected deliverable", async () => {
  const state = createApprovedDelegationState();

  const revisionState = await applyExternalDelegationDelivery(
    state,
    "task_3",
    "DELIVERABLE_MISSING_REQUIREMENT",
  );

  assert.equal(getExternalTask(revisionState).status, "REVISION_REQUIRED");

  const correctedState = await applyExternalDelegationDelivery(
    revisionState,
    "task_3",
    "GOOD_DELIVERABLE",
  );

  const correctedTask = getExternalTask(correctedState);

  assert.equal(correctedTask.status, "COMPLETE");

  assert.equal(correctedTask.delegation.delivery.verificationPassed, true);
});

test("external delivery cannot happen before approval", async () => {
  const state = createInitialState("Birthday Invitation");

  state.executionPlan = generateExecutionPlan("Birthday Invitation");

  await assert.rejects(
    () => applyExternalDelegationDelivery(state, "task_3", "GOOD_DELIVERABLE"),
    {
      message: "DELEGATION_NOT_READY_FOR_DELIVERY",
    },
  );
});

test("safe AI task cannot receive an external freelancer deliverable", async () => {
  const state = createApprovedDelegationState();

  await assert.rejects(
    () => applyExternalDelegationDelivery(state, "task_1", "GOOD_DELIVERABLE"),
    {
      message: "TASK_IS_NOT_EXTERNAL",
    },
  );
});