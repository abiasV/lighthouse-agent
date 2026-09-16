import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  ETSY_AUTH_SESSION_TTL_MS,
  clearEtsyAuthSessions,
  consumeEtsyAuthSession,
  createEtsyAuthSession,
  discardEtsyAuthSession,
  getEtsyAuthSessionCount,
} from "../src/integrations/etsy/auth/etsyAuthSessionStore.js";

afterEach(() => {
  clearEtsyAuthSessions();
});

test("Etsy auth session remains available before TTL expiry", () => {
  const now = 1_000_000;

  createEtsyAuthSession({
    state: "state_before_expiry",
    codeVerifier: "verifier_before_expiry",
    redirectUri: "https://example.com/api/etsy/auth/callback",
    scopes: ["listings_r", "transactions_r"],
    now,
  });

  assert.equal(getEtsyAuthSessionCount(now), 1);

  const session = consumeEtsyAuthSession(
    "state_before_expiry",
    now + ETSY_AUTH_SESSION_TTL_MS - 1,
  );

  assert.ok(session);

  assert.equal(session.codeVerifier, "verifier_before_expiry");
});

test("Etsy auth session expires after TTL", () => {
  const now = 2_000_000;

  createEtsyAuthSession({
    state: "state_expired",
    codeVerifier: "verifier_expired",
    redirectUri: "https://example.com/api/etsy/auth/callback",
    scopes: ["listings_r", "transactions_r"],
    now,
  });

  const session = consumeEtsyAuthSession(
    "state_expired",
    now + ETSY_AUTH_SESSION_TTL_MS,
  );

  assert.equal(session, null);

  assert.equal(getEtsyAuthSessionCount(now + ETSY_AUTH_SESSION_TTL_MS), 0);
});

test("Etsy auth session can only be consumed once", () => {
  const now = 3_000_000;

  createEtsyAuthSession({
    state: "state_single_use",
    codeVerifier: "verifier_single_use",
    redirectUri: "https://example.com/api/etsy/auth/callback",
    scopes: ["listings_r", "transactions_r"],
    now,
  });

  const firstConsume = consumeEtsyAuthSession("state_single_use", now + 1);

  const secondConsume = consumeEtsyAuthSession("state_single_use", now + 2);

  assert.ok(firstConsume);

  assert.equal(secondConsume, null);

  assert.equal(getEtsyAuthSessionCount(now + 2), 0);
});

test("creating a new Etsy auth session removes expired sessions", () => {
  const now = 4_000_000;

  createEtsyAuthSession({
    state: "old_state",
    codeVerifier: "old_verifier",
    redirectUri: "https://example.com/api/etsy/auth/callback",
    scopes: ["listings_r"],
    now,
  });

  createEtsyAuthSession({
    state: "new_state",
    codeVerifier: "new_verifier",
    redirectUri: "https://example.com/api/etsy/auth/callback",
    scopes: ["listings_r"],
    now: now + ETSY_AUTH_SESSION_TTL_MS,
  });

  assert.equal(getEtsyAuthSessionCount(now + ETSY_AUTH_SESSION_TTL_MS), 1);

  assert.equal(
    consumeEtsyAuthSession("old_state", now + ETSY_AUTH_SESSION_TTL_MS),
    null,
  );

  assert.ok(
    consumeEtsyAuthSession("new_state", now + ETSY_AUTH_SESSION_TTL_MS),
  );
});

test("discarding an Etsy auth session removes it without consuming it", () => {
  const now = 5_000_000;

  createEtsyAuthSession({
    state: "discard_state",
    codeVerifier: "discard_verifier",
    redirectUri: "https://example.com/api/etsy/auth/callback",
    scopes: ["listings_r"],
    now,
  });

  const discarded = discardEtsyAuthSession("discard_state", now + 1);

  assert.equal(discarded, true);

  assert.equal(consumeEtsyAuthSession("discard_state", now + 2), null);

  assert.equal(getEtsyAuthSessionCount(now + 2), 0);
});