import express from "express";

import getEtsyAuthenticatedUser from "../integrations/etsy/getEtsyAuthenticatedUser.js";

export function createEtsyReadRouter({
  getAuthenticatedUser = getEtsyAuthenticatedUser,
} = {}) {
  const router = express.Router();

  // *Read the authenticated Etsy user*

  router.get("/me", async (req, res) => {
    try {
      const { connectionId } = req.query;

      if (typeof connectionId !== "string" || !connectionId.trim()) {
        return res.status(400).json({
          error: "ETSY_CONNECTION_ID_REQUIRED",
          message: "An Etsy connection ID is required.",
        });
      }

      const user = await getAuthenticatedUser({
        connectionId: connectionId.trim(),

        clientId: process.env.ETSY_CLIENT_ID,

        keystring: process.env.ETSY_CLIENT_ID,

        sharedSecret: process.env.ETSY_SHARED_SECRET,
      });

      return res.json({
        connected: true,
        user,
      });
    } catch (error) {
      if (error.message === "ETSY_CONNECTION_NOT_FOUND") {
        return res.status(404).json({
          error: error.message,
          message: "The Etsy connection was not found.",
        });
      }

      if (error.message === "ETSY_REAUTHORIZATION_REQUIRED") {
        return res.status(401).json({
          error: error.message,
          message: "The Etsy connection must be authorized again.",
        });
      }

      if (error.message === "ETSY_RATE_LIMITED") {
        return res.status(429).json({
          error: error.message,
          message: "Etsy rate-limited the request. Please try again later.",
        });
      }

      if (
        error.message === "ETSY_TEMPORARY_ERROR" ||
        error.message === "ETSY_NETWORK_ERROR"
      ) {
        return res.status(502).json({
          error: error.message,
          message: "Etsy is temporarily unavailable.",
        });
      }

      if (
        error.message === "ETSY_API_KEYSTRING_REQUIRED" ||
        error.message === "ETSY_SHARED_SECRET_REQUIRED" ||
        error.message === "ETSY_CLIENT_ID_REQUIRED"
      ) {
        return res.status(503).json({
          error: error.message,
          message: "Etsy API credentials are not configured correctly.",
        });
      }

      if (error.message === "ETSY_API_REQUEST_FAILED") {
        return res.status(502).json({
          error: error.message,
          message: "Etsy rejected the API request.",
        });
      }

      console.error(error);

      return res.status(500).json({
        error: "ETSY_USER_READ_FAILED",
        message: "Lighthouse could not read the authenticated Etsy user.",
      });
    }
  });

  return router;
}

export default createEtsyReadRouter();