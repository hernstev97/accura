import { describe, expect, it } from 'vitest';
import {
  APP_PROTECTION_STORAGE_KEY,
  PIN_PBKDF2_ITERATIONS,
  attemptsRemainingBeforeCooldown,
  createPinCredential,
  defaultAppProtectionPreference,
  parseAppProtectionPreference,
  preferenceAfterFailedPin,
  readStoredAppProtection,
  verifyPinAttempt,
  verifyPinCredential,
  writeStoredAppProtection,
  type AppProtectionPreferenceV1,
} from './appProtectionStore';

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(APP_PROTECTION_STORAGE_KEY, initial);
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  };
}

describe('ACC-14 app protection storage and PIN security', () => {
  it('defaults to disabled only when the versioned preference is absent', () => {
    const memory = memoryStorage();
    expect(readStoredAppProtection(memory.storage)).toEqual({
      status: 'missing',
      preference: defaultAppProtectionPreference(),
    });
    expect(readStoredAppProtection(memoryStorage('{not-json').storage).status).toBe('corrupt');
  });

  it('validates and persists the screen-only preference without a PIN', () => {
    const memory = memoryStorage();
    const preference = { ...defaultAppProtectionPreference(), privacyScreenEnabled: true };
    expect(writeStoredAppProtection(preference, memory.storage)).toBe(true);
    expect(readStoredAppProtection(memory.storage)).toEqual({ status: 'valid', preference });
    expect(parseAppProtectionPreference({ ...preference, version: 2 })).toBeNull();
  });

  it('derives a salted verifier, never serializes the PIN, and verifies only the matching PIN', async () => {
    const credential = await createPinCredential('123456');
    expect(credential).not.toBeNull();
    expect(credential?.iterations).toBe(PIN_PBKDF2_ITERATIONS);
    expect(JSON.stringify(credential)).not.toContain('123456');
    await expect(verifyPinCredential('123456', credential!)).resolves.toBe(true);
    await expect(verifyPinCredential('654321', credential!)).resolves.toBe(false);
  });

  it('requires six digits and rejects a PIN credential without the preview protection', async () => {
    await expect(createPinCredential('1234')).resolves.toBeNull();
    const credential = await createPinCredential('123456');
    expect(parseAppProtectionPreference({
      ...defaultAppProtectionPreference(),
      pin: credential,
    })).toBeNull();
  });

  it('starts an exponential persisted cooldown on the fifth failed attempt', async () => {
    const credential = await createPinCredential('123456');
    let preference: AppProtectionPreferenceV1 = {
      ...defaultAppProtectionPreference(),
      privacyScreenEnabled: true,
      pin: credential!,
    };
    const now = 1_700_000_000_000;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const result = await verifyPinAttempt('000000', preference, now);
      expect(result.status).toBe('incorrect');
      preference = result.preference;
    }
    expect(attemptsRemainingBeforeCooldown(preference)).toBe(1);

    const fifth = await verifyPinAttempt('000000', preference, now);
    expect(fifth.status).toBe('cooldown');
    expect(fifth.preference.blockedUntil).toBe(now + 30_000);

    const stillBlocked = await verifyPinAttempt('123456', fifth.preference, now + 10_000);
    expect(stillBlocked.status).toBe('cooldown');
    const sixthPreference = preferenceAfterFailedPin({ ...fifth.preference, blockedUntil: null }, now + 30_001);
    expect(sixthPreference.blockedUntil).toBe(now + 90_001);
  });
});
