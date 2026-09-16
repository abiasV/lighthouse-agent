function validateExecutionPlan(plan) {
  if (!plan || typeof plan !== "object") {
    return {
      valid: false,
      reason: "PLAN_MISSING",
    };
  }

  if (plan.version !== 1) {
    return {
      valid: false,
      reason: "INVALID_PLAN_VERSION",
    };
  }

  if (!Array.isArray(plan.tasks) || plan.tasks.length === 0) {
    return {
      valid: false,
      reason: "PLAN_HAS_NO_TASKS",
    };
  }

  const validExecutorTypes = ["AI", "EXTERNAL", "USER"];

  const validRiskLevels = [
    "SAFE_AUTOMATION",
    "APPROVAL_REQUIRED",
    "MONEY_REQUIRED",
    "EXTERNAL_HUMAN_REQUIRED",
    "HIGH_RISK",
  ];

  const validEvaluationTypes = [
    "DETERMINISTIC",
    "AI_EVALUATED",
    "HUMAN_REVIEW",
  ];

  const validDelegationSignals = ["THUMBNAIL_QUALITY_SIGNAL"];

  const validVerifiedFactsSources = ["USER_INPUT_AT_APPROVAL"];

  for (const task of plan.tasks) {
    if (!task.id || !task.title || !task.description) {
      return {
        valid: false,
        reason: "TASK_REQUIRED_FIELDS_MISSING",
      };
    }

    if (!validExecutorTypes.includes(task.executorType)) {
      return {
        valid: false,
        reason: "INVALID_EXECUTOR_TYPE",
      };
    }

    if (!validRiskLevels.includes(task.riskLevel)) {
      return {
        valid: false,
        reason: "INVALID_RISK_LEVEL",
      };
    }

    if (
      !Array.isArray(task.acceptanceCriteria) ||
      task.acceptanceCriteria.length === 0
    ) {
      return {
        valid: false,
        reason: "ACCEPTANCE_CRITERIA_MISSING",
      };
    }

    for (const criterion of task.acceptanceCriteria) {
      if (!criterion.description) {
        return {
          valid: false,
          reason: "ACCEPTANCE_CRITERION_DESCRIPTION_MISSING",
        };
      }

      if (!validEvaluationTypes.includes(criterion.evaluationType)) {
        return {
          valid: false,
          reason: "INVALID_EVALUATION_TYPE",
        };
      }
    }

    if (task.riskLevel === "MONEY_REQUIRED") {
      if (
        !task.budget ||
        typeof task.budget.min !== "number" ||
        typeof task.budget.max !== "number" ||
        !task.budget.currency
      ) {
        return {
          valid: false,
          reason: "BUDGET_REQUIRED",
        };
      }

      if (
        task.budget.min < 0 ||
        task.budget.max < 0 ||
        task.budget.min > task.budget.max
      ) {
        return {
          valid: false,
          reason: "INVALID_BUDGET",
        };
      }
    }

    if (task.executorType === "EXTERNAL") {
      if (
        typeof task.delegationReason !== "string" ||
        !task.delegationReason.trim()
      ) {
        return {
          valid: false,
          reason: "DELEGATION_REASON_REQUIRED",
        };
      }

      if (!validDelegationSignals.includes(task.detectedFrom)) {
        return {
          valid: false,
          reason: "INVALID_DELEGATION_SIGNAL",
        };
      }

      if (
        !task.verifiedFactsPolicy ||
        typeof task.verifiedFactsPolicy !== "object"
      ) {
        return {
          valid: false,
          reason: "VERIFIED_FACTS_POLICY_REQUIRED",
        };
      }

      if (
        !validVerifiedFactsSources.includes(task.verifiedFactsPolicy.source)
      ) {
        return {
          valid: false,
          reason: "INVALID_VERIFIED_FACTS_SOURCE",
        };
      }

      if (task.verifiedFactsPolicy.unknownValue !== "UNKNOWN") {
        return {
          valid: false,
          reason: "INVALID_UNKNOWN_FACT_VALUE",
        };
      }

      if (task.verifiedFactsPolicy.allowInvention !== false) {
        return {
          valid: false,
          reason: "PRODUCT_FACT_INVENTION_NOT_ALLOWED",
        };
      }
    }
  }

  return {
    valid: true,
    reason: null,
  };
}

export default validateExecutionPlan;