import executeTaskMock from "../tools/executeTaskMock.js";
import verifyTaskResult from "../utils/verifyTaskResult.js";

async function runExecutionTask(task, idea, options = {}) {
  const scenario = options.scenario ?? "GOOD_OUTPUT";

  const executeTask = options.executeTask ?? executeTaskMock;

  if (task.riskLevel !== "SAFE_AUTOMATION") {
    return {
      ...task,
      status: task.status,
      failureReason: "AUTOMATION_NOT_ALLOWED_FOR_RISK_LEVEL",
    };
  }

  if (task.executorType !== "AI") {
    return {
      ...task,
      status: "FAILED",
      failureReason: "UNSUPPORTED_EXECUTOR_TYPE",
    };
  }

  const taskInProgress = {
    ...task,
    status: "IN_PROGRESS",
  };

  try {
    const result = await executeTask(taskInProgress, idea, scenario);

    const verificationResults = verifyTaskResult(
      taskInProgress,
      result,
      scenario,
    );

    const hasFailedVerification = verificationResults.some(
      (verification) => verification.status === "FAILED",
    );

    const requiresHumanReview = verificationResults.some(
      (verification) => verification.status === "WAITING_FOR_HUMAN",
    );

    if (requiresHumanReview) {
      return {
        ...taskInProgress,
        status: "WAITING_FOR_USER",
        result,
        verificationResults,
      };
    }

    if (hasFailedVerification) {
      return {
        ...taskInProgress,
        status: "FAILED",
        result,
        verificationResults,
        failureReason: "VERIFICATION_FAILED",
      };
    }

    return {
      ...taskInProgress,
      status: "COMPLETE",
      result,
      verificationResults,
    };
  } catch (error) {
    return {
      ...taskInProgress,
      status: "FAILED",
      failureReason: "TASK_EXECUTION_FAILED",
    };
  }
}

export default runExecutionTask;