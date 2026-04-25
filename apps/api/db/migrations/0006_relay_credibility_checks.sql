CREATE TABLE relay_credibility_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relay_id uuid NOT NULL REFERENCES relays(id) ON DELETE CASCADE,
  model_id uuid REFERENCES models(id) ON DELETE SET NULL,
  probe_region text NOT NULL DEFAULT 'global',
  compatibility_mode text NOT NULL,
  requested_model text NOT NULL,
  used_url text,
  response_reported_model text,
  response_reported_version text,
  self_reported_provider text,
  self_reported_model text,
  self_reported_version text,
  identity_confidence text NOT NULL CHECK (
    identity_confidence IN ('high', 'medium', 'low', 'unknown')
  ),
  identity_probe_ok boolean NOT NULL DEFAULT false,
  message text,
  measured_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX relay_credibility_checks_relay_idx
  ON relay_credibility_checks (relay_id, measured_at DESC);

CREATE INDEX relay_credibility_checks_model_idx
  ON relay_credibility_checks (model_id, measured_at DESC);
