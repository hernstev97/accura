import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseSheetsBatchResponse } from '../finance/parser';
import { anonymousSheetsResponse } from '../mocks/anonymousWorkbook';
import {
  clearCachedFinanceData,
  FINANCE_CACHE_GENERATION_STORAGE_KEY,
  loadCachedFinanceData,
  readFinanceCacheGeneration,
  rotateFinanceCacheGeneration,
  saveCachedFinanceData,
} from './financeCache';

const parsed = parseSheetsBatchResponse(anonymousSheetsResponse);
if (!parsed.success) throw new Error('Anonymous workbook is invalid.');
const ownerA = 'owner-cache-key-a';
const ownerB = 'owner-cache-key-b';

describe('last-known-good IndexedDB cache', () => {
  beforeEach(async () => clearCachedFinanceData());

  it('stores and loads only normalized FinanceDataV1 snapshots', async () => {
    await saveCachedFinanceData({
      refreshedAt: '2026-08-08T10:00:00.000Z',
      data: parsed.data,
    }, ownerA);
    await expect(loadCachedFinanceData(ownerA)).resolves.toEqual(expect.objectContaining({
      ownerKey: ownerA,
      data: expect.objectContaining({ schemaVersion: 1, monthlyIncomeCents: 259_132 }),
    }));
  });

  it('never returns one owner\'s cached finance data for another owner', async () => {
    await saveCachedFinanceData({ refreshedAt: '2026-08-08T10:00:00.000Z', data: parsed.data }, ownerA);
    await expect(loadCachedFinanceData(ownerB)).resolves.toBeNull();
  });

  it('removes cached personal finance data on local cleanup', async () => {
    await saveCachedFinanceData({ refreshedAt: '2026-08-08T10:00:00.000Z', data: parsed.data }, ownerA);
    await clearCachedFinanceData();
    await expect(loadCachedFinanceData(ownerA)).resolves.toBeNull();
  });

  it('rejects a cache write started before a protected-access recovery generation change', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const requestGeneration = readFinanceCacheGeneration(storage);
    expect(rotateFinanceCacheGeneration(storage)).not.toBeNull();
    expect(values.get(FINANCE_CACHE_GENERATION_STORAGE_KEY)).not.toBe(requestGeneration);

    await expect(saveCachedFinanceData({
      refreshedAt: '2026-08-08T10:00:00.000Z',
      data: parsed.data,
    }, ownerA, requestGeneration, storage)).resolves.toBe(false);
    await expect(loadCachedFinanceData(ownerA)).resolves.toBeNull();
  });
});
