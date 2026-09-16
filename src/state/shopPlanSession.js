import { randomUUID } from "node:crypto";

import buildShopApprovalProposalMock from "../tools/buildShopApprovalProposalMock.js";

import validateExecutionPlan from "../utils/validateExecutionPlan.js";

import buildShopPlanResponse from "../utils/buildShopPlanResponse.js";

import { shopPlans } from "./sessionStore.js";

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

export function createStoredShopPlan({ shopData, executionPlan }) {
  const validation = validateExecutionPlan(executionPlan);

  if (!validation.valid) {
    return {
      valid: false,
      reason: validation.reason,
      shopPlanId: null,
      state: null,
      response: null,
    };
  }

  const shopPlanId = randomUUID();

  const state = {
    shopData,
    executionPlan,
  };

  const stateWithProposal = attachPendingApprovalProposal(state);

  shopPlans.set(shopPlanId, stateWithProposal);

  return {
    valid: true,
    reason: null,
    shopPlanId,
    state: stateWithProposal,
    response: buildShopPlanResponse(shopPlanId, stateWithProposal),
  };
}