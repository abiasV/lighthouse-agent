import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createEtsyReadRouter } from "../src/routes/etsyReadRoutes.js";
import {
  ETSY_BROWSER_SESSION_COOKIE,
  hashEtsyBrowserSession,
} from "../src/integrations/etsy/auth/etsyBrowserSession.js";

const browserToken = "A".repeat(43);
const ownerSessionHash = hashEtsyBrowserSession(browserToken);
const browserHeaders = {
  Cookie: `${ETSY_BROWSER_SESSION_COOKIE}=${browserToken}`,
};

function startTestServer({
  getAuthenticatedUser,
  getUser,
  getShopCatalog,
  getConnectionByOwnerSessionHash = async hash => ({
    connectionId: "connection_1",
    etsyUserId: "12345678",
    ownerSessionHash: hash,
  }),
}) {
  const app = express();
  app.use(express.json());
  app.use("/api/etsy", createEtsyReadRouter({
    getAuthenticatedUser,
    getUser,
    getShopCatalog,
    getConnectionByOwnerSessionHash,
  }));
  return new Promise(resolve => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${server.address().port}`,
      });
    });
  });
}

function request(baseUrl, path, { withCookie = true } = {}) {
  return fetch(baseUrl + path, {
    headers: withCookie ? browserHeaders : {},
  });
}

test("Etsy read API resolves the connection from its HttpOnly browser session", async () => {
  let capturedInput;
  let capturedOwnerHash;
  const { server, baseUrl } = await startTestServer({
    getConnectionByOwnerSessionHash: async hash => {
      capturedOwnerHash = hash;
      return { connectionId: "connection_1", etsyUserId: "12345678" };
    },
    getAuthenticatedUser: async input => {
      capturedInput = input;
      return { user_id: 12345678, shop_id: 87654321 };
    },
  });
  try {
    const response = await request(baseUrl, "/api/etsy/me?connectionId=attacker_value");
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).user, {
      user_id: 12345678,
      shop_id: 87654321,
    });
    assert.equal(capturedOwnerHash, ownerSessionHash);
    assert.equal(capturedInput.connectionId, "connection_1");
  } finally { server.close(); }
});

test("Etsy read API rejects a missing browser session", async () => {
  const { server, baseUrl } = await startTestServer({
    getAuthenticatedUser: async () => { throw new Error("SHOULD_NOT_BE_CALLED"); },
  });
  try {
    const response = await request(baseUrl, "/api/etsy/me", { withCookie: false });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "ETSY_BROWSER_SESSION_REQUIRED");
  } finally { server.close(); }
});

test("Etsy read API rejects a valid session with no owned connection", async () => {
  const { server, baseUrl } = await startTestServer({
    getAuthenticatedUser: async () => { throw new Error("SHOULD_NOT_BE_CALLED"); },
    getConnectionByOwnerSessionHash: async () => null,
  });
  try {
    const response = await request(baseUrl, "/api/etsy/me");
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "ETSY_CONNECTION_NOT_FOUND");
  } finally { server.close(); }
});

for (const [name, providerError, expectedStatus] of [
  ["expired authorization", "ETSY_REAUTHORIZATION_REQUIRED", 401],
  ["Etsy rate limits", "ETSY_RATE_LIMITED", 429],
  ["temporary Etsy failures", "ETSY_TEMPORARY_ERROR", 502],
]) {
  test(`Etsy read API maps ${name}`, async () => {
    const { server, baseUrl } = await startTestServer({
      getAuthenticatedUser: async () => { throw new Error(providerError); },
    });
    try {
      const response = await request(baseUrl, "/api/etsy/me");
      assert.equal(response.status, expectedStatus);
      assert.equal((await response.json()).error, providerError);
    } finally { server.close(); }
  });
}

test("Etsy user profile uses only the browser-owned connection", async () => {
  let capturedInput;
  const { server, baseUrl } = await startTestServer({
    getAuthenticatedUser: async () => ({ user_id: 12345678 }),
    getUser: async input => {
      capturedInput = input;
      return { user_id: 12345678, login_name: "test_user" };
    },
  });
  try {
    const response = await request(baseUrl, "/api/etsy/user?connectionId=ignored");
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).user, {
      user_id: 12345678,
      login_name: "test_user",
    });
    assert.equal(capturedInput.connectionId, "connection_1");
    assert.equal(capturedInput.etsyUserId, "12345678");
  } finally { server.close(); }
});

test("Etsy user profile rejects a missing browser session", async () => {
  const { server, baseUrl } = await startTestServer({
    getUser: async () => { throw new Error("SHOULD_NOT_BE_CALLED"); },
  });
  try {
    const response = await request(baseUrl, "/api/etsy/user", { withCookie: false });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "ETSY_BROWSER_SESSION_REQUIRED");
  } finally { server.close(); }
});

test("Etsy user profile returns 404 when the browser owns no connection", async () => {
  const { server, baseUrl } = await startTestServer({
    getUser: async () => { throw new Error("SHOULD_NOT_BE_CALLED"); },
    getConnectionByOwnerSessionHash: async () => null,
  });
  try {
    const response = await request(baseUrl, "/api/etsy/user");
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "ETSY_CONNECTION_NOT_FOUND");
  } finally { server.close(); }
});

test("catalog route ignores supplied identity and uses the owned connection", async () => {
  let captured;
  const { server, baseUrl } = await startTestServer({ getShopCatalog: async input => {
    captured = input;
    return { source: "ETSY", shopName: "Owned Shop", listings: [] };
  }});
  try {
    const response = await request(baseUrl, "/api/etsy/shop/catalog?shopId=attacker&connectionId=attacker");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(captured.connectionId, "connection_1");
    assert.equal(captured.etsyUserId, "12345678");
    assert.equal(captured.shopId, undefined);
    const missing = await request(baseUrl, "/api/etsy/shop/catalog", { withCookie: false });
    assert.equal(missing.status, 401);
  } finally { server.close(); }
});

for (const [code, status] of [["ETSY_SHOP_NOT_FOUND", 404], ["ETSY_RATE_LIMITED", 429], ["ETSY_REAUTHORIZATION_REQUIRED", 401], ["ETSY_CATALOG_TOO_LARGE", 422], ["ETSY_CATALOG_INVALID", 502]]) {
  test(`catalog route maps ${code} without exposing provider data`, async () => {
    const { server, baseUrl } = await startTestServer({ getShopCatalog: async () => { throw new Error(code); } });
    try {
      const response = await request(baseUrl, "/api/etsy/shop/catalog");
      assert.equal(response.status, status);
      assert.equal((await response.json()).listings, undefined);
    } finally { server.close(); }
  });
}
