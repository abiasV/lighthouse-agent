import express from "express";

import getEtsyAuthenticatedUser from "../integrations/etsy/getEtsyAuthenticatedUser.js";
import getEtsyUser from "../integrations/etsy/getEtsyUser.js";
import getEtsyShopCatalog from "../integrations/etsy/getEtsyShopCatalog.js";
import getEtsyPeriodSales from "../integrations/etsy/getEtsyPeriodSales.js";
import { PERIOD_ERRORS } from "../../shared/reportingPeriod.js";
import { getEtsyConnectionByOwnerSessionHash } from "../integrations/etsy/auth/etsyConnectionStore.js";
import { readEtsyBrowserSession } from "../integrations/etsy/auth/etsyBrowserSession.js";

export function createEtsyReadRouter({
  getAuthenticatedUser = getEtsyAuthenticatedUser,
  getUser = getEtsyUser,
  getShopCatalog = getEtsyShopCatalog,
  getPeriodSales = getEtsyPeriodSales,
  salesImportEnabled = process.env.LIGHTHOUSE_PRIVATE_PILOT === "true" && process.env.LIGHTHOUSE_ETSY_REVIEW_APPROVED === "true",
  getConnectionByOwnerSessionHash = getEtsyConnectionByOwnerSessionHash,
  pilotAccess,
} = {}) {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  async function requireOwnedConnection(req) {
    const browserSession = readEtsyBrowserSession(req);
    if (!browserSession) throw new Error("ETSY_BROWSER_SESSION_REQUIRED");
    const connection = await getConnectionByOwnerSessionHash(
      browserSession.ownerSessionHash,
    );
    if (!connection) throw new Error("ETSY_CONNECTION_NOT_FOUND");
    return connection;
  }

  function handleOwnershipError(error, res) {
    if (error.message === "ETSY_BROWSER_SESSION_REQUIRED") {
      res.status(401).json({
        error: error.message,
        message: "Start or reconnect Etsy from this browser.",
      });
      return true;
    }
    if (error.message === "ETSY_CONNECTION_NOT_FOUND") {
      res.status(404).json({
        error: error.message,
        message: "No Etsy connection belongs to this browser session.",
      });
      return true;
    }
    return false;
  }

  router.get(["/shop/catalog", "/shop"], ...(pilotAccess ? [pilotAccess.requireAccess] : []), async (req, res) => {
    try {
      const connection = await requireOwnedConnection(req);
      const catalog = await getShopCatalog({
        summaryOnly: req.path === "/shop",
        connectionId: connection.connectionId,
        etsyUserId: connection.etsyUserId,
        clientId: process.env.ETSY_CLIENT_ID,
        keystring: process.env.ETSY_CLIENT_ID,
        sharedSecret: process.env.ETSY_SHARED_SECRET,
      });
      return res.json(catalog);
    } catch (error) {
      if (handleOwnershipError(error, res)) return;
      const errors = {
        ETSY_SHOP_NOT_FOUND: [404, "This Etsy account has no shop. Connect the account that owns your shop, or enter data manually."],
        ETSY_REAUTHORIZATION_REQUIRED: [401, "Your Etsy connection expired. Please reconnect."],
        ETSY_RATE_LIMITED: [429, "Etsy is busy. Please try importing again later."],
        ETSY_CATALOG_TOO_LARGE: [422, "Import currently supports up to 500 active listings. Please use manual entry for selected listings."],
        ETSY_CATALOG_CHANGED: [502, "The listing collection changed or was incomplete. Nothing was imported. Please try again."],
      };
      const [status, message] = errors[error.message] ?? [502, "Could not import your Etsy listings. Nothing was changed. Please retry or use manual entry."];
      return res.status(status).json({ error: errors[error.message] ? error.message : "ETSY_CATALOG_IMPORT_FAILED", message });
    }
  });

  router.get("/shop/sales", ...(pilotAccess ? [pilotAccess.requireAccess] : []), async (req, res) => {
    try {
      const connection = await requireOwnedConnection(req);
      if (!salesImportEnabled) return res.status(503).json({ error: "ETSY_SALES_NOT_READY", message: "Sales import is being prepared. You can enter your period figures manually." });
      const result = await getPeriodSales({
        connectionId: connection.connectionId, etsyUserId: connection.etsyUserId,
        clientId: process.env.ETSY_CLIENT_ID, keystring: process.env.ETSY_CLIENT_ID,
        sharedSecret: process.env.ETSY_SHARED_SECRET,
        shopId: req.query.shopId,
        listingIds: typeof req.query.listingIds === "string" ? req.query.listingIds.split(",") : null,
        reportingPeriod: { startDate: req.query.startDate, endDate: req.query.endDate, timeZone: "UTC" },
      });
      return res.json(result);
    } catch (error) {
      if (handleOwnershipError(error, res)) return;
      if (PERIOD_ERRORS[error.message]) return res.status(400).json({ error: error.message, message: PERIOD_ERRORS[error.message] });
      const errors = {
        ETSY_SALES_PERIOD_INVALID: [400, "Choose up to 90 completed days for sales import."],
        ETSY_SALES_SELECTION_INVALID: [400, "Import and select your Etsy products first."],
        ETSY_SALES_SHOP_MISMATCH: [409, "Your connected shop changed. Import its products again."],
        ETSY_SALES_PERMISSION_REQUIRED: [403, "Reconnect Etsy to grant read access to sales, then retry."],
        ETSY_REAUTHORIZATION_REQUIRED: [401, "Your Etsy connection expired. Please reconnect."],
        ETSY_RATE_LIMITED: [429, "Etsy is busy. Please try importing sales again later."],
        ETSY_SALES_TOO_LARGE: [422, "This import exceeds 1,000 orders across both periods. Choose a shorter date range or enter sales manually."],
        ETSY_SALES_CHANGED: [502, "Orders changed or the response was incomplete. Nothing was imported. Please retry."],
      };
      const [status, message] = errors[error.message] ?? [502, "Sales import could not be completed. Your figures have been kept. Retry or enter sales manually."];
      return res.status(status).json({ error: errors[error.message] ? error.message : "ETSY_SALES_IMPORT_FAILED", message });
    }
  });

  // *Read the authenticated Etsy user*

  router.get("/me", async (req, res) => {
    try {
      const connection = await requireOwnedConnection(req);

      const user = await getAuthenticatedUser({
        connectionId: connection.connectionId,

        clientId: process.env.ETSY_CLIENT_ID,

        keystring: process.env.ETSY_CLIENT_ID,

        sharedSecret: process.env.ETSY_SHARED_SECRET,
      });

      return res.json({
        connected: true,
        user,
        ...(pilotAccess ? { pilot: await pilotAccess.describe(connection, req, res) } : {}),
      });
    } catch (error) {
      if (handleOwnershipError(error, res)) return;

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
          providerStatus: Number.isInteger(error.status) ? error.status : null,
        });
      }

      console.error(error);

      return res.status(500).json({
        error: "ETSY_USER_READ_FAILED",
        message: "Lighthouse could not read the authenticated Etsy user.",
      });
    }
  });

  // *Read the connected Etsy user profile by stored Etsy user ID*

  router.get("/user", ...(pilotAccess ? [pilotAccess.requireAccess] : []), async (req, res) => {
    try {
      const connection = await requireOwnedConnection(req);

      const user = await getUser({
        connectionId: connection.connectionId,

        etsyUserId: connection.etsyUserId,

        clientId: process.env.ETSY_CLIENT_ID,

        keystring: process.env.ETSY_CLIENT_ID,

        sharedSecret: process.env.ETSY_SHARED_SECRET,
      });

      return res.json({
        connected: true,
        user,
      });
    } catch (error) {
      if (handleOwnershipError(error, res)) return;
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
          providerStatus: Number.isInteger(error.status) ? error.status : null,
        });
      }

      console.error(error);

      return res.status(500).json({
        error: "ETSY_USER_PROFILE_READ_FAILED",
        message: "Lighthouse could not read the Etsy user profile.",
      });
    }
  });

  return router;
}

export default createEtsyReadRouter();
