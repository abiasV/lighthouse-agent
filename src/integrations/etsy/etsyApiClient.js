import getValidEtsyAccessToken from "./auth/getValidEtsyAccessToken.js";

export const ETSY_API_BASE_URL = "https://api.etsy.com/v3";

export const ETSY_MAX_RATE_LIMIT_RETRIES = 1;

export const ETSY_MAX_TEMPORARY_RETRIES = 1;

export const ETSY_DEFAULT_RETRY_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildApiKeyHeader({ keystring, sharedSecret }) {
  if (typeof keystring !== "string" || !keystring.trim()) {
    throw new Error("ETSY_API_KEYSTRING_REQUIRED");
  }

  if (typeof sharedSecret !== "string" || !sharedSecret.trim()) {
    throw new Error("ETSY_SHARED_SECRET_REQUIRED");
  }

  return `${keystring.trim()}:${sharedSecret.trim()}`;
}

function buildUrl({ path, query }) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new Error("INVALID_ETSY_API_PATH");
  }

  const url = new URL(`${ETSY_API_BASE_URL}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function parseRetryAfterMs(response) {
  const retryAfter = response.headers?.get?.("retry-after");

  if (!retryAfter) {
    return null;
  }

  const seconds = Number(retryAfter);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  return seconds * 1000;
}

export default async function etsyApiGet({
  connectionId,
  clientId,
  keystring,
  sharedSecret,
  path,
  query,
  fetchImpl = fetch,
  getAccessToken = getValidEtsyAccessToken,
  sleepImpl = sleep,
}) {
  const apiKeyHeader = buildApiKeyHeader({
    keystring,
    sharedSecret,
  });

  const url = buildUrl({
    path,
    query,
  });

  let authRetryUsed = false;
  let rateLimitRetries = 0;
  let temporaryRetries = 0;

  let tokenResult = await getAccessToken({
    connectionId,
    clientId,
  });

  while (true) {
    let response;

    try {
      response = await fetchImpl(url, {
        method: "GET",

        headers: {
          "x-api-key": apiKeyHeader,

          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
      });
    } catch {
      if (temporaryRetries < ETSY_MAX_TEMPORARY_RETRIES) {
        temporaryRetries += 1;

        await sleepImpl(ETSY_DEFAULT_RETRY_DELAY_MS);

        continue;
      }

      throw new Error("ETSY_NETWORK_ERROR");
    }

    if (response.ok) {
      return response.json();
    }

    if (response.status === 401) {
      if (authRetryUsed) {
        throw new Error("ETSY_REAUTHORIZATION_REQUIRED");
      }

      authRetryUsed = true;

      tokenResult = await getAccessToken({
        connectionId,
        clientId,
        forceRefresh: true,
        rejectedAccessToken: tokenResult.accessToken,
      });

      continue;
    }

    if (response.status === 429) {
      if (rateLimitRetries >= ETSY_MAX_RATE_LIMIT_RETRIES) {
        throw new Error("ETSY_RATE_LIMITED");
      }

      rateLimitRetries += 1;

      const retryAfterMs = parseRetryAfterMs(response);

      await sleepImpl(retryAfterMs ?? ETSY_DEFAULT_RETRY_DELAY_MS);

      continue;
    }

    if (response.status >= 500 && response.status <= 599) {
      if (temporaryRetries >= ETSY_MAX_TEMPORARY_RETRIES) {
        throw new Error("ETSY_TEMPORARY_ERROR");
      }

      temporaryRetries += 1;

      await sleepImpl(ETSY_DEFAULT_RETRY_DELAY_MS);

      continue;
    }

    const error = new Error("ETSY_API_REQUEST_FAILED");

    error.status = response.status;

    throw error;
  }
}
