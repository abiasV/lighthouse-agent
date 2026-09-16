import test from "node:test";
import assert from "node:assert/strict";

import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";
import runExecutionTask from "../src/agent/runExecutionTask.js";

test("safe AI task completes when all verification criteria pass", async () => {
  const plan = generateExecutionPlan("Dog Training Course");

  const task = plan.tasks[0];

  const result = await runExecutionTask(task, "Dog Training Course", {
    scenario: "GOOD_OUTPUT",
  });

  assert.equal(result.status, "COMPLETE");

  assert.ok(result.result);

  assert.equal(result.verificationResults.length, 2);

  assert.equal(result.verificationResults[0].status, "PASSED");

  assert.equal(result.verificationResults[1].status, "PASSED");
});

test("task fails when deterministic verification fails", async () => {
  const plan = generateExecutionPlan("Dog Training Course");

  const task = plan.tasks[0];

  const result = await runExecutionTask(task, "Dog Training Course", {
    scenario: "TOO_FEW_KEYWORDS",
  });

  assert.equal(result.status, "FAILED");

  assert.equal(result.failureReason, "VERIFICATION_FAILED");

  assert.equal(result.verificationResults[0].status, "FAILED");

  assert.equal(result.verificationResults[1].status, "PASSED");
});

test("task fails when AI evaluation rejects the output", async () => {
  const plan = generateExecutionPlan("Dog Training Course");

  const task = plan.tasks[0];

  const result = await runExecutionTask(task, "Dog Training Course", {
    scenario: "IRRELEVANT_KEYWORDS",
  });

  assert.equal(result.status, "FAILED");

  assert.equal(result.failureReason, "VERIFICATION_FAILED");

  assert.equal(result.verificationResults[0].status, "PASSED");

  assert.equal(result.verificationResults[1].status, "FAILED");
});

test("product copy task completes when title and description are provided", async () => {
  const plan = generateExecutionPlan("Dog Training Course");

  const task = plan.tasks[1];

  const result = await runExecutionTask(task, "Dog Training Course", {
    scenario: "GOOD_OUTPUT",
  });

  assert.equal(result.status, "COMPLETE");

  assert.ok(result.result);

  assert.equal(result.result.type, "PRODUCT_COPY");

  assert.ok(result.result.title);

  assert.ok(result.result.description);

  assert.equal(result.verificationResults.length, 2);

  assert.equal(result.verificationResults[0].status, "PASSED");

  assert.equal(result.verificationResults[1].status, "PASSED");
});

test("product copy task fails when description verification fails", async () => {
  const plan = generateExecutionPlan("Dog Training Course");

  const task = plan.tasks[1];

  const result = await runExecutionTask(task, "Dog Training Course", {
    scenario: "MISSING_PRODUCT_DESCRIPTION",
  });

  assert.equal(result.status, "FAILED");

  assert.equal(result.failureReason, "VERIFICATION_FAILED");

  assert.ok(result.result);

  assert.equal(result.result.type, "PRODUCT_COPY");

  assert.ok(result.result.title);

  assert.equal(result.result.description, "");

  assert.equal(result.verificationResults[0].status, "PASSED");

  assert.equal(result.verificationResults[1].status, "FAILED");
});

test("money-required task is not automatically executed", async () => {
  const plan = generateExecutionPlan("Dog Training Course");

  const task = plan.tasks[2];

  const result = await runExecutionTask(task, "Dog Training Course");

  assert.equal(result.status, "AWAITING_APPROVAL");

  assert.equal(result.failureReason, "AUTOMATION_NOT_ALLOWED_FOR_RISK_LEVEL");

  assert.equal(result.result, undefined);
});

test("uses an injected executor when provided", async () => {
  const plan = generateExecutionPlan("Dog Training Course");

  const task = plan.tasks[0];

  let injectedExecutorWasCalled = false;

  async function injectedExecutor(receivedTask, idea) {
    injectedExecutorWasCalled = true;

    assert.equal(receivedTask.id, "task_1");
    assert.equal(receivedTask.status, "IN_PROGRESS");
    assert.equal(idea, "Dog Training Course");

    return {
      type: "KEYWORD_RESEARCH",
      idea,
      keywords: [
        "dog training course",
        "dog training course online",
        "dog training course beginner",
        "dog training course at home",
        "dog training course guide",
        "dog training course lessons",
        "dog training course program",
        "dog training course basics",
        "best dog training course",
        "dog training course tips",
      ],
    };
  }

  const result = await runExecutionTask(task, "Dog Training Course", {
    executeTask: injectedExecutor,
  });

  assert.equal(injectedExecutorWasCalled, true);

  assert.equal(result.status, "COMPLETE");

  assert.equal(result.result.type, "KEYWORD_RESEARCH");

  assert.equal(result.result.keywords.length, 10);

  assert.equal(result.verificationResults[0].status, "PASSED");

  assert.equal(result.verificationResults[1].status, "PASSED");
});