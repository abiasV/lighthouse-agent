import test from "node:test";
import assert from "node:assert/strict";

import { ETSY_TOKEN_URL } from "../src/integrations/etsy/auth/exchangeEtsyAuthorizationCode.js";

import refreshEtsyAccessToken from "../src/integrations/etsy/auth/refreshEtsyAccessToken.js";

test("refreshes an Etsy access token using the stored refresh token", async () => {
  let capturedUrl = null;
  let capturedOptions = null;

  async function fakeFetch(url, options) {
    capturedUrl = url;
    capturedOptions = options;

    return {
      ok: true,

      async json() {
        return {
          access_token: "12345678.new_access",

          refresh_token: "12345678.new_refresh",

          token_type: "Bearer",

          expires_in: 3600,

          scope: "shops_r listings_r transactions_r email_r",
        };
      },
    };
  }

  const result = await refreshEtsyAccessToken({
    clientId: "test_client",

    refreshToken: "12345678.old_refresh",

    fetchImpl: fakeFetch,
  });

  assert.equal(capturedUrl, ETSY_TOKEN_URL);

  assert.equal(capturedOptions.method, "POST");

  assert.equal(
    capturedOptions.headers["Content-Type"],
    "application/x-www-form-urlencoded",
  );

  assert.equal(capturedOptions.body.get("grant_type"), "refresh_token");

  assert.equal(capturedOptions.body.get("client_id"), "test_client");

  assert.equal(
    capturedOptions.body.get("refresh_token"),
    "12345678.old_refresh",
  );

  assert.equal(result.accessToken, "12345678.new_access");

  assert.equal(result.refreshToken, "12345678.new_refresh");

  assert.deepEqual(result.scopes, ["shops_r", "listings_r", "transactions_r", "email_r"]);
});

test("rejects an unsuccessful Etsy token refresh", async () => {
  async function fakeFetch() {
    return {
      ok: false,
    };
  }

  await assert.rejects(
    () =>
      refreshEtsyAccessToken({
        clientId: "test_client",
        refreshToken: "12345678.old_refresh",
        fetchImpl: fakeFetch,
      }),
    {
      message: "ETSY_TOKEN_REFRESH_FAILED",
    },
  );
});

test("rejects an invalid Etsy refresh response", async () => {
  async function fakeFetch() {
    return {
      ok: true,

      async json() {
        return {
          access_token: "12345678.new_access",
        };
      },
    };
  }

  await assert.rejects(
    () =>
      refreshEtsyAccessToken({
        clientId: "test_client",
        refreshToken: "12345678.old_refresh",
        fetchImpl: fakeFetch,
      }),
    {
      message: "INVALID_ETSY_REFRESH_RESPONSE",
    },
  );
});