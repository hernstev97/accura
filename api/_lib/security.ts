import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { isAppPath, type AppPath } from '../../src/navigation/appNavigation.js';
import { AppError } from './errors.js';

export const SESSION_COOKIE = 'finance_session';
export const OAUTH_COOKIE = 'finance_oauth';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const OAUTH_TTL_SECONDS = 10 * 60;

const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');
const fromBase64url = (value: string) => Buffer.from(value, 'base64url');

const sessionSchema = z.object({
  type: z.literal('session'),
  sub: z.string().min(1),
  email: z.string().email(),
  csrf: z.string().min(20),
  iat: z.number().int(),
  exp: z.number().int(),
});

const oauthSchema = z.object({
  type: z.literal('oauth'),
  state: z.string().min(20),
  verifier: z.string().min(43),
  nonce: z.string().min(20),
  returnPath: z.custom<AppPath>(isAppPath).default('/'),
  iat: z.number().int(),
  exp: z.number().int(),
});

export type AppSession = z.infer<typeof sessionSchema>;
export type OAuthTransaction = z.infer<typeof oauthSchema>;

const sign = (encodedPayload: string, secret: string) => base64url(createHmac('sha256', secret).update(encodedPayload).digest());

function signedToken(payload: object, secret: string) {
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

function verifySignedToken(value: string, secret: string): unknown {
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) throw new AppError('invalid_session', 401, 'Ungültige Sitzung.');
  const expected = sign(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new AppError('invalid_session', 401, 'Ungültige Sitzung.');
  }
  try {
    return JSON.parse(fromBase64url(payload).toString('utf8'));
  } catch {
    throw new AppError('invalid_session', 401, 'Ungültige Sitzung.');
  }
}

export function createSession(sub: string, email: string, secret: string, now = Date.now()): { token: string; session: AppSession } {
  const iat = Math.floor(now / 1000);
  const session: AppSession = {
    type: 'session',
    sub,
    email: email.toLowerCase(),
    csrf: randomBytes(24).toString('base64url'),
    iat,
    exp: iat + SESSION_TTL_SECONDS,
  };
  return { token: signedToken(session, secret), session };
}

export function verifySession(token: string, secret: string, now = Date.now()): AppSession {
  const parsed = sessionSchema.safeParse(verifySignedToken(token, secret));
  if (!parsed.success || parsed.data.exp <= Math.floor(now / 1000)) {
    throw new AppError('invalid_session', 401, 'Sitzung ist abgelaufen oder ungültig.');
  }
  return parsed.data;
}

/** Returns a stable pseudonymous browser-cache partition without exposing the Google subject. */
export function financeCacheOwnerKey(sub: string, secret: string): string {
  return createHmac('sha256', secret)
    .update('accura-finance-cache-owner-v1\0')
    .update(sub)
    .digest('base64url');
}

export function createOAuthTransaction(
  secret: string,
  returnPath: AppPath = '/',
  now = Date.now(),
): { token: string; transaction: OAuthTransaction; challenge: string } {
  const iat = Math.floor(now / 1000);
  const verifier = randomBytes(48).toString('base64url');
  const transaction: OAuthTransaction = {
    type: 'oauth',
    state: randomBytes(32).toString('base64url'),
    verifier,
    nonce: randomBytes(32).toString('base64url'),
    returnPath,
    iat,
    exp: iat + OAUTH_TTL_SECONDS,
  };
  return {
    token: signedToken(transaction, secret),
    transaction,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  };
}

export function verifyOAuthTransaction(token: string, returnedState: string, secret: string, now = Date.now()): OAuthTransaction {
  const parsed = oauthSchema.safeParse(verifySignedToken(token, secret));
  if (!parsed.success || parsed.data.exp <= Math.floor(now / 1000)) {
    throw new AppError('invalid_oauth_state', 400, 'OAuth-Anfrage ist abgelaufen oder ungültig.');
  }
  const expected = Buffer.from(parsed.data.state);
  const actual = Buffer.from(returnedState);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new AppError('invalid_oauth_state', 400, 'OAuth-state stimmt nicht überein.');
  }
  return parsed.data;
}

export const parseCookies = (header: string | undefined): Record<string, string> => Object.fromEntries(
  (header ?? '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }),
);

export function serializeCookie(name: string, value: string, options: { maxAge?: number; production: boolean }) {
  const attributes = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (options.production) attributes.push('Secure');
  if (options.maxAge !== undefined) attributes.push(`Max-Age=${options.maxAge}`);
  return attributes.join('; ');
}

export const clearCookie = (name: string, production: boolean) => serializeCookie(name, '', { maxAge: 0, production });
export const sessionCookie = (token: string, production: boolean) => serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS, production });
export const oauthCookie = (token: string, production: boolean) => serializeCookie(OAUTH_COOKIE, token, { maxAge: OAUTH_TTL_SECONDS, production });

export function isAllowedGoogleUser(email: string, emailVerified: boolean, allowedEmail: string) {
  return emailVerified && email.trim().toLowerCase() === allowedEmail.trim().toLowerCase();
}

export function assertCsrf(session: AppSession, csrfHeader: string | undefined, originHeader: string | undefined, appOrigin: string) {
  if (originHeader !== appOrigin) throw new AppError('csrf_failed', 403, 'Ungültiger Anfrageursprung.');
  if (!csrfHeader) throw new AppError('csrf_failed', 403, 'CSRF-Token fehlt.');
  const expected = Buffer.from(session.csrf);
  const actual = Buffer.from(csrfHeader);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new AppError('csrf_failed', 403, 'CSRF-Prüfung fehlgeschlagen.');
  }
}

