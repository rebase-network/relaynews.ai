BEGIN;

UPDATE models
SET
  name = key,
  updated_at = now()
WHERE name <> key;

COMMIT;
