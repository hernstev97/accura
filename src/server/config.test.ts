import { describe, expect, it } from 'vitest';
import { getServerConfig } from '../../api/_lib/config';

const env = (): NodeJS.ProcessEnv => ({
  APP_ORIGIN: 'http://localhost:3000',
  GOOGLE_CLIENT_ID: 'client',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_API_KEY: 'key',
  GOOGLE_CLOUD_PROJECT_NUMBER: '123456',
  GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
  ALLOWED_GOOGLE_EMAIL: 'owner@example.test',
  DATABASE_URL: 'postgres://database',
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
  SESSION_SECRET: 'a-session-secret-longer-than-thirty-two-bytes',
  NODE_ENV: 'development',
});

describe('server environment contract', () => {
  it('accepts a consistent localhost server configuration', () => {
    expect(getServerConfig(env())).toMatchObject({ appOrigin: 'http://localhost:3000', production: false, googleCloudProjectNumber: '123456' });
  });

  it('rejects mismatched callbacks, short session secrets, and non-HTTPS production origins', () => {
    expect(() => getServerConfig({ ...env(), GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:4000/api/auth/google/callback' })).toThrow(/inconsistent/);
    expect(() => getServerConfig({ ...env(), SESSION_SECRET: 'short' })).toThrow(/32 bytes/);
    expect(() => getServerConfig({ ...env(), NODE_ENV: 'production' })).toThrow(/HTTPS/);
  });
});
