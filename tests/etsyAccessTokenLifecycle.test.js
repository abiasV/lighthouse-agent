import test, { afterEach } from "node:test";

import assert from "node:assert/strict";

import getValidEtsyAccessToken, {
  ETSY_TOKEN_REFRESH_BUFFER_MS,
} from "../src/integrations/etsy/auth/getValidEtsyAccessToken.js";

import {
  clearEtsyConnections,
  createEtsyConnection,
  getEtsyConnection,
} from "../src/integrations/etsy/auth/etsyConnectionStore.js";

afterEach(() => {
  clearEtsyConnections();
});

function createTestConnection({ now, expiresInSeconds = 3600 }) {
  return createEtsyConnection({
    ownerSessionHash: "ab".repeat(32),
    tokenResult: {
      accessToken: "12345678.old_access",

      refreshToken: "12345678.old_refresh",

      tokenType: "Bearer",

      expiresInSeconds,

      scopes: ["listings_r", "transactions_r"],
    },

    now,
  });
}

test("returns the existing Etsy access token when it is still safely valid", async () => {
  const now = 1_000_000;

  const connection = await createTestConnection({
    now,
    expiresInSeconds: 3600,
  });

  let refreshCalled = false;

  async function fakeRefresh() {
    refreshCalled = true;

    throw new Error("REFRESH_SHOULD_NOT_RUN");
  }

  const result = await getValidEtsyAccessToken({
    connectionId: connection.connectionId,

    clientId: "test_client",

    now: now + 1000,

    refreshAccessToken: fakeRefresh,
  });

  assert.equal(result.accessToken, "12345678.old_access");

  assert.equal(result.refreshed, false);

  assert.equal(refreshCalled, false);
});

test("refreshes an Etsy access token when it is inside the refresh buffer", async () => {
  const now = 2_000_000;

  const connection = await createTestConnection({
    now,
    expiresInSeconds: 60,
  });

  let capturedInput = null;

  async function fakeRefresh(input) {
    capturedInput = input;

    return {
      accessToken: "12345678.new_access",

      refreshToken: "12345678.new_refresh",

      tokenType: "Bearer",

      expiresInSeconds: 3600,

      scopes: ["listings_r", "transactions_r"],
    };
  }

  const result = await getValidEtsyAccessToken({
    connectionId: connection.connectionId,

    clientId: "test_client",

    now,

    refreshAccessToken: fakeRefresh,
  });

  assert.equal(capturedInput.clientId, "test_client");

  assert.equal(capturedInput.refreshToken, "12345678.old_refresh");

  assert.equal(result.accessToken, "12345678.new_access");

  assert.equal(result.refreshed, true);

  const storedConnection = await getEtsyConnection(connection.connectionId);

  assert.equal(storedConnection.accessToken, "12345678.new_access");

  assert.equal(storedConnection.refreshToken, "12345678.new_refresh");

  assert.equal(storedConnection.accessTokenExpiresAt, now + 3600 * 1000);
});

test("refreshes an already expired Etsy access token", async () => {
  const now = 3_000_000;

  const connection = await createTestConnection({
    now,
    expiresInSeconds: 1,
  });

  async function fakeRefresh() {
    return {
      accessToken: "12345678.refreshed_access",

      refreshToken: "12345678.refreshed_refresh",

      tokenType: "Bearer",

      expiresInSeconds: 3600,

      scopes: ["listings_r", "transactions_r"],
    };
  }

  const result = await getValidEtsyAccessToken({
    connectionId: connection.connectionId,

    clientId: "test_client",

    now: now + 2000,

    refreshAccessToken: fakeRefresh,
  });

  assert.equal(result.refreshed, true);

  assert.equal(result.accessToken, "12345678.refreshed_access");
});

test("rejects an unknown Etsy connection", async () => {
  await assert.rejects(
    () =>
      getValidEtsyAccessToken({
        connectionId: "missing_connection",

        clientId: "test_client",
      }),
    {
      message: "ETSY_CONNECTION_NOT_FOUND",
    },
  );
});

test("rejects a refreshed token that belongs to another Etsy user", async () => {
  const now = 4_000_000;

  const connection = await createTestConnection({
    now,
    expiresInSeconds: 1,
  });

  async function fakeRefresh() {
    return {
      accessToken: "99999999.new_access",

      refreshToken: "99999999.new_refresh",

      tokenType: "Bearer",

      expiresInSeconds: 3600,

      scopes: ["listings_r", "transactions_r"],
    };
  }

  await assert.rejects(
    () =>
      getValidEtsyAccessToken({
        connectionId: connection.connectionId,

        clientId: "test_client",

        now: now + 2000,

        refreshAccessToken: fakeRefresh,
      }),
    {
      message: "ETSY_TOKEN_USER_MISMATCH",
    },
  );

  const storedConnection = await getEtsyConnection(connection.connectionId);

  assert.equal(storedConnection.accessToken, "12345678.old_access");
});

test("rejects a refreshed token that loses a required scope", async () => {
  const now = 5_000_000;

  const connection = await createTestConnection({
    now,
    expiresInSeconds: 1,
  });

  async function fakeRefresh() {
    return {
      accessToken: "12345678.new_access",

      refreshToken: "12345678.new_refresh",

      tokenType: "Bearer",

      expiresInSeconds: 3600,

      scopes: ["listings_r"],
    };
  }

  await assert.rejects(
    () =>
      getValidEtsyAccessToken({
        connectionId: connection.connectionId,

        clientId: "test_client",

        now: now + 2000,

        refreshAccessToken: fakeRefresh,
      }),
    {
      message: "ETSY_REFRESH_SCOPE_MISMATCH",
    },
  );
});

test("uses a sixty-second safety buffer before Etsy access token expiry", () => {
  assert.equal(ETSY_TOKEN_REFRESH_BUFFER_MS, 60 * 1000);
});

test("failed token refresh leaves the existing Etsy connection unchanged", async () => {
  const now = 6_000_000;

  const connection = await createTestConnection({
    now,
    expiresInSeconds: 1,
  });

  const beforeRefresh = await getEtsyConnection(connection.connectionId);

  async function fakeRefresh() {
    throw new Error("ETSY_TOKEN_REFRESH_FAILED");
  }

  await assert.rejects(
    () =>
      getValidEtsyAccessToken({
        connectionId: connection.connectionId,

        clientId: "test_client",

        now: now + 2000,

        refreshAccessToken: fakeRefresh,
      }),
    {
      message: "ETSY_TOKEN_REFRESH_FAILED",
    },
  );

  const afterRefresh = await getEtsyConnection(connection.connectionId);

  assert.deepEqual(afterRefresh, beforeRefresh);
});

test("force refresh bypasses a still-valid Etsy access token", async () => {
  const now = 7_000_000;

  const connection = await createTestConnection({
    now,
    expiresInSeconds: 3600,
  });

  let refreshCalled = false;

  async function fakeRefresh() {
    refreshCalled = true;

    return {
      accessToken: "12345678.forced_access",

      refreshToken: "12345678.forced_refresh",

      tokenType: "Bearer",

      expiresInSeconds: 3600,

      scopes: ["listings_r", "transactions_r"],
    };
  }

  const result = await getValidEtsyAccessToken({
    connectionId: connection.connectionId,

    clientId: "test_client",

    now: now + 1000,

    forceRefresh: true,

    refreshAccessToken: fakeRefresh,
  });

  assert.equal(refreshCalled, true);

  assert.equal(result.refreshed, true);

  assert.equal(result.accessToken, "12345678.forced_access");
});
