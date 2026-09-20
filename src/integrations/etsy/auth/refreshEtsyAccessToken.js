import { ETSY_TOKEN_URL } from "./exchangeEtsyAuthorizationCode.js";

export default async function refreshEtsyAccessToken({
  clientId,
  refreshToken,
  fetchImpl = fetch,
}) {
  if (typeof clientId !== "string" || !clientId.trim()) {
    throw new Error("ETSY_CLIENT_ID_REQUIRED");
  }

  if (typeof refreshToken !== "string" || !refreshToken.trim()) {
    throw new Error("ETSY_REFRESH_TOKEN_REQUIRED");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId.trim(),
    refresh_token: refreshToken.trim(),
  });

  const response = await fetchImpl(ETSY_TOKEN_URL, {
    signal: AbortSignal.timeout(10_000),
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("ETSY_TOKEN_REFRESH_FAILED");
  }

  const data = await response.json();

  if (
    typeof data.access_token !== "string" ||
    !data.access_token ||
    typeof data.refresh_token !== "string" ||
    !data.refresh_token ||
    data.token_type !== "Bearer" ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0 ||
    typeof data.scope !== "string"
  ) {
    throw new Error("INVALID_ETSY_REFRESH_RESPONSE");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type,
    expiresInSeconds: data.expires_in,
    scopes: data.scope
      .split(" ")
      .map((scope) => scope.trim())
      .filter(Boolean),
  };
}
