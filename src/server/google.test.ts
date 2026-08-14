import { describe, expect, it, vi } from 'vitest';
import type { ServerConfig } from '../../api/_lib/config';
import {
  buildGoogleAuthorizationUrl,
  exchangeAuthorizationCode,
  REQUIRED_GOOGLE_SCOPES,
} from '../../api/_lib/google';

export const testServerConfig: ServerConfig = {
  appOrigin: 'http://localhost:3000',
  googleClientId: 'client-id.apps.googleusercontent.com',
  googleClientSecret: 'server-secret',
  googleOAuthRedirectUri: 'http://localhost:3000/api/auth/google/callback',
  allowedGoogleEmail: 'owner@example.test',
  databaseUrl: 'postgres://unused',
  sessionSecret: 'test-session-secret-with-at-least-32-bytes',
  production: false,
};

describe('Google identity adapters', () => {
  it('requests only identity scopes with state, nonce, and PKCE', () => {
    const url = new URL(buildGoogleAuthorizationUrl(testServerConfig, { state: 'state', challenge: 'challenge', nonce: 'nonce' }));
    expect(url.searchParams.get('scope')?.split(' ')).toEqual(REQUIRED_GOOGLE_SCOPES);
    expect(url.searchParams.get('access_type')).toBeNull();
    expect(url.searchParams.get('prompt')).toBe('select_account');
    expect(url.searchParams.get('state')).toBe('state');
    expect(url.searchParams.get('nonce')).toBe('nonce');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('accepts an identity token exchange without a refresh token', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      id_token: 'identity-token',
      scope: 'openid email profile',
    })));
    await expect(exchangeAuthorizationCode(testServerConfig, 'code', 'verifier', fetchMock)).resolves.toEqual({
      idToken: 'identity-token',
      scopes: ['openid', 'email', 'profile'],
    });
  });
});
