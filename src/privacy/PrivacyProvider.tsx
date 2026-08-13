/* eslint-disable react-refresh/only-export-components -- privacy context and provider intentionally share this module */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  APP_PROTECTION_STORAGE_KEY,
  applyAppCoveredToDocument,
  canUsePinSecurity,
  createPinCredential,
  defaultAppProtectionPreference,
  deserializeAppProtectionPreference,
  initializeAppProtectionBeforeRender,
  isValidPin,
  removeStoredAppProtection,
  verifyPinAttempt,
  writeStoredAppProtection,
  type AppProtectionPreferenceV1,
  type AppProtectionReadResult,
} from './appProtectionStore';
import {
  applyPrivacyToDocument,
  initializePrivacyBeforeRender,
  PRIVACY_STORAGE_KEY,
  writeStoredPrivacy,
} from './privacyStore';

export type ProtectionOperationResult =
  | { status: 'success' }
  | { status: 'invalid-pin' }
  | { status: 'incorrect'; attemptsRemaining: number }
  | { status: 'cooldown'; retryAt: number }
  | { status: 'unavailable' }
  | { status: 'storage-error' }
  | { status: 'pin-required' };

type PrivacyContextValue = {
  privacyMode: boolean;
  manualPrivacyMode: boolean;
  setPrivacyMode: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  togglePrivacyMode: () => void;
  appProtection: AppProtectionPreferenceV1;
  appCovered: boolean;
  appProtectionCorrupt: boolean;
  appProtectionStorageAvailable: boolean;
  pinSecurityAvailable: boolean;
  revealPrivacyScreen: () => void;
  setPrivacyScreenEnabled: (enabled: boolean) => ProtectionOperationResult;
  setupPin: (pin: string) => Promise<ProtectionOperationResult>;
  verifyCurrentPin: (pin: string) => Promise<ProtectionOperationResult>;
  replacePin: (pin: string) => Promise<ProtectionOperationResult>;
  disablePin: (pin: string) => Promise<ProtectionOperationResult>;
  unlockWithPin: (pin: string) => Promise<ProtectionOperationResult>;
  resetAppProtectionAfterRecovery: () => ProtectionOperationResult;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

function resultAfterVerification(result: Awaited<ReturnType<typeof verifyPinAttempt>>): ProtectionOperationResult {
  switch (result.status) {
    case 'success': return { status: 'success' };
    case 'incorrect': return { status: 'incorrect', attemptsRemaining: result.attemptsRemaining };
    case 'cooldown': return { status: 'cooldown', retryAt: result.retryAt };
    case 'unavailable': return { status: 'unavailable' };
  }
}

export function PrivacyProvider({
  children,
  initialEnabled,
  initialProtection,
}: {
  children: ReactNode;
  initialEnabled?: boolean;
  initialProtection?: AppProtectionReadResult;
}) {
  const [initialProtectionSnapshot] = useState(() => initialProtection ?? initializeAppProtectionBeforeRender());
  const [manualPrivacyMode, setPrivacyModeState] = useState<boolean>(() => initialEnabled ?? initializePrivacyBeforeRender());
  const [appProtection, setAppProtection] = useState<AppProtectionPreferenceV1>(initialProtectionSnapshot.preference);
  const [appCovered, setAppCovered] = useState(() => initialProtectionSnapshot.status === 'corrupt' || Boolean(initialProtectionSnapshot.preference.pin));
  const [appProtectionCorrupt, setAppProtectionCorrupt] = useState(initialProtectionSnapshot.status === 'corrupt');
  const [appProtectionStorageAvailable, setAppProtectionStorageAvailable] = useState(initialProtectionSnapshot.status !== 'unavailable');
  const manualPrivacyRef = useRef(manualPrivacyMode);
  const appProtectionRef = useRef(appProtection);
  const appCoveredRef = useRef(appCovered);
  const corruptRef = useRef(appProtectionCorrupt);

  const applyCoveredState = useCallback((covered: boolean) => {
    appCoveredRef.current = covered;
    applyAppCoveredToDocument(covered);
    applyPrivacyToDocument(covered || manualPrivacyRef.current);
    setAppCovered(covered);
  }, []);

  const coverApp = useCallback(() => {
    if (!appProtectionRef.current.privacyScreenEnabled && !corruptRef.current) return;
    applyCoveredState(true);
  }, [applyCoveredState]);

  const commitPreference = useCallback((next: AppProtectionPreferenceV1): boolean => {
    const persisted = writeStoredAppProtection(next);
    setAppProtectionStorageAvailable(persisted);
    if (!persisted) return false;
    appProtectionRef.current = next;
    setAppProtection(next);
    setAppProtectionCorrupt(false);
    corruptRef.current = false;
    return true;
  }, []);

  const persistVerificationPreference = useCallback((next: AppProtectionPreferenceV1): boolean => {
    const persisted = writeStoredAppProtection(next);
    setAppProtectionStorageAvailable(persisted);
    appProtectionRef.current = next;
    setAppProtection(next);
    return persisted;
  }, []);

  const setPrivacyMode = useCallback((updater: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof updater === 'function' ? updater(manualPrivacyRef.current) : updater;
    manualPrivacyRef.current = next;
    applyPrivacyToDocument(next || appCoveredRef.current);
    writeStoredPrivacy(next);
    setPrivacyModeState(next);
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setPrivacyMode((prev) => !prev);
  }, [setPrivacyMode]);

  const revealPrivacyScreen = useCallback(() => {
    if (appProtectionRef.current.pin || corruptRef.current) return;
    applyCoveredState(false);
  }, [applyCoveredState]);

  const setPrivacyScreenEnabled = useCallback((enabled: boolean): ProtectionOperationResult => {
    const current = appProtectionRef.current;
    if (!enabled && current.pin) return { status: 'pin-required' };
    const next = { ...current, privacyScreenEnabled: enabled };
    if (!commitPreference(next)) return { status: 'storage-error' };
    if (!enabled) applyCoveredState(false);
    return { status: 'success' };
  }, [applyCoveredState, commitPreference]);

  const setupPin = useCallback(async (pin: string): Promise<ProtectionOperationResult> => {
    if (!isValidPin(pin)) return { status: 'invalid-pin' };
    const credential = await createPinCredential(pin);
    if (!credential) return { status: 'unavailable' };
    const next: AppProtectionPreferenceV1 = {
      ...appProtectionRef.current,
      privacyScreenEnabled: true,
      pin: credential,
      failedAttempts: 0,
      blockedUntil: null,
    };
    return commitPreference(next) ? { status: 'success' } : { status: 'storage-error' };
  }, [commitPreference]);

  const verifyCurrentPin = useCallback(async (pin: string): Promise<ProtectionOperationResult> => {
    if (!isValidPin(pin)) return { status: 'invalid-pin' };
    const result = await verifyPinAttempt(pin, appProtectionRef.current);
    if (result.status !== 'unavailable' && !persistVerificationPreference(result.preference)) return { status: 'storage-error' };
    return resultAfterVerification(result);
  }, [persistVerificationPreference]);

  const replacePin = useCallback(async (pin: string): Promise<ProtectionOperationResult> => {
    if (!isValidPin(pin)) return { status: 'invalid-pin' };
    const credential = await createPinCredential(pin);
    if (!credential) return { status: 'unavailable' };
    const next: AppProtectionPreferenceV1 = {
      ...appProtectionRef.current,
      privacyScreenEnabled: true,
      pin: credential,
      failedAttempts: 0,
      blockedUntil: null,
    };
    return commitPreference(next) ? { status: 'success' } : { status: 'storage-error' };
  }, [commitPreference]);

  const disablePin = useCallback(async (pin: string): Promise<ProtectionOperationResult> => {
    if (!isValidPin(pin)) return { status: 'invalid-pin' };
    const result = await verifyPinAttempt(pin, appProtectionRef.current);
    if (result.status !== 'success') {
      if (result.status !== 'unavailable' && !persistVerificationPreference(result.preference)) return { status: 'storage-error' };
      return resultAfterVerification(result);
    }
    const next: AppProtectionPreferenceV1 = {
      ...result.preference,
      privacyScreenEnabled: true,
      pin: null,
      failedAttempts: 0,
      blockedUntil: null,
    };
    return commitPreference(next) ? { status: 'success' } : { status: 'storage-error' };
  }, [commitPreference, persistVerificationPreference]);

  const unlockWithPin = useCallback(async (pin: string): Promise<ProtectionOperationResult> => {
    if (!isValidPin(pin)) return { status: 'invalid-pin' };
    const result = await verifyPinAttempt(pin, appProtectionRef.current);
    if (result.status !== 'unavailable' && !persistVerificationPreference(result.preference)) return { status: 'storage-error' };
    if (result.status === 'success') applyCoveredState(false);
    return resultAfterVerification(result);
  }, [applyCoveredState, persistVerificationPreference]);

  const resetAppProtectionAfterRecovery = useCallback((): ProtectionOperationResult => {
    if (!removeStoredAppProtection()) return { status: 'storage-error' };
    const next = defaultAppProtectionPreference();
    appProtectionRef.current = next;
    setAppProtection(next);
    setAppProtectionCorrupt(false);
    corruptRef.current = false;
    setAppProtectionStorageAvailable(true);
    applyCoveredState(false);
    return { status: 'success' };
  }, [applyCoveredState]);

  useLayoutEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') coverApp();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', coverApp);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', coverApp);
    };
  }, [coverApp]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PRIVACY_STORAGE_KEY) {
        const next = event.newValue === 'true';
        manualPrivacyRef.current = next;
        setPrivacyModeState(next);
        applyPrivacyToDocument(next || appCoveredRef.current);
        return;
      }
      if (event.key !== APP_PROTECTION_STORAGE_KEY) return;
      if (event.newValue === null) {
        window.location.reload();
        return;
      }
      const next = deserializeAppProtectionPreference(event.newValue);
      if (!next) {
        setAppProtectionCorrupt(true);
        corruptRef.current = true;
        coverApp();
        return;
      }
      const previous = appProtectionRef.current;
      appProtectionRef.current = next;
      setAppProtection(next);
      setAppProtectionCorrupt(false);
      corruptRef.current = false;
      setAppProtectionStorageAvailable(true);
      const pinChanged = Boolean(next.pin) && (
        !previous.pin
        || next.pin?.salt !== previous.pin.salt
        || next.pin?.verifier !== previous.pin.verifier
      );
      if (pinChanged) applyCoveredState(true);
      else if (!next.privacyScreenEnabled) applyCoveredState(false);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [applyCoveredState, coverApp]);

  const privacyMode = manualPrivacyMode || appCovered;
  const value = useMemo<PrivacyContextValue>(() => ({
    privacyMode,
    manualPrivacyMode,
    setPrivacyMode,
    togglePrivacyMode,
    appProtection,
    appCovered,
    appProtectionCorrupt,
    appProtectionStorageAvailable,
    pinSecurityAvailable: canUsePinSecurity(),
    revealPrivacyScreen,
    setPrivacyScreenEnabled,
    setupPin,
    verifyCurrentPin,
    replacePin,
    disablePin,
    unlockWithPin,
    resetAppProtectionAfterRecovery,
  }), [
    appCovered,
    appProtection,
    appProtectionCorrupt,
    appProtectionStorageAvailable,
    disablePin,
    manualPrivacyMode,
    privacyMode,
    replacePin,
    resetAppProtectionAfterRecovery,
    revealPrivacyScreen,
    setPrivacyMode,
    setPrivacyScreenEnabled,
    setupPin,
    togglePrivacyMode,
    unlockWithPin,
    verifyCurrentPin,
  ]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (!context) throw new Error('usePrivacy must be used inside PrivacyProvider.');
  return context;
}
