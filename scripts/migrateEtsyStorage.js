import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { buildEtsyDatabaseConfig } from "../src/integrations/etsy/auth/configureEtsyConnectionStorage.js";

let pool;
try {
  pool = new Pool(buildEtsyDatabaseConfig(process.env));
  pool.on("error", () => console.error("ETSY_DATABASE_POOL_ERROR"));
  const sql = await readFile(new URL("../migrations/001_etsy_connections.sql", import.meta.url), "utf8");
  await pool.query(sql);
  console.log("Etsy connection storage schema is ready.");
} catch {
  console.error("Etsy storage migration failed. Check the database URL, verified TLS, and database permissions.");
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
