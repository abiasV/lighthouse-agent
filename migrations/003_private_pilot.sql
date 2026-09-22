CREATE TABLE IF NOT EXISTS lighthouse_pilot_budget (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  reserved_cad_cents INTEGER NOT NULL DEFAULT 0 CHECK (reserved_cad_cents BETWEEN 0 AND 3000)
);
INSERT INTO lighthouse_pilot_budget (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS lighthouse_pilot_reviews (
  id UUID PRIMARY KEY,
  etsy_user_id TEXT NOT NULL,
  request_key UUID NOT NULL,
  input_hash TEXT NOT NULL,
  reserved_cad_cents INTEGER NOT NULL CHECK (reserved_cad_cents = 100),
  status TEXT NOT NULL CHECK (status IN ('pending', 'complete', 'failed')),
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (etsy_user_id, request_key)
);
CREATE INDEX IF NOT EXISTS lighthouse_pilot_reviews_owner ON lighthouse_pilot_reviews (etsy_user_id, created_at DESC);
