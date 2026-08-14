import type postgres from 'postgres';
import { getDatabase } from './database.js';

export type GoogleConnection = {
  googleSub: string;
  email: string;
  encryptedRefreshToken: string;
  scopes: string[];
  spreadsheetId: string | null;
  spreadsheetName: string | null;
  createdAt: Date;
  updatedAt: Date;
  tokenUpdatedAt: Date;
  spreadsheetUpdatedAt: Date | null;
};

export interface ConnectionRepository {
  get(googleSub: string): Promise<GoogleConnection | null>;
  upsertAuthorization(input: { googleSub: string; email: string; encryptedRefreshToken: string; scopes: string[] }): Promise<GoogleConnection>;
  saveSpreadsheet(googleSub: string, spreadsheetId: string, spreadsheetName: string): Promise<void>;
  delete(googleSub: string): Promise<void>;
}

type ConnectionRow = {
  google_sub: string;
  verified_email: string;
  encrypted_refresh_token: string;
  granted_scopes: string[];
  spreadsheet_id: string | null;
  spreadsheet_name: string | null;
  created_at: Date;
  updated_at: Date;
  token_updated_at: Date;
  spreadsheet_updated_at: Date | null;
};

const mapRow = (row: ConnectionRow): GoogleConnection => ({
  googleSub: row.google_sub,
  email: row.verified_email,
  encryptedRefreshToken: row.encrypted_refresh_token,
  scopes: row.granted_scopes,
  spreadsheetId: row.spreadsheet_id,
  spreadsheetName: row.spreadsheet_name,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
  tokenUpdatedAt: new Date(row.token_updated_at),
  spreadsheetUpdatedAt: row.spreadsheet_updated_at ? new Date(row.spreadsheet_updated_at) : null,
});

export class PostgresConnectionRepository implements ConnectionRepository {
  constructor(private readonly sql: postgres.Sql) {}

  async get(googleSub: string) {
    const rows = await this.sql<ConnectionRow[]>`
      SELECT google_sub, verified_email, encrypted_refresh_token, granted_scopes,
             spreadsheet_id, spreadsheet_name, created_at, updated_at,
             token_updated_at, spreadsheet_updated_at
      FROM google_connections
      WHERE google_sub = ${googleSub}
      LIMIT 1
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async upsertAuthorization(input: { googleSub: string; email: string; encryptedRefreshToken: string; scopes: string[] }) {
    const rows = await this.sql<ConnectionRow[]>`
      INSERT INTO google_connections (
        google_sub, verified_email, encrypted_refresh_token, granted_scopes, token_updated_at
      ) VALUES (
        ${input.googleSub}, ${input.email.toLowerCase()}, ${input.encryptedRefreshToken}, ${input.scopes}, NOW()
      )
      ON CONFLICT (google_sub) DO UPDATE SET
        verified_email = EXCLUDED.verified_email,
        encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
        granted_scopes = EXCLUDED.granted_scopes,
        token_updated_at = NOW(),
        updated_at = NOW()
      RETURNING google_sub, verified_email, encrypted_refresh_token, granted_scopes,
                spreadsheet_id, spreadsheet_name, created_at, updated_at,
                token_updated_at, spreadsheet_updated_at
    `;
    return mapRow(rows[0]!);
  }

  async saveSpreadsheet(googleSub: string, spreadsheetId: string, spreadsheetName: string) {
    await this.sql`
      UPDATE google_connections
      SET spreadsheet_id = ${spreadsheetId}, spreadsheet_name = ${spreadsheetName},
          spreadsheet_updated_at = NOW(), updated_at = NOW()
      WHERE google_sub = ${googleSub}
    `;
  }

  async delete(googleSub: string) {
    await this.sql`DELETE FROM google_connections WHERE google_sub = ${googleSub}`;
  }
}

const repositories = new Map<string, ConnectionRepository>();

export function getConnectionRepository(databaseUrl: string): ConnectionRepository {
  const existing = repositories.get(databaseUrl);
  if (existing) return existing;

  const repository = new PostgresConnectionRepository(getDatabase(databaseUrl));
  repositories.set(databaseUrl, repository);
  return repository;
}
