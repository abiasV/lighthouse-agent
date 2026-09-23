CREATE TABLE IF NOT EXISTS lighthouse_pilot_consents (
  etsy_user_id TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (etsy_user_id, terms_version)
);
