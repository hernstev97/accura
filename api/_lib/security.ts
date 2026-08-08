import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AppError } from './errors';

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

export function createOAuthTransaction(secret: string, now = Date.now()): { token: string; transaction: OAuthTransaction; challenge: string } {
  const iat = Math.floor(now / 1000);
  const verifier = randomBytes(48).toString('base64url');
  const transaction: OAuthTransaction = {
    type: 'oauth',
    state: randomBytes(32).toString('base64url'),
    verifier,
    nonce: randomBytes(32).toString('base64url'),
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

function encryptionKey(key: string) {
  const decoded = Buffer.from(key, 'base64');
  if (decoded.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return decoded;
}

export function encryptRefreshToken(token: string, key: string, googleSub: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv);
  cipher.setAAD(Buffer.from(`finance-google-token:${googleSub}`, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${encrypted.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
}

export function decryptRefreshToken(value: string, key: string, googleSub: string) {
  const [version, iv, encrypted, tag, extra] = value.split('.');
  if (version !== 'v1' || !iv || !encrypted || !tag || extra) throw new Error('Unsupported encrypted token format.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(`finance-google-token:${googleSub}`, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}
