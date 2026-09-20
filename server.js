import express from "express";
import "dotenv/config";

import analysisRoutes from "./src/routes/analysisRoutes.js";
import shopRoutes from "./src/routes/shopRoutes.js";
import etsyAuthRoutes from "./src/routes/etsyAuthRoutes.js";
import etsyReadRoutes from "./src/routes/etsyReadRoutes.js";
import {
  configureEtsyConnectionStorage,
  requireEtsyConnectionStorage,
} from "./src/integrations/etsy/auth/configureEtsyConnectionStorage.js";

let etsyStorage;
try {
  etsyStorage = await configureEtsyConnectionStorage();
} catch {
  // Never fall back to ephemeral/plaintext storage when persistent setup fails.
  console.error("Etsy storage could not initialize; real Etsy routes are disabled.");
  etsyStorage = { enabled: false, close: async () => {} };
}

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "lighthouse-agent",
  });
});

// Opportunity analysis workflow

app.use("/api/analysis", analysisRoutes);

// Etsy shop planning and execution workflow

app.use("/api/shop", shopRoutes);

// *Etsy OAuth workflow*

app.use("/api/etsy", requireEtsyConnectionStorage(etsyStorage));

app.use("/api/etsy/auth", etsyAuthRoutes);

// *Etsy read workflow*

app.use("/api/etsy", etsyReadRoutes);

const server = app.listen(PORT, () => {
  console.log(`Lighthouse API server is running on port ${PORT}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    server.close(async () => {
      await etsyStorage.close();
      process.exit(0);
    });
  });
}
