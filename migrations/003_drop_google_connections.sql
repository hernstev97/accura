BEGIN;

-- Deploy only after the identity-only runtime is active. This irreversible drop intentionally removes stored Google refresh tokens.
DROP TABLE IF EXISTS google_connections;

COMMIT;
