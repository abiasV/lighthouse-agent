import express from "express";

import buildEtsyAuthorizationRequest from "../integrations/etsy/auth/buildEtsyAuthorizationRequest.js";

import completeEtsyAuthorization from "../integrations/etsy/auth/completeEtsyAuthorization.js";

import { discardEtsyAuthSession } from "../integrations/etsy/auth/etsyAuthSessionStore.js";

export function createEtsyAuthRouter({ exchangeAuthorizationCode } = {}) {
  const router = express.Router();

  // Start an Etsy OAuth authorization request

  router.get("/start", (req, res) => {
    try {
      const clientId = process.env.ETSY_CLIENT_ID;

      const redirectUri = process.env.ETSY_REDIRECT_URI;

      const result = buildEtsyAuthorizationRequest({
        clientId,
        redirectUri,
      });

      return res.json({
        authorizationUrl: result.authorizationUrl,
        expiresInSeconds: result.expiresInSeconds,
      });
    } catch (error) {
      const configurationErrors = {
        ETSY_CLIENT_ID_REQUIRED: "Etsy OAuth client ID is not configured.",

        ETSY_REDIRECT_URI_REQUIRED:
          "Etsy OAuth redirect URI is not configured.",
      };

      if (configurationErrors[error.message]) {
        return res.status(503).json({
          error: error.message,
          message: configurationErrors[error.message],
        });
      }

      console.error(error);

      return res.status(500).json({
        error: "ETSY_AUTH_START_FAILED",
        message: "Lighthouse could not start Etsy authorization.",
      });
    }
  });

  // Complete an Etsy OAuth authorization request

  router.get("/callback", async (req, res) => {
    try {
      const {
        code,
        state,
        error,
        error_description: errorDescription,
      } = req.query;

      if (error) {
        discardEtsyAuthSession(state);

        return res.status(400).json({
          error: "ETSY_AUTHORIZATION_DENIED",
          message:
            typeof errorDescription === "string"
              ? errorDescription
              : "Etsy authorization was not completed.",
        });
      }

      const result = await completeEtsyAuthorization({
        state,
        code,
        clientId: process.env.ETSY_CLIENT_ID,
        exchangeAuthorizationCode,
      });

      return res.json({
        connected: true,
        connection: result.connection,
      });
    } catch (error) {
      const clientErrors = {
        ETSY_OAUTH_STATE_REQUIRED: "OAuth state is required.",

        ETSY_AUTHORIZATION_CODE_REQUIRED:
          "Etsy authorization code is required.",

        INVALID_OR_EXPIRED_ETSY_OAUTH_STATE:
          "The Etsy authorization request is invalid or expired.",

        ETSY_REQUIRED_SCOPE_NOT_GRANTED:
          "Etsy did not grant all required permissions.",
      };

      if (clientErrors[error.message]) {
        return res.status(400).json({
          error: error.message,
          message: clientErrors[error.message],
        });
      }

      if (error.message === "ETSY_TOKEN_EXCHANGE_FAILED") {
        return res.status(502).json({
          error: error.message,
          message: "Etsy did not accept the token exchange.",
        });
      }

      if (
        error.message === "INVALID_ETSY_TOKEN_RESPONSE" ||
        error.message === "INVALID_ETSY_ACCESS_TOKEN"
      ) {
        return res.status(502).json({
          error: error.message,
          message: "Etsy returned an invalid token response.",
        });
      }

      if (error.message === "ETSY_CLIENT_ID_REQUIRED") {
        return res.status(503).json({
          error: error.message,
          message: "Etsy OAuth client ID is not configured.",
        });
      }

      console.error(error);

      return res.status(500).json({
        error: "ETSY_AUTH_CALLBACK_FAILED",
        message: "Lighthouse could not complete Etsy authorization.",
      });
    }
  });

  return router;
}

export default createEtsyAuthRouter();