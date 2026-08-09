export const APPEARANCE_DATABASE_NAME = 'finance-appearance-v1';
export const APPEARANCE_ASSET_STORE = 'assets';
export const WALLPAPER_PREVIEW_KEY = 'wallpaper-preview';

type WallpaperPreviewRecord = {
  blob: Blob;
  updatedAt: string;
};

function openAppearanceDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(APPEARANCE_DATABASE_NAME, 1);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(APPEARANCE_ASSET_STORE)) request.result.createObjectStore(APPEARANCE_ASSET_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Appearance database could not be opened.'));
    request.onblocked = () => reject(new Error('Appearance database upgrade is blocked.'));
  });
}

async function runTransaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openAppearanceDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(APPEARANCE_ASSET_STORE, mode);
      const request = operation(transaction.objectStore(APPEARANCE_ASSET_STORE));
      let result: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error ?? new Error('Appearance asset operation failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Appearance asset transaction was aborted.'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Appearance asset transaction failed.'));
      transaction.oncomplete = () => resolve(result);
    });
  } finally {
    database.close();
  }
}

export async function saveWallpaperPreview(blob: Blob): Promise<void> {
  const record: WallpaperPreviewRecord = { blob, updatedAt: new Date().toISOString() };
  await runTransaction('readwrite', (store) => store.put(record, WALLPAPER_PREVIEW_KEY));
}

export async function loadWallpaperPreview(): Promise<Blob | null> {
  const record = await runTransaction<WallpaperPreviewRecord | undefined>('readonly', (store) => store.get(WALLPAPER_PREVIEW_KEY));
  return record?.blob instanceof Blob ? record.blob : null;
}

export async function removeWallpaperPreview(): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(WALLPAPER_PREVIEW_KEY));
}
