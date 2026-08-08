import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseSheetsBatchResponse } from '../finance/parser';
import { anonymousSheetsResponse } from '../mocks/anonymousWorkbook';
import { clearCachedFinanceData, loadCachedFinanceData, saveCachedFinanceData } from './financeCache';

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
});
