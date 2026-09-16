import executeNextPlanTask from "./executeNextPlanTask.js";

const MAX_TASKS_PER_RUN = 10;

function findUnresolvedBlockingTask(state) {
  const tasks = state.executionPlan?.tasks ?? [];

  return tasks.find(
    (task) =>
      task.status === "FAILED" ||
      task.status === "WAITING_FOR_USER" ||
      task.status === "REVISION_REQUIRED",
  );
}

function findApprovalTask(state) {
  const tasks = state.executionPlan?.tasks ?? [];

  return tasks.find((task) => task.status === "AWAITING_APPROVAL");
}

function getBlockingStatus(task) {
  if (!task) {
    return null;
  }

  if (task.status === "FAILED") {
    return "STOPPED_ON_FAILURE";
  }

  if (task.status === "WAITING_FOR_USER") {
    return "WAITING_FOR_USER";
  }

  if (task.status === "REVISION_REQUIRED") {
    return "REVISION_REQUIRED";
  }

  return null;
}

async function runExecutionLoop(state, options = {}) {
  if (!state.executionPlan?.tasks?.length) {
    return {
      state,

      executionStatus: "NO_EXECUTION_PLAN",

      executedTaskIds: [],

      stoppedTaskId: null,
    };
  }

  const maxTasksPerRun = options.maxTasksPerRun ?? MAX_TASKS_PER_RUN;

  const executeNextTask = options.executeNextTask ?? executeNextPlanTask;

  let currentState = state;

  const executedTaskIds = [];

  for (let iteration = 0; iteration < maxTasksPerRun; iteration += 1) {
    const blockingTask = findUnresolvedBlockingTask(currentState);

    if (blockingTask) {
      return {
        state: currentState,

        executionStatus: getBlockingStatus(blockingTask),

        executedTaskIds,

        stoppedTaskId: blockingTask.id,
      };
    }

    const executionResult = await executeNextTask(currentState, options);

    currentState = executionResult.state;

    if (executionResult.executedTaskId) {
      executedTaskIds.push(executionResult.executedTaskId);
    }

    if (executionResult.executionStatus === "COMPLETE") {
      continue;
    }

    if (executionResult.executionStatus === "FAILED") {
      return {
        state: currentState,

        executionStatus: "STOPPED_ON_FAILURE",

        executedTaskIds,

        stoppedTaskId: executionResult.executedTaskId ?? null,
      };
    }

    if (executionResult.executionStatus === "WAITING_FOR_USER") {
      return {
        state: currentState,

        executionStatus: "WAITING_FOR_USER",

        executedTaskIds,

        stoppedTaskId: executionResult.executedTaskId ?? null,
      };
    }

    if (executionResult.executionStatus === "NO_EXECUTABLE_TASK") {
      const approvalTask = findApprovalTask(currentState);

      if (approvalTask) {
        return {
          state: currentState,

          executionStatus: "AWAITING_APPROVAL",

          executedTaskIds,

          stoppedTaskId: approvalTask.id,
        };
      }

      return {
        state: currentState,

        executionStatus: "NO_READY_TASKS",

        executedTaskIds,

        stoppedTaskId: null,
      };
    }

    if (executionResult.executionStatus === "NO_EXECUTION_PLAN") {
      return {
        state: currentState,

        executionStatus: "NO_EXECUTION_PLAN",

        executedTaskIds,

        stoppedTaskId: null,
      };
    }

    return {
      state: currentState,

      executionStatus: executionResult.executionStatus,

      executedTaskIds,

      stoppedTaskId: executionResult.executedTaskId ?? null,
    };
  }

  const nextReadyTask = currentState.executionPlan.tasks.find(
    (task) => task.status === "READY" && task.riskLevel === "SAFE_AUTOMATION",
  );

  return {
    state: currentState,

    executionStatus: "MAX_TASKS_REACHED",

    executedTaskIds,

    stoppedTaskId: nextReadyTask?.id ?? null,
  };
}

export default runExecutionLoop;