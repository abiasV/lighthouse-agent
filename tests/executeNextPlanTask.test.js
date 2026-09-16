import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";
import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";
import executeNextPlanTask from "../src/agent/executeNextPlanTask.js";

function createStateWithExecutionPlan(idea = "Dog Training Course") {
  const state = createInitialState(idea);

  state.executionPlan = generateExecutionPlan(idea);

  return state;
}

test("executes the first ready safe automation task", async () => {
  const state = createStateWithExecutionPlan();

  const result = await executeNextPlanTask(state);

  assert.equal(result.executionStatus, "COMPLETE");
  assert.equal(result.executedTaskId, "task_1");

  const executedTask = result.state.executionPlan.tasks[0];

  assert.equal(executedTask.status, "COMPLETE");
  assert.ok(executedTask.result);

  assert.equal(executedTask.verificationResults.length, 2);

  assert.equal(executedTask.verificationResults[0].status, "PASSED");

  assert.equal(executedTask.verificationResults[1].status, "PASSED");
});

test("does not modify later plan tasks when executing the first task", async () => {
  const state = createStateWithExecutionPlan();

  const result = await executeNextPlanTask(state);

  const tasks = result.state.executionPlan.tasks;

  assert.equal(tasks[0].status, "COMPLETE");
  assert.equal(tasks[1].status, "READY");
  assert.equal(tasks[2].status, "AWAITING_APPROVAL");
});

test("stores a failed verification result in the execution plan", async () => {
  const state = createStateWithExecutionPlan();

  const result = await executeNextPlanTask(state, {
    scenario: "TOO_FEW_KEYWORDS",
  });

  assert.equal(result.executionStatus, "FAILED");
  assert.equal(result.executedTaskId, "task_1");

  const executedTask = result.state.executionPlan.tasks[0];

  assert.equal(executedTask.status, "FAILED");

  assert.equal(executedTask.failureReason, "VERIFICATION_FAILED");

  assert.equal(executedTask.verificationResults[0].status, "FAILED");
});

test("returns NO_EXECUTION_PLAN when the state has no execution plan", async () => {
  const state = createInitialState("Dog Training Course");

  const result = await executeNextPlanTask(state);

  assert.equal(result.executionStatus, "NO_EXECUTION_PLAN");

  assert.equal(result.executedTaskId, undefined);
  assert.equal(result.state, state);
});

test("returns NO_EXECUTABLE_TASK when no ready safe task exists", async () => {
  const state = createStateWithExecutionPlan();

  state.executionPlan.tasks[0].status = "COMPLETE";
  state.executionPlan.tasks[1].status = "COMPLETE";

  const result = await executeNextPlanTask(state);

  assert.equal(result.executionStatus, "NO_EXECUTABLE_TASK");

  assert.equal(result.executedTaskId, undefined);

  assert.equal(result.state.executionPlan.tasks[2].status, "AWAITING_APPROVAL");
});