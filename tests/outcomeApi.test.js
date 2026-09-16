import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

let serverProcess;
let baseUrl;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("FAILED_TO_RESOLVE_TEST_PORT"));
        return;
      }

      const { port } = address;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });

    server.on("error", reject);
  });
}

async function waitForServer(url, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // Server may still be starting.
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  throw new Error("TEST_SERVER_DID_NOT_START");
}

async function postJson(pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  return {
    response,
    data,
  };
}

async function createCompletedOpportunityAnalysis() {
  const startResult = await postJson("/api/analysis", {
    idea: "Birthday Invitation",
  });

  assert.equal(startResult.response.status, 200);

  let analysis = startResult.data;

  const answers = ["CAD", 50, 8, 1, 15, "VERY LITTLE", 5];

  for (const value of answers) {
    const inputResult = await postJson("/api/analysis/input", {
      analysisId: analysis.analysisId,
      value,
    });

    assert.equal(inputResult.response.status, 200);

    analysis = inputResult.data;
  }

  assert.equal(analysis.finalStatus, "WORTH_TESTING");

  const executionResult = await postJson("/api/analysis/execute", {
    analysisId: analysis.analysisId,
  });

  assert.equal(executionResult.response.status, 200);

  return executionResult.data;
}

async function createExecutedShopPlan() {
  const planResult = await postJson("/api/shop/plan", {
    shopName: "Maya Studio",
    weeklyAvailableMinutes: 180,
    listings: [
      {
        id: "listing_1",
        title: "Weekly ADHD Planner",
        views: 1200,
        sales: 84,
        trendPercent: 0,
      },
      {
        id: "listing_2",
        title: "Daily Focus Planner",
        views: 950,
        sales: 9,
        trendPercent: 0,
      },
      {
        id: "listing_3",
        title: "Student ADHD Planner",
        views: 190,
        sales: 11,
        trendPercent: 25,
      },
      {
        id: "listing_4",
        title: "Meal Planner Bundle",
        views: 610,
        sales: 34,
        trendPercent: -30,
      },
    ],
  });

  assert.equal(planResult.response.status, 200);

  const executionResult = await postJson("/api/shop/execute", {
    shopPlanId: planResult.data.shopPlanId,
  });

  assert.equal(executionResult.response.status, 200);

  return executionResult.data;
}

before(async () => {
  const port = await getFreePort();

  baseUrl = `http://127.0.0.1:${port}`;

  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      USE_REAL_EXECUTION_AI: "false",
    },
    stdio: "ignore",
  });

  await waitForServer(baseUrl);
});

after(() => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

test("opportunity outcome API records and returns an outcome", async () => {
  const analysis = await createCompletedOpportunityAnalysis();

  const completedTask = analysis.executionPlan.tasks.find(
    (task) => task.status === "COMPLETE",
  );

  assert.ok(completedTask);

  const outcomeResult = await postJson("/api/analysis/outcome", {
    analysisId: analysis.analysisId,
    taskId: completedTask.id,
    outcome: {
      result: "POSITIVE",
      note: "Performance improved after the action.",
      measurement: {
        metric: "Conversion rate",
        before: "1.4%",
        after: "2.0%",
      },
    },
  });

  assert.equal(outcomeResult.response.status, 200);

  const updatedTask = outcomeResult.data.executionPlan.tasks.find(
    (task) => task.id === completedTask.id,
  );

  assert.equal(updatedTask.outcome.status, "RECORDED");
  assert.equal(updatedTask.outcome.result, "POSITIVE");

  assert.equal(
    updatedTask.outcome.note,
    "Performance improved after the action.",
  );

  assert.deepEqual(updatedTask.outcome.measurement, {
    metric: "Conversion rate",
    before: "1.4%",
    after: "2.0%",
  });

  assert.ok(updatedTask.outcome.recordedAt);
});

test("opportunity outcome API allows an existing outcome to be updated", async () => {
  const analysis = await createCompletedOpportunityAnalysis();

  const completedTask = analysis.executionPlan.tasks.find(
    (task) => task.status === "COMPLETE",
  );

  assert.ok(completedTask);

  const firstResult = await postJson("/api/analysis/outcome", {
    analysisId: analysis.analysisId,
    taskId: completedTask.id,
    outcome: {
      result: "NEUTRAL",
    },
  });

  assert.equal(firstResult.response.status, 200);

  const secondResult = await postJson("/api/analysis/outcome", {
    analysisId: analysis.analysisId,
    taskId: completedTask.id,
    outcome: {
      result: "POSITIVE",
      note: "More data showed a positive result.",
      measurement: {
        metric: "Sales",
        before: "10",
        after: "14",
      },
    },
  });

  assert.equal(secondResult.response.status, 200);

  const updatedTask = secondResult.data.executionPlan.tasks.find(
    (task) => task.id === completedTask.id,
  );

  assert.equal(updatedTask.outcome.result, "POSITIVE");
  assert.equal(updatedTask.outcome.note, "More data showed a positive result.");

  assert.deepEqual(updatedTask.outcome.measurement, {
    metric: "Sales",
    before: "10",
    after: "14",
  });
});

test("opportunity outcome API rejects an invalid result", async () => {
  const analysis = await createCompletedOpportunityAnalysis();

  const completedTask = analysis.executionPlan.tasks.find(
    (task) => task.status === "COMPLETE",
  );

  assert.ok(completedTask);

  const outcomeResult = await postJson("/api/analysis/outcome", {
    analysisId: analysis.analysisId,
    taskId: completedTask.id,
    outcome: {
      result: "BETTER",
    },
  });

  assert.equal(outcomeResult.response.status, 400);
  assert.equal(outcomeResult.data.error, "INVALID_OUTCOME_RESULT");
});

test("opportunity outcome API rejects a task that is not complete", async () => {
  const analysis = await createCompletedOpportunityAnalysis();

  const incompleteTask = analysis.executionPlan.tasks.find(
    (task) => task.status !== "COMPLETE",
  );

  assert.ok(incompleteTask);

  const outcomeResult = await postJson("/api/analysis/outcome", {
    analysisId: analysis.analysisId,
    taskId: incompleteTask.id,
    outcome: {
      result: "POSITIVE",
    },
  });

  assert.equal(outcomeResult.response.status, 409);
  assert.equal(outcomeResult.data.error, "OUTCOME_TASK_NOT_COMPLETE");
});

test("shop outcome API records an outcome on a completed shop task", async () => {
  const shopPlan = await createExecutedShopPlan();

  const completedTask = shopPlan.tasks.find(
    (task) => task.status === "COMPLETE",
  );

  assert.ok(completedTask);

  const outcomeResult = await postJson("/api/shop/outcome", {
    shopPlanId: shopPlan.shopPlanId,
    taskId: completedTask.id,
    outcome: {
      result: "POSITIVE",
      note: "The action improved listing performance.",
      measurement: {
        metric: "Weekly sales",
        before: "12",
        after: "18",
      },
    },
  });

  assert.equal(outcomeResult.response.status, 200);

  const updatedTask = outcomeResult.data.tasks.find(
    (task) => task.id === completedTask.id,
  );

  assert.equal(updatedTask.outcome.status, "RECORDED");
  assert.equal(updatedTask.outcome.result, "POSITIVE");

  assert.deepEqual(updatedTask.outcome.measurement, {
    metric: "Weekly sales",
    before: "12",
    after: "18",
  });
});

test("shop outcome API rejects incomplete measurement data", async () => {
  const shopPlan = await createExecutedShopPlan();

  const completedTask = shopPlan.tasks.find(
    (task) => task.status === "COMPLETE",
  );

  assert.ok(completedTask);

  const outcomeResult = await postJson("/api/shop/outcome", {
    shopPlanId: shopPlan.shopPlanId,
    taskId: completedTask.id,
    outcome: {
      result: "POSITIVE",
      measurement: {
        metric: "Weekly sales",
        before: "12",
      },
    },
  });

  assert.equal(outcomeResult.response.status, 400);

  assert.equal(outcomeResult.data.error, "INCOMPLETE_OUTCOME_MEASUREMENT");
});

test("shop outcome API returns not found for an unknown task", async () => {
  const shopPlan = await createExecutedShopPlan();

  const outcomeResult = await postJson("/api/shop/outcome", {
    shopPlanId: shopPlan.shopPlanId,
    taskId: "missing_task",
    outcome: {
      result: "POSITIVE",
    },
  });

  assert.equal(outcomeResult.response.status, 404);
  assert.equal(outcomeResult.data.error, "OUTCOME_TASK_NOT_FOUND");
});