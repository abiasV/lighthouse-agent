CREATE TABLE IF NOT EXISTS etsy_connections (
  connection_id TEXT PRIMARY KEY,
  owner_session_hash TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL
);
