import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

import { createEtsyReadRouter } from "../src/routes/etsyReadRoutes.js";

function startTestServer({ getAuthenticatedUser }) {
  const app = express();

  app.use(express.json());

  app.use(
    "/api/etsy",
    createEtsyReadRouter({
      getAuthenticatedUser,
    }),
  );

  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();

      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

test("Etsy read API returns the authenticated Etsy user", async () => {
  let capturedInput = null;

  async function fakeGetAuthenticatedUser(input) {
    capturedInput = input;

    return {
      user_id: 12345678,
      shop_id: 87654321,
    };
  }

  const { server, baseUrl } = await startTestServer({
    getAuthenticatedUser: fakeGetAuthenticatedUser,
  });

  try {
    const response = await fetch(
      `${baseUrl}/api/etsy/me?connectionId=connection_1`,
    );

    assert.equal(response.status, 200);

    const data = await response.json();

    assert.deepEqual(data, {
      connected: true,

      user: {
        user_id: 12345678,
        shop_id: 87654321,
      },
    });

    assert.equal(capturedInput.connectionId, "connection_1");
  } finally {
    server.close();
  }
});

test("Etsy read API requires a connection ID", async () => {
  async function fakeGetAuthenticatedUser() {
    throw new Error("SHOULD_NOT_BE_CALLED");
  }

  const { server, baseUrl } = await startTestServer({
    getAuthenticatedUser: fakeGetAuthenticatedUser,
  });

  try {
    const response = await fetch(`${baseUrl}/api/etsy/me`);

    assert.equal(response.status, 400);

    const data = await response.json();

    assert.equal(data.error, "ETSY_CONNECTION_ID_REQUIRED");
  } finally {
    server.close();
  }
});

test("Etsy read API maps missing connections to 404", async () => {
  async function fakeGetAuthenticatedUser() {
    throw new Error("ETSY_CONNECTION_NOT_FOUND");
  }

  const { server, baseUrl } = await startTestServer({
    getAuthenticatedUser: fakeGetAuthenticatedUser,
  });

  try {
    const response = await fetch(
      `${baseUrl}/api/etsy/me?connectionId=missing_connection`,
    );

    assert.equal(response.status, 404);

    const data = await response.json();

    assert.equal(data.error, "ETSY_CONNECTION_NOT_FOUND");
  } finally {
    server.close();
  }
});

test("Etsy read API maps expired authorization to 401", async () => {
  async function fakeGetAuthenticatedUser() {
    throw new Error("ETSY_REAUTHORIZATION_REQUIRED");
  }

  const { server, baseUrl } = await startTestServer({
    getAuthenticatedUser: fakeGetAuthenticatedUser,
  });

  try {
    const response = await fetch(
      `${baseUrl}/api/etsy/me?connectionId=connection_1`,
    );

    assert.equal(response.status, 401);

    const data = await response.json();

    assert.equal(data.error, "ETSY_REAUTHORIZATION_REQUIRED");
  } finally {
    server.close();
  }
});

test("Etsy read API maps Etsy rate limits to 429", async () => {
  async function fakeGetAuthenticatedUser() {
    throw new Error("ETSY_RATE_LIMITED");
  }

  const { server, baseUrl } = await startTestServer({
    getAuthenticatedUser: fakeGetAuthenticatedUser,
  });

  try {
    const response = await fetch(
      `${baseUrl}/api/etsy/me?connectionId=connection_1`,
    );

    assert.equal(response.status, 429);

    const data = await response.json();

    assert.equal(data.error, "ETSY_RATE_LIMITED");
  } finally {
    server.close();
  }
});

test("Etsy read API maps temporary Etsy failures to 502", async () => {
  async function fakeGetAuthenticatedUser() {
    throw new Error("ETSY_TEMPORARY_ERROR");
  }

  const { server, baseUrl } = await startTestServer({
    getAuthenticatedUser: fakeGetAuthenticatedUser,
  });

  try {
    const response = await fetch(
      `${baseUrl}/api/etsy/me?connectionId=connection_1`,
    );

    assert.equal(response.status, 502);

    const data = await response.json();

    assert.equal(data.error, "ETSY_TEMPORARY_ERROR");
  } finally {
    server.close();
  }
});