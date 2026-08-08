import { describe, expect, it } from 'vitest';
import { parseSheetsBatchResponse } from '../finance/parser';
import { anonymousSheetsResponse } from '../mocks/anonymousWorkbook';
import { financeProviderReducer, initialFinanceState } from './FinanceDataProvider';

const parsed = parseSheetsBatchResponse(anonymousSheetsResponse);
if (!parsed.success) throw new Error('Anonymous workbook is invalid.');
const data = parsed.data;
const sheet = { id: 'sheet-id', name: 'Anonyme Finanzen' };

describe('finance provider state transitions', () => {
  it('represents disconnected, authenticated-no-sheet, loading, stale, offline, and validation-error states', () => {
    const signedOut = financeProviderReducer(initialFinanceState, { type: 'signed-out' });
    expect(signedOut).toMatchObject({ authState: 'signed-out', connectionState: 'disconnected' });

    const noSheet = financeProviderReducer(initialFinanceState, {
      type: 'authenticated',
      session: { authenticated: true, user: { email: 'owner@example.test' }, csrfToken: 'csrf', connection: { connected: true, spreadsheet: null } },
    });
    expect(noSheet).toMatchObject({ authState: 'authenticated', connectionState: 'no-spreadsheet', syncState: 'initial' });

    const cached = financeProviderReducer(initialFinanceState, { type: 'cache-loaded', data, refreshedAt: '2026-08-08T10:00:00.000Z', spreadsheet: sheet });
    expect(cached).toMatchObject({ syncState: 'stale', stale: true, data });
    expect(financeProviderReducer(cached, { type: 'sync-started' }).syncState).toBe('syncing');
    expect(financeProviderReducer(cached, { type: 'offline-startup', hasData: true })).toMatchObject({ authState: 'offline', syncState: 'offline', data });
    expect(financeProviderReducer(cached, { type: 'sync-failed', syncState: 'validation-error', error: { code: 'invalid_finance_schema', message: 'Ungültig' } })).toMatchObject({ syncState: 'validation-error', stale: true });
  });

  it('retains the last-known-good data after an invalid refresh', () => {
    const valid = financeProviderReducer(initialFinanceState, { type: 'sync-succeeded', data, refreshedAt: '2026-08-08T10:00:00.000Z', spreadsheet: sheet });
    const failed = financeProviderReducer(valid, {
      type: 'sync-failed',
      syncState: 'validation-error',
      error: { code: 'invalid_finance_schema', message: 'Tabelle ungültig', issues: [{ tab: '_Meta', row: 2, column: 'schema_version', expected: '1', message: 'Ungültig' }] },
    });
    expect(failed.data).toBe(data);
    expect(failed.lastSuccessfulRefresh).toBe('2026-08-08T10:00:00.000Z');
    expect(failed).toMatchObject({ stale: true, syncState: 'validation-error' });
  });

  it('enters a reconnect state for revoked authorization without discarding valid data', () => {
    const valid = financeProviderReducer(initialFinanceState, { type: 'sync-succeeded', data, refreshedAt: '2026-08-08T10:00:00.000Z', spreadsheet: sheet });
    const reconnect = financeProviderReducer(valid, { type: 'sync-failed', syncState: 'error', reconnect: true, error: { code: 'reconnect_required', message: 'Neu verbinden' } });
    expect(reconnect).toMatchObject({ connectionState: 'reconnect', data, stale: true });
  });
});
