# Etsy connection storage

## Status

- Implemented: encrypted PostgreSQL connection records, asynchronous OAuth/token
  reads and writes, refresh locking across server instances, verified database TLS,
  and safe handling of missing or invalid configuration.
- Not activated: no hosted database or production encryption key has been created.
- Browser ownership is implemented with a random HttpOnly cookie. OAuth state is
  bound to that browser, connection IDs are not exposed, and read routes resolve
  only the connection owned by the cookie.
- This is guest-session ownership for the MVP: clearing browser cookies or moving
  to another browser requires reconnecting Etsy. Ownership also expires server-side
  30 days after authorization. Account-based ownership can replace
  the cookie hash later without changing the encrypted token storage.
- Next: configure a hosted database, then wire the real Etsy import into the planner.
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
- Before real seller onboarding: run the real-Postgres integration test, verify
  persistence after restart, and test an Etsy authorization end-to-end through the
  production site's proxy. These have not been validated against a hosted database.
- Browser ownership is an MVP connection boundary, not a Lighthouse account system.
  OAuth state remains process-local: use one backend instance until it is persistent.
