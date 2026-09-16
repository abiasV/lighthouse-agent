import test from "node:test";
import assert from "node:assert/strict";

import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";
import validateExecutionPlan from "../src/utils/validateExecutionPlan.js";

test("good execution plan passes validation", () => {
  const plan = generateExecutionPlan("Birthday Invitation", "GOOD_PLAN");

  const validation = validateExecutionPlan(plan);

  assert.equal(validation.valid, true);
  assert.equal(validation.reason, null);

  assert.equal(plan.version, 1);
  assert.ok(Array.isArray(plan.tasks));
  assert.ok(plan.tasks.length > 0);
});

test("plan without acceptance criteria fails validation", () => {
  const plan = generateExecutionPlan(
    "Birthday Invitation",
    "MISSING_ACCEPTANCE_CRITERIA",
  );

  const validation = validateExecutionPlan(plan);

  assert.equal(validation.valid, false);
  assert.equal(validation.reason, "ACCEPTANCE_CRITERIA_MISSING");
});