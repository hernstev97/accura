export const APP_PROTECTION_STORAGE_KEY = 'finance-app-protection-v1';
export const PIN_LENGTH = 6;
export const PIN_PBKDF2_ITERATIONS = 600_000;

const PIN_PATTERN = /^\d{6}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const INITIAL_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 15 * 60_000;
const ATTEMPTS_BEFORE_COOLDOWN = 5;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type PinCredentialV1 = {
  algorithm: 'PBKDF2-HMAC-SHA-256';
  iterations: typeof PIN_PBKDF2_ITERATIONS;
  salt: string;
  verifier: string;
};

export type AppProtectionPreferenceV1 = {
  version: 1;
  privacyScreenEnabled: boolean;
  pin: PinCredentialV1 | null;
  failedAttempts: number;
  blockedUntil: number | null;
};

export type AppProtectionReadResult =
  | { status: 'missing'; preference: AppProtectionPreferenceV1 }
  | { status: 'valid'; preference: AppProtectionPreferenceV1 }
  | { status: 'corrupt'; preference: AppProtectionPreferenceV1 }
  | { status: 'unavailable'; preference: AppProtectionPreferenceV1 };

export type PinVerificationResult =
  | { status: 'success'; preference: AppProtectionPreferenceV1 }
  | { status: 'incorrect'; preference: AppProtectionPreferenceV1; attemptsRemaining: number }
  | { status: 'cooldown'; preference: AppProtectionPreferenceV1; retryAt: number }
  | { status: 'unavailable'; preference: AppProtectionPreferenceV1 };

export function defaultAppProtectionPreference(): AppProtectionPreferenceV1 {
  return {
    version: 1,
    privacyScreenEnabled: false,
    pin: null,
    failedAttempts: 0,
    blockedUntil: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPinCredential(value: unknown): value is PinCredentialV1 {
  if (!isRecord(value)) return false;
  return value.algorithm === 'PBKDF2-HMAC-SHA-256'
    && value.iterations === PIN_PBKDF2_ITERATIONS
    && typeof value.salt === 'string'
    && value.salt.length === 22
    && BASE64URL_PATTERN.test(value.salt)
    && typeof value.verifier === 'string'
    && value.verifier.length === 43
    && BASE64URL_PATTERN.test(value.verifier);
}

export function parseAppProtectionPreference(value: unknown): AppProtectionPreferenceV1 | null {
  if (!isRecord(value) || value.version !== 1 || typeof value.privacyScreenEnabled !== 'boolean') return null;
  if (value.pin !== null && !isPinCredential(value.pin)) return null;
  if (value.pin && !value.privacyScreenEnabled) return null;
  if (!Number.isSafeInteger(value.failedAttempts) || Number(value.failedAttempts) < 0) return null;
  if (value.blockedUntil !== null && (!Number.isSafeInteger(value.blockedUntil) || Number(value.blockedUntil) <= 0)) return null;

  return {
    version: 1,
    privacyScreenEnabled: value.privacyScreenEnabled,
    pin: value.pin,
    failedAttempts: Number(value.failedAttempts),
    blockedUntil: value.blockedUntil === null ? null : Number(value.blockedUntil),
  };
}

export function deserializeAppProtectionPreference(raw: string | null): AppProtectionPreferenceV1 | null {
  if (!raw) return null;
  try {
    return parseAppProtectionPreference(JSON.parse(raw));
  } catch {
    return null;
  }
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredAppProtection(storage: StorageLike | null = browserStorage()): AppProtectionReadResult {
  if (!storage) return { status: 'unavailable', preference: defaultAppProtectionPreference() };
  try {
    const raw = storage.getItem(APP_PROTECTION_STORAGE_KEY);
    if (raw === null) return { status: 'missing', preference: defaultAppProtectionPreference() };
    const preference = deserializeAppProtectionPreference(raw);
    return preference
      ? { status: 'valid', preference }
      : { status: 'corrupt', preference: defaultAppProtectionPreference() };
  } catch {
    return { status: 'unavailable', preference: defaultAppProtectionPreference() };
  }
}

export function writeStoredAppProtection(
  preference: AppProtectionPreferenceV1,
  storage: StorageLike | null = browserStorage(),
): boolean {
  if (!storage || !parseAppProtectionPreference(preference)) return false;
  try {
    storage.setItem(APP_PROTECTION_STORAGE_KEY, JSON.stringify(preference));
    return true;
  } catch {
    return false;
  }
}

export function removeStoredAppProtection(storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(APP_PROTECTION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function applyAppCoveredToDocument(
  covered: boolean,
  documentRef: Document | undefined = typeof document === 'undefined' ? undefined : document,
) {
  if (!documentRef) return;
  if (covered) documentRef.documentElement.dataset.appCovered = 'true';
  else delete documentRef.documentElement.dataset.appCovered;
}

export function initializeAppProtectionBeforeRender(): AppProtectionReadResult {
  const result = readStoredAppProtection();
  applyAppCoveredToDocument(result.status === 'corrupt' || Boolean(result.preference.pin));
  return result;
}

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePinVerifier(pin: string, salt: Uint8Array, cryptoRef: Crypto): Promise<Uint8Array> {
  const pinBytes = new TextEncoder().encode(pin);
  const key = await cryptoRef.subtle.importKey('raw', pinBytes, 'PBKDF2', false, ['deriveBits']);
  const bits = await cryptoRef.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: Uint8Array.from(salt).buffer,
    iterations: PIN_PBKDF2_ITERATIONS,
  }, key, 256);
  return new Uint8Array(bits);
}

function availableCrypto(cryptoRef?: Crypto): Crypto | null {
  const candidate = cryptoRef ?? globalThis.crypto;
  return candidate?.subtle && typeof candidate.getRandomValues === 'function' ? candidate : null;
}

export function canUsePinSecurity(cryptoRef?: Crypto): boolean {
  return Boolean(availableCrypto(cryptoRef));
}

export async function createPinCredential(pin: string, cryptoRef?: Crypto): Promise<PinCredentialV1 | null> {
  if (!isValidPin(pin)) return null;
  const cryptoApi = availableCrypto(cryptoRef);
  if (!cryptoApi) return null;
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const verifier = await derivePinVerifier(pin, salt, cryptoApi);
  return {
    algorithm: 'PBKDF2-HMAC-SHA-256',
    iterations: PIN_PBKDF2_ITERATIONS,
    salt: bytesToBase64Url(salt),
    verifier: bytesToBase64Url(verifier),
  };
}

export async function verifyPinCredential(pin: string, credential: PinCredentialV1, cryptoRef?: Crypto): Promise<boolean | null> {
  if (!isValidPin(pin)) return false;
  const cryptoApi = availableCrypto(cryptoRef);
  if (!cryptoApi) return null;
  const expected = base64UrlToBytes(credential.verifier);
  const actual = await derivePinVerifier(pin, base64UrlToBytes(credential.salt), cryptoApi);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

export function preferenceAfterSuccessfulPin(preference: AppProtectionPreferenceV1): AppProtectionPreferenceV1 {
  return { ...preference, failedAttempts: 0, blockedUntil: null };
}

export function preferenceAfterFailedPin(preference: AppProtectionPreferenceV1, now = Date.now()): AppProtectionPreferenceV1 {
  const failedAttempts = preference.failedAttempts + 1;
  if (failedAttempts < ATTEMPTS_BEFORE_COOLDOWN) {
    return { ...preference, failedAttempts, blockedUntil: null };
  }
  const exponent = Math.min(failedAttempts - ATTEMPTS_BEFORE_COOLDOWN, 10);
  const cooldown = Math.min(INITIAL_COOLDOWN_MS * (2 ** exponent), MAX_COOLDOWN_MS);
  return { ...preference, failedAttempts, blockedUntil: now + cooldown };
}

export function attemptsRemainingBeforeCooldown(preference: AppProtectionPreferenceV1): number {
  return Math.max(0, ATTEMPTS_BEFORE_COOLDOWN - preference.failedAttempts);
}

export async function verifyPinAttempt(
  pin: string,
  preference: AppProtectionPreferenceV1,
  now = Date.now(),
  cryptoRef?: Crypto,
): Promise<PinVerificationResult> {
  if (!preference.pin) return { status: 'unavailable', preference };
  if (preference.blockedUntil && preference.blockedUntil > now) {
    return { status: 'cooldown', preference, retryAt: preference.blockedUntil };
  }
  const verified = await verifyPinCredential(pin, preference.pin, cryptoRef);
  if (verified === null) return { status: 'unavailable', preference };
  if (verified) return { status: 'success', preference: preferenceAfterSuccessfulPin(preference) };
  const next = preferenceAfterFailedPin({ ...preference, blockedUntil: null }, now);
  if (next.blockedUntil) return { status: 'cooldown', preference: next, retryAt: next.blockedUntil };
  return {
    status: 'incorrect',
    preference: next,
    attemptsRemaining: attemptsRemainingBeforeCooldown(next),
  };
}
