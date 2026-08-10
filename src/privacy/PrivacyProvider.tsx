/* eslint-disable react-refresh/only-export-components -- privacy context and provider intentionally share this module */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  applyPrivacyToDocument,
  initializePrivacyBeforeRender,
  PRIVACY_STORAGE_KEY,
  writeStoredPrivacy,
} from './privacyStore';

type PrivacyContextValue = {
  privacyMode: boolean;
  setPrivacyMode: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  togglePrivacyMode: () => void;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyProvider({ children, initialEnabled }: { children: ReactNode; initialEnabled?: boolean }) {
  const [privacyMode, setPrivacyModeState] = useState<boolean>(() => initialEnabled ?? initializePrivacyBeforeRender());

  const setPrivacyMode = useCallback((updater: boolean | ((prev: boolean) => boolean)) => {
    setPrivacyModeState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      applyPrivacyToDocument(next);
      writeStoredPrivacy(next);
      return next;
    });
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setPrivacyMode((prev) => !prev);
  }, [setPrivacyMode]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PRIVACY_STORAGE_KEY) return;
      const next = event.newValue === 'true';
      setPrivacyModeState(next);
      applyPrivacyToDocument(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<PrivacyContextValue>(
    () => ({ privacyMode, setPrivacyMode, togglePrivacyMode }),
    [privacyMode, setPrivacyMode, togglePrivacyMode]
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used inside PrivacyProvider.');
  }
  return context;
}
