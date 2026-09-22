# Etsy connection storage

## Status

- Implemented: encrypted PostgreSQL connection records, asynchronous OAuth/token
  reads and writes, refresh locking across server instances, verified database TLS,
  and safe handling of missing or invalid configuration.
- Hosted test setup: Render PostgreSQL and backend secret settings are configured.
  Verified-TLS schema migration succeeded and backend commit 30d9aaf was Live on
  2026-09-21. On 2026-09-22, the production OAuth flow completed and the
  authenticated connection check succeeded, verifying a real Etsy token round trip.
- The free test database expires on 2026-10-20. Arrange migration or an explicitly
  approved hosting plan before expiry; no paid upgrade has been authorized.
- Render Start Command is `npm run db:migrate:etsy && node server.js`, so the
  idempotent migrations run before startup. Separate runtime/migration roles and
  a backup policy remain onboarding work.
- Browser ownership is implemented with a random HttpOnly cookie. OAuth state is
  bound to that browser, connection IDs are not exposed, and read routes resolve
  only the connection owned by the cookie.
- This is guest-session ownership for the MVP: clearing browser cookies or moving
  to another browser requires reconnecting Etsy. Ownership also expires server-side
  30 days after authorization. Account-based ownership can replace
  the cookie hash later without changing the encrypted token storage.
- Deployment verification: on 2026-09-22, the public health endpoint returned
  HTTP 200 with the expected service response. The Etsy read route returned the
  expected HTTP 401 `ETSY_BROWSER_SESSION_REQUIRED` without a browser session,
  confirming that the deployed storage gate and session guard are active.
- Implemented: the planner now exposes Connect Etsy, verifies the connection using
  the browser-owned read route, and offers retry/reconnect states. Browser OAuth
  callbacks return to a fixed Lighthouse page with a non-sensitive outcome;
  JSON API clients retain their existing callback contract.
- Connection UI checks that the OAuth callback matches the current site origin.
  Sample/manual planning remains available; connecting does not import shop data.
- Production OAuth verification: Render and Etsy use the Netlify callback below,
  Netlify commit 7c904f9 was Published, OAuth returned to the planner, and
  /api/etsy/me verified the authenticated connection. Etsy did not display a new
  consent screen, which is consistent with an authorization already granted to
  this Etsy app/account.
- Token persistence was verified after a backend redeploy on 2026-09-22: storage
  initialized successfully and the same production browser session remained connected.
- Implemented: browser-owned, read-only shop name and active listing import into the
  manual planner. Metrics stay blank; existing validation is preserved. Live seller
  import verification is pending deployment and a seller browser test.
- Next: import period-based sales from complete order data; never substitute lifetime
  statistics for reporting-period metrics.
- OAuth state/PKCE sessions are still in memory. An authorization attempt interrupted
  by a restart must be restarted. Established connections use PostgreSQL when configured.
- Tests cover browser ownership, encryption, tamper rejection, concurrency, rollback
  behavior, and fail-closed configuration. The optional real-Postgres integration
  test requires a local test database.

## Database preparation

Use a dedicated PostgreSQL database, a restricted application database role, and a
backup policy. The runtime needs SELECT, INSERT and UPDATE on etsy_connections.
The migration role additionally needs permission to create the table.
Do not activate a paid service without the owner's approval.

Backend environment only (Render, never Netlify client/VITE variables):

| Variable | Value |
| --- | --- |
| ETSY_CONNECTION_STORAGE | postgres |
| ETSY_DATABASE_URL | Dedicated PostgreSQL connection URL, with no SSL URL parameters |
| ETSY_TOKEN_ENCRYPTION_KEY | Stable 64-character hexadecimal key (32 random bytes) |
| ETSY_DATABASE_SSL | verify (default) |
| ETSY_DATABASE_CA | Optional trusted CA PEM if the provider requires it |

Generate the key once in a private terminal:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Store it in the backend's secret settings and a password manager. Never commit it,
paste it into chat, expose it to the frontend, or regenerate it during deployments.
Losing/changing this key makes existing records unreadable. Planned key rotation
requires a migration; this first version does not implement automatic rotation.

With the database URL configured in the migration environment:

```bash
npm ci
npm run db:migrate:etsy
```

The migration command applies 001 and 002 together in a transaction and is safe to
rerun. Migration 002 upgrades the original table without deleting old records. Old
records without an owner remain inaccessible; pre-expiry-format sessions require
reconnecting Etsy. Startup verifies the owner column exists and checks
the encryption key against an existing record, if present. Failed setup disables
real Etsy routes; it never falls back to memory or plaintext. Database outages during
requests return errors rather than claiming a successful save.

Use verified TLS. SSL parameters such as sslmode in the URL are rejected because they
can override pg's TLS configuration. Plaintext connections are permitted only for
loopback development with ETSY_DATABASE_SSL=disable, never production/Render.

Local OAuth tests may explicitly use ETSY_CONNECTION_STORAGE=memory. This mode is
rejected on production/Render. With no storage mode set, real Etsy routes return 503.

The OAuth callback must use the same public site origin that started authorization
so the browser sends its HttpOnly cookie. In production, point Etsy at the Netlify
`/api/etsy/auth/callback` URL that proxies to the backend, rather than the Render URL.

## Verification

```bash
node --test tests/etsySecureStorage.test.js tests/etsyAccessTokenLifecycle.test.js tests/etsyOAuthCompletion.test.js tests/etsyAuthStartApi.test.js tests/etsyReadApi.test.js
```

For the optional integration test, point ETSY_TEST_DATABASE_URL at a **local dedicated
test database** named lighthouse_test (or lighthouse_test with a suffix), then run:

```bash
node --test tests/etsyPostgresStorage.integration.test.js
```

It creates/removes only its own random schema, verifies ciphertext, reads the connection
from a fresh Node process, and checks cross-client locking, rollback and corruption.
Without the URL it is explicitly skipped.

Refreshes and reconnects share a row lock in a PostgreSQL transaction. A separate
owner advisory lock serializes simultaneous first connections for the same browser. A provider refresh
and database commit cannot be one atomic operation: if Etsy rotates a token but the
subsequent commit fails, reauthorization may be required. No shop changes or AI calls
are made by storage or its tests.

## Review and deployment gates

- Retain `email_r`: the existing `/user` profile route calls Etsy getUser, which requires it.
  Reference: https://developers.etsy.com/documentation/tutorials/quickstart
- Owner lookups verify the owner hash inside authenticated ciphertext against the index.
- OAuth denials validate the browser/state before removing a pending authorization.
- Render internal Postgres uses self-signed TLS and does not support verify-full.
  Use the external hostname with verified TLS for this implementation, restricting
  database network access to the backend's outbound addresses and any migration client.
  Do not disable certificate verification to make the internal URL connect.
  Reference: https://render.com/docs/postgresql-creating-connecting
- Production-origin OAuth through the Netlify proxy, the hosted PostgreSQL token
  round trip, and encrypted connection persistence after a backend restart have
  been validated.
- Browser ownership is an MVP connection boundary, not a Lighthouse account system.
  OAuth state remains process-local: use one backend instance until it is persistent.

## Connection UI deployment check

Set backend `ETSY_REDIRECT_URI` and the Etsy app's registered redirect URI to exactly:

```text
https://lighthouse-agent-app.netlify.app/api/etsy/auth/callback
```

The existing Netlify /api proxy forwards both authorization and callback requests.
Do not use the Render origin, localhost, or a deploy-preview origin for this test.
The callback was verified in both Render and the Etsy app on 2026-09-22. Live Etsy
OAuth is intentionally production-only: Etsy requires an exact registered HTTPS
callback, while local Vite uses an HTTP loopback origin and a separate backend.
The local UI therefore directs development to sample/manual data instead of
starting or polling a production-owned Etsy connection.

The production test completed successfully on 2026-09-22: Connect Etsy returned to
the planner and displayed "Your Etsy connection has been verified." Cancelled,
expired and failed attempts show a retry message without claiming success. Check
connection reads /api/etsy/me.
Never send screenshots containing OAuth codes, cookies or tokens.

Persistence verification completed after a backend redeploy while retaining the
same production browser cookie; Check connection still verified the Etsy account.

Implementation verification: 28 focused OAuth, ownership/read and client request tests
passed; client lint and production build passed. These tests use mocked Etsy responses,
not live seller credentials.

## Switching the connected account

The planner supports one Etsy account per browser session. Switch Etsy Account
confirms clearing the displayed draft/plan, then POSTs to /api/etsy/auth/disconnect.
The endpoint requires the configured callback origin and a custom action header,
deletes only that browser owner's stored credentials, invalidates pending OAuth
state, and expires the HttpOnly cookie only after successful deletion. Owner and
row locks serialize deletion with OAuth completion and token refresh. OAuth state
is still process-local; the single-backend-instance requirement remains.

The planner reloads after success to discard old form data and in-flight UI work.
It shows the connected shop name when available through the read-only /api/etsy/shop
summary. Users must sign out on Etsy and sign into their other account before
connecting again. Lighthouse disconnect does not log out of Etsy or revoke the
app's permissions on Etsy. No schema migration is required.

Next verification: switch between two real accounts in the deployed planner and
confirm the new shop name before importing. Automated tests use mocked Etsy data;
the optional PostgreSQL integration test needs a dedicated local test database.
