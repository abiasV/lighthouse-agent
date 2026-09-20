-- Existing unowned records remain inaccessible and require Etsy reconnection.
ALTER TABLE etsy_connections ADD COLUMN IF NOT EXISTS owner_session_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS etsy_connections_owner_session_hash_key
  ON etsy_connections (owner_session_hash);
