import test from "node:test";
import assert from "node:assert/strict";

import {
  authorizeBetaRealAiRun,
  parseAccessEntries,
} from "../src/middleware/betaAccessGuard.js";
import { createBetaUsageStore } from "../src/state/betaUsageStore.js";

test("parses configured beta access entries", () => {
  const entries = parseAccessEntries(
    "tester-a:key-a, tester-b:key-b",
  );

  assert.deepEqual(entries, [
    {
      testerId: "tester-a",
      accessKey: "key-a",
    },
    {
      testerId: "tester-b",
      accessKey: "key-b",
    },
  ]);
});

test("blocks real AI when beta access is disabled", () => {
  const result = authorizeBetaRealAiRun({
    accessKey: "key-a",
    env: {
      BETA_REAL_AI_ENABLED: "false",
      BETA_ACCESS_KEYS: "tester-a:key-a",
    },
    usageStore: createBetaUsageStore(),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.statusCode, 503);
  assert.equal(result.error, "BETA_REAL_AI_DISABLED");
});

test("requires a beta access key when real AI is enabled", () => {
  const result = authorizeBetaRealAiRun({
    env: {
      BETA_REAL_AI_ENABLED: "true",
      BETA_ACCESS_KEYS: "tester-a:key-a",
    },
    usageStore: createBetaUsageStore(),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.statusCode, 401);
  assert.equal(result.error, "BETA_ACCESS_KEY_REQUIRED");
});

test("rejects an unknown beta access key", () => {
  const result = authorizeBetaRealAiRun({
    accessKey: "wrong-key",
    env: {
      BETA_REAL_AI_ENABLED: "true",
      BETA_ACCESS_KEYS: "tester-a:key-a",
    },
    usageStore: createBetaUsageStore(),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.statusCode, 403);
  assert.equal(result.error, "BETA_ACCESS_KEY_INVALID");
});

test("allows an approved tester within both usage limits", () => {
  const result = authorizeBetaRealAiRun({
    accessKey: "key-a",
    env: {
      BETA_REAL_AI_ENABLED: "true",
      BETA_ACCESS_KEYS: "tester-a:key-a",
      BETA_MAX_RUNS_PER_TESTER: "3",
      BETA_MAX_TOTAL_RUNS: "10",
    },
    usageStore: createBetaUsageStore(),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.testerId, "tester-a");
  assert.equal(result.testerRuns, 1);
  assert.equal(result.totalRuns, 1);
});

test("blocks a tester after reaching the per-tester run limit", () => {
  const usageStore = createBetaUsageStore();

  const env = {
    BETA_REAL_AI_ENABLED: "true",
    BETA_ACCESS_KEYS: "tester-a:key-a",
    BETA_MAX_RUNS_PER_TESTER: "2",
    BETA_MAX_TOTAL_RUNS: "10",
  };

  authorizeBetaRealAiRun({
    accessKey: "key-a",
    env,
    usageStore,
  });

  authorizeBetaRealAiRun({
    accessKey: "key-a",
    env,
    usageStore,
  });

  const blocked = authorizeBetaRealAiRun({
    accessKey: "key-a",
    env,
    usageStore,
  });

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.statusCode, 429);
  assert.equal(
    blocked.error,
    "BETA_TESTER_RUN_LIMIT_REACHED",
  );
});

test("blocks all testers after reaching the global run limit", () => {
  const usageStore = createBetaUsageStore();

  const env = {
    BETA_REAL_AI_ENABLED: "true",
    BETA_ACCESS_KEYS:
      "tester-a:key-a,tester-b:key-b,tester-c:key-c",
    BETA_MAX_RUNS_PER_TESTER: "3",
    BETA_MAX_TOTAL_RUNS: "2",
  };

  authorizeBetaRealAiRun({
    accessKey: "key-a",
    env,
    usageStore,
  });

  authorizeBetaRealAiRun({
    accessKey: "key-b",
    env,
    usageStore,
  });

  const blocked = authorizeBetaRealAiRun({
    accessKey: "key-c",
    env,
    usageStore,
  });

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.statusCode, 429);
  assert.equal(
    blocked.error,
    "BETA_GLOBAL_RUN_LIMIT_REACHED",
  );
});
