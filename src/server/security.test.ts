import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  assertCsrf,
  createOAuthTransaction,
  createSession,
  financeCacheOwnerKey,
  isAllowedGoogleUser,
  verifyOAuthTransaction,
  verifySession,
  sessionCookie,
} from '../../api/_lib/security';

const sessionSecret = 'test-session-secret-with-at-least-32-bytes';

describe('server security primitives', () => {
  it('accepts only the verified allowlisted Google email case-insensitively', () => {
    expect(isAllowedGoogleUser('OWNER@example.test', true, 'owner@example.test')).toBe(true);
    expect(isAllowedGoogleUser('owner@example.test', false, 'owner@example.test')).toBe(false);
    expect(isAllowedGoogleUser('other@example.test', true, 'owner@example.test')).toBe(false);
  });

  it('signs sessions and rejects tampering or expiry', () => {
    const now = Date.UTC(2026, 7, 8);
    const { token, session } = createSession('immutable-sub', 'owner@example.test', sessionSecret, now);
    expect(verifySession(token, sessionSecret, now + 1_000).sub).toBe('immutable-sub');
    expect(() => verifySession(`${token}x`, sessionSecret, now)).toThrow();
    expect(() => verifySession(token, sessionSecret, now + 15 * 24 * 60 * 60 * 1000)).toThrow();
    expect(session.csrf.length).toBeGreaterThan(20);
  });

  it('partitions browser finance caches with a pseudonymous owner key', () => {
    const first = financeCacheOwnerKey('immutable-sub', sessionSecret);
    expect(first).toHaveLength(43);
    expect(first).not.toContain('immutable-sub');
    expect(financeCacheOwnerKey('immutable-sub', sessionSecret)).toBe(first);
    expect(financeCacheOwnerKey('other-sub', sessionSecret)).not.toBe(first);
  });

  it('validates OAuth state, signed transaction age, and PKCE material', () => {
    const now = Date.UTC(2026, 7, 8);
    const { token, transaction, challenge } = createOAuthTransaction(sessionSecret, '/budget', now);
    expect(challenge).toHaveLength(43);
    expect(transaction.verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifyOAuthTransaction(token, transaction.state, sessionSecret, now + 1000)).toMatchObject({
      nonce: transaction.nonce,
      returnPath: '/budget',
    });
    expect(() => verifyOAuthTransaction(token, 'wrong-state', sessionSecret, now)).toThrow(/state/i);
    expect(() => verifyOAuthTransaction(token, transaction.state, sessionSecret, now + 11 * 60 * 1000)).toThrow(/abgelaufen/i);

    const [encodedPayload, signature] = token.split('.');
    const tamperedPayload = JSON.parse(Buffer.from(encodedPayload!, 'base64url').toString('utf8')) as Record<string, unknown>;
    tamperedPayload.returnPath = 'https://evil.example';
    const tamperedEncoded = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url');
    const tamperedSignature = Buffer.from(createHmac('sha256', sessionSecret).update(tamperedEncoded).digest()).toString('base64url');
    expect(() => verifyOAuthTransaction(`${tamperedEncoded}.${tamperedSignature}`, transaction.state, sessionSecret, now)).toThrow(/ungültig/i);
    expect(() => verifyOAuthTransaction(`${token}${signature}`, transaction.state, sessionSecret, now)).toThrow(/ungültig/i);
  });

  it('accepts signed in-flight OAuth transactions created before return paths existed', () => {
    const now = Date.UTC(2026, 7, 8);
    const { token, transaction } = createOAuthTransaction(sessionSecret, '/', now);
    const [encodedPayload] = token.split('.');
    const legacyPayload = JSON.parse(Buffer.from(encodedPayload!, 'base64url').toString('utf8')) as Record<string, unknown>;
    delete legacyPayload.returnPath;
    const legacyEncoded = Buffer.from(JSON.stringify(legacyPayload)).toString('base64url');
    const legacySignature = Buffer.from(createHmac('sha256', sessionSecret).update(legacyEncoded).digest()).toString('base64url');

    expect(verifyOAuthTransaction(`${legacyEncoded}.${legacySignature}`, transaction.state, sessionSecret, now).returnPath).toBe('/');
  });

  it('requires both a same-origin request and matching CSRF header', () => {
    const { session } = createSession('sub', 'owner@example.test', sessionSecret);
    expect(() => assertCsrf(session, session.csrf, 'https://finance.example.test', 'https://finance.example.test')).not.toThrow();
    expect(() => assertCsrf(session, 'wrong', 'https://finance.example.test', 'https://finance.example.test')).toThrow(/CSRF/);
    expect(() => assertCsrf(session, session.csrf, 'https://evil.example.test', 'https://finance.example.test')).toThrow(/Anfrageursprung/);
  });

  it('marks session cookies Secure only in production while always using HttpOnly and SameSite', () => {
    expect(sessionCookie('signed', false)).toContain('HttpOnly; SameSite=Lax');
    expect(sessionCookie('signed', false)).not.toContain('Secure');
    expect(sessionCookie('signed', true)).toContain('Secure');
  });
});
