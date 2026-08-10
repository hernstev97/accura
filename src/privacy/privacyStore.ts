export const PRIVACY_STORAGE_KEY = 'finance-privacy-v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredPrivacy(storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(PRIVACY_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeStoredPrivacy(enabled: boolean, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PRIVACY_STORAGE_KEY, String(enabled));
    return true;
  } catch {
    return false;
  }
}

export function applyPrivacyToDocument(enabled: boolean, documentRef: Document | undefined = typeof document === 'undefined' ? undefined : document) {
  if (!documentRef) return;
  if (enabled) {
    documentRef.documentElement.dataset.privacyMode = 'true';
  } else {
    delete documentRef.documentElement.dataset.privacyMode;
  }
}

export function initializePrivacyBeforeRender(): boolean {
  const isPrivacyMode = readStoredPrivacy();
  applyPrivacyToDocument(isPrivacyMode);
  return isPrivacyMode;
}
