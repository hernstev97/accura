import { z } from 'zod';
import { financeDataV1Schema } from '../finance/runtime';
import type { FinanceDataV1 } from '../finance/types';

const DATABASE_NAME = 'finance-overview';
const DATABASE_VERSION = 1;
const STORE_NAME = 'last-good';
const CACHE_KEY = 'finance-data-v1';
export const FINANCE_CACHE_GENERATION_STORAGE_KEY = 'finance-cache-generation-v1';
const INITIAL_CACHE_GENERATION = '0';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const cacheSchema = z.object({
  key: z.literal(CACHE_KEY),
  spreadsheetId: z.string().min(1),
  spreadsheetName: z.string().min(1),
  refreshedAt: z.string().datetime(),
  data: financeDataV1Schema,
});

export type CachedFinanceSnapshot = {
  key: typeof CACHE_KEY;
  spreadsheetId: string;
  spreadsheetName: string;
  refreshedAt: string;
  data: FinanceDataV1;
};

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('IndexedDB konnte nicht geöffnet werden.'));
});

const transactionDone = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB-Transaktion fehlgeschlagen.'));
  transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB-Transaktion wurde abgebrochen.'));
});

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readFinanceCacheGeneration(storage: StorageLike | null = browserStorage()): string {
  if (!storage) return INITIAL_CACHE_GENERATION;
  try {
    return storage.getItem(FINANCE_CACHE_GENERATION_STORAGE_KEY) ?? INITIAL_CACHE_GENERATION;
  } catch {
    return INITIAL_CACHE_GENERATION;
  }
}

export function rotateFinanceCacheGeneration(storage: StorageLike | null = browserStorage()): string | null {
  if (!storage) return null;
  try {
    const randomPart = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const next = `${Date.now()}-${randomPart}`;
    storage.setItem(FINANCE_CACHE_GENERATION_STORAGE_KEY, next);
    return next;
  } catch {
    return null;
  }
}

export function restoreFinanceCacheGeneration(
  generation: string,
  storage: StorageLike | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    if (generation === INITIAL_CACHE_GENERATION) storage.removeItem(FINANCE_CACHE_GENERATION_STORAGE_KEY);
    else storage.setItem(FINANCE_CACHE_GENERATION_STORAGE_KEY, generation);
    return true;
  } catch {
    return false;
  }
}

export async function loadCachedFinanceData(): Promise<CachedFinanceSnapshot | null> {
  if (!globalThis.indexedDB) return null;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(CACHE_KEY);
    const value = await new Promise<unknown>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const parsed = cacheSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } finally {
    database.close();
  }
}

export async function saveCachedFinanceData(
  snapshot: Omit<CachedFinanceSnapshot, 'key'>,
  expectedGeneration = readFinanceCacheGeneration(),
  storage: StorageLike | null = browserStorage(),
): Promise<boolean> {
  if (!globalThis.indexedDB || readFinanceCacheGeneration(storage) !== expectedGeneration) return false;
  const database = await openDatabase();
  try {
    if (readFinanceCacheGeneration(storage) !== expectedGeneration) return false;
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ key: CACHE_KEY, ...snapshot });
    await transactionDone(transaction);
    return true;
  } finally {
    database.close();
  }
}

export async function clearCachedFinanceData() {
  if (!globalThis.indexedDB) return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(CACHE_KEY);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
