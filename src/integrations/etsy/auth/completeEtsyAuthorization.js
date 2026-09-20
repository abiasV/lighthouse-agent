import { consumeEtsyAuthSession } from "./etsyAuthSessionStore.js";

import exchangeEtsyAuthorizationCode from "./exchangeEtsyAuthorizationCode.js";

import {
  buildPublicEtsyConnection,
  createEtsyConnection,
} from "./etsyConnectionStore.js";

function hasAllRequiredScopes(grantedScopes, requiredScopes) {
  return requiredScopes.every((scope) => grantedScopes.includes(scope));
}

export default async function completeEtsyAuthorization({
  state,
  code,
  clientId,
  now = Date.now(),
  exchangeAuthorizationCode = exchangeEtsyAuthorizationCode,
}) {
  if (typeof state !== "string" || !state.trim()) {
    throw new Error("ETSY_OAUTH_STATE_REQUIRED");
  }

  if (typeof code !== "string" || !code.trim()) {
    throw new Error("ETSY_AUTHORIZATION_CODE_REQUIRED");
  }

  const authSession = consumeEtsyAuthSession(state.trim(), now);

  if (!authSession) {
    throw new Error("INVALID_OR_EXPIRED_ETSY_OAUTH_STATE");
  }

  const tokenResult = await exchangeAuthorizationCode({
    clientId,
    code: code.trim(),
    codeVerifier: authSession.codeVerifier,
    redirectUri: authSession.redirectUri,
  });

  if (!hasAllRequiredScopes(tokenResult.scopes, authSession.scopes)) {
    throw new Error("ETSY_REQUIRED_SCOPE_NOT_GRANTED");
  }

  const connection = await createEtsyConnection({
    tokenResult,
    now,
  });

  return {
    connection: buildPublicEtsyConnection(connection),
  };
}
