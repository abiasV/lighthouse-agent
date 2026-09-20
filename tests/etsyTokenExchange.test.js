import test from "node:test";
import assert from "node:assert/strict";

import { ETSY_TOKEN_URL } from "../src/integrations/etsy/auth/exchangeEtsyAuthorizationCode.js";

import exchangeEtsyAuthorizationCode from "../src/integrations/etsy/auth/exchangeEtsyAuthorizationCode.js";

test("exchanges Etsy authorization code using the stored PKCE verifier", async () => {
  let capturedUrl = null;
  let capturedOptions = null;

  async function fakeFetch(url, options) {
    capturedUrl = url;
    capturedOptions = options;

    return {
      ok: true,

      async json() {
        return {
          access_token: "12345678.fake_access_token",

          refresh_token: "12345678.fake_refresh_token",

          token_type: "Bearer",

          expires_in: 3600,

          scope: "shops_r listings_r transactions_r email_r",
        };
      },
    };
  }

  const result = await exchangeEtsyAuthorizationCode({
    clientId: "test_client",
    code: "test_code",
    codeVerifier: "test_verifier",
    redirectUri: "https://example.com/api/etsy/auth/callback",
    fetchImpl: fakeFetch,
  });

  assert.equal(capturedUrl, ETSY_TOKEN_URL);

  assert.equal(capturedOptions.method, "POST");
  assert.ok(capturedOptions.signal instanceof AbortSignal);

  assert.equal(
    capturedOptions.headers["Content-Type"],
    "application/x-www-form-urlencoded",
  );

  const body = capturedOptions.body;

  assert.equal(body.get("grant_type"), "authorization_code");

  assert.equal(body.get("client_id"), "test_client");

  assert.equal(body.get("code"), "test_code");

  assert.equal(body.get("code_verifier"), "test_verifier");

  assert.equal(
    body.get("redirect_uri"),
    "https://example.com/api/etsy/auth/callback",
  );

  assert.deepEqual(result.scopes, ["shops_r", "listings_r", "transactions_r", "email_r"]);

  assert.equal(result.accessToken, "12345678.fake_access_token");

  assert.equal(result.refreshToken, "12345678.fake_refresh_token");
});

test("rejects an unsuccessful Etsy token exchange", async () => {
  async function fakeFetch() {
    return {
      ok: false,
    };
  }

  await assert.rejects(
    () =>
      exchangeEtsyAuthorizationCode({
        clientId: "test_client",
        code: "test_code",
        codeVerifier: "test_verifier",
        redirectUri: "https://example.com/callback",
        fetchImpl: fakeFetch,
      }),
    {
      message: "ETSY_TOKEN_EXCHANGE_FAILED",
    },
  );
});

test("rejects an invalid Etsy token response", async () => {
  async function fakeFetch() {
    return {
      ok: true,

      async json() {
        return {
          access_token: "12345678.access",
        };
      },
    };
  }

  await assert.rejects(
    () =>
      exchangeEtsyAuthorizationCode({
        clientId: "test_client",
        code: "test_code",
        codeVerifier: "test_verifier",
        redirectUri: "https://example.com/callback",
        fetchImpl: fakeFetch,
      }),
    {
      message: "INVALID_ETSY_TOKEN_RESPONSE",
    },
  );
});
