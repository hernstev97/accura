import { describe, expect, it } from 'vitest';
import {
  assertCsrf,
  createOAuthTransaction,
  createSession,
  decryptRefreshToken,
  encryptRefreshToken,
  isAllowedGoogleUser,
  verifyOAuthTransaction,
  verifySession,
  sessionCookie,
} from '../../api/_lib/security';

const encryptionKey = Buffer.alloc(32, 7).toString('base64');
const sessionSecret = 'test-session-secret-with-at-least-32-bytes';

describe('server security primitives', () => {
  it('encrypts refresh tokens with authenticated encryption and subject-bound AAD', () => {
    const encrypted = encryptRefreshToken('refresh-token-value', encryptionKey, 'google-sub-1');
    expect(encrypted).not.toContain('refresh-token-value');
    expect(decryptRefreshToken(encrypted, encryptionKey, 'google-sub-1')).toBe('refresh-token-value');
    expect(() => decryptRefreshToken(encrypted, encryptionKey, 'other-sub')).toThrow();
  });

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

  it('validates OAuth state, signed transaction age, and PKCE material', () => {
    const now = Date.UTC(2026, 7, 8);
    const { token, transaction, challenge } = createOAuthTransaction(sessionSecret, now);
    expect(challenge).toHaveLength(43);
    expect(transaction.verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifyOAuthTransaction(token, transaction.state, sessionSecret, now + 1000).nonce).toBe(transaction.nonce);
    expect(() => verifyOAuthTransaction(token, 'wrong-state', sessionSecret, now)).toThrow(/state/i);
    expect(() => verifyOAuthTransaction(token, transaction.state, sessionSecret, now + 11 * 60 * 1000)).toThrow(/abgelaufen/i);
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
