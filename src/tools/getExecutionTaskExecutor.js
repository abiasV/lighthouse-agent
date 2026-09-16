import executeTaskMock from "./executeTaskMock.js";
import executeTaskReal from "./executeTaskReal.js";

function getExecutionTaskExecutor(
  useRealExecutionAI = process.env.USE_REAL_EXECUTION_AI === "true",
) {
  return useRealExecutionAI ? executeTaskReal : executeTaskMock;
}

export default getExecutionTaskExecutor;