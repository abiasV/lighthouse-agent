import test from "node:test";
import assert from "node:assert/strict";

import createInitialState from "../src/state/createInitialState.js";
import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";
import runExecutionLoop from "../src/agent/runExecutionLoop.js";
import executeTaskReal from "../src/tools/executeTaskReal.js";

function createStateWithExecutionPlan(idea = "Dog Training Course") {
  const state = createInitialState(idea);

  state.executionPlan = generateExecutionPlan(idea);

  return state;
}

test("executes all ready safe tasks and stops at approval boundary", async () => {
  const state = createStateWithExecutionPlan();

  const result = await runExecutionLoop(state);

  assert.equal(result.executionStatus, "AWAITING_APPROVAL");

  assert.deepEqual(result.executedTaskIds, ["task_1", "task_2"]);

  assert.equal(result.stoppedTaskId, "task_3");

  const tasks = result.state.executionPlan.tasks;

  assert.equal(tasks[0].status, "COMPLETE");
  assert.equal(tasks[1].status, "COMPLETE");
  assert.equal(tasks[2].status, "AWAITING_APPROVAL");

  assert.equal(tasks[0].verificationResults.length, 2);

  assert.equal(tasks[1].verificationResults.length, 2);
});

test("stops the loop when a later safe task fails", async () => {
  const state = createStateWithExecutionPlan();

  const result = await runExecutionLoop(state, {
    scenario: "MISSING_PRODUCT_DESCRIPTION",
  });

  assert.equal(result.executionStatus, "STOPPED_ON_FAILURE");

  assert.deepEqual(result.executedTaskIds, ["task_1", "task_2"]);

  assert.equal(result.stoppedTaskId, "task_2");

  const tasks = result.state.executionPlan.tasks;

  assert.equal(tasks[0].status, "COMPLETE");
  assert.equal(tasks[1].status, "FAILED");
  assert.equal(tasks[1].failureReason, "VERIFICATION_FAILED");

  assert.equal(tasks[2].status, "AWAITING_APPROVAL");
});

test("does not continue past an existing failed task", async () => {
  const state = createStateWithExecutionPlan();

  state.executionPlan.tasks[0].status = "FAILED";
  state.executionPlan.tasks[0].failureReason = "VERIFICATION_FAILED";

  const result = await runExecutionLoop(state);

  assert.equal(result.executionStatus, "STOPPED_ON_FAILURE");

  assert.deepEqual(result.executedTaskIds, []);

  assert.equal(result.stoppedTaskId, "task_1");

  assert.equal(result.state.executionPlan.tasks[1].status, "READY");
});

test("returns NO_READY_TASKS when no safe task or blocking task exists", async () => {
  const state = createStateWithExecutionPlan();

  state.executionPlan.tasks[0].status = "COMPLETE";
  state.executionPlan.tasks[1].status = "COMPLETE";
  state.executionPlan.tasks[2].status = "COMPLETE";

  const result = await runExecutionLoop(state);

  assert.equal(result.executionStatus, "NO_READY_TASKS");

  assert.deepEqual(result.executedTaskIds, []);
  assert.equal(result.stoppedTaskId, null);
});

test("stops when the maximum task iteration limit is reached", async () => {
  const state = createStateWithExecutionPlan();

  async function executeWithoutProgress(currentState) {
    return {
      state: currentState,
      executionStatus: "COMPLETE",
      executedTaskId: "task_1",
    };
  }

  const result = await runExecutionLoop(state, {
    maxTasksPerRun: 2,
    executeNextTask: executeWithoutProgress,
  });

  assert.equal(result.executionStatus, "MAX_TASKS_REACHED");

  assert.deepEqual(result.executedTaskIds, ["task_1", "task_1"]);

  assert.equal(result.stoppedTaskId, "task_1");
});

test("execution loop can use the real executor contract with a fake OpenAI client", async () => {
  const state = createStateWithExecutionPlan();

  const fakeClient = {
    responses: {
      async create(options) {
        if (
          options.instructions.includes(
            "Generate purchase-intent keyword candidates",
          )
        ) {
          return {
            output_text: JSON.stringify({
              keywords: [
                "dog training course",
                "online dog training course",
                "best dog training course",
                "dog training course for beginners",
                "puppy training course",
                "dog obedience course",
                "dog training classes online",
                "dog behavior training course",
                "home dog training program",
                "professional dog training course",
              ],
            }),
          };
        }

        if (options.instructions.includes("Create concise product copy")) {
          return {
            output_text: JSON.stringify({
              title: "Dog Training Course - Beginner Guide",

              description:
                "A practical dog training course designed to help beginners build better everyday training habits.",

              keyBenefits: [
                "Beginner friendly",
                "Practical exercises",
                "Easy-to-follow guidance",
              ],
            }),
          };
        }

        throw new Error("UNEXPECTED_FAKE_OPENAI_REQUEST");
      },
    },
  };

  async function realExecutorWithFakeClient(task, idea, scenario) {
    return executeTaskReal(task, idea, scenario, fakeClient);
  }

  const result = await runExecutionLoop(state, {
    executeTask: realExecutorWithFakeClient,
  });

  assert.equal(result.executionStatus, "AWAITING_APPROVAL");

  assert.deepEqual(result.executedTaskIds, ["task_1", "task_2"]);

  assert.equal(result.stoppedTaskId, "task_3");

  const tasks = result.state.executionPlan.tasks;

  assert.equal(tasks[0].status, "COMPLETE");

  assert.equal(tasks[0].result.type, "KEYWORD_RESEARCH");

  assert.equal(tasks[0].result.keywords.length, 10);

  assert.equal(tasks[0].verificationResults[0].status, "PASSED");

  assert.equal(tasks[0].verificationResults[1].status, "PASSED");

  assert.equal(tasks[1].status, "COMPLETE");

  assert.equal(tasks[1].result.type, "PRODUCT_COPY");

  assert.ok(tasks[1].result.title);

  assert.ok(tasks[1].result.description);

  assert.equal(tasks[1].verificationResults[0].status, "PASSED");

  assert.equal(tasks[1].verificationResults[1].status, "PASSED");

  assert.equal(tasks[2].status, "AWAITING_APPROVAL");
});

test("executes only one safe task when the execution budget is limited to one task", async () => {
  const state = createStateWithExecutionPlan();

  const result = await runExecutionLoop(state, {
    maxTasksPerRun: 1,
  });

  assert.equal(
    result.executionStatus,
    "MAX_TASKS_REACHED",
  );

  assert.deepEqual(
    result.executedTaskIds,
    ["task_1"],
  );

  assert.equal(
    result.stoppedTaskId,
    "task_2",
  );

  const tasks = result.state.executionPlan.tasks;

  assert.equal(
    tasks[0].status,
    "COMPLETE",
  );

  assert.equal(
    tasks[1].status,
    "READY",
  );

  assert.equal(
    tasks[2].status,
    "AWAITING_APPROVAL",
  );
});