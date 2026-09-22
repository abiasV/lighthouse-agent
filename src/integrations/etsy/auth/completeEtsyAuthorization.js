import { consumeEtsyAuthSession } from "./etsyAuthSessionStore.js";

import exchangeEtsyAuthorizationCode from "./exchangeEtsyAuthorizationCode.js";

import {
  buildPublicEtsyConnection,
  createEtsyConnection,
  withEtsyOwnerLock,
} from "./etsyConnectionStore.js";

function hasAllRequiredScopes(grantedScopes, requiredScopes) {
  return requiredScopes.every((scope) => grantedScopes.includes(scope));
}

export default async function completeEtsyAuthorization({
  state,
  code,
  clientId,
  ownerSessionHash,
  now = Date.now(),
  exchangeAuthorizationCode = exchangeEtsyAuthorizationCode,
}) {
  if (typeof state !== "string" || !state.trim()) {
    throw new Error("ETSY_OAUTH_STATE_REQUIRED");
  }

  if (typeof code !== "string" || !code.trim()) {
    throw new Error("ETSY_AUTHORIZATION_CODE_REQUIRED");
  }

  // Serialize completion with disconnect, including the provider exchange.
  return withEtsyOwnerLock(ownerSessionHash, async lockedRepository => {
    const authSession = consumeEtsyAuthSession(state.trim(), now, {
      ownerSessionHash,
    });

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
      lockedRepository,
      ownerSessionHash,
      now,
    });

    return {
      connectionId: connection.connectionId,
      connection: buildPublicEtsyConnection(connection),
    };
  });
}
