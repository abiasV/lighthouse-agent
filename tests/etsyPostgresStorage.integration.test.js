import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";
import { createEtsyTokenCipher } from "../src/integrations/etsy/auth/etsyTokenCipher.js";
import { createPostgresEtsyConnectionRepository } from "../src/integrations/etsy/auth/postgresEtsyConnectionRepository.js";
import {
  createEtsyConnection, setEtsyConnectionRepository,
} from "../src/integrations/etsy/auth/etsyConnectionStore.js";
import { createMemoryEtsyConnectionRepository } from "../src/integrations/etsy/auth/memoryEtsyConnectionRepository.js";

const databaseUrl = process.env.ETSY_TEST_DATABASE_URL;
test("real Postgres: ciphertext, process restart, cross-client lock and rollback", {
  skip: !databaseUrl && "Set ETSY_TEST_DATABASE_URL to a dedicated local test database.",
}, async () => {
  const parsed = new URL(databaseUrl);
  // Never run an integration fixture against a remote/live database.
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname));
  assert.match(parsed.pathname, /^\/lighthouse_test[a-zA-Z0-9_]*$/);
  const schema = "etsy_test_" + randomUUID().replaceAll("-", "");
  const admin = new Pool({ connectionString: databaseUrl });
  const config = { connectionString: databaseUrl, options: "-c search_path=" + schema };
  let poolA;
  let poolB;
  const key = "ab".repeat(32);
  const cipher = createEtsyTokenCipher(key);
  try {
    await admin.query('CREATE SCHEMA "' + schema + '"');
    poolA = new Pool(config);
    poolB = new Pool(config);
    const migration = await readFile(new URL("../migrations/001_etsy_connections.sql", import.meta.url), "utf8");
    await poolA.query(migration);
    await poolA.query(migration); // Safe to rerun the additive migration.
    const repositoryA = createPostgresEtsyConnectionRepository({ pool: poolA, cipher });
    const repositoryB = createPostgresEtsyConnectionRepository({ pool: poolB, cipher });
    setEtsyConnectionRepository(repositoryA);
    const connection = await createEtsyConnection({
      tokenResult: {
        accessToken: "12345678.integration_access", refreshToken: "integration_refresh",
        tokenType: "Bearer", scopes: ["shops_r"], expiresInSeconds: 1,
      }, now: 1000,
    });
    const { rows } = await poolA.query("SELECT payload FROM etsy_connections");
    assert.equal(rows[0].payload.includes(connection.accessToken), false);
    assert.equal(rows[0].payload.includes(connection.refreshToken), false);
    await poolA.end();
    poolA = null;

    // A fresh Node process/pool has no access to the parent's memory store.
    const code = `
      import assert from "node:assert/strict";
      import { Pool } from "pg";
      import { createEtsyTokenCipher } from "./src/integrations/etsy/auth/etsyTokenCipher.js";
      import { createPostgresEtsyConnectionRepository } from "./src/integrations/etsy/auth/postgresEtsyConnectionRepository.js";
      const pool = new Pool(JSON.parse(process.env.ETSY_TEST_POOL_CONFIG));
      try {
        const store = createPostgresEtsyConnectionRepository({ pool, cipher: createEtsyTokenCipher("ab".repeat(32)) });
        const record = await store.get(process.env.ETSY_TEST_CONNECTION_ID);
        assert.equal(record.accessToken, "12345678.integration_access");
        assert.equal(record.refreshToken, "integration_refresh");
      } finally { await pool.end(); }
    `;
    await promisify(execFile)(process.execPath, ["--input-type=module", "-e", code], {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, ETSY_TEST_POOL_CONFIG: JSON.stringify(config), ETSY_TEST_CONNECTION_ID: connection.connectionId },
    });
    poolA = new Pool(config);
    const restarted = createPostgresEtsyConnectionRepository({ pool: poolA, cipher });
    let rotations = 0;
    const rotate = repository => repository.withLock(connection.connectionId, async locked => {
      const record = await locked.get(connection.connectionId);
      if (record.refreshToken === "integration_refresh") {
        rotations++;
        await new Promise(resolve => setTimeout(resolve, 30));
        await locked.save({ ...record, refreshToken: "rotated_refresh" });
      }
    });
    await Promise.all([rotate(restarted), rotate(repositoryB)]);
    assert.equal(rotations, 1);
    assert.equal((await restarted.get(connection.connectionId)).refreshToken, "rotated_refresh");
    await assert.rejects(restarted.withLock(connection.connectionId, async locked => {
      const record = await locked.get(connection.connectionId);
      await locked.save({ ...record, refreshToken: "must_roll_back" });
      throw new Error("intentional rollback");
    }), /intentional rollback/);
    assert.equal((await repositoryB.get(connection.connectionId)).refreshToken, "rotated_refresh");
    await poolB.query("UPDATE etsy_connections SET payload = 'corrupt' WHERE connection_id = $1", [connection.connectionId]);
    await assert.rejects(restarted.get(connection.connectionId), /DECRYPTION_FAILED/);
  } finally {
    setEtsyConnectionRepository(createMemoryEtsyConnectionRepository());
    if (poolA) await poolA.end();
    if (poolB) await poolB.end();
    await admin.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
    await admin.end();
  }
});
