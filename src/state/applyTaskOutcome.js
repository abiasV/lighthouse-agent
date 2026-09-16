const VALID_OUTCOME_RESULTS = new Set(["POSITIVE", "NEUTRAL", "NEGATIVE"]);

function normalizeOptionalText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();

  return normalizedValue || null;
}

function normalizeMeasurement(measurement) {
  if (measurement === null || measurement === undefined) {
    return null;
  }

  if (typeof measurement !== "object" || Array.isArray(measurement)) {
    throw new Error("INVALID_OUTCOME_MEASUREMENT");
  }

  const metric = normalizeOptionalText(measurement.metric);
  const before = normalizeOptionalText(measurement.before);
  const after = normalizeOptionalText(measurement.after);

  const hasAnyMeasurementValue = Boolean(metric || before || after);
  const hasCompleteMeasurement = Boolean(metric && before && after);

  if (!hasAnyMeasurementValue) {
    return null;
  }

  if (!hasCompleteMeasurement) {
    throw new Error("INCOMPLETE_OUTCOME_MEASUREMENT");
  }

  return {
    metric,
    before,
    after,
  };
}

function applyTaskOutcome(state, taskId, outcomeInput) {
  if (
    !state?.executionPlan?.tasks ||
    !Array.isArray(state.executionPlan.tasks)
  ) {
    throw new Error("EXECUTION_PLAN_NOT_FOUND");
  }

  if (!taskId) {
    throw new Error("OUTCOME_TASK_ID_REQUIRED");
  }

  const taskIndex = state.executionPlan.tasks.findIndex(
    (task) => task.id === taskId,
  );

  if (taskIndex === -1) {
    throw new Error("OUTCOME_TASK_NOT_FOUND");
  }

  const task = state.executionPlan.tasks[taskIndex];

  if (task.status !== "COMPLETE") {
    throw new Error("OUTCOME_TASK_NOT_COMPLETE");
  }

  if (
    !outcomeInput ||
    typeof outcomeInput !== "object" ||
    Array.isArray(outcomeInput)
  ) {
    throw new Error("OUTCOME_INPUT_REQUIRED");
  }

  const result = String(outcomeInput.result ?? "")
    .trim()
    .toUpperCase();

  if (!VALID_OUTCOME_RESULTS.has(result)) {
    throw new Error("INVALID_OUTCOME_RESULT");
  }

  const note = normalizeOptionalText(outcomeInput.note);
  const measurement = normalizeMeasurement(outcomeInput.measurement);

  const updatedTask = {
    ...task,

    outcome: {
      status: "RECORDED",
      result,
      note,
      measurement,
      recordedAt: new Date().toISOString(),
    },
  };

  const updatedTasks = [...state.executionPlan.tasks];

  updatedTasks[taskIndex] = updatedTask;

  return {
    ...state,

    executionPlan: {
      ...state.executionPlan,

      tasks: updatedTasks,
    },
  };
}

export default applyTaskOutcome;