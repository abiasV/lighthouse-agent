import test, { afterEach } from "node:test";

import assert from "node:assert/strict";

import completeEtsyAuthorization from "../src/integrations/etsy/auth/completeEtsyAuthorization.js";

import {
  clearEtsyAuthSessions,
  createEtsyAuthSession,
} from "../src/integrations/etsy/auth/etsyAuthSessionStore.js";

import {
  clearEtsyConnections,
  getEtsyConnection,
  getEtsyConnectionCount,
} from "../src/integrations/etsy/auth/etsyConnectionStore.js";

afterEach(() => {
  clearEtsyAuthSessions();
  clearEtsyConnections();
});

test("completes Etsy authorization using the stored PKCE session", async () => {
  const now = 1_000_000;

  createEtsyAuthSession({
    state: "valid_state",
    codeVerifier: "stored_verifier",
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

  const result = await completeEtsyAuthorization({
    state: "valid_state",
    code: "authorization_code",
    clientId: "test_client",
    now: now + 1000,
    exchangeAuthorizationCode: fakeExchange,
  });

  assert.equal(capturedInput.clientId, "test_client");

  assert.equal(capturedInput.code, "authorization_code");

  assert.equal(capturedInput.codeVerifier, "stored_verifier");

  assert.equal(
    capturedInput.redirectUri,
    "https://example.com/api/etsy/auth/callback",
  );

  assert.equal(result.connection.etsyUserId, "12345678");

  assert.equal(getEtsyConnectionCount(), 1);

  const storedConnection = getEtsyConnection(result.connection.connectionId);

  assert.equal(storedConnection.accessToken, "12345678.fake_access_token");

  assert.equal(storedConnection.refreshToken, "12345678.fake_refresh_token");

  assert.equal("accessToken" in result.connection, false);

  assert.equal("refreshToken" in result.connection, false);
});

test("rejects an invalid or expired OAuth state before token exchange", async () => {
  let exchangeCalled = false;

  async function fakeExchange() {
    exchangeCalled = true;

    throw new Error("TOKEN_EXCHANGE_SHOULD_NOT_RUN");
  }

  await assert.rejects(
    () =>
      completeEtsyAuthorization({
        state: "unknown_state",
        code: "authorization_code",
        clientId: "test_client",
        exchangeAuthorizationCode: fakeExchange,
      }),
    {
      message: "INVALID_OR_EXPIRED_ETSY_OAUTH_STATE",
    },
  );

  assert.equal(exchangeCalled, false);

  assert.equal(getEtsyConnectionCount(), 0);
});

test("OAuth state cannot be reused after completion", async () => {
  const now = 2_000_000;

  createEtsyAuthSession({
    state: "single_use_state",
    codeVerifier: "stored_verifier",
    redirectUri: "https://example.com/callback",
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

  await completeEtsyAuthorization({
    state: "single_use_state",
    code: "first_code",
    clientId: "test_client",
    now: now + 1,
    exchangeAuthorizationCode: fakeExchange,
  });

  await assert.rejects(
    () =>
      completeEtsyAuthorization({
        state: "single_use_state",
        code: "second_code",
        clientId: "test_client",
        now: now + 2,
        exchangeAuthorizationCode: fakeExchange,
      }),
    {
      message: "INVALID_OR_EXPIRED_ETSY_OAUTH_STATE",
    },
  );
});

test("does not create a connection when required scopes are missing", async () => {
  const now = 3_000_000;

  createEtsyAuthSession({
    state: "missing_scope_state",
    codeVerifier: "stored_verifier",
    redirectUri: "https://example.com/callback",
    scopes: ["shops_r", "listings_r", "transactions_r", "email_r"],
    now,
  });

  async function fakeExchange() {
    return {
      accessToken: "12345678.fake_access",

      refreshToken: "12345678.fake_refresh",

      tokenType: "Bearer",

      expiresInSeconds: 3600,

      scopes: ["listings_r"],
    };
  }

  await assert.rejects(
    () =>
      completeEtsyAuthorization({
        state: "missing_scope_state",
        code: "authorization_code",
        clientId: "test_client",
        now: now + 1,
        exchangeAuthorizationCode: fakeExchange,
      }),
    {
      message: "ETSY_REQUIRED_SCOPE_NOT_GRANTED",
    },
  );

  assert.equal(getEtsyConnectionCount(), 0);
});