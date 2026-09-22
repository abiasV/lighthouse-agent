import { readEtsyBrowserSession, serializeEtsyBrowserSessionCookie } from "../integrations/etsy/auth/etsyBrowserSession.js";
import { getEtsyConnectionByOwnerSessionHash } from "../integrations/etsy/auth/etsyConnectionStore.js";

export const PILOT_COOKIE = "lighthouse_pilot_session";

// Unknown nonempty values fail closed instead of accidentally opening public APIs.
export function isPrivatePilot(env = process.env) {
  return Boolean(env.LIGHTHOUSE_PRIVATE_PILOT && env.LIGHTHOUSE_PRIVATE_PILOT !== "false");
}

export function pilotUserIds(env = process.env) {
  const ids = (env.LIGHTHOUSE_PILOT_ETSY_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
  if (env.LIGHTHOUSE_PRIVATE_PILOT !== "true" || ids.length > 5 ||
      new Set(ids).size !== ids.length || ids.some(id => !/^[1-9][0-9]{0,19}$/.test(id))) {
    throw new Error("PILOT_CONFIGURATION_INVALID");
  }
  return ids;
}

export function createPilotAccess({ env = process.env, ready = () => false,
  getConnection = getEtsyConnectionByOwnerSessionHash } = {}) {
  function allowed(connection) {
    return pilotUserIds(env).includes(String(connection.etsyUserId));
  }

  function describe(connection, req, res) {
    if (!isPrivatePilot(env)) return { enabled: false };
    const approved = allowed(connection);
    const session = readEtsyBrowserSession(req);
    if (approved && session) {
      // An alias extends access to /api/shop without changing the existing OAuth cookie.
      res.append("Set-Cookie", serializeEtsyBrowserSessionCookie(session.token, {
        secure: true, cookieName: PILOT_COOKIE, path: "/api",
      }));
    }
    return { enabled: true, approved, ready: ready(), etsyUserId: String(connection.etsyUserId) };
  }

  async function requireAccess(req, res, next) {
    if (!isPrivatePilot(env)) return next();
    res.set("Cache-Control", "no-store");
    try {
      if (!ready()) return res.status(503).json({ error: "PILOT_NOT_READY", message: "The private pilot is being prepared. Please try later." });
      // Use the original cookie only on its original route. Never trust an ID from a body/header.
      const session = req.originalUrl.startsWith("/api/etsy/")
        ? readEtsyBrowserSession(req)
        : readEtsyBrowserSession(req, { cookieName: PILOT_COOKIE });
      const connection = session && await getConnection(session.ownerSessionHash);
      if (!connection) return res.status(401).json({ error: "PILOT_SIGN_IN_REQUIRED", message: "Connect your invited Etsy account in this browser first." });
      if (!allowed(connection)) return res.status(403).json({ error: "PILOT_INVITATION_REQUIRED", message: "This private pilot is available only to approved Etsy accounts." });
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = new URL(env.ETSY_REDIRECT_URI).origin;
        if (req.get("Origin") !== origin || !req.is("application/json")) {
          return res.status(403).json({ error: "PILOT_ORIGIN_REQUIRED", message: "Open Lighthouse and try again from the planner." });
        }
      }
      req.pilotIdentity = { etsyUserId: String(connection.etsyUserId) };
      return next();
    } catch {
      return res.status(503).json({ error: "PILOT_ACCESS_UNAVAILABLE", message: "Access could not be checked. Please try later." });
    }
  }
  return { describe, requireAccess };
}
