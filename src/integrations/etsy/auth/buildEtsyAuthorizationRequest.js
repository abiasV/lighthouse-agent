import { createHash, randomBytes } from "node:crypto";

import {
  createEtsyAuthSession,
  ETSY_AUTH_SESSION_TTL_MS,
} from "./etsyAuthSessionStore.js";

export const ETSY_AUTHORIZATION_URL = "https://www.etsy.com/oauth/connect";

export const ETSY_OAUTH_SCOPES = ["shops_r", "listings_r", "transactions_r"];

function generateBase64UrlRandomValue(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

function createCodeChallenge(codeVerifier) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export default function buildEtsyAuthorizationRequest({
  clientId,
  redirectUri,
  ownerSessionHash,
  now = Date.now(),
}) {
  if (typeof clientId !== "string" || !clientId.trim()) {
    throw new Error("ETSY_CLIENT_ID_REQUIRED");
  }

  if (typeof redirectUri !== "string" || !redirectUri.trim()) {
    throw new Error("ETSY_REDIRECT_URI_REQUIRED");
  }

  if (
    typeof ownerSessionHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(ownerSessionHash)
  ) {
    throw new Error("ETSY_OWNER_SESSION_INVALID");
  }

  const state = generateBase64UrlRandomValue();

  const codeVerifier = generateBase64UrlRandomValue();

  const codeChallenge = createCodeChallenge(codeVerifier);

  const session = createEtsyAuthSession({
    state,
    codeVerifier,
    redirectUri: redirectUri.trim(),
    scopes: ETSY_OAUTH_SCOPES,
    ownerSessionHash,
    now,
  });

  const authorizationUrl = new URL(ETSY_AUTHORIZATION_URL);

  authorizationUrl.searchParams.set("response_type", "code");

  authorizationUrl.searchParams.set("client_id", clientId.trim());

  authorizationUrl.searchParams.set("redirect_uri", redirectUri.trim());

  authorizationUrl.searchParams.set("scope", ETSY_OAUTH_SCOPES.join(" "));

  authorizationUrl.searchParams.set("state", state);

  authorizationUrl.searchParams.set("code_challenge", codeChallenge);

  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  return {
    authorizationUrl: authorizationUrl.toString(),
    expiresInSeconds: ETSY_AUTH_SESSION_TTL_MS / 1000,
    session,
  };
}
