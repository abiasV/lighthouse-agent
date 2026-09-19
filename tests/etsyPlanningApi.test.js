import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { sampleTrafficPeriod } from "./fixtures/reportingPeriods.js";
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

function createSnapshot() {
  return {
    shopId: "shop_1",
    shopName: "Maya Studio",

    period: {
      days: 30,
      currentStart: "2026-08-13T00:00:00.000Z",
      currentEndExclusive: "2026-09-12T00:00:00.000Z",
      previousStart: "2026-07-14T00:00:00.000Z",
      previousEndExclusive: "2026-08-13T00:00:00.000Z",
      timeZone: "UTC",
    },

    listings: [
      {
        id: "listing_1",
        title: "Printable Birthday Invitation",

        metrics: {
          periodViews: null,
          currentPeriodSales: 5,
          previousPeriodSales: 5,
          trendPercent: 0,
        },

        availability: {
          periodViews: "UNAVAILABLE",
          currentPeriodSales: "AVAILABLE",
          previousPeriodSales: "AVAILABLE",
          trendPercent: "DERIVED",
        },

        sources: {
          periodViews: null,
          currentPeriodSales: "ETSY",
          previousPeriodSales: "ETSY",
          trendPercent: "LIGHTHOUSE_DERIVED",
        },
      },
    ],
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

test("Etsy API rejects mismatched evidence periods before creating a plan", async () => {
  const input = { listingId: "listing_1", periodViews: 200, periodConfirmed: true, period: sampleTrafficPeriod };
  for (const period of [undefined, { ...sampleTrafficPeriod, timeZone: "America/Toronto" },
    { ...sampleTrafficPeriod, currentStart: "2026-08-14T00:00:00.000Z" }]) {
    const result = await postJson("/api/shop/etsy/plan", { snapshot: createSnapshot(), sellerInputs: [{ ...input, period }] });
    assert.equal(result.response.status, 400);
    assert.equal(result.data.error, "SELLER_PERIOD_MISMATCH");
    assert.equal(result.data.sessionPlan, undefined);
  }
  const result = await postJson("/api/shop/etsy/plan", { snapshot: createSnapshot(), sellerInputs: [input] });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.data.shopData.reportingPeriod, result.data.sessionPlan.reportingPeriod);
  assert.equal(result.data.sessionPlan.reportingPeriod.endDate, "2026-09-11");
});

test("Etsy planning API builds a plan from normalized snapshot and seller evidence", async () => {
  const result = await postJson("/api/shop/etsy/plan", {
    snapshot: createSnapshot(),

    sellerInputs: [
      {
        listingId: "listing_1",
        periodViews: 700,
        period: sampleTrafficPeriod,
        periodConfirmed: true,
      },
    ],

    weeklyAvailableMinutes: 180,
  });

  assert.equal(result.response.status, 200);

  assert.equal(result.data.shopData.shopName, "Maya Studio");

  assert.equal(result.data.shopData.weeklyAvailableMinutes, 180);

  assert.equal(result.data.shopData.listings[0].views, 700);

  assert.equal(result.data.shopData.listings[0].sales, 5);

  assert.equal(result.data.plan.tasks.length, 1);

  assert.equal(result.data.plan.tasks[0].opportunityType, "IMPROVE_CONVERSION");

  assert.equal(result.data.missingEvidence.length, 0);

  assert.ok(result.data.sessionPlan);

  assert.ok(result.data.sessionPlan.shopPlanId);

  assert.equal(result.data.sessionPlan.shopName, "Maya Studio");
});

test("Etsy planning API does not create a shop session while evidence is incomplete", async () => {
  const result = await postJson("/api/shop/etsy/plan", {
    snapshot: createSnapshot(),
    sellerInputs: [],
    weeklyAvailableMinutes: 180,
  });

  assert.equal(result.response.status, 200);

  assert.equal(result.data.sessionPlan, null);

  assert.equal(result.data.missingEvidence.length, 1);

  assert.equal(result.data.missingEvidence[0].field, "periodViews");
});

test("completed Etsy evidence creates a shop session that can enter the normal execution flow", async () => {
  const planningResult = await postJson("/api/shop/etsy/plan", {
    snapshot: createSnapshot(),

    sellerInputs: [
      {
        listingId: "listing_1",
        periodViews: 700,
        period: sampleTrafficPeriod,
        periodConfirmed: true,
      },
    ],

    weeklyAvailableMinutes: 180,
  });

  assert.equal(planningResult.response.status, 200);

  assert.ok(planningResult.data.sessionPlan);

  assert.ok(planningResult.data.sessionPlan.shopPlanId);

  const executionResult = await postJson("/api/shop/execute", {
    shopPlanId: planningResult.data.sessionPlan.shopPlanId,
  });

  assert.equal(executionResult.response.status, 200);

  assert.equal(executionResult.data.shopPlanId, planningResult.data.sessionPlan.shopPlanId,);
});

test("Etsy planning API rejects an invalid snapshot", async () => {
  const result = await postJson("/api/shop/etsy/plan", {
    snapshot: null,
    sellerInputs: [],
    weeklyAvailableMinutes: 180,
  });

  assert.equal(result.response.status, 400);

  assert.equal(result.data.error, "INVALID_ETSY_SNAPSHOT");

  assert.equal(result.data.message, "The Etsy snapshot is missing or invalid.");
});

test("Etsy planning API rejects seller input for an unknown listing", async () => {
  const result = await postJson("/api/shop/etsy/plan", {
    snapshot: createSnapshot(),

    sellerInputs: [
      {
        listingId: "missing_listing",
        periodViews: 700,
        period: sampleTrafficPeriod,
        periodConfirmed: true,
      },
    ],

    weeklyAvailableMinutes: 180,
  });

  assert.equal(result.response.status, 400);

  assert.equal(result.data.error, "SELLER_LISTING_NOT_FOUND");

  assert.equal(
    result.data.message,
    "Seller input references a listing that does not exist in the Etsy snapshot.",
  );
});

test("Etsy planning API rejects invalid seller input shape", async () => {
  const result = await postJson("/api/shop/etsy/plan", {
    snapshot: createSnapshot(),
    sellerInputs: {},
    weeklyAvailableMinutes: 180,
  });

  assert.equal(result.response.status, 400);

  assert.equal(result.data.error, "INVALID_SELLER_INPUTS");

  assert.equal(
    result.data.message,
    "Seller inputs must be provided as an array.",
  );
});

test("Etsy planning API rejects negative weekly available minutes", async () => {
  const result = await postJson("/api/shop/etsy/plan", {
    snapshot: createSnapshot(),
    sellerInputs: [],
    weeklyAvailableMinutes: -30,
  });

  assert.equal(result.response.status, 400);

  assert.equal(result.data.error, "INVALID_WEEKLY_AVAILABLE_MINUTES");

  assert.equal(
    result.data.message,
    "Weekly available minutes must be a non-negative number.",
  );
});

test("Etsy planning API rejects invalid period views", async () => {
  const result = await postJson("/api/shop/etsy/plan", {
    snapshot: createSnapshot(),

    sellerInputs: [
      {
        listingId: "listing_1",
        periodViews: -1,
      },
    ],

    weeklyAvailableMinutes: 180,
  });

  assert.equal(result.response.status, 400);

  assert.equal(result.data.error, "INVALID_PERIOD_VIEWS");

  assert.equal(
    result.data.message,
    "Period views must be a non-negative number.",
  );
});
