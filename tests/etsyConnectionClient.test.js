import test from "node:test";
import assert from "node:assert/strict";
import { requestEtsy, validateEtsyAuthorizationUrl } from "../client/src/utils/etsyConnection.js";

const origin = "https://lighthouse-agent-app.netlify.app";
function authUrl(callback = `${origin}/api/etsy/auth/callback`) {
  const url = new URL("https://www.etsy.com/oauth/connect");
  url.searchParams.set("redirect_uri", callback);
  return url.href;
}

test("client allows only Etsy authorization with the same-origin callback", () => {
  assert.equal(validateEtsyAuthorizationUrl(authUrl(), origin), authUrl());
  for (const url of ["javascript:alert(1)", "https://evil.example/oauth/connect", authUrl("https://lighthouse-agent-api.onrender.com/api/etsy/auth/callback"), authUrl(`${origin}/other`), authUrl(`${origin}/api/etsy/auth/callback?next=evil`), authUrl().replace("www.etsy.com", "www.etsy.com.evil.example")]) {
    assert.throws(() => validateEtsyAuthorizationUrl(url, origin));
  }
});

test("client requests use the browser cookie and bypass caches", async () => {
  const result = await requestEtsy("/api/etsy/me", { fetchImpl: async (url, options) => {
    assert.equal(url, "/api/etsy/me");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Accept, "application/json");
    return new Response(JSON.stringify({ connected: true }), { status: 200 });
  } });
  assert.equal(result.connected, true);
});

test("client preserves session error codes but does not expose provider error text", async () => {
  await assert.rejects(requestEtsy("/api/etsy/me", { fetchImpl: async () => new Response(JSON.stringify({ error: "ETSY_BROWSER_SESSION_REQUIRED", message: "secret internal data" }), { status: 401 }) }), (error) => {
    assert.equal(error.code, "ETSY_BROWSER_SESSION_REQUIRED");
    assert.doesNotMatch(error.message, /secret/);
    return true;
  });
  await assert.rejects(requestEtsy("/api/etsy/me", { fetchImpl: async () => new Response("<html>loading</html>") }), /unexpected response/);
});
