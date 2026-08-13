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

describe('last-known-good IndexedDB cache', () => {
  beforeEach(async () => clearCachedFinanceData());

  it('stores and loads only normalized FinanceDataV1 snapshots', async () => {
    await saveCachedFinanceData({
      spreadsheetId: 'spreadsheet-id',
      spreadsheetName: 'Anonyme Finanzen',
      refreshedAt: '2026-08-08T10:00:00.000Z',
      data: parsed.data,
    });
    await expect(loadCachedFinanceData()).resolves.toEqual(expect.objectContaining({
      spreadsheetId: 'spreadsheet-id',
      data: expect.objectContaining({ schemaVersion: 1, monthlyIncomeCents: 259_132 }),
    }));
  });

  it('removes cached personal finance data on disconnect cleanup', async () => {
    await saveCachedFinanceData({ spreadsheetId: 'id', spreadsheetName: 'Name', refreshedAt: '2026-08-08T10:00:00.000Z', data: parsed.data });
    await clearCachedFinanceData();
    await expect(loadCachedFinanceData()).resolves.toBeNull();
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
      spreadsheetId: 'stale-id',
      spreadsheetName: 'Veralteter Stand',
      refreshedAt: '2026-08-08T10:00:00.000Z',
      data: parsed.data,
    }, requestGeneration, storage)).resolves.toBe(false);
    await expect(loadCachedFinanceData()).resolves.toBeNull();
  });
});
