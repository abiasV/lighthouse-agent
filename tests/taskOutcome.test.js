import test from "node:test";
import assert from "node:assert/strict";

import applyTaskOutcome from "../src/state/applyTaskOutcome.js";

function createState(taskOverrides = {}) {
  return {
    executionPlan: {
      tasks: [
        {
          id: "task_1",
          title: "Improve listing copy",
          status: "COMPLETE",
          ...taskOverrides,
        },
      ],
    },
  };
}

function getTask(state) {
  return state.executionPlan.tasks.find((task) => task.id === "task_1");
}

test("records a positive outcome on a complete task", () => {
  const state = createState();

  const updatedState = applyTaskOutcome(state, "task_1", {
    result: "POSITIVE",
    note: "The listing performed better after the change.",
    measurement: {
      metric: "Conversion rate",
      before: "1.4%",
      after: "2.0%",
    },
  });

  const task = getTask(updatedState);

  assert.equal(task.outcome.status, "RECORDED");

  assert.equal(task.outcome.result, "POSITIVE");

  assert.equal(
    task.outcome.note,
    "The listing performed better after the change.",
  );

  assert.deepEqual(task.outcome.measurement, {
    metric: "Conversion rate",
    before: "1.4%",
    after: "2.0%",
  });

  assert.ok(task.outcome.recordedAt);
});

test("allows an outcome without note or measurement", () => {
  const state = createState();

  const updatedState = applyTaskOutcome(state, "task_1", {
    result: "NEUTRAL",
  });

  const task = getTask(updatedState);

  assert.equal(task.outcome.result, "NEUTRAL");

  assert.equal(task.outcome.note, null);

  assert.equal(task.outcome.measurement, null);
});

test("normalizes blank optional values", () => {
  const state = createState();

  const updatedState = applyTaskOutcome(state, "task_1", {
    result: "NEGATIVE",
    note: "   ",
    measurement: {
      metric: "   ",
      before: "",
      after: "   ",
    },
  });

  const task = getTask(updatedState);

  assert.equal(task.outcome.note, null);

  assert.equal(task.outcome.measurement, null);
});

test("rejects an invalid outcome result", () => {
  const state = createState();

  assert.throws(
    () =>
      applyTaskOutcome(state, "task_1", {
        result: "BETTER",
      }),
    {
      message: "INVALID_OUTCOME_RESULT",
    },
  );
});

test("rejects outcome recording for an incomplete task", () => {
  const state = createState({
    status: "READY",
  });

  assert.throws(
    () =>
      applyTaskOutcome(state, "task_1", {
        result: "POSITIVE",
      }),
    {
      message: "OUTCOME_TASK_NOT_COMPLETE",
    },
  );
});

test("rejects a missing task", () => {
  const state = createState();

  assert.throws(
    () =>
      applyTaskOutcome(state, "missing_task", {
        result: "POSITIVE",
      }),
    {
      message: "OUTCOME_TASK_NOT_FOUND",
    },
  );
});

test("rejects a partially completed measurement", () => {
  const state = createState();

  assert.throws(
    () =>
      applyTaskOutcome(state, "task_1", {
        result: "POSITIVE",
        measurement: {
          metric: "Conversion rate",
          before: "1.4%",
        },
      }),
    {
      message: "INCOMPLETE_OUTCOME_MEASUREMENT",
    },
  );
});

test("allows an existing outcome to be updated", () => {
  const state = createState({
    outcome: {
      status: "RECORDED",
      result: "NEUTRAL",
      note: null,
      measurement: null,
      recordedAt: "2026-01-01T00:00:00.000Z",
    },
  });

  const updatedState = applyTaskOutcome(state, "task_1", {
    result: "POSITIVE",
    note: "Performance improved after more data was collected.",
    measurement: {
      metric: "Conversion rate",
      before: "1.4%",
      after: "2.2%",
    },
  });

  const task = getTask(updatedState);

  assert.equal(task.outcome.result, "POSITIVE");

  assert.equal(
    task.outcome.note,
    "Performance improved after more data was collected.",
  );

  assert.deepEqual(task.outcome.measurement, {
    metric: "Conversion rate",
    before: "1.4%",
    after: "2.2%",
  });

  assert.notEqual(task.outcome.recordedAt, "2026-01-01T00:00:00.000Z");
});

test("does not mutate the original state", () => {
  const state = createState();

  const updatedState = applyTaskOutcome(state, "task_1", {
    result: "POSITIVE",
  });

  assert.notEqual(updatedState, state);

  assert.notEqual(updatedState.executionPlan, state.executionPlan);

  assert.notEqual(updatedState.executionPlan.tasks, state.executionPlan.tasks);

  assert.equal(getTask(state).outcome, undefined);
});