import { randomUUID } from "node:crypto";

const etsyConnections = new Map();

function extractEtsyUserId(accessToken) {
  if (typeof accessToken !== "string") {
    return null;
  }

  const [userId] = accessToken.split(".");

  if (!/^\d+$/.test(userId)) {
    return null;
  }

  return userId;
}

export function createEtsyConnection({ tokenResult, now = Date.now() }) {
  const connectionId = randomUUID();

  const etsyUserId = extractEtsyUserId(tokenResult.accessToken);

  if (!etsyUserId) {
    throw new Error("INVALID_ETSY_ACCESS_TOKEN");
  }

  const connection = {
    connectionId,
    etsyUserId,

    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,

    tokenType: tokenResult.tokenType,

    scopes: [...tokenResult.scopes],

    createdAt: now,
    updatedAt: now,

    accessTokenExpiresAt: now + tokenResult.expiresInSeconds * 1000,
  };

  etsyConnections.set(connectionId, connection);

  return connection;
}

export function getEtsyConnection(connectionId) {
  return etsyConnections.get(connectionId) ?? null;
}

export function updateEtsyConnectionTokens({
  connectionId,
  tokenResult,
  now = Date.now(),
}) {
  const existingConnection = getEtsyConnection(connectionId);

  if (!existingConnection) {
    throw new Error("ETSY_CONNECTION_NOT_FOUND");
  }

  const refreshedEtsyUserId = extractEtsyUserId(tokenResult.accessToken);

  if (!refreshedEtsyUserId) {
    throw new Error("INVALID_ETSY_ACCESS_TOKEN");
  }

  if (refreshedEtsyUserId !== existingConnection.etsyUserId) {
    throw new Error("ETSY_TOKEN_USER_MISMATCH");
  }

  const requiredScopes = existingConnection.scopes;

  const hasAllRequiredScopes = requiredScopes.every((scope) =>
    tokenResult.scopes.includes(scope),
  );

  if (!hasAllRequiredScopes) {
    throw new Error("ETSY_REFRESH_SCOPE_MISMATCH");
  }

  const updatedConnection = {
    ...existingConnection,

    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,

    tokenType: tokenResult.tokenType,

    scopes: [...tokenResult.scopes],

    updatedAt: now,

    accessTokenExpiresAt: now + tokenResult.expiresInSeconds * 1000,
  };

  etsyConnections.set(connectionId, updatedConnection);

  return updatedConnection;
}

export function getEtsyConnectionCount() {
  return etsyConnections.size;
}

export function clearEtsyConnections() {
  etsyConnections.clear();
}

export function buildPublicEtsyConnection(connection) {
  return {
    connectionId: connection.connectionId,

    etsyUserId: connection.etsyUserId,

    scopes: [...connection.scopes],

    accessTokenExpiresAt: connection.accessTokenExpiresAt,
  };
}