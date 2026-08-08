BEGIN;

CREATE TABLE IF NOT EXISTS google_connections (
  google_sub TEXT PRIMARY KEY,
  verified_email TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  granted_scopes TEXT[] NOT NULL,
  spreadsheet_id TEXT,
  spreadsheet_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  token_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  spreadsheet_updated_at TIMESTAMPTZ,
  CONSTRAINT spreadsheet_selection_complete CHECK (
    (spreadsheet_id IS NULL AND spreadsheet_name IS NULL)
    OR (spreadsheet_id IS NOT NULL AND spreadsheet_name IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS google_connections_verified_email_idx
  ON google_connections (LOWER(verified_email));

COMMIT;
