import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { ServerConfig } from './config.js';
import { AppError } from './errors.js';

export const REQUIRED_GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
] as const;

type Fetch = typeof fetch;

export function buildGoogleAuthorizationUrl(config: ServerConfig, input: { state: string; challenge: string; nonce: string }) {
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleOAuthRedirectUri,
    response_type: 'code',
    scope: REQUIRED_GOOGLE_SCOPES.join(' '),
    include_granted_scopes: 'false',
    prompt: 'select_account',
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
  if (typeof body.id_token !== 'string' || typeof body.scope !== 'string') {
    throw new AppError('invalid_google_identity', 401, 'Google-Identität konnte nicht verifiziert werden.');
  }
  return { idToken: body.id_token, scopes: body.scope.split(' ').filter(Boolean) };
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
