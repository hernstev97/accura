import { describe, expect, it } from 'vitest';
import { getServerConfig } from '../../api/_lib/config';

const env = (): NodeJS.ProcessEnv => ({
  APP_ORIGIN: 'http://localhost:3000',
  GOOGLE_CLIENT_ID: 'client',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
  ALLOWED_GOOGLE_EMAIL: 'owner@example.test',
  DATABASE_URL: 'postgres://database',
  SESSION_SECRET: 'a-session-secret-longer-than-thirty-two-bytes',
  NODE_ENV: 'development',
});

describe('server environment contract', () => {
  it('accepts a consistent localhost server configuration', () => {
    expect(getServerConfig(env())).toMatchObject({ appOrigin: 'http://localhost:3000', production: false });
  });

  it('strips surrounding quotes from pulled environment values', () => {
    expect(getServerConfig({
      ...env(),
      APP_ORIGIN: '"http://localhost:3000"',
      GOOGLE_OAUTH_REDIRECT_URI: '"http://localhost:3000/api/auth/google/callback"',
      ALLOWED_GOOGLE_EMAIL: '"owner@example.test"',
    })).toMatchObject({ appOrigin: 'http://localhost:3000', allowedGoogleEmail: 'owner@example.test' });
  });

  it('treats localhost vercel-dev as non-production even when Node or Vercel claim production', () => {
    expect(getServerConfig({ ...env(), NODE_ENV: 'production' })).toMatchObject({
      appOrigin: 'http://localhost:3000',
      production: false,
    });
    expect(getServerConfig({ ...env(), NODE_ENV: 'production', VERCEL_ENV: 'development' })).toMatchObject({
      production: false,
    });
    expect(getServerConfig({ ...env(), VERCEL_ENV: 'production' })).toMatchObject({
      production: false,
    });
  });

  it('rejects mismatched callbacks, short session secrets, and non-HTTPS production origins', () => {
    expect(() => getServerConfig({ ...env(), GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:4000/api/auth/google/callback' })).toThrow(/inconsistent/);
    expect(() => getServerConfig({ ...env(), SESSION_SECRET: 'short' })).toThrow(/32 bytes/);
    expect(() => getServerConfig({
      ...env(),
      APP_ORIGIN: 'http://accura.example',
      GOOGLE_OAUTH_REDIRECT_URI: 'http://accura.example/api/auth/google/callback',
      VERCEL_ENV: 'production',
    })).toThrow(/HTTPS/);
  });
});
