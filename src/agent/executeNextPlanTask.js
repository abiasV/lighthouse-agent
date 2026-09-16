import runExecutionTask from "./runExecutionTask.js";

function getExecutionContext(state) {
  if (state.shopData) {
    return state.shopData;
  }

  return state.idea;
}

async function executeNextPlanTask(state, options = {}) {
  if (!state.executionPlan?.tasks?.length) {
    return {
      state,
      executionStatus: "NO_EXECUTION_PLAN",
    };
  }

  const taskIndex = state.executionPlan.tasks.findIndex(
    (task) => task.status === "READY" && task.riskLevel === "SAFE_AUTOMATION",
  );

  if (taskIndex === -1) {
    return {
      state,
      executionStatus: "NO_EXECUTABLE_TASK",
    };
  }

  const task = state.executionPlan.tasks[taskIndex];

  const executionContext = getExecutionContext(state);

  const updatedTask = await runExecutionTask(task, executionContext, options);

  const updatedTasks = [...state.executionPlan.tasks];

  updatedTasks[taskIndex] = updatedTask;

  const updatedState = {
    ...state,

    executionPlan: {
      ...state.executionPlan,
      tasks: updatedTasks,
    },
  };

  return {
    state: updatedState,
    executionStatus: updatedTask.status,
    executedTaskId: updatedTask.id,
  };
}

export default executeNextPlanTask;