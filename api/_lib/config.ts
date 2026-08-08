import { z } from 'zod';

const urlSchema = z.string().url();

export type ServerConfig = {
  appOrigin: string;
  googleClientId: string;
  googleClientSecret: string;
  googleApiKey: string;
  googleCloudProjectNumber: string;
  googleOAuthRedirectUri: string;
  allowedGoogleEmail: string;
  databaseUrl: string;
  tokenEncryptionKey: string;
  sessionSecret: string;
  production: boolean;
};

const required = (name: string, env: NodeJS.ProcessEnv) => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
};

export function getServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const appOrigin = required('APP_ORIGIN', env).replace(/\/$/, '');
  const redirectUri = required('GOOGLE_OAUTH_REDIRECT_URI', env);
  if (!urlSchema.safeParse(appOrigin).success || !urlSchema.safeParse(redirectUri).success) {
    throw new Error('APP_ORIGIN and GOOGLE_OAUTH_REDIRECT_URI must be absolute URLs.');
  }
  const appUrl = new URL(appOrigin);
  const redirectUrl = new URL(redirectUri);
  if (appUrl.origin !== appOrigin || redirectUrl.origin !== appOrigin || redirectUrl.pathname !== '/api/auth/google/callback') {
    throw new Error('OAuth origin/callback configuration is inconsistent.');
  }
  if ((env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production') && appUrl.protocol !== 'https:') {
    throw new Error('Production APP_ORIGIN must use HTTPS.');
  }
  const allowedGoogleEmail = required('ALLOWED_GOOGLE_EMAIL', env).toLowerCase();
  if (!z.string().email().safeParse(allowedGoogleEmail).success) throw new Error('ALLOWED_GOOGLE_EMAIL must be an email address.');
  const projectNumber = required('GOOGLE_CLOUD_PROJECT_NUMBER', env);
  if (!/^\d+$/.test(projectNumber)) throw new Error('GOOGLE_CLOUD_PROJECT_NUMBER must be numeric.');
  const sessionSecret = required('SESSION_SECRET', env);
  if (Buffer.byteLength(sessionSecret, 'utf8') < 32) throw new Error('SESSION_SECRET must contain at least 32 bytes.');
  return {
    appOrigin,
    googleClientId: required('GOOGLE_CLIENT_ID', env),
    googleClientSecret: required('GOOGLE_CLIENT_SECRET', env),
    googleApiKey: required('GOOGLE_API_KEY', env),
    googleCloudProjectNumber: projectNumber,
    googleOAuthRedirectUri: redirectUri,
    allowedGoogleEmail,
    databaseUrl: required('DATABASE_URL', env),
    tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY', env),
    sessionSecret,
    production: env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production',
  };
}
