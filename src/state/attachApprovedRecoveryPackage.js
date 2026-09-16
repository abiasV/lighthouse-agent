function attachApprovedRecoveryPackage(state, taskId) {
  if (!state?.executionPlan?.tasks?.length) {
    throw new Error("NO_SHOP_EXECUTION_PLAN");
  }

  const taskIndex = state.executionPlan.tasks.findIndex(
    (task) => task.id === taskId,
  );

  if (taskIndex === -1) {
    throw new Error("SHOP_RECOVERY_TASK_NOT_FOUND");
  }

  const task = state.executionPlan.tasks[taskIndex];

  if (task.opportunityType !== "IMPROVE_CONVERSION") {
    return state;
  }

  if (task.status !== "APPROVED") {
    throw new Error("SHOP_RECOVERY_TASK_NOT_APPROVED");
  }

  if (!task.approval?.proposal) {
    throw new Error("APPROVED_RECOVERY_PROPOSAL_MISSING");
  }

  if (task.approvedRecovery) {
    return state;
  }

  const proposal = task.approval.proposal;

  const changes = (proposal.proposedChanges ?? []).map((change) => ({
    field: change.field,

    currentValue: change.currentValue ?? null,

    approvedValue: change.proposedValue,

    reason: change.reason,
  }));

  const approvedRecovery = {
    status: "READY_FOR_MANUAL_APPLICATION",

    applicationMode: "MANUAL",

    source: "APPROVED_PROPOSAL",

    listingId: proposal.listingId,

    listingTitle: proposal.listingTitle,

    changes,

    safeguards: {
      didModifyShop: false,

      externalSpend: 0,
    },

    preparedAt: new Date().toISOString(),
  };

  const updatedTask = {
    ...task,

    approvedRecovery,
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

export default attachApprovedRecoveryPackage;