import express from "express";

import buildEtsyAuthorizationRequest from "../integrations/etsy/auth/buildEtsyAuthorizationRequest.js";

import completeEtsyAuthorization from "../integrations/etsy/auth/completeEtsyAuthorization.js";

import { consumeEtsyAuthSession } from "../integrations/etsy/auth/etsyAuthSessionStore.js";
import {
  createEtsyBrowserSession,
  readEtsyBrowserSession,
  serializeEtsyBrowserSessionCookie,
} from "../integrations/etsy/auth/etsyBrowserSession.js";

export function createEtsyAuthRouter({ exchangeAuthorizationCode } = {}) {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    next();
  });

  // Start an Etsy OAuth authorization request

  router.get("/start", (req, res) => {
    try {
      const clientId = process.env.ETSY_CLIENT_ID;

      const redirectUri = process.env.ETSY_REDIRECT_URI;

      let browserSession = readEtsyBrowserSession(req);
      if (!browserSession) {
        browserSession = createEtsyBrowserSession();
        res.set(
          "Set-Cookie",
          serializeEtsyBrowserSessionCookie(browserSession.token, {
            secure: process.env.NODE_ENV === "production" || Boolean(process.env.RENDER),
          }),
        );
      }

      const result = buildEtsyAuthorizationRequest({
        clientId,
        redirectUri,
        ownerSessionHash: browserSession.ownerSessionHash,
      });

      res.set("Cache-Control", "no-store");
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

      console.error("ETSY_AUTH_REQUEST_FAILED");

      return res.status(500).json({
        error: "ETSY_AUTH_START_FAILED",
        message: "Lighthouse could not start Etsy authorization.",
      });
    }
  });

  // Complete an Etsy OAuth authorization request

  router.get("/callback", async (req, res) => {
    // Browser navigation returns to a fixed local page; API clients keep JSON.
    const reply = (status, body) => {
      if (req.accepts(["json", "html"]) === "html") {
        const outcome = body.connected ? "connected"
          : body.error === "ETSY_AUTHORIZATION_DENIED" ? "denied"
          : ["ETSY_BROWSER_SESSION_REQUIRED", "INVALID_OR_EXPIRED_ETSY_OAUTH_STATE",
              "ETSY_OAUTH_BROWSER_SESSION_MISMATCH"].includes(body.error) ? "expired"
          : "failed";
        return res.redirect(303, `/?etsy=${outcome}`);
      }
      return res.status(status).json(body);
    };
    try {
      const {
        code,
        state,
        error,
        error_description: errorDescription,
      } = req.query;

      const browserSession = readEtsyBrowserSession(req);
      if (error) {
        if (!browserSession) {
          return reply(401, { error: "ETSY_BROWSER_SESSION_REQUIRED" });
        }
        if (typeof state !== "string" || !state.trim()) {
          throw new Error("ETSY_OAUTH_STATE_REQUIRED");
        }
        if (!consumeEtsyAuthSession(state.trim(), Date.now(), {
          ownerSessionHash: browserSession.ownerSessionHash,
        })) throw new Error("INVALID_OR_EXPIRED_ETSY_OAUTH_STATE");

        return reply(400, {
          error: "ETSY_AUTHORIZATION_DENIED",
          message:
            typeof errorDescription === "string"
              ? errorDescription
              : "Etsy authorization was not completed.",
        });
      }

      if (
        typeof state === "string" &&
        state.trim() &&
        typeof code === "string" &&
        code.trim() &&
        !browserSession
      ) {
        return reply(401, {
          error: "ETSY_BROWSER_SESSION_REQUIRED",
          message: "Return to Lighthouse and start the Etsy connection again.",
        });
      }

      const result = await completeEtsyAuthorization({
        state,
        code,
        clientId: process.env.ETSY_CLIENT_ID,
        ownerSessionHash: browserSession?.ownerSessionHash,
        exchangeAuthorizationCode,
      });

      res.set("Cache-Control", "no-store");
      return reply(200, {
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

        ETSY_OAUTH_BROWSER_SESSION_MISMATCH:
          "This Etsy authorization was started in another browser session.",
      };

      if (clientErrors[error.message]) {
        return reply(
          error.message === "ETSY_OAUTH_BROWSER_SESSION_MISMATCH" ? 401 : 400, {
          error: error.message,
          message: clientErrors[error.message],
        });
      }

      if (error.message === "ETSY_TOKEN_EXCHANGE_FAILED") {
        return reply(502, {
          error: error.message,
          message: "Etsy did not accept the token exchange.",
        });
      }

      if (
        error.message === "INVALID_ETSY_TOKEN_RESPONSE" ||
        error.message === "INVALID_ETSY_ACCESS_TOKEN"
      ) {
        return reply(502, {
          error: error.message,
          message: "Etsy returned an invalid token response.",
        });
      }

      if (error.message === "ETSY_CLIENT_ID_REQUIRED") {
        return reply(503, {
          error: error.message,
          message: "Etsy OAuth client ID is not configured.",
        });
      }

      console.error("ETSY_AUTH_REQUEST_FAILED");

      return reply(500, {
        error: "ETSY_AUTH_CALLBACK_FAILED",
        message: "Lighthouse could not complete Etsy authorization.",
      });
    }
  });

  return router;
}

export default createEtsyAuthRouter();
