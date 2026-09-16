import refreshEtsyAccessToken from "./refreshEtsyAccessToken.js";

import {
  getEtsyConnection,
  updateEtsyConnectionTokens,
} from "./etsyConnectionStore.js";

export const ETSY_TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

export default async function getValidEtsyAccessToken({
  connectionId,
  clientId,
  now = Date.now(),
  refreshBufferMs = ETSY_TOKEN_REFRESH_BUFFER_MS,
  forceRefresh = false,
  refreshAccessToken = refreshEtsyAccessToken,
}) {
  const connection = getEtsyConnection(connectionId);

  if (!connection) {
    throw new Error("ETSY_CONNECTION_NOT_FOUND");
  }

  const remainingLifetime = connection.accessTokenExpiresAt - now;

  if (!forceRefresh && remainingLifetime > refreshBufferMs) {
    return {
      accessToken: connection.accessToken,

      refreshed: false,
    };
  }

  const tokenResult = await refreshAccessToken({
    clientId,
    refreshToken: connection.refreshToken,
  });

  const updatedConnection = updateEtsyConnectionTokens({
    connectionId,
    tokenResult,
    now,
  });

  return {
    accessToken: updatedConnection.accessToken,

    refreshed: true,
  };
}