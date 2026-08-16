import { z } from 'zod';
import { AppError } from './errors.js';
import { applyLocalEnvFiles } from './localEnv.js';

const urlSchema = z.string().url();

export type ServerConfig = {
  appOrigin: string;
  googleClientId: string;
  googleClientSecret: string;
  googleOAuthRedirectUri: string;
  allowedGoogleEmail: string;
  databaseUrl: string;
  sessionSecret: string;
  production: boolean;
};

const required = (name: string, env: NodeJS.ProcessEnv) => {
  let value = env[name]?.trim() ?? '';
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
    || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    value = value.slice(1, -1).trim();
  }
  if (!value) throw new AppError('server_configuration_error', 500, `Missing required server environment variable: ${name}`);
  return value;
};

const isLoopbackHost = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1';

const isProductionRuntime = (env: NodeJS.ProcessEnv, hostname: string) =>
  env.VERCEL_ENV?.trim() === 'production' && !isLoopbackHost(hostname);

export function getServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  if (env === process.env) applyLocalEnvFiles(env);
  const appOrigin = required('APP_ORIGIN', env).replace(/\/$/, '');
  const redirectUri = required('GOOGLE_OAUTH_REDIRECT_URI', env);
  if (!urlSchema.safeParse(appOrigin).success || !urlSchema.safeParse(redirectUri).success) {
    throw new AppError('server_configuration_error', 500, 'APP_ORIGIN and GOOGLE_OAUTH_REDIRECT_URI must be absolute URLs.');
  }
  const appUrl = new URL(appOrigin);
  const redirectUrl = new URL(redirectUri);
  if (appUrl.origin !== appOrigin || redirectUrl.origin !== appOrigin || redirectUrl.pathname !== '/api/auth/google/callback') {
    throw new AppError('server_configuration_error', 500, 'OAuth origin/callback configuration is inconsistent.');
  }
  const production = isProductionRuntime(env, appUrl.hostname);
  if (production && appUrl.protocol !== 'https:') {
    throw new AppError('server_configuration_error', 500, 'Production APP_ORIGIN must use HTTPS.');
  }
  const allowedGoogleEmail = required('ALLOWED_GOOGLE_EMAIL', env).toLowerCase();
  if (!z.string().email().safeParse(allowedGoogleEmail).success) {
    throw new AppError('server_configuration_error', 500, 'ALLOWED_GOOGLE_EMAIL must be an email address.');
  }
  const sessionSecret = required('SESSION_SECRET', env);
  if (Buffer.byteLength(sessionSecret, 'utf8') < 32) {
    throw new AppError('server_configuration_error', 500, 'SESSION_SECRET must contain at least 32 bytes.');
  }
  return {
    appOrigin,
    googleClientId: required('GOOGLE_CLIENT_ID', env),
    googleClientSecret: required('GOOGLE_CLIENT_SECRET', env),
    googleOAuthRedirectUri: redirectUri,
    allowedGoogleEmail,
    databaseUrl: required('DATABASE_URL', env),
    sessionSecret,
    production,
  };
}
