import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createEtsyTokenCipher } from "../src/integrations/etsy/auth/etsyTokenCipher.js";
import { createMemoryEtsyConnectionRepository } from "../src/integrations/etsy/auth/memoryEtsyConnectionRepository.js";
import { createPostgresEtsyConnectionRepository } from "../src/integrations/etsy/auth/postgresEtsyConnectionRepository.js";
import {
  createEtsyConnection, getEtsyConnection, setEtsyConnectionRepository,
} from "../src/integrations/etsy/auth/etsyConnectionStore.js";
import getValidEtsyAccessToken from "../src/integrations/etsy/auth/getValidEtsyAccessToken.js";
import {
  buildEtsyDatabaseConfig, configureEtsyConnectionStorage, requireEtsyConnectionStorage,
} from "../src/integrations/etsy/auth/configureEtsyConnectionStorage.js";
import {
  createEtsyBrowserSession,
  hashEtsyBrowserSession,
  serializeEtsyBrowserSessionCookie,
} from "../src/integrations/etsy/auth/etsyBrowserSession.js";

const key = "ab".repeat(32); // Test-only key.
const cipher = createEtsyTokenCipher(key);
const tokens = {
  accessToken: "12345678.test_access", refreshToken: "12345678.test_refresh",
  tokenType: "Bearer", scopes: ["shops_r"], expiresInSeconds: 1,
};
afterEach(() => setEtsyConnectionRepository(createMemoryEtsyConnectionRepository()));

test("browser session uses a high-entropy HttpOnly cookie and stores only its hash", () => {
  const session = createEtsyBrowserSession();
  assert.match(session.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(session.ownerSessionHash, hashEtsyBrowserSession(session.token));
  assert.match(session.ownerSessionHash, /^[a-f0-9]{64}$/);
  const cookie = serializeEtsyBrowserSessionCookie(session.token);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal(cookie.includes(session.ownerSessionHash), false);
});

test("connection creation requires a valid owner and reconnects the same browser", async () => {
  await assert.rejects(
    createEtsyConnection({ tokenResult: tokens }),
    /ETSY_OWNER_SESSION_INVALID/,
  );
  const ownerSessionHash = "ef".repeat(32);
  const first = await createEtsyConnection({ tokenResult: tokens, ownerSessionHash });
  const second = await createEtsyConnection({
    tokenResult: {
      ...tokens,
      accessToken: "12345678.reconnected",
      refreshToken: "reconnected_refresh",
    },
    ownerSessionHash,
  });
  assert.equal(second.connectionId, first.connectionId);
  assert.equal((await getEtsyConnection(first.connectionId)).accessToken, "12345678.reconnected");
});

test("AES-GCM encrypts the complete record with fresh IVs and round-trips", () => {
  const record = { connectionId: "connection-1", ...tokens };
  const first = cipher.encrypt(record);
  assert.notEqual(first, cipher.encrypt(record));
  assert.equal(first.includes(tokens.accessToken), false);
  assert.equal(first.includes(tokens.refreshToken), false);
  assert.deepEqual(cipher.decrypt(record.connectionId, first), record);
});

test("cipher rejects bad keys, tampering, wrong keys and cross-connection swaps", () => {
  for (const badKey of [undefined, "", "password", "a".repeat(63), "z".repeat(64)]) {
    assert.throws(() => createEtsyTokenCipher(badKey), /ENCRYPTION_KEY_INVALID/);
  }
  const encrypted = cipher.encrypt({ connectionId: "one", ...tokens });
  const parts = encrypted.split(".");
  const damaged = Buffer.from(parts[3], "base64");
  damaged[0] ^= 1;
  parts[3] = damaged.toString("base64");
  for (const payload of ["invalid", parts.join("."), encrypted.replace("v1", "v2")]) {
    assert.throws(() => cipher.decrypt("one", payload), /DECRYPTION_FAILED/);
  }
  assert.throws(() => cipher.decrypt("two", encrypted), /DECRYPTION_FAILED/);
  assert.throws(() => createEtsyTokenCipher("cd".repeat(32)).decrypt("one", encrypted), /DECRYPTION_FAILED/);
});

test("simultaneous expiry refreshes call Etsy once and keep the rotated token", async () => {
  const connection = await createEtsyConnection({
    tokenResult: tokens, ownerSessionHash: "cd".repeat(32), now: 1000,
  });
  let calls = 0;
  const results = await Promise.all(Array.from({ length: 8 }, () => getValidEtsyAccessToken({
    connectionId: connection.connectionId, clientId: "client", now: 3000,
    refreshAccessToken: async () => {
      calls++;
      await new Promise(resolve => setImmediate(resolve));
      return { ...tokens, accessToken: "12345678.new", refreshToken: "rotated", expiresInSeconds: 3600 };
    },
  })));
  assert.equal(calls, 1);
  assert.ok(results.every(result => result.accessToken === "12345678.new"));
  assert.equal((await getEtsyConnection(connection.connectionId)).refreshToken, "rotated");
});

test("parallel 401 retries reuse the token already rotated by another request", async () => {
  const connection = await createEtsyConnection({
    tokenResult: { ...tokens, expiresInSeconds: 3600 },
    ownerSessionHash: "cd".repeat(32),
  });
  let calls = 0;
  await Promise.all(Array.from({ length: 5 }, () => getValidEtsyAccessToken({
    connectionId: connection.connectionId, clientId: "client",
    forceRefresh: true, rejectedAccessToken: tokens.accessToken,
    refreshAccessToken: async () => {
      calls++;
      return { ...tokens, accessToken: "12345678.new", expiresInSeconds: 3600 };
    },
  })));
  assert.equal(calls, 1);
});

test("failed persistent write is not reported as a successful refresh", async () => {
  const memory = createMemoryEtsyConnectionRepository();
  setEtsyConnectionRepository(memory);
  const connection = await createEtsyConnection({
    tokenResult: tokens, ownerSessionHash: "cd".repeat(32), now: 1000,
  });
  const repository = { ...memory, save: async () => { throw new Error("ETSY_CONNECTION_STORAGE_UNAVAILABLE"); } };
  repository.withLock = (_id, callback) => callback(repository);
  setEtsyConnectionRepository(repository);
  await assert.rejects(getValidEtsyAccessToken({
    connectionId: connection.connectionId, now: 3000, clientId: "client",
    refreshAccessToken: async () => ({ ...tokens, accessToken: "12345678.new", expiresInSeconds: 3600 }),
  }), /STORAGE_UNAVAILABLE/);
  assert.equal((await getEtsyConnection(connection.connectionId)).accessToken, tokens.accessToken);
});

test("database TLS verifies certificates and rejects URL overrides / remote plaintext", () => {
  const env = { ETSY_DATABASE_URL: "postgres://user:pass@db.example/test" };
  assert.equal(buildEtsyDatabaseConfig(env).ssl.rejectUnauthorized, true);
  assert.throws(() => buildEtsyDatabaseConfig({ ...env, ETSY_DATABASE_SSL: "disable" }), /TLS_REQUIRED/);
  assert.throws(() => buildEtsyDatabaseConfig({ ...env, ETSY_DATABASE_URL: env.ETSY_DATABASE_URL + "?sslmode=no-verify" }), /URL_OPTIONS_NOT_ALLOWED/);
  assert.throws(() => buildEtsyDatabaseConfig({ ETSY_DATABASE_URL: "https://example.com" }), /URL_INVALID/);
  assert.equal(buildEtsyDatabaseConfig({ ETSY_DATABASE_URL: "postgres://localhost/test", ETSY_DATABASE_SSL: "disable" }).ssl, false);
  assert.throws(() => buildEtsyDatabaseConfig({ ETSY_DATABASE_URL: "postgres://localhost/test", ETSY_DATABASE_SSL: "disable", NODE_ENV: "production" }), /TLS_REQUIRED/);
});

test("storage is disabled by default and production refuses memory storage", async () => {
  assert.equal((await configureEtsyConnectionStorage({ env: {} })).enabled, false);
  await assert.rejects(configureEtsyConnectionStorage({ env: { ETSY_CONNECTION_STORAGE: "memory", NODE_ENV: "production" } }), /MEMORY_STORAGE_NOT_ALLOWED/);
  await assert.rejects(configureEtsyConnectionStorage({ env: { ETSY_CONNECTION_STORAGE: "memory", RENDER: "true" } }), /MEMORY_STORAGE_NOT_ALLOWED/);
  await assert.rejects(configureEtsyConnectionStorage({ env: { ETSY_CONNECTION_STORAGE: "unknown" } }), /STORAGE_INVALID/);
});

test("invalid encryption config fails before connecting; DB errors never fall back", async () => {
  const env = { ETSY_CONNECTION_STORAGE: "postgres", ETSY_DATABASE_URL: "postgres://db.example/test" };
  let connected = false;
  await assert.rejects(configureEtsyConnectionStorage({ env, createPool: () => { connected = true; } }), /KEY_INVALID/);
  assert.equal(connected, false);
  let closed = false;
  await assert.rejects(configureEtsyConnectionStorage({
    env: { ...env, ETSY_TOKEN_ENCRYPTION_KEY: key },
    createPool: () => ({ on() {}, query: async () => { throw new Error("sensitive database detail"); }, end: async () => { closed = true; } }),
  }), { message: "ETSY_STORAGE_INITIALIZATION_FAILED" });
  assert.equal(closed, true);
});

test("production storage enables browser-owned Etsy routes after initialization", async () => {
  const storage = await configureEtsyConnectionStorage({
    env: { ETSY_CONNECTION_STORAGE: "postgres", ETSY_DATABASE_URL: "postgres://db.example/test", ETSY_TOKEN_ENCRYPTION_KEY: key, NODE_ENV: "production" },
    createPool: () => ({ on() {}, query: async () => ({ rows: [] }), end: async () => {} }),
  });
  assert.equal(storage.ready, true);
  assert.equal(storage.enabled, true);
});

test("disabled Etsy routes return no-store 503 without blocking manual routes", async () => {
  const app = express();
  app.get("/api/shop/test", (_req, res) => res.json({ ok: true }));
  app.use("/api/etsy", requireEtsyConnectionStorage({ enabled: false }));
  app.get("/api/etsy/auth/start", () => { throw new Error("must not run"); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    const response = await fetch(base + "/api/etsy/auth/start");
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).error, "ETSY_CONNECTION_STORAGE_NOT_CONFIGURED");
    assert.equal((await fetch(base + "/api/shop/test")).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("Postgres lock uses one client, rolls back on failure, and releases it", async () => {
  const calls = [];
  const client = {
    query: async sql => { calls.push(sql); return { rows: [] }; },
    release: () => calls.push("release"),
  };
  const repository = createPostgresEtsyConnectionRepository({
    pool: { connect: async () => client }, cipher,
  });
  await assert.rejects(repository.withLock("id", async () => { throw new Error("refresh failed"); }), /refresh failed/);
  assert.equal(calls[0], "BEGIN");
  assert.ok(calls.some(sql => sql.includes("FOR UPDATE")));
  assert.deepEqual(calls.slice(-2), ["ROLLBACK", "release"]);
});

test("Postgres failures expose only a safe storage error", async () => {
  const repository = createPostgresEtsyConnectionRepository({
    pool: { query: async () => { throw new Error("postgres://secret@host/test"); } }, cipher,
  });
  await assert.rejects(repository.get("id"), { message: "ETSY_CONNECTION_STORAGE_UNAVAILABLE" });
});

test("owner index tampering cannot grant access to another encrypted connection", async () => {
  const record = { connectionId: "one", ownerSessionHash: "ab".repeat(32), ...tokens };
  const repository = createPostgresEtsyConnectionRepository({
    pool: { query: async () => ({ rows: [{ connection_id: "one", payload: cipher.encrypt(record) }] }) },
    cipher,
  });
  await assert.rejects(repository.getByOwnerSessionHash("cd".repeat(32)), /OWNER_MISMATCH/);
  assert.equal((await repository.getByOwnerSessionHash(record.ownerSessionHash)).connectionId, "one");
});

test("parallel OAuth completions create only one connection for the same browser", async () => {
  const ownerSessionHash = "ef".repeat(32);
  const connections = await Promise.all(Array.from({ length: 5 }, () =>
    createEtsyConnection({ tokenResult: tokens, ownerSessionHash }),
  ));
  assert.equal(new Set(connections.map(connection => connection.connectionId)).size, 1);
});

test("reconnect waits for an in-flight refresh and preserves the new authorization", async () => {
  const ownerSessionHash = "ef".repeat(32);
  const first = await createEtsyConnection({ tokenResult: tokens, ownerSessionHash, now: 1000 });
  let started;
  const refreshing = new Promise(resolve => { started = resolve; });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const refresh = getValidEtsyAccessToken({
    connectionId: first.connectionId, now: 3000,
    refreshAccessToken: async () => {
      started();
      await gate;
      return { ...tokens, accessToken: "12345678.old_refresh", expiresInSeconds: 3600 };
    },
  });
  await refreshing;
  const reconnect = createEtsyConnection({
    ownerSessionHash, now: 4000,
    tokenResult: { ...tokens, accessToken: "12345678.new_authorization" },
  });
  await new Promise(resolve => setImmediate(resolve));
  release();
  await Promise.all([refresh, reconnect]);
  const saved = await getEtsyConnection(first.connectionId);
  assert.equal(saved.accessToken, "12345678.new_authorization");
  assert.equal(saved.createdAt, 1000);
});

test("replayed browser credentials expire on the server and legacy ownership fails closed", async () => {
  const { getEtsyConnectionByOwnerSessionHash } = await import("../src/integrations/etsy/auth/etsyConnectionStore.js");
  const ownerSessionHash = "ef".repeat(32);
  const connection = await createEtsyConnection({ tokenResult: tokens, ownerSessionHash, now: 1000 });
  assert.equal((await getEtsyConnectionByOwnerSessionHash(ownerSessionHash, 1001)).connectionId, connection.connectionId);
  assert.equal(await getEtsyConnectionByOwnerSessionHash(ownerSessionHash, connection.ownerSessionExpiresAt), null);
  setEtsyConnectionRepository({ getByOwnerSessionHash: async () => ({ ...connection, ownerSessionExpiresAt: undefined }) });
  assert.equal(await getEtsyConnectionByOwnerSessionHash(ownerSessionHash, 1001), null);
});
