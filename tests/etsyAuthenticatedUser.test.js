import test from "node:test";
import assert from "node:assert/strict";

import getEtsyAuthenticatedUser from "../src/integrations/etsy/getEtsyAuthenticatedUser.js";

test("gets the authenticated Etsy user through the Etsy API client contract", async () => {
  let capturedUrl = null;
  let capturedOptions = null;

  async function fakeGetAccessToken() {
    return {
      accessToken: "12345678.valid_access",
      refreshed: false,
    };
  }

  async function fakeFetch(url, options) {
    capturedUrl = url;
    capturedOptions = options;

    return {
      ok: true,
      status: 200,

      headers: {
        get() {
          return null;
        },
      },

      async json() {
        return {
          user_id: 12345678,
          shop_id: 87654321,
        };
      },
    };
  }

  const result = await getEtsyAuthenticatedUser({
    connectionId: "connection_1",

    clientId: "test_client",

    keystring: "test_keystring",

    sharedSecret: "test_shared_secret",

    fetchImpl: fakeFetch,

    getAccessToken: fakeGetAccessToken,
  });

  assert.equal(
    capturedUrl.toString(),
    "https://api.etsy.com/v3/application/users/me",
  );

  assert.equal(capturedOptions.method, "GET");

  assert.equal(
    capturedOptions.headers["x-api-key"],
    "test_keystring:test_shared_secret",
  );

  assert.equal(
    capturedOptions.headers.Authorization,
    "Bearer 12345678.valid_access",
  );

  assert.deepEqual(result, {
    user_id: 12345678,
    shop_id: 87654321,
  });
});

test("authenticated-user endpoint preserves Etsy API client validation", async () => {
  await assert.rejects(
    () =>
      getEtsyAuthenticatedUser({
        connectionId: "connection_1",

        clientId: "test_client",

        keystring: "",

        sharedSecret: "test_shared_secret",

        getAccessToken: async () => ({
          accessToken: "12345678.valid_access",
          refreshed: false,
        }),
      }),
    {
      message: "ETSY_API_KEYSTRING_REQUIRED",
    },
  );
});