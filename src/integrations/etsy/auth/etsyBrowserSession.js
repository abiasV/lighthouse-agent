import { createHash, randomBytes } from "node:crypto";

export const ETSY_BROWSER_SESSION_COOKIE = "lighthouse_etsy_session";
export const ETSY_BROWSER_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function hashEtsyBrowserSession(token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error("ETSY_BROWSER_SESSION_INVALID");
  }
  return createHash("sha256").update(token).digest("hex");
}

export function createEtsyBrowserSession() {
  const token = randomBytes(32).toString("base64url");
  return { token, ownerSessionHash: hashEtsyBrowserSession(token) };
}

export function readEtsyBrowserSession(req) {
  const header = req.headers.cookie;
  if (typeof header !== "string") return null;
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const name = item.slice(0, separator).trim();
    if (name !== ETSY_BROWSER_SESSION_COOKIE) continue;
    const token = item.slice(separator + 1).trim();
    try {
      return { token, ownerSessionHash: hashEtsyBrowserSession(token) };
    } catch {
      return null;
    }
  }
  return null;
}

export function serializeEtsyBrowserSessionCookie(token, { secure = true } = {}) {
  hashEtsyBrowserSession(token);
  return [
    `${ETSY_BROWSER_SESSION_COOKIE}=${token}`,
    "Path=/api/etsy",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ETSY_BROWSER_SESSION_MAX_AGE_SECONDS}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
