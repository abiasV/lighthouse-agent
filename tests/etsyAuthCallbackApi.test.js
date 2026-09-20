import test, { afterEach, beforeEach } from "node:test";

import assert from "node:assert/strict";
import express from "express";

import { createEtsyAuthRouter } from "../src/routes/etsyAuthRoutes.js";

import {
  clearEtsyAuthSessions,
  consumeEtsyAuthSession,
  createEtsyAuthSession,
  getEtsyAuthSessionCount,
} from "../src/integrations/etsy/auth/etsyAuthSessionStore.js";

import {
  clearEtsyConnections,
  getEtsyConnectionCount,
} from "../src/integrations/etsy/auth/etsyConnectionStore.js";
import {
  ETSY_BROWSER_SESSION_COOKIE,
  hashEtsyBrowserSession,
} from "../src/integrations/etsy/auth/etsyBrowserSession.js";

const browserToken = "A".repeat(43);
const ownerSessionHash = hashEtsyBrowserSession(browserToken);
const browserHeaders = {
  Cookie: `${ETSY_BROWSER_SESSION_COOKIE}=${browserToken}`,
};

let server;
let baseUrl;

async function startTestServer({ exchangeAuthorizationCode } = {}) {
  const app = express();

  app.use(express.json());

  app.use(
    "/api/etsy/auth",
    createEtsyAuthRouter({
      exchangeAuthorizationCode,
    }),
  );

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function stopTestServer() {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  server = null;
}

beforeEach(() => {
  process.env.ETSY_CLIENT_ID = "test_etsy_client";
});

afterEach(async () => {
  await stopTestServer();

  clearEtsyAuthSessions();
  clearEtsyConnections();

  delete process.env.ETSY_CLIENT_ID;
});

test("Etsy callback rejects a request with missing state", async () => {
  await startTestServer();

  const response = await fetch(
    `${baseUrl}/api/etsy/auth/callback?code=test_code`,
  );

  assert.equal(response.status, 400);

  const data = await response.json();

  assert.equal(data.error, "ETSY_OAUTH_STATE_REQUIRED");

  assert.equal(getEtsyConnectionCount(), 0);
});

test("Etsy callback requires the browser session before token exchange", async () => {
  let exchangeCalled = false;

  async function fakeExchange() {
    exchangeCalled = true;

    throw new Error("TOKEN_EXCHANGE_SHOULD_NOT_RUN");
  }

  await startTestServer({
    exchangeAuthorizationCode: fakeExchange,
  });

  const response = await fetch(
    `${baseUrl}/api/etsy/auth/callback?state=unknown_state&code=test_code`,
  );

  assert.equal(response.status, 401);

  const data = await response.json();

  assert.equal(data.error, "ETSY_BROWSER_SESSION_REQUIRED");

  assert.equal(exchangeCalled, false);

  assert.equal(getEtsyConnectionCount(), 0);
});

test("Etsy authorization denial discards the stored OAuth session", async () => {
  const now = Date.now();

  createEtsyAuthSession({
    ownerSessionHash,
    state: "denied_state",
    codeVerifier: "denied_verifier",
    redirectUri: "https://example.com/api/etsy/auth/callback",
    scopes: ["shops_r", "listings_r", "transactions_r", "email_r"],
    now,
  });

  assert.equal(getEtsyAuthSessionCount(now), 1);

  await startTestServer();

  const response = await fetch(
    `${baseUrl}/api/etsy/auth/callback?error=access_denied&error_description=User%20declined&state=denied_state`,
    { headers: browserHeaders },
  );

  assert.equal(response.status, 400);

  const data = await response.json();

  assert.equal(data.error, "ETSY_AUTHORIZATION_DENIED");

  assert.equal(data.message, "User declined");

  assert.equal(consumeEtsyAuthSession("denied_state", Date.now()), null);

  assert.equal(getEtsyAuthSessionCount(), 0);
});

test("successful Etsy callback creates a connection without exposing tokens", async () => {
  const now = Date.now();

  createEtsyAuthSession({
    ownerSessionHash,
    state: "valid_callback_state",
    codeVerifier: "stored_callback_verifier",
    redirectUri: "https://example.com/api/etsy/auth/callback",
    scopes: ["shops_r", "listings_r", "transactions_r", "email_r"],
    now,
  });

  let capturedInput = null;

  async function fakeExchange(input) {
    capturedInput = input;

    return {
      accessToken: "12345678.fake_access_token",

      refreshToken: "12345678.fake_refresh_token",

      tokenType: "Bearer",

      expiresInSeconds: 3600,

      scopes: ["shops_r", "listings_r", "transactions_r", "email_r"],
    };
  }

  await startTestServer({
    exchangeAuthorizationCode: fakeExchange,
  });

  const response = await fetch(
    `${baseUrl}/api/etsy/auth/callback?state=valid_callback_state&code=test_authorization_code`,
    { headers: browserHeaders },
  );

  assert.equal(response.status, 200);

  const data = await response.json();

  assert.equal(data.connected, true);

  assert.equal(data.connection.etsyUserId, "12345678");

  assert.equal("connectionId" in data.connection, false);

  assert.equal("accessToken" in data.connection, false);

  assert.equal("refreshToken" in data.connection, false);

  assert.equal(getEtsyConnectionCount(), 1);

  assert.equal(capturedInput.clientId, "test_etsy_client");

  assert.equal(capturedInput.code, "test_authorization_code");

  assert.equal(capturedInput.codeVerifier, "stored_callback_verifier");

  assert.equal(
    capturedInput.redirectUri,
    "https://example.com/api/etsy/auth/callback",
  );
});

test("successful Etsy callback consumes the OAuth state", async () => {
  const now = Date.now();

  createEtsyAuthSession({
    ownerSessionHash,
    state: "single_use_callback_state",
    codeVerifier: "single_use_callback_verifier",
    redirectUri: "https://example.com/api/etsy/auth/callback",
    scopes: ["shops_r", "listings_r", "transactions_r", "email_r"],
    now,
  });

  async function fakeExchange() {
    return {
      accessToken: "12345678.fake_access",

      refreshToken: "12345678.fake_refresh",

      tokenType: "Bearer",

      expiresInSeconds: 3600,

      scopes: ["shops_r", "listings_r", "transactions_r", "email_r"],
    };
  }

  await startTestServer({
    exchangeAuthorizationCode: fakeExchange,
  });

  const firstResponse = await fetch(
    `${baseUrl}/api/etsy/auth/callback?state=single_use_callback_state&code=first_code`,
    { headers: browserHeaders },
  );

  assert.equal(firstResponse.status, 200);

  const secondResponse = await fetch(
    `${baseUrl}/api/etsy/auth/callback?state=single_use_callback_state&code=second_code`,
    { headers: browserHeaders },
  );

  assert.equal(secondResponse.status, 400);

  const secondData = await secondResponse.json();

  assert.equal(secondData.error, "INVALID_OR_EXPIRED_ETSY_OAUTH_STATE");
});

test("callback rejects another browser without consuming the rightful OAuth state", async () => {
  const state = "browser_bound_state";
  createEtsyAuthSession({
    ownerSessionHash,
    state,
    codeVerifier: "browser_bound_verifier",
    redirectUri: "https://example.com/callback",
    scopes: ["shops_r"],
  });
  let exchanges = 0;
  await startTestServer({
    exchangeAuthorizationCode: async () => {
      exchanges += 1;
      return {
        accessToken: "12345678.access",
        refreshToken: "12345678.refresh",
        tokenType: "Bearer",
        expiresInSeconds: 3600,
        scopes: ["shops_r"],
      };
    },
  });
  const wrongResponse = await fetch(
    `${baseUrl}/api/etsy/auth/callback?state=${state}&code=code`,
    {
      headers: {
        Cookie: `${ETSY_BROWSER_SESSION_COOKIE}=${"B".repeat(43)}`,
      },
    },
  );
  assert.equal(wrongResponse.status, 401);
  assert.equal(
    (await wrongResponse.json()).error,
    "ETSY_OAUTH_BROWSER_SESSION_MISMATCH",
  );
  assert.equal(exchanges, 0);

  const rightfulResponse = await fetch(
    `${baseUrl}/api/etsy/auth/callback?state=${state}&code=code`,
    { headers: browserHeaders },
  );
  assert.equal(rightfulResponse.status, 200);
  assert.equal(exchanges, 1);
});

test("a denied callback from another browser cannot cancel the owner's authorization", async () => {
  createEtsyAuthSession({
    ownerSessionHash, state: "protected_denial", codeVerifier: "verifier",
    redirectUri: "https://example.com/callback", scopes: ["shops_r"],
  });
  await startTestServer();
  const url = `${baseUrl}/api/etsy/auth/callback?error=access_denied&state=protected_denial`;
  const missing = await fetch(url);
  assert.equal(missing.status, 401);
  const wrong = await fetch(url, {
    headers: { Cookie: `${ETSY_BROWSER_SESSION_COOKIE}=${"B".repeat(43)}` },
  });
  assert.equal(wrong.status, 401);
  assert.equal(getEtsyAuthSessionCount(), 1);
  assert.equal(wrong.headers.get("cache-control"), "no-store");
  const owner = await fetch(url, { headers: browserHeaders });
  assert.equal(owner.status, 400);
  assert.equal((await owner.json()).error, "ETSY_AUTHORIZATION_DENIED");
  assert.equal(getEtsyAuthSessionCount(), 0);
});
