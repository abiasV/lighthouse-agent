import executeExternalDelegationMock from "../tools/executeExternalDelegationMock.js";
import verifyExternalDelegationResult from "../utils/verifyExternalDelegationResult.js";

const SUPPORTED_DELIVERY_STATUSES = new Set(["APPROVED", "REVISION_REQUIRED"]);

async function applyExternalDelegationDelivery(
  state,
  taskId,
  scenario = "GOOD_DELIVERABLE",
  options = {},
) {
  if (!state?.executionPlan?.tasks?.length) {
    throw new Error("NO_EXECUTION_PLAN");
  }

  const taskIndex = state.executionPlan.tasks.findIndex(
    (task) => task.id === taskId,
  );

  if (taskIndex === -1) {
    throw new Error("DELEGATION_TASK_NOT_FOUND");
  }

  const task = state.executionPlan.tasks[taskIndex];

  if (task.executorType !== "EXTERNAL") {
    throw new Error("TASK_IS_NOT_EXTERNAL");
  }

  if (!SUPPORTED_DELIVERY_STATUSES.has(task.status)) {
    throw new Error("DELEGATION_NOT_READY_FOR_DELIVERY");
  }

  if (!task.delegation?.brief) {
    throw new Error("DELEGATION_BRIEF_REQUIRED");
  }

  const executeExternalTask =
    options.executeExternalTask ?? executeExternalDelegationMock;

  const result = await executeExternalTask(task, scenario);

  const verificationResults = verifyExternalDelegationResult(task, result);

  const failedCriteria = verificationResults.filter(
    (verification) => verification.status === "FAILED",
  );

  const verificationPassed = failedCriteria.length === 0;

  const updatedTask = {
    ...task,

    status: verificationPassed ? "COMPLETE" : "REVISION_REQUIRED",

    result,

    verificationResults,

    delegation: {
      ...task.delegation,

      status: verificationPassed ? "COMPLETE" : "REVISION_REQUIRED",

      delivery: {
        source: result.source ?? "UNKNOWN",

        scenario,

        receivedAt: new Date().toISOString(),

        result,

        verificationPassed,

        failedCriteria: failedCriteria.map((criterion) => ({
          description: criterion.description,

          reason: criterion.reason,
        })),

        nextAction: verificationPassed ? null : "REVISION_REQUIRED",
      },
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

export default applyExternalDelegationDelivery;