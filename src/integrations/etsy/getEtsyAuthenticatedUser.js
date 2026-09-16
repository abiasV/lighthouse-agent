import etsyApiGet from "./etsyApiClient.js";

export default async function getEtsyAuthenticatedUser({
  connectionId,
  clientId,
  keystring,
  sharedSecret,
  fetchImpl,
  getAccessToken,
  sleepImpl,
}) {
  return etsyApiGet({
    connectionId,
    clientId,
    keystring,
    sharedSecret,
    path: "/application/users/me",
    fetchImpl,
    getAccessToken,
    sleepImpl,
  });
}