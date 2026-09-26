import buildShopApprovalProposalMock from "../tools/buildShopApprovalProposalMock.js";

export function attachPendingApprovalProposal(state) {
  const tasks = state.executionPlan?.tasks ?? [];

  const taskIndex = tasks.findIndex(
    (task) =>
      task.status === "AWAITING_APPROVAL" &&
      task.riskLevel === "APPROVAL_REQUIRED",
  );

  if (taskIndex === -1) {
    return state;
  }

  const task = tasks[taskIndex];

  if (task.approval?.proposal) {
    return state;
  }

  const proposal = buildShopApprovalProposalMock(task, state.shopData);

  const updatedTask = {
    ...task,

    approval: {
      status: "PENDING",
      proposal,
    },
  };

  const updatedTasks = [...tasks];

  updatedTasks[taskIndex] = updatedTask;

  return {
    ...state,

    executionPlan: {
      ...state.executionPlan,
      tasks: updatedTasks,
    },
  };
}
