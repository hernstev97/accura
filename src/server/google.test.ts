import { describe, expect, it, vi } from 'vitest';
import { anonymousSheetsResponse } from '../mocks/anonymousWorkbook';
import type { ServerConfig } from '../../api/_lib/config';
import { ReconnectRequiredError } from '../../api/_lib/errors';
import {
  buildGoogleAuthorizationUrl,
  readGoogleFinanceWorkbook,
  refreshGoogleAccessToken,
  REQUIRED_GOOGLE_SCOPES,
  validateGoogleSpreadsheet,
} from '../../api/_lib/google';

export const testServerConfig: ServerConfig = {
  appOrigin: 'http://localhost:3000',
  googleClientId: 'client-id.apps.googleusercontent.com',
  googleClientSecret: 'server-secret',
  googleApiKey: 'picker-public-api-key',
  googleCloudProjectNumber: '1234567890',
  googleOAuthRedirectUri: 'http://localhost:3000/api/auth/google/callback',
  allowedGoogleEmail: 'owner@example.test',
  databaseUrl: 'postgres://unused',
  tokenEncryptionKey: Buffer.alloc(32, 9).toString('base64'),
  sessionSecret: 'test-session-secret-with-at-least-32-bytes',
  production: false,
};

describe('Google OAuth and API adapters', () => {
  it('requests only the required scopes with offline access, state, nonce, and PKCE', () => {
    const url = new URL(buildGoogleAuthorizationUrl(testServerConfig, { state: 'state', challenge: 'challenge', nonce: 'nonce' }));
    expect(url.searchParams.get('scope')?.split(' ')).toEqual(REQUIRED_GOOGLE_SCOPES);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toContain('consent');
    expect(url.searchParams.get('state')).toBe('state');
    expect(url.searchParams.get('nonce')).toBe('nonce');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('maps an invalid or revoked refresh token to reconnect_required', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
    await expect(refreshGoogleAccessToken(testServerConfig, 'revoked-token', fetchMock)).rejects.toBeInstanceOf(ReconnectRequiredError);
  });

  it('validates selected Drive file MIME type and accessibility', async () => {
    const validFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      id: 'sheet-file-id', name: 'Finanzdaten', mimeType: 'application/vnd.google-apps.spreadsheet', trashed: false,
    })));
    await expect(validateGoogleSpreadsheet('access', 'sheet-file-id', validFetch)).resolves.toEqual(expect.objectContaining({ name: 'Finanzdaten' }));

    const invalidFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      id: 'document-id', name: 'Dokument', mimeType: 'application/vnd.google-apps.document', trashed: false,
    })));
    await expect(validateGoogleSpreadsheet('access', 'document-id', invalidFetch)).rejects.toMatchObject({ code: 'invalid_spreadsheet_type' });
  });

  it('reads all machine tabs through one Sheets batchGet using unformatted values', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(anonymousSheetsResponse)));
    await expect(readGoogleFinanceWorkbook('access', 'spreadsheet-id', fetchMock)).resolves.toEqual(anonymousSheetsResponse);
    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requested.pathname).toContain('/values:batchGet');
    expect(requested.searchParams.getAll('ranges')).toHaveLength(10);
    expect(requested.searchParams.get('valueRenderOption')).toBe('UNFORMATTED_VALUE');
  });

  it('returns structured Sheets failures without response data or credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(readGoogleFinanceWorkbook('access', 'spreadsheet-id', fetchMock)).rejects.toMatchObject({ code: 'sheets_read_failed', status: 502 });
  });
});
