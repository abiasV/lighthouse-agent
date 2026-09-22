import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createEtsyAuthRouter } from "../src/routes/etsyAuthRoutes.js";
import { createEtsyConnection, disconnectEtsyConnection, getEtsyConnectionByOwnerSessionHash, setEtsyConnectionRepository } from "../src/integrations/etsy/auth/etsyConnectionStore.js";
import { createMemoryEtsyConnectionRepository } from "../src/integrations/etsy/auth/memoryEtsyConnectionRepository.js";
import { createEtsyAuthSession, clearEtsyAuthSessions } from "../src/integrations/etsy/auth/etsyAuthSessionStore.js";
import complete from "../src/integrations/etsy/auth/completeEtsyAuthorization.js";
import { hashEtsyBrowserSession } from "../src/integrations/etsy/auth/etsyBrowserSession.js";
import { requestEtsy } from "../client/src/utils/etsyConnection.js";
const owner = "ab".repeat(32), other = "cd".repeat(32);
const tokenResult = { accessToken: "123.token", refreshToken: "secret", tokenType: "Bearer", scopes: [], expiresInSeconds: 3600 };
function session(state) { createEtsyAuthSession({ state, ownerSessionHash: owner, codeVerifier: "verifier", redirectUri: "https://app.test/callback", scopes: [] }); }

test("disconnect deletes only its owner and invalidates pending authorization", async () => {
  setEtsyConnectionRepository(createMemoryEtsyConnectionRepository()); clearEtsyAuthSessions();
  await createEtsyConnection({ ownerSessionHash: owner, tokenResult });
  await createEtsyConnection({ ownerSessionHash: other, tokenResult }); session("pending");
  await disconnectEtsyConnection(owner);
  await disconnectEtsyConnection(owner);
  assert.equal(await getEtsyConnectionByOwnerSessionHash(owner), null);
  assert.ok(await getEtsyConnectionByOwnerSessionHash(other));
  await assert.rejects(complete({ state: "pending", code: "code", ownerSessionHash: owner }), /INVALID_OR_EXPIRED/);
});

test("disconnect waits for in-flight authorization then removes its tokens", async () => {
  setEtsyConnectionRepository(createMemoryEtsyConnectionRepository()); session("inflight");
  let release, started;
  const ready = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const authorization = complete({ state: "inflight", code: "code", ownerSessionHash: owner,
    exchangeAuthorizationCode: async () => { started(); await gate; return tokenResult; } });
  await ready;
  const deletion = disconnectEtsyConnection(owner);
  release(); await authorization; await deletion;
  assert.equal(await getEtsyConnectionByOwnerSessionHash(owner), null);
});

test("disconnect endpoint checks origin, derives owner from cookie, and preserves cookie on failure", async t => {
  const old = process.env.ETSY_REDIRECT_URI;
  process.env.ETSY_REDIRECT_URI = "https://app.test/api/etsy/auth/callback";
  t.after(() => { if (old === undefined) delete process.env.ETSY_REDIRECT_URI; else process.env.ETSY_REDIRECT_URI = old; });
  let fail = false, calls = [];
  const app = express(); app.use("/auth", createEtsyAuthRouter({ disconnect: async hash => { calls.push(hash); if (fail) throw Error("db secret"); } }));
  const server = app.listen(0); await new Promise(resolve => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://localhost:${server.address().port}/auth/disconnect`;
  const cookie = "lighthouse_etsy_session=" + "A".repeat(43);
  const headers = { Origin: "https://app.test", "X-Lighthouse-Action": "disconnect", Cookie: cookie };
  for (const origin of ["https://evil.test", "null", ""]) {
    assert.equal((await fetch(url, { method: "POST", headers: { ...headers, Origin: origin } })).status, 403);
  }
  assert.equal(calls.length, 0);
  let response = await fetch(url, { method: "POST", headers });
  assert.equal(response.status, 200); assert.match(response.headers.get("set-cookie"), /Path=\/api\/etsy; HttpOnly; SameSite=Lax; Max-Age=0/);
  assert.deepEqual(calls, [hashEtsyBrowserSession("A".repeat(43))]);
  fail = true; response = await fetch(url, { method: "POST", headers });
  assert.equal(response.status, 503); assert.equal(response.headers.get("set-cookie"), null);
  assert.doesNotMatch(await response.text(), /db secret/);
});

test("disconnect client sends POST with same-origin cookie and action header", async () => {
  await requestEtsy("/api/etsy/auth/disconnect", { method: "POST", headers: { "X-Lighthouse-Action": "disconnect" }, fetchImpl: async (_url, options) => {
    assert.equal(options.method, "POST"); assert.equal(options.credentials, "same-origin");
    assert.equal(options.headers["X-Lighthouse-Action"], "disconnect");
    return { ok: true, json: async () => ({ connected: false }) };
  } });
});
