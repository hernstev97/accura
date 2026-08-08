import { createRemoteJWKSet, jwtVerify } from 'jose';
import { GOOGLE_SHEETS_RANGES } from '../../src/finance/schema';
import type { RawSheetsBatchResponse } from '../../src/finance/types';
import type { ServerConfig } from './config';
import { AppError, ReconnectRequiredError } from './errors';

export const REQUIRED_GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
] as const;

type Fetch = typeof fetch;

export function buildGoogleAuthorizationUrl(config: ServerConfig, input: { state: string; challenge: string; nonce: string }) {
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleOAuthRedirectUri,
    response_type: 'code',
    scope: REQUIRED_GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'false',
    prompt: 'consent select_account',
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.challenge,
    code_challenge_method: 'S256',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeAuthorizationCode(config: ServerConfig, code: string, verifier: string, fetchImpl: Fetch = fetch) {
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleOAuthRedirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new AppError('oauth_exchange_failed', 401, 'Google-Anmeldung konnte nicht abgeschlossen werden.');
  const body = await response.json() as Record<string, unknown>;
  if (typeof body.refresh_token !== 'string' || typeof body.id_token !== 'string' || typeof body.scope !== 'string') {
    throw new AppError('refresh_token_missing', 401, 'Google hat kein Offline-Zugriffstoken ausgestellt. Bitte erneut verbinden.');
  }
  return { refreshToken: body.refresh_token, idToken: body.id_token, scopes: body.scope.split(' ').filter(Boolean) };
}

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function verifyGoogleIdentity(idToken: string, clientId: string, nonce: string) {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    audience: clientId,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
  });
  if (payload.nonce !== nonce || typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new AppError('invalid_google_identity', 401, 'Google-Identität konnte nicht verifiziert werden.');
  }
  return { sub: payload.sub, email: payload.email, emailVerified: payload.email_verified === true };
}

export async function refreshGoogleAccessToken(config: ServerConfig, refreshToken: string, fetchImpl: Fetch = fetch) {
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    if (body.error === 'invalid_grant') throw new ReconnectRequiredError();
    throw new AppError('google_token_error', 502, 'Google-Zugriff konnte nicht erneuert werden.');
  }
  if (typeof body.access_token !== 'string') throw new AppError('google_token_error', 502, 'Google hat kein Zugriffstoken geliefert.');
  return { accessToken: body.access_token, expiresIn: typeof body.expires_in === 'number' ? body.expires_in : 3600 };
}

export async function revokeGoogleToken(refreshToken: string, fetchImpl: Fetch = fetch) {
  try {
    await fetchImpl('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
    });
  } catch {
    // Revocation is best-effort; local deletion must still complete.
  }
}

export type GoogleDriveFile = { id: string; name: string; mimeType: string; trashed?: boolean };

export async function validateGoogleSpreadsheet(accessToken: string, fileId: string, fetchImpl: Fetch = fetch): Promise<GoogleDriveFile> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('fields', 'id,name,mimeType,trashed');
  url.searchParams.set('supportsAllDrives', 'true');
  const response = await fetchImpl(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new AppError('spreadsheet_inaccessible', 400, 'Die ausgewählte Tabelle ist nicht zugänglich.');
  const file = await response.json() as GoogleDriveFile;
  if (file.trashed || file.mimeType !== 'application/vnd.google-apps.spreadsheet') {
    throw new AppError('invalid_spreadsheet_type', 400, 'Bitte eine aktive Google-Sheets-Tabelle auswählen.');
  }
  return file;
}

export async function readGoogleFinanceWorkbook(accessToken: string, spreadsheetId: string, fetchImpl: Fetch = fetch): Promise<RawSheetsBatchResponse> {
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`);
  GOOGLE_SHEETS_RANGES.forEach((range) => url.searchParams.append('ranges', range));
  url.searchParams.set('majorDimension', 'ROWS');
  url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE');
  url.searchParams.set('dateTimeRenderOption', 'FORMATTED_STRING');
  url.searchParams.set('fields', 'valueRanges(range,values)');
  const response = await fetchImpl(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (response.status === 401) throw new ReconnectRequiredError();
  if (!response.ok) throw new AppError('sheets_read_failed', 502, 'Google Sheets konnte nicht gelesen werden.');
  return response.json() as Promise<RawSheetsBatchResponse>;
}
