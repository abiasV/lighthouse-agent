export const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

export default async function exchangeEtsyAuthorizationCode({
  clientId,
  code,
  codeVerifier,
  redirectUri,
  fetchImpl = fetch,
}) {
  if (typeof clientId !== "string" || !clientId.trim()) {
    throw new Error("ETSY_CLIENT_ID_REQUIRED");
  }

  if (typeof code !== "string" || !code.trim()) {
    throw new Error("ETSY_AUTHORIZATION_CODE_REQUIRED");
  }

  if (typeof codeVerifier !== "string" || !codeVerifier.trim()) {
    throw new Error("ETSY_CODE_VERIFIER_REQUIRED");
  }

  if (typeof redirectUri !== "string" || !redirectUri.trim()) {
    throw new Error("ETSY_REDIRECT_URI_REQUIRED");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId.trim(),
    redirect_uri: redirectUri.trim(),
    code: code.trim(),
    code_verifier: codeVerifier.trim(),
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
    throw new Error("ETSY_TOKEN_EXCHANGE_FAILED");
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
    throw new Error("INVALID_ETSY_TOKEN_RESPONSE");
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
