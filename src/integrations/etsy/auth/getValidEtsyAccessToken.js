import refreshEtsyAccessToken from "./refreshEtsyAccessToken.js";
import { getEtsyConnection, withEtsyConnectionLock } from "./etsyConnectionStore.js";

export const ETSY_TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

export default async function getValidEtsyAccessToken({
  connectionId,
  clientId,
  now = Date.now(),
  refreshBufferMs = ETSY_TOKEN_REFRESH_BUFFER_MS,
  forceRefresh = false,
  rejectedAccessToken,
  refreshAccessToken = refreshEtsyAccessToken,
}) {
  function canReuse(connection) {
    const forced = forceRefresh &&
      (!rejectedAccessToken || connection.accessToken === rejectedAccessToken);
    return !forced && connection.accessTokenExpiresAt - now > refreshBufferMs;
  }
  const connection = await getEtsyConnection(connectionId);
  if (!connection) throw new Error("ETSY_CONNECTION_NOT_FOUND");
  if (canReuse(connection)) {
    return { accessToken: connection.accessToken, refreshed: false };
  }

  return withEtsyConnectionLock(connectionId, async ({ connection: current, saveTokens }) => {
    // Another request/process may already have refreshed while we waited.
    if (canReuse(current)) {
      return { accessToken: current.accessToken, refreshed: false };
    }
    const tokenResult = await refreshAccessToken({
      clientId,
      refreshToken: current.refreshToken,
    });
    const updated = await saveTokens(tokenResult, now);
    return { accessToken: updated.accessToken, refreshed: true };
  });
}
