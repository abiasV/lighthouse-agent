import { Pool } from "pg";
import { createEtsyTokenCipher } from "./etsyTokenCipher.js";
import { createPostgresEtsyConnectionRepository } from "./postgresEtsyConnectionRepository.js";
import { createMemoryEtsyConnectionRepository } from "./memoryEtsyConnectionRepository.js";
import { setEtsyConnectionRepository } from "./etsyConnectionStore.js";

export function buildEtsyDatabaseConfig(env) {
  let url;
  try { url = new URL(env.ETSY_DATABASE_URL); } catch {
    throw new Error("ETSY_DATABASE_URL_INVALID");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("ETSY_DATABASE_URL_INVALID");
  }
  // URL SSL flags can override node-postgres's explicit TLS settings.
  if ([...url.searchParams.keys()].some(key => key.toLowerCase().startsWith("ssl"))) {
    throw new Error("ETSY_DATABASE_SSL_URL_OPTIONS_NOT_ALLOWED");
  }
  const sslMode = env.ETSY_DATABASE_SSL ?? "verify";
  if (!["verify", "disable"].includes(sslMode)) {
    throw new Error("ETSY_DATABASE_SSL_INVALID");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (sslMode === "disable" && (!loopback || env.NODE_ENV === "production" || env.RENDER)) {
    throw new Error("ETSY_DATABASE_TLS_REQUIRED");
  }
  return {
    connectionString: url.toString(),
    ssl: sslMode === "disable" ? false : {
      rejectUnauthorized: true,
      ...(env.ETSY_DATABASE_CA ? { ca: env.ETSY_DATABASE_CA } : {}),
    },
    max: 5,
    connectionTimeoutMillis: 5000,
    query_timeout: 20000,
    statement_timeout: 20000,
  };
}

export async function configureEtsyConnectionStorage({
  env = process.env,
  createPool = config => new Pool(config),
} = {}) {
  const mode = env.ETSY_CONNECTION_STORAGE ?? "disabled";
  if (mode === "disabled") {
    return { enabled: false, ready: false, mode, close: async () => {} };
  }
  if (mode === "memory") {
    if (env.NODE_ENV === "production" || env.RENDER) {
      throw new Error("ETSY_MEMORY_STORAGE_NOT_ALLOWED");
    }
    setEtsyConnectionRepository(createMemoryEtsyConnectionRepository());
    return { enabled: true, ready: true, mode, close: async () => {} };
  }
  if (mode !== "postgres") throw new Error("ETSY_CONNECTION_STORAGE_INVALID");
  const cipher = createEtsyTokenCipher(env.ETSY_TOKEN_ENCRYPTION_KEY);
  const pool = createPool(buildEtsyDatabaseConfig(env));
  // pg emits errors for idle connections too; do not log connection credentials.
  pool.on("error", () => console.error("ETSY_DATABASE_POOL_ERROR"));
  try {
    // Explicit migration first. Check existing key compatibility before serving.
    const { rows } = await pool.query(
      "SELECT connection_id, owner_session_hash, payload FROM etsy_connections LIMIT 1",
    );
    if (rows.length) cipher.decrypt(rows[0].connection_id, rows[0].payload);
    setEtsyConnectionRepository(createPostgresEtsyConnectionRepository({ pool, cipher }));
    return { enabled: true, ready: true, mode, close: () => pool.end() };
  } catch {
    await pool.end();
    throw new Error("ETSY_STORAGE_INITIALIZATION_FAILED");
  }
}

export function requireEtsyConnectionStorage(storage) {
  return (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!storage.enabled) {
      return res.status(503).json({
        error: storage.ready
          ? "ETSY_ACCOUNT_ACCESS_NOT_READY"
          : "ETSY_CONNECTION_STORAGE_NOT_CONFIGURED",
        message: "Etsy connection is not available yet. Use sample data or enter your shop data manually.",
      });
    }
    return next();
  };
}
