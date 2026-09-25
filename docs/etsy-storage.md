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

## Pilot readiness (2026-09-22)

- Seller screenshots confirm the connected shop name, empty-catalog handling,
  and disconnect UI. A populated second shop import remains unverified.
- Keep switch guidance visible after Retry check; the Etsy account-menu link
  deliberately opens a separate tab and does not log out the user automatically.
- Personal access is limited-scale use subject to Etsy approval. Confirm this
  app's actual shop allowance with Etsy rather than assuming that five new sellers
  plus the owner's account are permitted. Our private pilot independently caps
  its approved account list at five.
- Pilot code is prepared behind `LIGHTHOUSE_PRIVATE_PILOT`; it has NOT been
  activated or tested with a paid provider or a populated live seller shop.
- No new invitations should be sent until the activation gates below pass.

## Private seller review pilot

Approved owner budget: C$30 total for pilot AI, not per seller or per month.
The pilot offers an evidence-based draft review for one product, draft title and
description, one action to test, and a saved follow-up with a later equal-length
reporting period. This is separate from the existing deterministic Weekly Planner;
its scoring thresholds and mock execution/approval packages are unchanged.
AI suggestions are hypotheses/drafts, not verified market research or sales promises.
Import includes shop name and selected active listing titles. When the private pilot
and Etsy approval gates are enabled, the planner also requests period paid-unit
sales and the preceding period's trend. Sellers still supply period views, missing
or refund-ambiguous sales, and accurate product facts. Raw receipt responses can
contain buyer details; the sales adapter discards these without logging, storing,
returning them to the browser or sending them to AI.

### Access and spending boundaries

- When `LIGHTHOUSE_PRIVATE_PILOT=true`, `/api/shop` and Etsy catalog/profile reads
  require an active browser-owned Etsy connection whose stored numeric Etsy user ID
  is allowlisted. Client-supplied user IDs and invitation links do not grant access.
  Health, landing pages, OAuth, and `/api/etsy/me` remain available for sign-in.
- `/me` issues an additional HttpOnly, Secure, SameSite=Lax cookie scoped to `/api`
  only for approved accounts. Every protected request resolves the current stored
  connection again, so disconnect or removal from the allowlist revokes access.
  Pilot shop plans are also bound to their owner; another invited account cannot
  execute, approve or record outcomes against their IDs.
- All `/api/analysis` routes are disabled in private-pilot mode, regardless of
  legacy real-AI flags. The old in-memory beta counter is NOT the pilot budget.
- Migration `003_private_pilot.sql` adds a singleton C$30 allowance and encrypted
  review records. A transaction locks the budget row before reserving C$1 per
  unique submission, at most six attempts per account and 30 in total. The budget
  does not reset on restart, deploy, reconnect or rerunning migrations.
- Request keys are unique per verified Etsy user. Identical retries return the
  existing record; a key reused with changed data is rejected. Failed/ambiguous
  provider requests retain their reservation. An interrupted pending record is
  never automatically sent to the provider again. Saved results remain readable
  after the allowance is exhausted.
- One text-only OpenAI request uses `gpt-4.1-mini-2025-04-14`, at most 16,000 UTF-8
  input bytes plus fixed instructions and 2,200 output tokens; no tools, retries
  or background work. Provider response storage is disabled. Reviews are encrypted
  in our database using the existing server encryption key and a separate record
  namespace. Do not rotate that key without migrating existing encrypted records.
- C$1 is a conservative reservation, not a provider invoice measurement. At the
  official 2026-09-22 prices (US$0.40/1M input, US$1.60/1M output), the bounded call
  is below US$0.02. The large reserve leaves currency/tax headroom. Recheck pricing
  before activation. Use a separate OpenAI project/key; this code cannot cap other
  applications using the key, account top-ups, or hosting costs. No paid hosting
  service is authorized by this AI budget.

### Activation gates and settings

1. Obtain Etsy's written approval for this exact analytics/AI-assisted use case,
   including sending selected seller content to OpenAI for inference. Etsy's API
   Terms updated 2026-08-18, section 5 items 24–25, require written authorization
   for the stated automated/analytics uses. Generic OAuth consent or Commercial
   status alone is not evidence that every proposed use is approved.
   Official sources: https://www.etsy.com/legal/api/ and
   https://developers.etsy.com/documentation/ .
2. Public `/terms`, `/privacy` and `/support` pages and a footer are implemented.
   Set `LIGHTHOUSE_SUPPORT_EMAIL` in Render to the operator's chosen monitored
   public email; `/api/legal` exposes only that contact and the terms version.
   The operator has not yet selected a public contact. Private readiness fails
   closed without a valid address. Verify the deployed pages and contact before
   inviting sellers; these texts are not a guarantee of legal compliance.
   Migration `004_pilot_consent.sql` records the verified Etsy account, current
   terms version and database timestamp. The unchecked acceptance form links to
   both texts; all protected pilot APIs require current acceptance, except the
   consent endpoint itself. Old versions require acceptance again. Privacy text
   accurately discloses that automatic record deletion is not implemented.
3. Run the PostgreSQL test against a dedicated LOCAL database, never production:
   `ETSY_TEST_DATABASE_URL=postgresql://.../lighthouse_test node --test tests/pilotPostgres.integration.test.js`
   It covers cross-client races, deduplication, both caps, persistence, encrypted
   records, owner isolation and durable versioned consent. The test is skipped if
   no local test DB is supplied. Live migrations and this database test remain pending.
4. Run `npm run db:migrate:etsy` with the existing server-side database settings.
   It is additive/idempotent and does not clear the budget. Do not delete ledger
   rows or reset the singleton to reclaim failed requests.
5. In Render only, configure `LIGHTHOUSE_PRIVATE_PILOT=true`,
   `LIGHTHOUSE_PILOT_ETSY_USER_IDS` as at most five comma-separated numeric Etsy
   user IDs (not emails, names or shop IDs), and a dedicated `OPENAI_API_KEY`.
   Empty allowlist denies everyone. Keep the existing PostgreSQL, encryption and
   Netlify callback settings. Set `LIGHTHOUSE_ETSY_REVIEW_APPROVED=true` only after
   written approval and the preceding gates are complete. Missing configuration
   or schema closes private functionality; it never falls back to memory storage.
6. Test on deployed Netlify with the owner's approved account: Weekly Growth Plan
   → Connect Etsy → Read and accept pilot terms → Enter manually. Use a product you own, its actual reporting
   period/views/sales, then enter factual details and the problem in Private seller
   pilot → Prepare my improvement draft. Check the output before copying it, reload
   and retrieve the saved review. Verify an uninvited account is denied; disconnect
   must revoke both review and planner access. A populated shop import, real provider
   output quality and these live checks remain unverified.
7. Only then contact the selected prospects for a useful assisted review, invite
   at most five approved identities, and track actual seller outcomes. Outreach
   drafts are not proof that any invitation was sent or any recipient consented.

### Outreach promise and draft review

- Seller entry includes a no-account, no-network illustrative listing review with
  product facts, copy drafts, one action and a measurement plan. It is clearly a
  hand-written example, not a live AI result or evidence of sales uplift. Real
  saved pilot reviews also have copy controls with a manual-copy fallback.
- The landing page shows actual private-pilot availability instead of speculative
  subscription tiers. Import saves typing listing titles and can fill period sales;
  traffic still requires seller input. The planner explains these steps before connection.
- Import now loads a searchable product picker before changing the planner. No
  product is preselected; the seller explicitly selects one or more and confirms.
  Cancelling keeps existing form data. Replacing populated form data still uses
  the existing confirmation. Connection checks/switches discard pending selection.
  Only selected products enter the form; a subsequent request loads their period
  sales. Views stay blank; failed sales imports never turn unknown values into zero.
- These changes explain the value; they do not prove seller demand or AI quality.
  Invitation and activation gates remain unchanged. Next: verify a populated shop
  import and a useful end-to-end one-listing review before sending outreach.
- Deployment checkpoint (2026-09-23): seller-entry code is committed in `6e48b11`.
  Netlify deployment `6ab336405bf3524672299da1` failed with "Skipped due to account
  credit usage exceeded". Production still serves the prior `e3d374a` deployment;
  do not claim the new frontend or policy pages are live. No hosting upgrade was
  purchased. Resolve hosting credits before repeating deployment and browser QA.

- Before sending, reread and rewrite the existing draft subjects and bodies around
  a concrete benefit for each seller, not a request to test our import or help us
  build our product. Offer a useful review of one relevant listing, ready-to-check
  copy improvements and one measurable action only after we have verified that
  the actual workflow can deliver those outputs.
- Be transparent that this is an early, free, limited pilot. Our benefit is learning
  from real use; the seller must receive useful work in return. Do not disguise
  pilot status, promise to fix sales, guarantee increased revenue or imply that
  generated suggestions are proven results. No claim of a seller-specific problem
  without evidence, and no invented personalization.
- Keep the initial invitation short and make replying the first step. Explain
  the required effort and data access before onboarding. Do not make a lengthy
  survey or feedback obligation the price of receiving the promised deliverable.
- On 2026-09-24 all ten existing Gmail outreach drafts were rewritten in place.
  Subjects now use "One Etsy listing to improve at [shop]?". Bodies offer a free,
  personally supported one-product review, copy suggestions and a measurable action;
  they disclose that private access is still being prepared, do not promise higher
  sales and ask for a listing link first. Existing recipients were preserved and
  the operator-approved postal address replaced the placeholder. No messages sent.
  User approval of the revised drafts is required before sending, in addition to
  readiness and current recipient/active-shop checks. At most five sellers get access.

### Reporting-period sales import (2026-09-24)

- `GET /api/etsy/shop/sales` resolves the connection from the HttpOnly cookie and
  verifies that the requested shop belongs to the stored Etsy user. It respects
  existing invitation/consent middleware. The default route is also disabled unless
  both `LIGHTHOUSE_PRIVATE_PILOT=true` and `LIGHTHOUSE_ETSY_REVIEW_APPROVED=true`;
  do not enable these to bypass the activation gates above.
- Uses documented `getShopReceipts` with `transactions_r`, date filters, paid and
  non-cancelled filters. Scope was already included in OAuth. A provider 403 asks
  the seller to reconnect; no write permissions are requested.
- Sales mean **paid units by receipt creation UTC date**, not revenue, shop-lifetime
  sales, or Etsy Stats order counts. Both periods use complete UTC days. Pattern,
  unpaid, cancelled and fully refunded receipts are excluded. Partial refunds or
  other ambiguous refund records leave the affected product's sales/trend blank
  for seller review. No fabricated zeroes or refund-unit estimates.
- Limits: 90 days per period, 500 selected IDs, 1,000 receipts across both periods,
  a 45-second provider deadline and 60-second UI deadline. Missing/duplicate pages,
  changing counts, malformed data and foreign ownership fail the entire import.
- Selection triggers sales import automatically. Sellers can refresh or enter
  figures manually if it fails. Existing manual sales/trends and in-flight edits
  are preserved. Changing report dates clears prior performance inputs; old
  requests are aborted on period/selection change or leaving the form.
- The current official OpenAPI spec has no date-range listing views endpoint.
  Lifetime views must never populate period views. Sellers must copy product
  views for the same dates from Etsy Stats; do not substitute visits for views.
  Reference: https://www.etsy.com/openapi/generated/oas/3.0.0.json
- Privacy/terms describe receipt processing; version `2026-09-24-v2` requires new
  acceptance in private mode. Any Etsy application/use-case description must now
  disclose receipt reads/aggregate sales and select **Read sales data**; Commercial
  status alone is not the written analytics/AI permission described above.
- Validation: 178 relevant Etsy/pilot/reporting tests passed; 1 PostgreSQL integration
  test skipped without a local test DB. Frontend lint and production build passed.
  Real populated-shop receipt import, provider output quality and deployment remain
  unverified. Netlify credit exhaustion still blocks production publication.

Local sample/manual development is unchanged while the feature flag is absent.
Real Etsy OAuth remains hosted-only. To close all private functionality without
reopening legacy routes, keep the private-pilot flag true and empty the allowlist;
setting it false restores the legacy public behavior.

### Browser verification and release status (2026-09-25)

- Tested the production frontend build in Chromium with intercepted fixture API
  responses. Selected-product import, required views/button validation, preservation
  of edits during requests, manual fallback on API failure, stale-response rejection
  after a date change, and blank metrics for ambiguous refunds all passed. No React
  runtime errors were observed. This does **not** verify live Etsy data or OAuth.
- Reproducible check: build with `npm --prefix client run build`, then run
  `node scripts/testEtsySalesBrowser.mjs` with Playwright and its Chromium installed
  in the test environment. Optional `LIGHTHOUSE_PLAYWRIGHT_MODULE` (module path) and
  `LIGHTHOUSE_CHROMIUM_EXECUTABLE` (binary path) allow external tooling without adding
  browser dependencies to the production install. Requests are intercepted and no
  real account, API token, email or paid service is used. The test clock is fixed.
- Read-only Netlify inspection confirmed the published deploy is still `e3d374a`
  (`6ab2a10dddc674000885ec82`), while GitHub contains sales import at `c8b1940`.
  Production publication is still outstanding; do not tell sellers these changes
  are already available. No hosting purchase or extra deploy was triggered.
- Native PostgreSQL integration tests remain unexecuted in this workspace: no
  server was installed and the package manager could not run with the available
  OS permissions. Do not substitute the successful mocked/browser tests for the
  two PostgreSQL integration checks. Run both against a dedicated local
  `lighthouse_test*` database, never production:
  `ETSY_TEST_DATABASE_URL=<local-test-url> node --test tests/etsyPostgresStorage.integration.test.js tests/pilotPostgres.integration.test.js`.
- Next release gates remain: resume Netlify publication, complete database checks,
  confirm Etsy's required written analytics/AI permission and pilot configuration,
  then verify useful output with a populated shop. Ten revised outreach drafts
  remain unsent pending the user's review and the readiness checks above.

### Hosting resumed (2026-09-25 UTC)

- The operator upgraded the existing Netlify team to Personal. Netlify now reports
  1,000 monthly plan credits and automatic credit recharge disabled. This hosting
  change does not enable the invitation-only Etsy pilot or its sales route.
- Trigger one production build from the GitHub-connected `main` branch, then
  verify the published commit, Netlify proxy routing, and the public seller flow.
  Keep outreach drafts unsent until the remaining pilot gates pass.

### Seller-facing review and readiness audit (2026-09-25)

This is the current status; earlier blocked-deploy entries above are historical.

- Netlify production published `a58ee5a`, including the required Etsy trademark
  notice. Hosting credit exhaustion is resolved.
- The operator supplied a screenshot showing **Pending Commercial Approval**.
  Submission is complete; approval and specific written analytics/AI authorization
  remain outstanding. Do not enable either approval flag on this evidence.
- The operator's before/after screenshots show **Run Shop Review** completing and
  displaying its sample result. The earlier cloud-browser stall is not evidence
  of a confirmed product defect. Local GENERAL_REVIEW execution also returned 200.
- Replaced the landing page's expandable copy-draft example and Copy buttons with
  a compact fictional problem → one proposed change → measurement example.
  A working sample-planner button opens the existing workflow at the top of the
  page. No live AI review or proven sales uplift is implied.
- Targeted audit: 191 passing tests covering Etsy, reporting periods, planning,
  outcomes and pilot access/budget logic; two real PostgreSQL integration tests
  skipped because no dedicated local PostgreSQL server is available. Lint and
  production build passed. These checks do not verify live Etsy receipt imports
  or real AI output quality.
- The live Support page, after a reload, explicitly reports that its public
  contact is still being configured. Obtain the operator's chosen monitored
  address and configure `LIGHTHOUSE_SUPPORT_EMAIL` on Render before invitations.
- Remaining release gates: dedicated PostgreSQL checks and migrations; verified
  persistent storage and pilot settings (at most five approved Etsy user IDs,
  dedicated AI key and the existing budget ledger); required Etsy authorization;
  a useful end-to-end review and import check using an authorized populated shop.
- Outreach order: clear these gates, verify the existing recipients are still
  relevant/active, align the approved drafts with the live deliverable, then send
  the ten invitations. Admit at most five sellers; after delivering a useful
  review ask whether they would use it again next week. No emails sent in this audit.
