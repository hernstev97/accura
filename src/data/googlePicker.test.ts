import { describe, expect, it, vi } from 'vitest';
import type { FinanceApi } from './financeApi';
import { selectSpreadsheetWithPicker } from './googlePicker';

const response = {
  spreadsheet: { id: 'chosen-sheet-id', name: 'Gewählte Tabelle' },
  data: {
    schemaVersion: 1 as const,
    asOf: '2026-08-08',
    currency: 'EUR' as const,
    monthlyIncomeCents: 0,
    accounts: [], accountSnapshots: [], pockets: [], pocketSnapshots: [], budgetItems: [], debts: [], debtSnapshots: [], debtMilestones: [], reliefMilestones: [],
  },
  refreshedAt: '2026-08-08T10:00:00.000Z',
};

const api = (): FinanceApi => ({
  getSession: vi.fn(),
  getFinance: vi.fn(),
  getPickerConfig: vi.fn().mockResolvedValue({ accessToken: 'short-lived-only', expiresIn: 3600, apiKey: 'public-key', appId: '123', clientId: 'client' }),
  saveSpreadsheet: vi.fn().mockResolvedValue(response),
  logout: vi.fn(),
  disconnect: vi.fn(),
});

describe('Google Picker selection', () => {
  it('uses a mocked single-file Picker selection and sends only the chosen ID to the backend', async () => {
    const mockApi = api();
    const launcher = vi.fn().mockResolvedValue({ id: 'chosen-sheet-id', name: 'Untrusted Picker name' });
    await expect(selectSpreadsheetWithPicker(mockApi, launcher, 'csrf')).resolves.toEqual(response);
    expect(mockApi.saveSpreadsheet).toHaveBeenCalledWith('chosen-sheet-id', 'csrf', undefined);
  });

  it('does not call the save endpoint when Picker is cancelled', async () => {
    const mockApi = api();
    await expect(selectSpreadsheetWithPicker(mockApi, vi.fn().mockResolvedValue(null), 'csrf')).resolves.toBeNull();
    expect(mockApi.saveSpreadsheet).not.toHaveBeenCalled();
  });
});
