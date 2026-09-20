import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { buildEtsyDatabaseConfig } from "../src/integrations/etsy/auth/configureEtsyConnectionStorage.js";

let pool;
try {
  pool = new Pool(buildEtsyDatabaseConfig(process.env));
  pool.on("error", () => console.error("ETSY_DATABASE_POOL_ERROR"));
  // One checked-out client keeps all migrations in the same transaction.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const file of ["001_etsy_connections.sql", "002_etsy_connection_owners.sql"]) {
      const sql = await readFile(new URL("../migrations/" + file, import.meta.url), "utf8");
      await client.query(sql);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  console.log("Etsy connection storage schema is ready.");
} catch {
  console.error("Etsy storage migration failed. Check the database URL, verified TLS, and database permissions.");
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
