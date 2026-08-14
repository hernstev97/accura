import { parseSheetsBatchResponse } from '../finance/parser';
import { anonymousSheetsResponse } from './anonymousWorkbook';
import type { FinanceApi } from '../data/financeApi';

const parsed = parseSheetsBatchResponse(anonymousSheetsResponse);
if (!parsed.success) throw new Error('Anonymous mock workbook is invalid.');

const financeResponse = {
  data: parsed.data,
  refreshedAt: '2026-08-08T10:00:00.000Z',
};

export const mockFinanceApi: FinanceApi = {
  getSession: async () => ({
    authenticated: true,
    user: { email: 'developer@example.test' },
    csrfToken: 'mock-csrf-token',
  }),
  getFinance: async () => financeResponse,
  logout: async () => undefined,
};
