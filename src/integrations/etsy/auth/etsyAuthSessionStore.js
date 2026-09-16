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
  now = Date.now(),
}) {
  removeExpiredEtsyAuthSessions(now);

  const session = {
    state,
    codeVerifier,
    redirectUri,
    scopes: [...scopes],
    createdAt: now,
    expiresAt: now + ETSY_AUTH_SESSION_TTL_MS,
  };

  etsyAuthSessions.set(state, session);

  return session;
}

export function consumeEtsyAuthSession(state, now = Date.now()) {
  removeExpiredEtsyAuthSessions(now);

  const session = etsyAuthSessions.get(state);

  if (!session) {
    return null;
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
