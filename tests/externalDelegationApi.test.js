import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      const port = typeof address === "object" && address ? address.port : null;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

function waitForServer(baseUrl, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    async function check() {
      try {
        const response = await fetch(`${baseUrl}/api/health`);

        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Server may still be starting.
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("TEST_SERVER_START_TIMEOUT"));
        return;
      }

      setTimeout(check, 100);
    }

    check();
  });
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(body),
  });

  const data = await response.json();

  return {
    status: response.status,
    data,
  };
}

async function createWorthTestingAnalysis(baseUrl) {
  const startResponse = await postJson(`${baseUrl}/api/analysis`, {
    idea: "Birthday Invitation",
  });

  assert.equal(startResponse.status, 200);

  const analysisId = startResponse.data.analysisId;

  assert.ok(analysisId);

  const inputs = ["CAD", 50, 8, 1, 15, "VERY LITTLE", 5];

  let currentResponse = startResponse.data;

  for (const value of inputs) {
    const inputResponse = await postJson(`${baseUrl}/api/analysis/input`, {
      analysisId,
      value,
    });

    assert.equal(inputResponse.status, 200);

    currentResponse = inputResponse.data;
  }

  assert.equal(currentResponse.finalStatus, "WORTH_TESTING");

  assert.ok(currentResponse.executionPlan);

  return {
    analysisId,
    response: currentResponse,
  };
}

test("external delegation API supports approval, failed delivery, and corrected delivery", async (t) => {
  const port = await getAvailablePort();

  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),

    env: {
      ...process.env,
      PORT: String(port),
      USE_REAL_EXECUTION_AI: "false",
    },

    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(() => {
    child.kill();
  });

  await waitForServer(baseUrl);

  const { analysisId } = await createWorthTestingAnalysis(baseUrl);

  const executeResponse = await postJson(`${baseUrl}/api/analysis/execute`, {
    analysisId,
  });

  assert.equal(executeResponse.status, 200);

  assert.equal(executeResponse.data.executionStatus, "AWAITING_APPROVAL");

  assert.equal(executeResponse.data.stoppedTaskId, "task_3");

  const approvalResponse = await postJson(
    `${baseUrl}/api/analysis/delegation/approval`,
    {
      analysisId,
      taskId: "task_3",
      decision: "APPROVE",

      verifiedFacts: {
        dimensions: "8 x 10 inches",
        personalization: "Yes",
        material: "",
      },
    },
  );

  assert.equal(approvalResponse.status, 200);

  assert.equal(approvalResponse.data.delegationDecision, "APPROVE");

  const approvedTask = approvalResponse.data.executionPlan.tasks.find(
    (task) => task.id === "task_3",
  );

  assert.ok(approvedTask);

  assert.equal(approvedTask.status, "APPROVED");

  assert.equal(approvedTask.delegation.verifiedFacts.material, "UNKNOWN");

  assert.equal(approvedTask.delegation.brief.source, "MOCK");

  const failedDeliveryResponse = await postJson(
    `${baseUrl}/api/analysis/delegation/delivery`,
    {
      analysisId,
      taskId: "task_3",
      scenario: "DELIVERABLE_MISSING_REQUIREMENT",
    },
  );

  assert.equal(failedDeliveryResponse.status, 200);

  assert.equal(failedDeliveryResponse.data.deliveryStatus, "REVISION_REQUIRED");

  assert.ok(
    failedDeliveryResponse.data.failedCriteria.some(
      (criterion) =>
        criterion.description === "Required source files are included",
    ),
  );

  const correctedDeliveryResponse = await postJson(
    `${baseUrl}/api/analysis/delegation/delivery`,
    {
      analysisId,
      taskId: "task_3",
      scenario: "GOOD_DELIVERABLE",
    },
  );

  assert.equal(correctedDeliveryResponse.status, 200);

  assert.equal(correctedDeliveryResponse.data.deliveryStatus, "COMPLETE");

  const completedTask = correctedDeliveryResponse.data.executionPlan.tasks.find(
    (task) => task.id === "task_3",
  );

  assert.ok(completedTask);

  assert.equal(completedTask.status, "COMPLETE");

  assert.equal(completedTask.delegation.delivery.verificationPassed, true);

  assert.deepEqual(completedTask.delegation.delivery.failedCriteria, []);
});
