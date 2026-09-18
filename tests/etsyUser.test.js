import test from "node:test";
import assert from "node:assert/strict";

import getEtsyUser from "../src/integrations/etsy/getEtsyUser.js";

test("gets an Etsy user by user ID through the Etsy API client contract", async () => {
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
          login_name: "test_user",
        };
      },
    };
  }

  const result = await getEtsyUser({
    connectionId: "connection_1",

    etsyUserId: "12345678",

    clientId: "test_client",

    keystring: "test_keystring",

    sharedSecret: "test_shared_secret",

    fetchImpl: fakeFetch,

    getAccessToken: fakeGetAccessToken,
  });

  assert.equal(
    capturedUrl.toString(),
    "https://api.etsy.com/v3/application/users/12345678",
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
    login_name: "test_user",
  });
});

test("Etsy user endpoint requires a user ID", async () => {
  await assert.rejects(
    () =>
      getEtsyUser({
        connectionId: "connection_1",

        etsyUserId: "",

        clientId: "test_client",

        keystring: "test_keystring",

        sharedSecret: "test_shared_secret",

        getAccessToken: async () => ({
          accessToken: "12345678.valid_access",
          refreshed: false,
        }),
      }),
    {
      message: "ETSY_USER_ID_REQUIRED",
    },
  );
});