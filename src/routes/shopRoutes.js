import express from "express";

import runExecutionLoop from "../agent/runExecutionLoop.js";

import executeTaskMock from "../tools/executeTaskMock.js";

import generateExecutionPlan from "../tools/generateExecutionPlan.js";

import buildShopPlanResponse from "../utils/buildShopPlanResponse.js";

import applyShopApprovalDecision from "../state/applyShopApprovalDecision.js";

import attachApprovedRecoveryPackage from "../state/attachApprovedRecoveryPackage.js";

import applyTaskOutcome from "../state/applyTaskOutcome.js";

import { shopPlans } from "../state/sessionStore.js";

import {
  attachPendingApprovalProposal,
  createStoredShopPlan,
} from "../state/shopPlanSession.js";

import buildEtsyPlanningResult from "../integrations/etsy/buildEtsyPlanningResult.js";

const router = express.Router();

function getShopExecutionMessage(executionStatus) {
  if (executionStatus === "AWAITING_APPROVAL") {
    return "All safe shop tasks are complete. Approval is required before protected changes can continue.";
  }

  if (executionStatus === "STOPPED_ON_FAILURE") {
    return "Shop execution stopped because a task failed.";
  }

  if (executionStatus === "WAITING_FOR_USER") {
    return "Shop execution paused because user input or review is required.";
  }

  if (executionStatus === "NO_READY_TASKS") {
    return "No ready safe shop tasks remain.";
  }

  if (executionStatus === "MAX_TASKS_REACHED") {
    return "Shop execution stopped after reaching the maximum task limit.";
  }

  return null;
}

// Create a weekly Etsy shop growth plan

router.post("/plan", (req, res) => {
  try {
    const shopData = req.body;

    if (!shopData || typeof shopData !== "object") {
      return res.status(400).json({
        error: "SHOP_DATA_REQUIRED",
      });
    }

    if (!shopData.shopName || !String(shopData.shopName).trim()) {
      return res.status(400).json({
        error: "SHOP_NAME_REQUIRED",
      });
    }

    if (!Array.isArray(shopData.listings) || shopData.listings.length === 0) {
      return res.status(400).json({
        error: "SHOP_LISTINGS_REQUIRED",
      });
    }

    const normalizedShopData = {
      shopName: String(shopData.shopName).trim(),

      weeklyAvailableMinutes:
        typeof shopData.weeklyAvailableMinutes === "number"
          ? shopData.weeklyAvailableMinutes
          : null,

      listings: shopData.listings,
    };

    const plan = generateExecutionPlan(normalizedShopData);

    const storedPlan = createStoredShopPlan({
      shopData: normalizedShopData,
      executionPlan: plan,
    });

    if (!storedPlan.valid) {
      return res.status(422).json({
        error: "INVALID_SHOP_PLAN",
        reason: storedPlan.reason,
      });
    }

    return res.json(storedPlan.response);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "SHOP_PLAN_FAILED",
    });
  }
});

// Execute safe tasks from an existing shop growth plan

router.post("/execute", async (req, res) => {
  try {
    const { shopPlanId } = req.body;

    if (!shopPlanId) {
      return res.status(400).json({
        error: "SHOP_PLAN_ID_REQUIRED",
      });
    }

    const state = shopPlans.get(shopPlanId);

    if (!state) {
      return res.status(404).json({
        error: "SHOP_PLAN_NOT_FOUND",

        shopPlanId,
      });
    }

    if (!state.executionPlan?.tasks?.length) {
      return res.status(409).json({
        error: "NO_SHOP_EXECUTION_PLAN",
      });
    }

    /*
     * Shop Execution V2 is intentionally mock-only.
     *
     * Even if USE_REAL_EXECUTION_AI=true,
     * this endpoint must remain FREE until the
     * real shop executor is implemented and tested.
     */

    const executionResult = await runExecutionLoop(state, {
      executeTask: executeTaskMock,
    });

    const stateWithProposal =
      executionResult.executionStatus === "AWAITING_APPROVAL"
        ? attachPendingApprovalProposal(executionResult.state)
        : executionResult.state;

    shopPlans.set(shopPlanId, stateWithProposal);

    return res.json({
      ...buildShopPlanResponse(shopPlanId, stateWithProposal),

      executionStatus: executionResult.executionStatus,

      executedTaskIds: executionResult.executedTaskIds ?? [],

      stoppedTaskId: executionResult.stoppedTaskId ?? null,

      message: getShopExecutionMessage(executionResult.executionStatus),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "SHOP_EXECUTION_FAILED",
    });
  }
});

// Approve or reject a protected shop task

router.post("/approval", (req, res) => {
  try {
    const { shopPlanId, taskId, decision } = req.body;

    if (!shopPlanId) {
      return res.status(400).json({
        error: "SHOP_PLAN_ID_REQUIRED",
      });
    }

    if (!taskId) {
      return res.status(400).json({
        error: "SHOP_TASK_ID_REQUIRED",
      });
    }

    if (decision !== "APPROVE" && decision !== "REJECT") {
      return res.status(400).json({
        error: "INVALID_APPROVAL_DECISION",
      });
    }

    const state = shopPlans.get(shopPlanId);

    if (!state) {
      return res.status(404).json({
        error: "SHOP_PLAN_NOT_FOUND",

        shopPlanId,
      });
    }

    let updatedState;

    try {
      updatedState = applyShopApprovalDecision(state, taskId, decision);
    } catch (error) {
      if (error.message === "SHOP_APPROVAL_TASK_NOT_FOUND") {
        return res.status(404).json({
          error: error.message,
        });
      }

      if (
        error.message === "TASK_DOES_NOT_REQUIRE_APPROVAL" ||
        error.message === "TASK_NOT_AWAITING_APPROVAL" ||
        error.message === "APPROVAL_PROPOSAL_MISSING"
      ) {
        return res.status(409).json({
          error: error.message,
        });
      }

      throw error;
    }

    if (decision === "APPROVE") {
      updatedState = attachApprovedRecoveryPackage(updatedState, taskId);
    }

    shopPlans.set(shopPlanId, updatedState);

    const approved = decision === "APPROVE";

    return res.json({
      ...buildShopPlanResponse(shopPlanId, updatedState),

      approvalDecision: decision,

      taskId,

      message: approved
        ? "The proposed protected action was approved. No Etsy changes have been made yet."
        : "The proposed protected action was rejected. No Etsy changes were made.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "SHOP_APPROVAL_FAILED",
    });
  }
});

// Record or update the outcome of a completed shop task

router.post("/outcome", (req, res) => {
  try {
    const { shopPlanId, taskId, outcome } = req.body;

    if (!shopPlanId) {
      return res.status(400).json({
        error: "SHOP_PLAN_ID_REQUIRED",
      });
    }

    if (!taskId) {
      return res.status(400).json({
        error: "OUTCOME_TASK_ID_REQUIRED",
      });
    }

    if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) {
      return res.status(400).json({
        error: "OUTCOME_INPUT_REQUIRED",
      });
    }

    const state = shopPlans.get(shopPlanId);

    if (!state) {
      return res.status(404).json({
        error: "SHOP_PLAN_NOT_FOUND",
        shopPlanId,
      });
    }

    let updatedState;

    try {
      updatedState = applyTaskOutcome(state, taskId, outcome);
    } catch (error) {
      if (error.message === "OUTCOME_TASK_NOT_FOUND") {
        return res.status(404).json({
          error: error.message,
        });
      }

      if (
        error.message === "OUTCOME_TASK_NOT_COMPLETE" ||
        error.message === "EXECUTION_PLAN_NOT_FOUND"
      ) {
        return res.status(409).json({
          error: error.message,
        });
      }

      if (
        error.message === "OUTCOME_INPUT_REQUIRED" ||
        error.message === "INVALID_OUTCOME_RESULT" ||
        error.message === "INVALID_OUTCOME_MEASUREMENT" ||
        error.message === "INCOMPLETE_OUTCOME_MEASUREMENT"
      ) {
        return res.status(400).json({
          error: error.message,
        });
      }

      throw error;
    }

    shopPlans.set(shopPlanId, updatedState);

    return res.json({
      ...buildShopPlanResponse(shopPlanId, updatedState),

      taskId,

      message: "Task outcome was recorded successfully.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "OUTCOME_RECORDING_FAILED",
    });
  }
});

// Build a shop growth plan from normalized Etsy data and seller-provided evidence

router.post("/etsy/plan", (req, res) => {
  try {
    const {
      snapshot,
      sellerInputs = [],
      weeklyAvailableMinutes = null,
    } = req.body ?? {};

    const result = buildEtsyPlanningResult({
      snapshot,
      sellerInputs,
      weeklyAvailableMinutes,
    });

    if (result.missingEvidence.length > 0) {
      return res.json({
        ...result,
        sessionPlan: null,
      });
    }

    const storedPlan = createStoredShopPlan({
      shopData: result.shopData,
      executionPlan: result.plan,
    });

    if (!storedPlan.valid) {
      return res.status(422).json({
        error: "INVALID_SHOP_PLAN",
        reason: storedPlan.reason,
      });
    }

    return res.json({
      ...result,
      sessionPlan: storedPlan.response,
    });
  } catch (error) {
    const errorMessages = {
      INVALID_ETSY_SNAPSHOT: "The Etsy snapshot is missing or invalid.",

      INVALID_SELLER_INPUTS: "Seller inputs must be provided as an array.",

      SELLER_LISTING_NOT_FOUND:
        "Seller input references a listing that does not exist in the Etsy snapshot.",

      INVALID_WEEKLY_AVAILABLE_MINUTES:
        "Weekly available minutes must be a non-negative number.",

      INVALID_PERIOD_VIEWS: "Period views must be a non-negative number.",
    };

    if (errorMessages[error.message]) {
      return res.status(400).json({
        error: error.message,
        message: errorMessages[error.message],
      });
    }

    console.error(error);

    return res.status(500).json({
      error: "ETSY_PLANNING_FAILED",
      message: "Lighthouse could not build the Etsy planning result.",
    });
  }
});

export default router;
