import express from "express";
import "dotenv/config";

import analysisRoutes from "./src/routes/analysisRoutes.js";
import shopRoutes from "./src/routes/shopRoutes.js";
import etsyAuthRoutes from "./src/routes/etsyAuthRoutes.js";
import { createEtsyReadRouter } from "./src/routes/etsyReadRoutes.js";
import { createPilotAccess, isPrivatePilot, pilotUserIds } from "./src/pilot/pilotAccess.js";
import { createPilotReviewStore } from "./src/pilot/pilotReviewStore.js";
import { createEtsyTokenCipher } from "./src/integrations/etsy/auth/etsyTokenCipher.js";
import { createPilotRouter } from "./src/routes/pilotRoutes.js";
import { publicLegalConfig } from "./shared/pilotTerms.js";
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

let pilotStore;
if (isPrivatePilot()) {
  try {
    pilotUserIds();
    if (!etsyStorage.pool || !process.env.OPENAI_API_KEY?.trim() ||
        process.env.LIGHTHOUSE_ETSY_REVIEW_APPROVED !== "true" ||
        !publicLegalConfig(process.env).supportEmail) throw new Error();
    const candidate = createPilotReviewStore({ pool: etsyStorage.pool,
      cipher: createEtsyTokenCipher(process.env.ETSY_TOKEN_ENCRYPTION_KEY) });
    await candidate.check();
    pilotStore = candidate;
  } catch {
    console.error("Private pilot is not ready; private functionality is blocked.");
  }
}
const pilotAccess = createPilotAccess({ ready: () => Boolean(pilotStore),
  hasConsent: id => pilotStore.hasConsent(id) });
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.get("/api/legal", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(publicLegalConfig(process.env));
});

// Health check

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "lighthouse-agent",
  });
});

// Opportunity analysis workflow

// Legacy opportunity AI has different cost controls. It is unavailable during
// the bounded seller pilot, even when USE_REAL_EXECUTION_AI is accidentally on.
app.use("/api/analysis", (_req, res, next) => {
  if (isPrivatePilot()) return res.status(403).json({ error: "PILOT_SHOP_WORKFLOW_ONLY", message: "Use the private listing review in Weekly Growth Plan during this pilot." });
  return next();
}, analysisRoutes);

// Etsy shop planning and execution workflow

app.use("/api/shop", pilotAccess.requireAccess, shopRoutes);

// *Etsy OAuth workflow*

app.use("/api/etsy", requireEtsyConnectionStorage(etsyStorage));

app.use("/api/etsy/auth", etsyAuthRoutes);

// *Etsy read workflow*

app.use("/api/etsy", createEtsyReadRouter({ pilotAccess }));
app.use("/api/etsy/pilot", createPilotRouter({ store: pilotStore, access: pilotAccess }));

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
