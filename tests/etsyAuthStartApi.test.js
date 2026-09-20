import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");

let serverProcess;

let baseUrl;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();

        reject(new Error("FAILED_TO_RESOLVE_TEST_PORT"));

        return;
      }

      const { port } = address;

      server.close((error) => {
        if (error) {
          reject(error);

          return;
        }

        resolve(port);
      });
    });

    server.on("error", reject);
  });
}

async function waitForServer(url, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // Server may still be starting.
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  throw new Error("TEST_SERVER_DID_NOT_START");
}

before(async () => {
  const port = await getFreePort();

  baseUrl = `http://127.0.0.1:${port}`;

  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,

    env: {
      ...process.env,

      PORT: String(port),
      NODE_ENV: "test",
      RENDER: "",
      ETSY_CONNECTION_STORAGE: "memory",

      ETSY_CLIENT_ID: "test_etsy_client",

      ETSY_REDIRECT_URI: "https://example.com/api/etsy/auth/callback",
    },

    stdio: "ignore",
  });

  await waitForServer(baseUrl);
});

after(() => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

test("Etsy auth start returns a PKCE authorization URL", async () => {
  const response = await fetch(`${baseUrl}/api/etsy/auth/start`);

  assert.equal(response.status, 200);

  const sessionCookie = response.headers.get("set-cookie");
  assert.match(sessionCookie, /^lighthouse_etsy_session=[A-Za-z0-9_-]{43};/);
  assert.match(sessionCookie, /HttpOnly/);
  assert.match(sessionCookie, /SameSite=Lax/);
  assert.match(sessionCookie, /Path=\/api\/etsy/);

  const data = await response.json();

  assert.equal(data.expiresInSeconds, 600);

  assert.equal(typeof data.authorizationUrl, "string");

  const authorizationUrl = new URL(data.authorizationUrl);

  assert.equal(authorizationUrl.origin, "https://www.etsy.com");

  assert.equal(authorizationUrl.pathname, "/oauth/connect");

  assert.equal(authorizationUrl.searchParams.get("response_type"), "code");

  assert.equal(
    authorizationUrl.searchParams.get("client_id"),
    "test_etsy_client",
  );

  assert.equal(
    authorizationUrl.searchParams.get("redirect_uri"),
    "https://example.com/api/etsy/auth/callback",
  );

  assert.equal(
    authorizationUrl.searchParams.get("scope"),
    "shops_r listings_r transactions_r",
  );

  assert.equal(
    authorizationUrl.searchParams.get("code_challenge_method"),
    "S256",
  );

  assert.ok(authorizationUrl.searchParams.get("state"));

  assert.ok(authorizationUrl.searchParams.get("code_challenge"));

  assert.equal(authorizationUrl.searchParams.has("code_verifier"), false);
});

test("each Etsy auth start request creates unique state and PKCE challenge values", async () => {
  const firstResponse = await fetch(`${baseUrl}/api/etsy/auth/start`);

  const secondResponse = await fetch(`${baseUrl}/api/etsy/auth/start`);

  assert.equal(firstResponse.status, 200);

  assert.equal(secondResponse.status, 200);

  const firstData = await firstResponse.json();

  const secondData = await secondResponse.json();

  const firstUrl = new URL(firstData.authorizationUrl);

  const secondUrl = new URL(secondData.authorizationUrl);

  assert.notEqual(
    firstUrl.searchParams.get("state"),
    secondUrl.searchParams.get("state"),
  );

  assert.notEqual(
    firstUrl.searchParams.get("code_challenge"),
    secondUrl.searchParams.get("code_challenge"),
  );
});
