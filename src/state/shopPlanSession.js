import { randomUUID } from "node:crypto";

import { attachPendingApprovalProposal } from "./attachPendingApprovalProposal.js";
export { attachPendingApprovalProposal } from "./attachPendingApprovalProposal.js";

import validateExecutionPlan from "../utils/validateExecutionPlan.js";

import buildShopPlanResponse from "../utils/buildShopPlanResponse.js";

import { shopPlans } from "./sessionStore.js";

export function createStoredShopPlan({ shopData, executionPlan, pilotOwnerId }) {
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
    ...(pilotOwnerId ? { pilotOwnerId } : {}),
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
