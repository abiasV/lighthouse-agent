import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { sampleManualPeriod } from "./fixtures/reportingPeriods.js";

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

test("manual period is required and retained without a confirmation checkbox", async () => {
  const body = { shopName: "Period test", weeklyAvailableMinutes: 180,
    listings: [{ id: "l", title: "Test", views: 200, sales: 5, trendPercent: null }] };
  const missing = await postJson("/api/shop/plan", body);
  assert.equal(missing.response.status, 400);
  assert.equal(missing.data.error, "REPORTING_PERIOD_REQUIRED");
  const created = await postJson("/api/shop/plan", { ...body, reportingPeriod: sampleManualPeriod });
  assert.equal(created.response.status, 200);
  assert.equal(created.data.reportingPeriod.startDate, sampleManualPeriod.startDate);
  const executed = await postJson("/api/shop/execute", { shopPlanId: created.data.shopPlanId });
  assert.equal(executed.response.status, 200);
  assert.deepEqual(executed.data.reportingPeriod, created.data.reportingPeriod);
});

test("shop plan API includes an approval proposal immediately for a weak-conversion listing", async () => {
  const planResult = await postJson("/api/shop/plan", {
    reportingPeriod: sampleManualPeriod,
    periodConfirmed: true,
    shopName: "Maya Studio",
    weeklyAvailableMinutes: 180,
    listings: [
      {
        id: "listing_1",
        title: "Printable Birthday Invitation",
        views: 700,
        sales: 5,
        trendPercent: 0,
      },
    ],
  });

  assert.equal(planResult.response.status, 200);

  assert.ok(planResult.data.shopPlanId);

  assert.ok(Array.isArray(planResult.data.tasks));
  assert.equal(planResult.data.tasks.length, 1);

  const approvalTask = planResult.data.tasks[0];

  assert.equal(approvalTask.opportunityType, "IMPROVE_CONVERSION");
  assert.equal(approvalTask.detectedFrom, "LOW_CONVERSION_SIGNAL");
  assert.equal(approvalTask.riskLevel, "APPROVAL_REQUIRED");
  assert.equal(approvalTask.status, "AWAITING_APPROVAL");

  assert.ok(approvalTask.approval);
  assert.equal(approvalTask.approval.status, "PENDING");

  assert.ok(approvalTask.approval.proposal);

  assert.equal(
    approvalTask.approval.proposal.type,
    "SHOP_LISTING_CHANGE_PROPOSAL",
  );

  assert.equal(approvalTask.approval.proposal.listingId, "listing_1");

  assert.equal(
    approvalTask.approval.proposal.listingTitle,
    "Printable Birthday Invitation",
  );

  assert.equal(
    approvalTask.approval.proposal.diagnosis.observedSignal,
    "This listing receives meaningful traffic but converts relatively few visitors into sales.",
  );

  assert.equal(approvalTask.approval.proposal.diagnosis.confidence, "LOW");

  assert.equal(approvalTask.approval.proposal.diagnosis.provenCause, null);

  assert.ok(
    Array.isArray(
      approvalTask.approval.proposal.diagnosis.possibleContributors,
    ),
  );

  assert.ok(
    approvalTask.approval.proposal.diagnosis.possibleContributors.length > 0,
  );

  assert.ok(Array.isArray(approvalTask.approval.proposal.proposedChanges));

  assert.ok(approvalTask.approval.proposal.proposedChanges.length > 0);

  assert.equal(approvalTask.approval.proposal.safeguards.didModifyShop, false);

  assert.equal(approvalTask.approval.proposal.safeguards.externalSpend, 0);
});

test("approving a weak-conversion proposal returns an approved recovery package with exact approved values", async () => {
  const planResult = await postJson("/api/shop/plan", {
    reportingPeriod: sampleManualPeriod,
    periodConfirmed: true,
    shopName: "Maya Studio",
    weeklyAvailableMinutes: 180,
    listings: [
      {
        id: "listing_1",
        title: "Printable Birthday Invitation",
        views: 700,
        sales: 5,
        trendPercent: 0,
      },
    ],
  });

  assert.equal(planResult.response.status, 200);

  const approvalTask = planResult.data.tasks[0];

  const originalApprovedValues =
    approvalTask.approval.proposal.proposedChanges.map(
      (change) => change.proposedValue,
    );

  const approvalResult = await postJson("/api/shop/approval", {
    shopPlanId: planResult.data.shopPlanId,
    taskId: approvalTask.id,
    decision: "APPROVE",
  });

  assert.equal(approvalResult.response.status, 200);

  assert.equal(approvalResult.data.approvalDecision, "APPROVE");

  const updatedTask = approvalResult.data.tasks.find(
    (task) => task.id === approvalTask.id,
  );

  assert.ok(updatedTask);

  assert.equal(updatedTask.status, "APPROVED");

  assert.equal(updatedTask.approval.status, "APPROVED");

  assert.equal(updatedTask.approval.decision, "APPROVE");

  assert.ok(updatedTask.approvedRecovery);

  assert.equal(
    updatedTask.approvedRecovery.status,
    "READY_FOR_MANUAL_APPLICATION",
  );

  assert.equal(updatedTask.approvedRecovery.applicationMode, "MANUAL");

  assert.equal(updatedTask.approvedRecovery.source, "APPROVED_PROPOSAL");

  assert.equal(updatedTask.approvedRecovery.listingId, "listing_1");

  assert.equal(
    updatedTask.approvedRecovery.listingTitle,
    "Printable Birthday Invitation",
  );

  const packagedValues = updatedTask.approvedRecovery.changes.map(
    (change) => change.approvedValue,
  );

  assert.deepEqual(packagedValues, originalApprovedValues);

  assert.equal(updatedTask.approvedRecovery.safeguards.didModifyShop, false);

  assert.equal(updatedTask.approvedRecovery.safeguards.externalSpend, 0);

  assert.ok(updatedTask.approvedRecovery.preparedAt);

  assert.equal(
    approvalResult.data.message,
    "The proposed protected action was approved. No Etsy changes have been made yet.",
  );
});

test("rejecting a weak-conversion proposal does not create an approved recovery package", async () => {
  const planResult = await postJson("/api/shop/plan", {
    reportingPeriod: sampleManualPeriod,
    periodConfirmed: true,
    shopName: "Maya Studio",
    weeklyAvailableMinutes: 180,
    listings: [
      {
        id: "listing_1",
        title: "Printable Birthday Invitation",
        views: 700,
        sales: 5,
        trendPercent: 0,
      },
    ],
  });

  assert.equal(planResult.response.status, 200);

  const approvalTask = planResult.data.tasks[0];

  const approvalResult = await postJson("/api/shop/approval", {
    shopPlanId: planResult.data.shopPlanId,
    taskId: approvalTask.id,
    decision: "REJECT",
  });

  assert.equal(approvalResult.response.status, 200);

  assert.equal(approvalResult.data.approvalDecision, "REJECT");

  const updatedTask = approvalResult.data.tasks.find(
    (task) => task.id === approvalTask.id,
  );

  assert.ok(updatedTask);

  assert.equal(updatedTask.status, "REJECTED");

  assert.equal(updatedTask.approval.status, "REJECTED");

  assert.equal(updatedTask.approval.decision, "REJECT");

  assert.equal(updatedTask.approvedRecovery, undefined);

  assert.equal(
    approvalResult.data.message,
    "The proposed protected action was rejected. No Etsy changes were made.",
  );
});
