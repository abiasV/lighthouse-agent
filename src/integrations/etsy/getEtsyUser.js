import etsyApiGet from "./etsyApiClient.js";

export default async function getEtsyUser({
  connectionId,
  etsyUserId,
  clientId,
  keystring,
  sharedSecret,
  fetchImpl,
  getAccessToken,
  sleepImpl,
}) {
  if (
    typeof etsyUserId !== "string" ||
    !etsyUserId.trim()
  ) {
    throw new Error(
      "ETSY_USER_ID_REQUIRED",
    );
  }

  return etsyApiGet({
    connectionId,
    clientId,
    keystring,
    sharedSecret,
    path: `/application/users/${etsyUserId.trim()}`,
    fetchImpl,
    getAccessToken,
    sleepImpl,
  });
}