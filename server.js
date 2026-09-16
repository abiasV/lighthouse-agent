import express from "express";
import "dotenv/config";

import analysisRoutes from "./src/routes/analysisRoutes.js";
import shopRoutes from "./src/routes/shopRoutes.js";
import etsyAuthRoutes from "./src/routes/etsyAuthRoutes.js";
import etsyReadRoutes from "./src/routes/etsyReadRoutes.js";

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

app.use("/api/etsy/auth", etsyAuthRoutes);

// *Etsy read workflow*

app.use("/api/etsy", etsyReadRoutes);

app.listen(PORT, () => {
  console.log(`Lighthouse API server is running on port ${PORT}`);
});