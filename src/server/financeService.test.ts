import { describe, expect, it, vi } from 'vitest';
import { anonymousSheetsResponse } from '../mocks/anonymousWorkbook';
import { validateAndSaveSpreadsheet } from '../../api/_lib/financeService';
import type { ConnectionRepository, GoogleConnection } from '../../api/_lib/repository';
import { encryptRefreshToken } from '../../api/_lib/security';
import { testServerConfig } from './google.test';

const connection: GoogleConnection = {
  googleSub: 'immutable-google-sub',
  email: 'owner@example.test',
  encryptedRefreshToken: encryptRefreshToken('refresh-value', testServerConfig.tokenEncryptionKey, 'immutable-google-sub'),
  scopes: [],
  spreadsheetId: null,
  spreadsheetName: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  tokenUpdatedAt: new Date(0),
  spreadsheetUpdatedAt: null,
};

function repository(): ConnectionRepository & { saveSpreadsheet: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn(),
    upsertAuthorization: vi.fn(),
    saveSpreadsheet: vi.fn(),
    delete: vi.fn(),
  };
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

describe('spreadsheet selection service', () => {
  it('commits a selected file only after Drive validation and schema validation succeed', async () => {
    const repo = repository();
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes('oauth2.googleapis.com/token')) return json({ access_token: 'short-lived', expires_in: 3600 });
      if (url.includes('googleapis.com/drive/')) return json({ id: 'valid-spreadsheet-id', name: 'Anonyme Finanzen', mimeType: 'application/vnd.google-apps.spreadsheet' });
      if (url.includes('sheets.googleapis.com/')) return json(anonymousSheetsResponse);
      return json({}, 404);
    });

    const result = await validateAndSaveSpreadsheet(testServerConfig, repo, connection, 'valid-spreadsheet-id', fetchMock);
    expect(result.data.schemaVersion).toBe(1);
    expect(repo.saveSpreadsheet).toHaveBeenCalledWith('immutable-google-sub', 'valid-spreadsheet-id', 'Anonyme Finanzen');
  });

  it('does not replace the stored selection if the candidate workbook is invalid', async () => {
    const repo = repository();
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes('oauth2.googleapis.com/token')) return json({ access_token: 'short-lived' });
      if (url.includes('googleapis.com/drive/')) return json({ id: 'invalid-sheet-id', name: 'Fehlerhaft', mimeType: 'application/vnd.google-apps.spreadsheet' });
      if (url.includes('sheets.googleapis.com/')) return json({ valueRanges: [] });
      return json({}, 404);
    });

    await expect(validateAndSaveSpreadsheet(testServerConfig, repo, connection, 'invalid-sheet-id', fetchMock)).rejects.toMatchObject({ code: 'invalid_finance_schema', status: 422 });
    expect(repo.saveSpreadsheet).not.toHaveBeenCalled();
  });
});
