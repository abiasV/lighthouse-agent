export const ETSY_RETURN_MESSAGES = {
  switched: "Lighthouse is disconnected. Sign out on Etsy, sign in to your other account, then return here and select Connect Etsy. Disconnecting Lighthouse does not sign you out of Etsy.",
  denied: "Etsy authorization was cancelled. You can connect again whenever you are ready.",
  expired: "The connection request expired or belongs to another browser. Start again in this browser.",
  failed: "The Etsy connection could not be completed. Please try connecting again.",
};

export function isLocalEtsyDevelopmentOrigin(location) {
  return ["localhost", "127.0.0.1", "::1"].includes(location?.hostname);
}

export function shouldRecheckEtsyConnectionAfterPageShow(event, status) {
  return event?.persisted === true && status === "connecting";
}

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

export async function requestEtsy(path, { signal, fetchImpl = fetch, method = "GET", headers = {} } = {}) {
  let response;
  try {
    response = await fetchImpl(path, {
      credentials: "same-origin",
      cache: "no-store",
      method,
      headers: { Accept: "application/json", ...headers },
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
    error.status = response.status;
    throw error;
  }
  return data;
}

function waitForRetry(delayMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("ETSY_REQUEST_ABORTED"));
      return;
    }

    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);

    function handleAbort() {
      clearTimeout(timeout);
      reject(new Error("ETSY_REQUEST_ABORTED"));
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

export async function requestEtsyWithRetry(path, {
  retries = 3,
  retryDelayMs = 5000,
  onRetry,
  ...options
} = {}) {
  let retryCount = 0;

  while (true) {
    try {
      return await requestEtsy(path, options);
    } catch (error) {
      const canRetry = error.status === 503 &&
        retryCount < retries &&
        !options.signal?.aborted;

      if (!canRetry) throw error;

      retryCount += 1;
      onRetry?.(retryCount);
      await waitForRetry(retryDelayMs, options.signal);
    }
  }
}
