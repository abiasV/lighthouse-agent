export const ETSY_AUTH_SESSION_TTL_MS = 10 * 60 * 1000;

const etsyAuthSessions = new Map();

function removeExpiredEtsyAuthSessions(now = Date.now()) {
  for (const [state, session] of etsyAuthSessions.entries()) {
    if (session.expiresAt <= now) {
      etsyAuthSessions.delete(state);
    }
  }
}

export function createEtsyAuthSession({
  state,
  codeVerifier,
  redirectUri,
  scopes,
  ownerSessionHash = null,
  now = Date.now(),
}) {
  removeExpiredEtsyAuthSessions(now);

  const session = {
    state,
    codeVerifier,
    redirectUri,
    scopes: [...scopes],
    ownerSessionHash,
    createdAt: now,
    expiresAt: now + ETSY_AUTH_SESSION_TTL_MS,
  };

  etsyAuthSessions.set(state, session);

  return session;
}

export function consumeEtsyAuthSession(
  state,
  now = Date.now(),
  { ownerSessionHash } = {},
) {
  removeExpiredEtsyAuthSessions(now);

  const session = etsyAuthSessions.get(state);

  if (!session) {
    return null;
  }

  if (
    session.ownerSessionHash &&
    session.ownerSessionHash !== ownerSessionHash
  ) {
    throw new Error("ETSY_OAUTH_BROWSER_SESSION_MISMATCH");
  }

  etsyAuthSessions.delete(state);

  return session;
}

export function discardEtsyAuthSession(state, now = Date.now()) {
  removeExpiredEtsyAuthSessions(now);

  if (typeof state !== "string" || !state.trim()) {
    return false;
  }

  return etsyAuthSessions.delete(state.trim());
}

export function getEtsyAuthSessionCount(now = Date.now()) {
  removeExpiredEtsyAuthSessions(now);

  return etsyAuthSessions.size;
}

export function clearEtsyAuthSessions() {
  etsyAuthSessions.clear();
}

export function discardEtsyAuthSessionsForOwner(ownerSessionHash) {
  for (const [state, session] of etsyAuthSessions) {
    if (session.ownerSessionHash === ownerSessionHash) etsyAuthSessions.delete(state);
  }
}
