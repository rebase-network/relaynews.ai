ALTER TABLE probe_results_raw
  ADD COLUMN IF NOT EXISTS first_token_ms integer
    CHECK (first_token_ms IS NULL OR first_token_ms >= 0);
