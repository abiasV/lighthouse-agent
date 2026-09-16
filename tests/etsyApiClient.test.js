import test from "node:test";
import assert from "node:assert/strict";

import etsyApiGet from "../src/integrations/etsy/etsyApiClient.js";

function createJsonResponse({ status = 200, body = {}, headers = {} }) {
  return {
    ok: status >= 200 && status < 300,

    status,

    headers: {
      get(name) {
        return headers[name.toLowerCase()] ?? null;
      },
    },

    async json() {
      return body;
    },
  };
}

test("Etsy API client sends authentication headers and returns raw JSON", async () => {
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

    return createJsonResponse({
      body: {
        user_id: 12345678,
        first_name: "Test",
      },
    });
  }

  const result = await etsyApiGet({
    connectionId: "connection_1",

    clientId: "test_client",

    keystring: "test_keystring",

    sharedSecret: "test_shared_secret",

    path: "/application/users/me",

    fetchImpl: fakeFetch,

    getAccessToken: fakeGetAccessToken,
  });

  assert.equal(
    capturedUrl.toString(),
    "https://api.etsy.com/v3/application/users/me",
  );

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
    first_name: "Test",
  });
});

test("Etsy API client force-refreshes once after 401 and retries once", async () => {
  const tokenCalls = [];
  let requestCount = 0;

  async function fakeGetAccessToken(input) {
    tokenCalls.push(input);

    if (input.forceRefresh) {
      return {
        accessToken: "12345678.new_access",
        refreshed: true,
      };
    }

    return {
      accessToken: "12345678.old_access",
      refreshed: false,
    };
  }

  async function fakeFetch(url, options) {
    requestCount += 1;

    if (requestCount === 1) {
      assert.equal(options.headers.Authorization, "Bearer 12345678.old_access");

      return createJsonResponse({
        status: 401,
      });
    }

    assert.equal(options.headers.Authorization, "Bearer 12345678.new_access");

    return createJsonResponse({
      status: 200,
      body: {
        ok: true,
      },
    });
  }

  const result = await etsyApiGet({
    connectionId: "connection_1",

    clientId: "test_client",

    keystring: "key",
    sharedSecret: "secret",

    path: "/application/users/me",

    fetchImpl: fakeFetch,

    getAccessToken: fakeGetAccessToken,
  });

  assert.deepEqual(result, { ok: true });

  assert.equal(requestCount, 2);

  assert.equal(tokenCalls.length, 2);

  assert.equal(tokenCalls[1].forceRefresh, true);
});

test("Etsy API client stops after a second 401", async () => {
  let requestCount = 0;
  let forceRefreshCount = 0;

  async function fakeGetAccessToken(input) {
    if (input.forceRefresh) {
      forceRefreshCount += 1;
    }

    return {
      accessToken: input.forceRefresh
        ? "12345678.new_access"
        : "12345678.old_access",

      refreshed: Boolean(input.forceRefresh),
    };
  }

  async function fakeFetch() {
    requestCount += 1;

    return createJsonResponse({
      status: 401,
    });
  }

  await assert.rejects(
    () =>
      etsyApiGet({
        connectionId: "connection_1",

        clientId: "test_client",

        keystring: "key",
        sharedSecret: "secret",

        path: "/application/users/me",

        fetchImpl: fakeFetch,

        getAccessToken: fakeGetAccessToken,
      }),
    {
      message: "ETSY_REAUTHORIZATION_REQUIRED",
    },
  );

  assert.equal(requestCount, 2);

  assert.equal(forceRefreshCount, 1);
});

test("Etsy API client respects retry-after on 429 and retries once", async () => {
  let requestCount = 0;
  const sleepCalls = [];

  async function fakeGetAccessToken() {
    return {
      accessToken: "12345678.valid_access",
      refreshed: false,
    };
  }

  async function fakeSleep(ms) {
    sleepCalls.push(ms);
  }

  async function fakeFetch() {
    requestCount += 1;

    if (requestCount === 1) {
      return createJsonResponse({
        status: 429,
        headers: {
          "retry-after": "2",
        },
      });
    }

    return createJsonResponse({
      body: {
        ok: true,
      },
    });
  }

  const result = await etsyApiGet({
    connectionId: "connection_1",

    clientId: "test_client",

    keystring: "key",
    sharedSecret: "secret",

    path: "/application/users/me",

    fetchImpl: fakeFetch,

    getAccessToken: fakeGetAccessToken,

    sleepImpl: fakeSleep,
  });

  assert.deepEqual(result, { ok: true });

  assert.equal(requestCount, 2);

  assert.deepEqual(sleepCalls, [2000]);
});

test("Etsy API client stops after the rate-limit retry cap", async () => {
  let requestCount = 0;

  async function fakeGetAccessToken() {
    return {
      accessToken: "12345678.valid_access",
      refreshed: false,
    };
  }

  async function fakeSleep() {}

  async function fakeFetch() {
    requestCount += 1;

    return createJsonResponse({
      status: 429,
      headers: {
        "retry-after": "1",
      },
    });
  }

  await assert.rejects(
    () =>
      etsyApiGet({
        connectionId: "connection_1",

        clientId: "test_client",

        keystring: "key",
        sharedSecret: "secret",

        path: "/application/users/me",

        fetchImpl: fakeFetch,

        getAccessToken: fakeGetAccessToken,

        sleepImpl: fakeSleep,
      }),
    {
      message: "ETSY_RATE_LIMITED",
    },
  );

  assert.equal(requestCount, 2);
});

test("Etsy API client retries one 5xx response and then succeeds", async () => {
  let requestCount = 0;

  async function fakeGetAccessToken() {
    return {
      accessToken: "12345678.valid_access",
      refreshed: false,
    };
  }

  async function fakeSleep() {}

  async function fakeFetch() {
    requestCount += 1;

    if (requestCount === 1) {
      return createJsonResponse({
        status: 503,
      });
    }

    return createJsonResponse({
      body: {
        ok: true,
      },
    });
  }

  const result = await etsyApiGet({
    connectionId: "connection_1",

    clientId: "test_client",

    keystring: "key",
    sharedSecret: "secret",

    path: "/application/users/me",

    fetchImpl: fakeFetch,

    getAccessToken: fakeGetAccessToken,

    sleepImpl: fakeSleep,
  });

  assert.deepEqual(result, { ok: true });

  assert.equal(requestCount, 2);
});

test("Etsy API client stops after the 5xx retry cap", async () => {
  let requestCount = 0;

  async function fakeGetAccessToken() {
    return {
      accessToken: "12345678.valid_access",
      refreshed: false,
    };
  }

  async function fakeSleep() {}

  async function fakeFetch() {
    requestCount += 1;

    return createJsonResponse({
      status: 503,
    });
  }

  await assert.rejects(
    () =>
      etsyApiGet({
        connectionId: "connection_1",

        clientId: "test_client",

        keystring: "key",
        sharedSecret: "secret",

        path: "/application/users/me",

        fetchImpl: fakeFetch,

        getAccessToken: fakeGetAccessToken,

        sleepImpl: fakeSleep,
      }),
    {
      message: "ETSY_TEMPORARY_ERROR",
    },
  );

  assert.equal(requestCount, 2);
});

test("Etsy API client retries one network failure and then succeeds", async () => {
  let requestCount = 0;

  async function fakeGetAccessToken() {
    return {
      accessToken: "12345678.valid_access",
      refreshed: false,
    };
  }

  async function fakeSleep() {}

  async function fakeFetch() {
    requestCount += 1;

    if (requestCount === 1) {
      throw new Error("NETWORK_DOWN");
    }

    return createJsonResponse({
      body: {
        ok: true,
      },
    });
  }

  const result = await etsyApiGet({
    connectionId: "connection_1",

    clientId: "test_client",

    keystring: "key",
    sharedSecret: "secret",

    path: "/application/users/me",

    fetchImpl: fakeFetch,

    getAccessToken: fakeGetAccessToken,

    sleepImpl: fakeSleep,
  });

  assert.deepEqual(result, { ok: true });

  assert.equal(requestCount, 2);
});

test("Etsy API client stops after the network retry cap", async () => {
  let requestCount = 0;

  async function fakeGetAccessToken() {
    return {
      accessToken: "12345678.valid_access",
      refreshed: false,
    };
  }

  async function fakeSleep() {}

  async function fakeFetch() {
    requestCount += 1;

    throw new Error("NETWORK_DOWN");
  }

  await assert.rejects(
    () =>
      etsyApiGet({
        connectionId: "connection_1",

        clientId: "test_client",

        keystring: "key",
        sharedSecret: "secret",

        path: "/application/users/me",

        fetchImpl: fakeFetch,

        getAccessToken: fakeGetAccessToken,

        sleepImpl: fakeSleep,
      }),
    {
      message: "ETSY_NETWORK_ERROR",
    },
  );

  assert.equal(requestCount, 2);
});

test("401 retry does not reset the rate-limit retry budget", async () => {
  let requestCount = 0;
  let forceRefreshCount = 0;
  const sleepCalls = [];

  async function fakeGetAccessToken(input) {
    if (input.forceRefresh) {
      forceRefreshCount += 1;

      return {
        accessToken: "12345678.new_access",
        refreshed: true,
      };
    }

    return {
      accessToken: "12345678.old_access",
      refreshed: false,
    };
  }

  async function fakeSleep(ms) {
    sleepCalls.push(ms);
  }

  async function fakeFetch() {
    requestCount += 1;

    if (requestCount === 1) {
      return createJsonResponse({
        status: 429,
        headers: {
          "retry-after": "1",
        },
      });
    }

    if (requestCount === 2) {
      return createJsonResponse({
        status: 401,
      });
    }

    return createJsonResponse({
      status: 429,
      headers: {
        "retry-after": "1",
      },
    });
  }

  await assert.rejects(
    () =>
      etsyApiGet({
        connectionId: "connection_1",
        clientId: "test_client",

        keystring: "key",
        sharedSecret: "secret",

        path: "/application/users/me",

        fetchImpl: fakeFetch,
        getAccessToken: fakeGetAccessToken,
        sleepImpl: fakeSleep,
      }),
    {
      message: "ETSY_RATE_LIMITED",
    },
  );

  assert.equal(requestCount, 3);

  assert.equal(forceRefreshCount, 1);

  assert.deepEqual(sleepCalls, [1000]);
});

test("401 retry does not reset the temporary-error retry budget", async () => {
  let requestCount = 0;
  let forceRefreshCount = 0;
  const sleepCalls = [];

  async function fakeGetAccessToken(input) {
    if (input.forceRefresh) {
      forceRefreshCount += 1;

      return {
        accessToken: "12345678.new_access",
        refreshed: true,
      };
    }

    return {
      accessToken: "12345678.old_access",
      refreshed: false,
    };
  }

  async function fakeSleep(ms) {
    sleepCalls.push(ms);
  }

  async function fakeFetch() {
    requestCount += 1;

    if (requestCount === 1) {
      return createJsonResponse({
        status: 503,
      });
    }

    if (requestCount === 2) {
      return createJsonResponse({
        status: 401,
      });
    }

    return createJsonResponse({
      status: 503,
    });
  }

  await assert.rejects(
    () =>
      etsyApiGet({
        connectionId: "connection_1",
        clientId: "test_client",

        keystring: "key",
        sharedSecret: "secret",

        path: "/application/users/me",

        fetchImpl: fakeFetch,
        getAccessToken: fakeGetAccessToken,
        sleepImpl: fakeSleep,
      }),
    {
      message: "ETSY_TEMPORARY_ERROR",
    },
  );

  assert.equal(requestCount, 3);

  assert.equal(forceRefreshCount, 1);

  assert.deepEqual(sleepCalls, [500]);
});