import { parseSheetsBatchResponse } from '../finance/parser';
import { anonymousSheetsResponse } from './anonymousWorkbook';
import type { FinanceApi } from '../data/financeApi';

const parsed = parseSheetsBatchResponse(anonymousSheetsResponse);
if (!parsed.success) throw new Error('Anonymous mock workbook is invalid.');

const financeResponse = {
  spreadsheet: { id: 'mock-spreadsheet-id', name: 'Anonyme Beispieldaten' },
  data: parsed.data,
  refreshedAt: '2026-08-08T10:00:00.000Z',
};

export const mockFinanceApi: FinanceApi = {
  getSession: async () => ({
    authenticated: true,
    user: { email: 'developer@example.test' },
    csrfToken: 'mock-csrf-token',
    connection: { connected: true, spreadsheet: financeResponse.spreadsheet },
  }),
  getFinance: async () => financeResponse,
  getPickerConfig: async () => ({ accessToken: 'ephemeral-mock-token', expiresIn: 3600, apiKey: 'mock-key', appId: '123', clientId: 'mock-client' }),
  saveSpreadsheet: async () => financeResponse,
  logout: async () => undefined,
  disconnect: async () => undefined,
};
