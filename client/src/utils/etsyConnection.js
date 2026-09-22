export const ETSY_RETURN_MESSAGES = {
  denied: "Etsy authorization was cancelled. You can connect again whenever you are ready.",
  expired: "The connection request expired or belongs to another browser. Start again in this browser.",
  failed: "The Etsy connection could not be completed. Please try connecting again.",
};

export function validateEtsyAuthorizationUrl(value, origin) {
  const url = new URL(value);
  const callback = new URL(url.searchParams.get("redirect_uri"));
  if (url.origin !== "https://www.etsy.com" || url.pathname !== "/oauth/connect" ||
      url.username || url.password || callback.origin !== origin ||
      callback.pathname !== "/api/etsy/auth/callback" || callback.search || callback.hash ||
      callback.username || callback.password) {
    throw new Error("ETSY_CALLBACK_CONFIGURATION");
  }
  return url.href;
}

export async function requestEtsy(path, { signal, fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(path, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch {
    throw new Error("Could not reach Lighthouse. Check your internet connection and try again.");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Lighthouse received an unexpected response. Please try again.");
  }
  if (!response.ok) {
    const error = new Error(response.status === 503
      ? "Etsy connection is not available yet. Please try again later."
      : response.status === 429
        ? "Etsy is busy. Please wait a moment before trying again."
        : "Could not check your Etsy connection. Please try again.");
    error.code = data.error;
    throw error;
  }
  return data;
}
