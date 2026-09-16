import express from "express";
import { randomUUID } from "node:crypto";

import createInitialState from "../state/createInitialState.js";
import runAgent from "../agent/runAgent.js";
import applyUserInput from "../state/applyUserInput.js";
import runExecutionLoop from "../agent/runExecutionLoop.js";
import applyExternalDelegationDecision from "../state/applyExternalDelegationDecision.js";
import applyExternalDelegationDelivery from "../state/applyExternalDelegationDelivery.js";

import getExecutionTaskExecutor from "../tools/getExecutionTaskExecutor.js";

import buildAnalysisResponse from "../utils/buildAnalysisResponse.js";

import { analyses } from "../state/sessionStore.js";
import applyTaskOutcome from "../state/applyTaskOutcome.js";

const router = express.Router();

function getAgentRunOptions() {
  return {
    useRealDemand: false,
    useRealCompetition: false,
    useRealProfitability: true,
    useRealEffort: true,
    useRealScalability: true,
    sleepFn: async () => {},
  };
}

function getExecutionMessage(executionStatus) {
  if (executionStatus === "AWAITING_APPROVAL") {
    return "All safe tasks are complete. Approval is required before continuing.";
  }

  if (executionStatus === "STOPPED_ON_FAILURE") {
    return "Execution stopped because a task failed.";
  }

  if (executionStatus === "WAITING_FOR_USER") {
    return "Execution paused because user input or review is required.";
  }

  if (executionStatus === "REVISION_REQUIRED") {
    return "Execution is paused because an external deliverable requires revision.";
  }

  if (executionStatus === "NO_READY_TASKS") {
    return "No ready safe tasks remain.";
  }

  if (executionStatus === "MAX_TASKS_REACHED") {
    return "Execution stopped after reaching the maximum tasks allowed for one run.";
  }

  return null;
}

// Start a new Lighthouse opportunity analysis

router.post("/", async (req, res) => {
  try {
    const { idea } = req.body;

    if (!idea || !String(idea).trim()) {
      return res.status(400).json({
        error: "Idea is required.",
      });
    }

    let state = createInitialState(String(idea).trim());

    const analysisId = randomUUID();

    state = await runAgent(state, getAgentRunOptions());

    analyses.set(analysisId, state);

    return res.json(buildAnalysisResponse(analysisId, state));
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Analysis failed.",
    });
  }
});

// Continue an existing Lighthouse opportunity analysis

router.post("/input", async (req, res) => {
  try {
    const { analysisId, value } = req.body;

    if (!analysisId) {
      return res.status(400).json({
        error: "analysisId is required.",
      });
    }

    const state = analyses.get(analysisId);

    if (!state) {
      return res.status(404).json({
        error: "Analysis not found.",
      });
    }

    let updatedState = applyUserInput(state, value);

    updatedState = await runAgent(updatedState, getAgentRunOptions());

    analyses.set(analysisId, updatedState);

    return res.json(buildAnalysisResponse(analysisId, updatedState));
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to continue analysis.",
    });
  }
});

// Run safe execution tasks for an opportunity analysis

router.post("/execute", async (req, res) => {
  try {
    const { analysisId } = req.body;

    if (!analysisId) {
      return res.status(400).json({
        error: "ANALYSIS_ID_REQUIRED",
      });
    }

    const state = analyses.get(analysisId);

    if (!state) {
      return res.status(404).json({
        error: "ANALYSIS_NOT_FOUND",

        analysisId,
      });
    }

    if (state.agentStatus === "RUNNING" || state.agentStatus === "PAUSED") {
      return res.status(409).json({
        error: "VALIDATION_NOT_COMPLETE",

        currentStatus: state.agentStatus,
      });
    }

    if (state.finalStatus !== "WORTH_TESTING" || !state.executionPlan) {
      return res.status(409).json({
        error: "NO_EXECUTION_PLAN",

        finalStatus: state.finalStatus,
      });
    }

    if (state.tasks.executionPlanning?.status !== "COMPLETE") {
      return res.status(409).json({
        error: "EXECUTION_PLAN_NOT_READY",

        planningStatus: state.tasks.executionPlanning?.status ?? null,
      });
    }

    const useRealExecutionAI = process.env.USE_REAL_EXECUTION_AI === "true";

    const executeTask = getExecutionTaskExecutor(useRealExecutionAI);

    const executionResult = await runExecutionLoop(state, {
      executeTask,

      maxTasksPerRun: useRealExecutionAI ? 1 : undefined,
    });

    analyses.set(analysisId, executionResult.state);

    return res.json({
      ...buildAnalysisResponse(analysisId, executionResult.state),

      executionStatus: executionResult.executionStatus,

      executedTaskIds: executionResult.executedTaskIds ?? [],

      stoppedTaskId: executionResult.stoppedTaskId ?? null,

      message: getExecutionMessage(executionResult.executionStatus),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "EXECUTION_FAILED",
    });
  }
});

// Approve or reject an external delegation task

router.post("/delegation/approval", (req, res) => {
  try {
    const { analysisId, taskId, decision, verifiedFacts } = req.body;

    if (!analysisId) {
      return res.status(400).json({
        error: "ANALYSIS_ID_REQUIRED",
      });
    }

    if (!taskId) {
      return res.status(400).json({
        error: "DELEGATION_TASK_ID_REQUIRED",
      });
    }

    if (decision !== "APPROVE" && decision !== "REJECT") {
      return res.status(400).json({
        error: "INVALID_DELEGATION_DECISION",
      });
    }

    if (
      decision === "APPROVE" &&
      (!verifiedFacts ||
        typeof verifiedFacts !== "object" ||
        Array.isArray(verifiedFacts) ||
        Object.keys(verifiedFacts).length === 0)
    ) {
      return res.status(400).json({
        error: "VERIFIED_FACTS_REQUIRED",
      });
    }

    const state = analyses.get(analysisId);

    if (!state) {
      return res.status(404).json({
        error: "ANALYSIS_NOT_FOUND",

        analysisId,
      });
    }

    let updatedState;

    try {
      updatedState = applyExternalDelegationDecision(
        state,
        taskId,
        decision,
        verifiedFacts,
      );
    } catch (error) {
      if (error.message === "DELEGATION_TASK_NOT_FOUND") {
        return res.status(404).json({
          error: error.message,
        });
      }

      if (
        error.message === "TASK_DOES_NOT_REQUIRE_EXTERNAL_DELEGATION" ||
        error.message === "TASK_NOT_AWAITING_APPROVAL"
      ) {
        return res.status(409).json({
          error: error.message,
        });
      }

      if (error.message === "VERIFIED_FACTS_REQUIRED") {
        return res.status(400).json({
          error: error.message,
        });
      }

      throw error;
    }

    analyses.set(analysisId, updatedState);

    const approved = decision === "APPROVE";

    return res.json({
      ...buildAnalysisResponse(analysisId, updatedState),

      delegationDecision: decision,

      taskId,

      message: approved
        ? "External delegation was approved and a freelancer brief was prepared. No freelancer has been hired and no money has been spent yet."
        : "External delegation was rejected. No freelancer was hired and no money was spent.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "EXTERNAL_DELEGATION_APPROVAL_FAILED",
    });
  }
});

// Receive and verify a mock external freelancer deliverable

router.post("/delegation/delivery", async (req, res) => {
  try {
    const { analysisId, taskId, scenario = "GOOD_DELIVERABLE" } = req.body;

    if (!analysisId) {
      return res.status(400).json({
        error: "ANALYSIS_ID_REQUIRED",
      });
    }

    if (!taskId) {
      return res.status(400).json({
        error: "DELEGATION_TASK_ID_REQUIRED",
      });
    }

    const validScenarios = new Set([
      "GOOD_DELIVERABLE",
      "DELIVERABLE_MISSING_REQUIREMENT",
      "UNVERIFIED_PRODUCT_FACT",
    ]);

    if (!validScenarios.has(scenario)) {
      return res.status(400).json({
        error: "INVALID_EXTERNAL_DELIVERY_SCENARIO",
      });
    }

    const state = analyses.get(analysisId);

    if (!state) {
      return res.status(404).json({
        error: "ANALYSIS_NOT_FOUND",

        analysisId,
      });
    }

    let updatedState;

    try {
      updatedState = await applyExternalDelegationDelivery(
        state,
        taskId,
        scenario,
      );
    } catch (error) {
      if (error.message === "DELEGATION_TASK_NOT_FOUND") {
        return res.status(404).json({
          error: error.message,
        });
      }

      if (
        error.message === "TASK_IS_NOT_EXTERNAL" ||
        error.message === "DELEGATION_NOT_READY_FOR_DELIVERY" ||
        error.message === "DELEGATION_BRIEF_REQUIRED"
      ) {
        return res.status(409).json({
          error: error.message,
        });
      }

      throw error;
    }

    analyses.set(analysisId, updatedState);

    const task = updatedState.executionPlan.tasks.find(
      (currentTask) => currentTask.id === taskId,
    );

    const revisionRequired = task.status === "REVISION_REQUIRED";

    return res.json({
      ...buildAnalysisResponse(analysisId, updatedState),

      taskId,

      deliveryScenario: scenario,

      deliveryStatus: task.status,

      failedCriteria: task.delegation?.delivery?.failedCriteria ?? [],

      message: revisionRequired
        ? "The freelancer deliverable did not pass all acceptance criteria. Revision is required before the task can be completed."
        : "The freelancer deliverable passed verification and the external task is complete.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "EXTERNAL_DELEGATION_DELIVERY_FAILED",
    });
  }
});

// Record or update the outcome of a completed opportunity task

router.post("/outcome", (req, res) => {
  try {
    const { analysisId, taskId, outcome } = req.body;

    if (!analysisId) {
      return res.status(400).json({
        error: "ANALYSIS_ID_REQUIRED",
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

    const state = analyses.get(analysisId);

    if (!state) {
      return res.status(404).json({
        error: "ANALYSIS_NOT_FOUND",
        analysisId,
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

    analyses.set(analysisId, updatedState);

    return res.json({
      ...buildAnalysisResponse(analysisId, updatedState),

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

export default router;