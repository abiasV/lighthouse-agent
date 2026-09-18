import { timingSafeEqual } from "node:crypto";

import { betaUsageStore } from "../state/betaUsageStore.js";

const DEFAULT_MAX_RUNS_PER_TESTER = 3;
const DEFAULT_MAX_TOTAL_RUNS = 10;

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : fallback;
}

function parseAccessEntries(value = "") {
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf(":");

      if (separatorIndex <= 0) {
        return null;
      }

      const testerId = entry.slice(0, separatorIndex).trim();
      const accessKey = entry.slice(separatorIndex + 1).trim();

      if (!testerId || !accessKey) {
        return null;
      }

      return {
        testerId,
        accessKey,
      };
    })
    .filter(Boolean);
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function findTesterByAccessKey(accessKey, entries) {
  return entries.find((entry) =>
    safeEqual(accessKey, entry.accessKey),
  );
}

function authorizeBetaRealAiRun({
  accessKey,
  env = process.env,
  usageStore = betaUsageStore,
} = {}) {
  if (env.BETA_REAL_AI_ENABLED !== "true") {
    return {
      allowed: false,
      statusCode: 503,
      error: "BETA_REAL_AI_DISABLED",
    };
  }

  if (!accessKey || !String(accessKey).trim()) {
    return {
      allowed: false,
      statusCode: 401,
      error: "BETA_ACCESS_KEY_REQUIRED",
    };
  }

  const entries = parseAccessEntries(env.BETA_ACCESS_KEYS);

  const tester = findTesterByAccessKey(
    String(accessKey).trim(),
    entries,
  );

  if (!tester) {
    return {
      allowed: false,
      statusCode: 403,
      error: "BETA_ACCESS_KEY_INVALID",
    };
  }

  const maxRunsPerTester = parsePositiveInteger(
    env.BETA_MAX_RUNS_PER_TESTER,
    DEFAULT_MAX_RUNS_PER_TESTER,
  );

  const maxTotalRuns = parsePositiveInteger(
    env.BETA_MAX_TOTAL_RUNS,
    DEFAULT_MAX_TOTAL_RUNS,
  );

  const reservation = usageStore.reserveRun(
    tester.testerId,
    {
      maxRunsPerTester,
      maxTotalRuns,
    },
  );

  if (!reservation.allowed) {
    return {
      allowed: false,
      statusCode: 429,
      error: reservation.reason,
      testerId: tester.testerId,
      testerRuns: reservation.testerRuns,
      totalRuns: reservation.totalRuns,
    };
  }

  return {
    allowed: true,
    statusCode: 200,
    error: null,
    testerId: tester.testerId,
    testerRuns: reservation.testerRuns,
    totalRuns: reservation.totalRuns,
  };
}

export {
  authorizeBetaRealAiRun,
  parseAccessEntries,
};
