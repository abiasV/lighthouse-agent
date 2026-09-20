import { randomUUID } from "node:crypto";
import { createMemoryEtsyConnectionRepository } from "./memoryEtsyConnectionRepository.js";

let repository = createMemoryEtsyConnectionRepository();

export function setEtsyConnectionRepository(nextRepository) {
  repository = nextRepository;
}

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

export async function createEtsyConnection({
  tokenResult,
  ownerSessionHash,
  now = Date.now(),
}) {
  const etsyUserId = extractEtsyUserId(tokenResult.accessToken);

  if (!etsyUserId) {
    throw new Error("INVALID_ETSY_ACCESS_TOKEN");
  }

  if (
    typeof ownerSessionHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(ownerSessionHash)
  ) {
    throw new Error("ETSY_OWNER_SESSION_INVALID");
  }

  const existingConnection =
    await repository.getByOwnerSessionHash(ownerSessionHash);
  const connectionId = existingConnection?.connectionId ?? randomUUID();

  const connection = {
    connectionId,
    ownerSessionHash,
    etsyUserId,

    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,

    tokenType: tokenResult.tokenType,

    scopes: [...tokenResult.scopes],

    createdAt: now,
    updatedAt: now,

    accessTokenExpiresAt: now + tokenResult.expiresInSeconds * 1000,
  };

  if (existingConnection) {
    await repository.save(connection);
  } else {
    await repository.insert(connection);
  }

  return connection;
}

export async function getEtsyConnection(connectionId) {
  return repository.get(connectionId);
}

export async function getEtsyConnectionByOwnerSessionHash(ownerSessionHash) {
  if (typeof ownerSessionHash !== "string" || !/^[a-f0-9]{64}$/.test(ownerSessionHash)) {
    return null;
  }
  return repository.getByOwnerSessionHash(ownerSessionHash);
}

function buildUpdatedConnection(existingConnection, tokenResult, now) {

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

  return updatedConnection;
}

export function getEtsyConnectionCount() {
  if (!repository.count) throw new Error("ETSY_MEMORY_STORE_ONLY");
  return repository.count();
}

export function clearEtsyConnections() {
  if (!repository.clear) throw new Error("ETSY_MEMORY_STORE_ONLY");
  repository.clear();
}

export function buildPublicEtsyConnection(connection) {
  return {
    etsyUserId: connection.etsyUserId,

    scopes: [...connection.scopes],

    accessTokenExpiresAt: connection.accessTokenExpiresAt,
  };
}
// The lock covers reading, provider refresh, and persisting rotated tokens.
export async function withEtsyConnectionLock(connectionId, callback) {
  return repository.withLock(connectionId, async (lockedRepository) => {
    const connection = await lockedRepository.get(connectionId);
    if (!connection) throw new Error("ETSY_CONNECTION_NOT_FOUND");
    return callback({
      connection,
      async saveTokens(tokenResult, now) {
        const updated = buildUpdatedConnection(connection, tokenResult, now);
        await lockedRepository.save(updated);
        return updated;
      },
    });
  });
}

export async function updateEtsyConnectionTokens({ connectionId, tokenResult, now = Date.now() }) {
  return withEtsyConnectionLock(connectionId, ({ saveTokens }) => saveTokens(tokenResult, now));
}
