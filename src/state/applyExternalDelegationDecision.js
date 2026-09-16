import buildExternalDelegationBriefMock from "../tools/buildExternalDelegationBriefMock.js";

const SUPPORTED_DECISIONS = new Set(["APPROVE", "REJECT"]);

function normalizeFactValue(value) {
  if (value === null || value === undefined) {
    return "UNKNOWN";
  }

  const normalizedValue = String(value).trim();

  return normalizedValue || "UNKNOWN";
}

function normalizeVerifiedFacts(verifiedFacts) {
  if (
    !verifiedFacts ||
    typeof verifiedFacts !== "object" ||
    Array.isArray(verifiedFacts)
  ) {
    throw new Error("VERIFIED_FACTS_REQUIRED");
  }

  const entries = Object.entries(verifiedFacts);

  if (entries.length === 0) {
    throw new Error("VERIFIED_FACTS_REQUIRED");
  }

  return Object.fromEntries(
    entries.map(([key, value]) => [key, normalizeFactValue(value)]),
  );
}

function applyExternalDelegationDecision(
  state,
  taskId,
  decision,
  verifiedFacts = null,
) {
  if (!state?.executionPlan?.tasks?.length) {
    throw new Error("NO_EXECUTION_PLAN");
  }

  if (!SUPPORTED_DECISIONS.has(decision)) {
    throw new Error("INVALID_DELEGATION_DECISION");
  }

  const taskIndex = state.executionPlan.tasks.findIndex(
    (task) => task.id === taskId,
  );

  if (taskIndex === -1) {
    throw new Error("DELEGATION_TASK_NOT_FOUND");
  }

  const task = state.executionPlan.tasks[taskIndex];

  if (task.executorType !== "EXTERNAL" || task.riskLevel !== "MONEY_REQUIRED") {
    throw new Error("TASK_DOES_NOT_REQUIRE_EXTERNAL_DELEGATION");
  }

  if (task.status !== "AWAITING_APPROVAL") {
    throw new Error("TASK_NOT_AWAITING_APPROVAL");
  }

  const decidedAt = new Date().toISOString();

  let updatedTask;

  if (decision === "REJECT") {
    updatedTask = {
      ...task,

      status: "REJECTED",

      delegation: {
        status: "REJECTED",

        decision,

        decidedAt,

        verifiedFacts: null,

        brief: null,
      },
    };
  } else {
    const normalizedVerifiedFacts = normalizeVerifiedFacts(verifiedFacts);

    const brief = buildExternalDelegationBriefMock(
      task,
      state.idea,
      normalizedVerifiedFacts,
    );

    updatedTask = {
      ...task,

      status: "APPROVED",

      delegation: {
        status: "APPROVED",

        decision,

        decidedAt,

        verifiedFacts: normalizedVerifiedFacts,

        brief,
      },
    };
  }

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

export default applyExternalDelegationDecision;