import "dotenv/config";

import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";
import executeTaskReal from "../src/tools/executeTaskReal.js";

const runRealExecutionTest = process.env.RUN_REAL_EXECUTION_TEST === "true";

console.log("\n=== LIGHTHOUSE REAL EXECUTION TEST ===");

if (!runRealExecutionTest) {
  console.log("\n🟢 FREE TEST");
  console.log("Real execution is disabled.");
  console.log("OpenAI API requests: 0");
  console.log("\nTo run the intentional paid test:");
  console.log("RUN_REAL_EXECUTION_TEST=true npm run test:real:execution");

  process.exit(0);
}

console.log("\n💰 REAL API TEST");
console.log("Expected top-level OpenAI requests: 1");
console.log("Web search requests: 0");

const idea = "Dog Training Course";

const plan = generateExecutionPlan(idea);

const task = plan.tasks.find((candidateTask) => candidateTask.id === "task_1");

if (!task) {
  throw new Error("TASK_1_NOT_FOUND");
}

console.log("\n=== TASK ===");

console.log({
  id: task.id,
  title: task.title,
  executorType: task.executorType,
  riskLevel: task.riskLevel,
});

console.log("\nExecuting task with real OpenAI...");

try {
  const result = await executeTaskReal(task, idea);

  console.log("\n=== REAL EXECUTION RESULT ===");

  console.dir(result, {
    depth: null,
  });

  console.log("\n=== BASIC VALIDATION ===");

  console.log({
    typeIsCorrect: result.type === "KEYWORD_RESEARCH",

    keywordCount: result.keywords?.length ?? 0,

    hasExactlyTenKeywords: result.keywords?.length === 10,
  });

  console.log("\n=== REAL EXECUTION TEST FINISHED ===");
} catch (error) {
  console.error("\n=== REAL EXECUTION TEST FAILED ===");

  console.error(error?.message ?? error);

  process.exitCode = 1;
}