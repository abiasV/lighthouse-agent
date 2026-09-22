import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { createPilotReviewStore } from "../src/pilot/pilotReviewStore.js";
import { createEtsyTokenCipher } from "../src/integrations/etsy/auth/etsyTokenCipher.js";

const databaseUrl = process.env.ETSY_TEST_DATABASE_URL;
test("Postgres pilot: concurrent reservations, retry deduplication, limits, restart and privacy", {
  skip: !databaseUrl && "Set ETSY_TEST_DATABASE_URL to a dedicated local test database.",
}, async () => {
  const url = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.match(url.pathname, /^\/lighthouse_test[a-zA-Z0-9_]*$/);
  const schema = "pilot_test_" + randomUUID().replaceAll("-", "");
  const admin = new Pool({ connectionString: databaseUrl });
  const config = { connectionString: databaseUrl, options: "-c search_path=" + schema };
  let a, b;
  const cipher = createEtsyTokenCipher("ab".repeat(32));
  const input = { title: "Private listing title", facts: "Private product facts" };
  try {
    await admin.query('CREATE SCHEMA "' + schema + '"');
    a = new Pool(config); b = new Pool(config);
    const sql = await readFile(new URL("../migrations/003_private_pilot.sql", import.meta.url), "utf8");
    await a.query(sql); await a.query(sql);
    const storeA = createPilotReviewStore({ pool: a, cipher });
    const storeB = createPilotReviewStore({ pool: b, cipher });
    await storeA.check();
    const key = randomUUID();
    const duplicates = await Promise.all([storeA, storeB, storeA, storeB].map(store => store.reserve("123", key, input)));
    assert.equal(duplicates.filter(item => item.fresh).length, 1);
    const firstId = duplicates[0].review.id;
    await assert.rejects(storeB.reserve("123", key, { title: "changed" }), /PILOT_REQUEST_CONFLICT/);
    const ciphertext = (await a.query("SELECT payload FROM lighthouse_pilot_reviews WHERE id = $1", [firstId])).rows[0].payload;
    assert.equal(ciphertext.includes(input.title), false);
    await storeA.finish("123", firstId, { input, result: { assessment: "Draft" } }, "complete");
    assert.equal((await storeB.list("456")).length, 0);
    await assert.rejects(storeB.outcome("456", firstId, { note: "must not write" }), /PILOT_REVIEW_NOT_FOUND/);
    await storeA.outcome("123", firstId, { note: "Updated description" });
    await a.end(); a = new Pool(config);
    const restarted = createPilotReviewStore({ pool: a, cipher });
    assert.equal((await restarted.list("123"))[0].outcome.note, "Updated description");
    assert.equal((await restarted.reserve("123", key, input)).fresh, false);

    const attempts = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => (i % 2 ? restarted : storeB).reserve("123", randomUUID(), input)));
    assert.equal(attempts.filter(item => item.status === "fulfilled").length, 5);
    assert.ok(attempts.filter(item => item.status === "rejected").every(item => item.reason.message === "PILOT_ACCOUNT_LIMIT"));
    // Different users race for the remaining global allowance; no reset by pool restart.
    const global = await Promise.allSettled(Array.from({ length: 40 }, (_, i) => (i % 2 ? restarted : storeB).reserve(String(1000 + i), randomUUID(), input)));
    assert.equal(global.filter(item => item.status === "fulfilled").length, 24);
    assert.ok(global.filter(item => item.status === "rejected").every(item => item.reason.message === "PILOT_BUDGET_LIMIT"));
    const budget = await a.query("SELECT reserved_cad_cents FROM lighthouse_pilot_budget WHERE id=1");
    assert.equal(budget.rows[0].reserved_cad_cents, 3000);
    assert.equal((await restarted.reserve("123", key, input)).fresh, false); // Cached result still works at cap.
    await a.query(sql); // Deployment/migration does not reset allowance.
    assert.equal((await a.query("SELECT reserved_cad_cents FROM lighthouse_pilot_budget WHERE id=1")).rows[0].reserved_cad_cents, 3000);
  } finally {
    if (a) await a.end(); if (b) await b.end();
    await admin.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE'); await admin.end();
  }
});
