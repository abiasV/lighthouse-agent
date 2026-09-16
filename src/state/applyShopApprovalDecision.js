const SUPPORTED_DECISIONS = new Set(["APPROVE", "REJECT"]);

function applyShopApprovalDecision(state, taskId, decision) {
  if (!state?.executionPlan?.tasks?.length) {
    throw new Error("NO_SHOP_EXECUTION_PLAN");
  }

  if (!SUPPORTED_DECISIONS.has(decision)) {
    throw new Error("INVALID_APPROVAL_DECISION");
  }

  const taskIndex = state.executionPlan.tasks.findIndex(
    (task) => task.id === taskId,
  );

  if (taskIndex === -1) {
    throw new Error("SHOP_APPROVAL_TASK_NOT_FOUND");
  }

  const task = state.executionPlan.tasks[taskIndex];

  if (task.riskLevel !== "APPROVAL_REQUIRED") {
    throw new Error("TASK_DOES_NOT_REQUIRE_APPROVAL");
  }

  if (task.status !== "AWAITING_APPROVAL") {
    throw new Error("TASK_NOT_AWAITING_APPROVAL");
  }

  if (!task.approval?.proposal) {
    throw new Error("APPROVAL_PROPOSAL_MISSING");
  }

  const approvalStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";

  const updatedTask = {
    ...task,

    status: approvalStatus,

    approval: {
      ...task.approval,

      status: approvalStatus,

      decision,

      decidedAt: new Date().toISOString(),
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

export default applyShopApprovalDecision;