import test from "node:test";
import assert from "node:assert/strict";

import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";
import validateExecutionPlan from "../src/utils/validateExecutionPlan.js";

function getExternalTask() {
  const plan = generateExecutionPlan("Birthday Invitation");

  return {
    plan,
    task: plan.tasks.find(
      (currentTask) => currentTask.executorType === "EXTERNAL",
    ),
  };
}

test("external delegation task includes explainable delegation metadata", () => {
  const { task } = getExternalTask();

  assert.ok(task);

  assert.equal(task.executorType, "EXTERNAL");

  assert.equal(task.riskLevel, "MONEY_REQUIRED");

  assert.equal(task.status, "AWAITING_APPROVAL");

  assert.equal(
    task.delegationReason,
    "This task requires specialized visual design work that should be handled by an external specialist.",
  );

  assert.equal(task.detectedFrom, "THUMBNAIL_QUALITY_SIGNAL");
});

test("external delegation task defines a verified product facts policy", () => {
  const { task } = getExternalTask();

  assert.deepEqual(task.verifiedFactsPolicy, {
    source: "USER_INPUT_AT_APPROVAL",
    unknownValue: "UNKNOWN",
    allowInvention: false,
  });

  assert.ok(
    task.acceptanceCriteria.some(
      (criterion) =>
        criterion.description ===
        "All product facts used in the brief and accepted deliverable come from verified facts",
    ),
  );
});

test("valid external delegation contract passes validation", () => {
  const { plan } = getExternalTask();

  const validation = validateExecutionPlan(plan);

  assert.equal(validation.valid, true);
  assert.equal(validation.reason, null);
});

test("external task without delegation reason fails validation", () => {
  const { plan, task } = getExternalTask();

  delete task.delegationReason;

  const validation = validateExecutionPlan(plan);

  assert.equal(validation.valid, false);

  assert.equal(validation.reason, "DELEGATION_REASON_REQUIRED");
});

test("external task with unknown delegation signal fails validation", () => {
  const { plan, task } = getExternalTask();

  task.detectedFrom = "SOME_RANDOM_TEXT";

  const validation = validateExecutionPlan(plan);

  assert.equal(validation.valid, false);

  assert.equal(validation.reason, "INVALID_DELEGATION_SIGNAL");
});

test("external task cannot allow invented product facts", () => {
  const { plan, task } = getExternalTask();

  task.verifiedFactsPolicy.allowInvention = true;

  const validation = validateExecutionPlan(plan);

  assert.equal(validation.valid, false);

  assert.equal(validation.reason, "PRODUCT_FACT_INVENTION_NOT_ALLOWED");
});

test("external task must preserve UNKNOWN for missing product facts", () => {
  const { plan, task } = getExternalTask();

  task.verifiedFactsPolicy.unknownValue = "GUESS";

  const validation = validateExecutionPlan(plan);

  assert.equal(validation.valid, false);

  assert.equal(validation.reason, "INVALID_UNKNOWN_FACT_VALUE");
});