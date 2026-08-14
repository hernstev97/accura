import { describe, expect, it } from 'vitest';
import { parseSheetsBatchResponse } from '../finance/parser';
import { anonymousSheetsResponse } from '../mocks/anonymousWorkbook';
import { financeProviderReducer, initialFinanceState } from './FinanceDataProvider';

const parsed = parseSheetsBatchResponse(anonymousSheetsResponse);
if (!parsed.success) throw new Error('Anonymous workbook is invalid.');
const data = parsed.data;

describe('finance provider state transitions', () => {
  it('represents signed-out, missing finance, loading, stale, offline, and integrity-error states', () => {
    const signedOut = financeProviderReducer(initialFinanceState, { type: 'signed-out' });
    expect(signedOut).toMatchObject({ authState: 'signed-out', connectionState: 'unknown' });

    const missing = financeProviderReducer(initialFinanceState, {
      type: 'authenticated',
      session: { authenticated: true, user: { email: 'owner@example.test' }, csrfToken: 'csrf' },
    });
    expect(missing).toMatchObject({ authState: 'authenticated', connectionState: 'unknown', syncState: 'initial' });
    expect(financeProviderReducer(missing, {
      type: 'sync-failed',
      syncState: 'error',
      missing: true,
      error: { code: 'finance_missing', message: 'Es ist noch kein Finanzstand vorhanden.' },
    })).toMatchObject({ connectionState: 'missing' });

    const cached = financeProviderReducer(initialFinanceState, { type: 'cache-loaded', data, refreshedAt: '2026-08-08T10:00:00.000Z' });
    expect(cached).toMatchObject({ syncState: 'stale', stale: true, data, connectionState: 'ready' });
    expect(financeProviderReducer(cached, { type: 'sync-started' }).syncState).toBe('syncing');
    expect(financeProviderReducer(cached, { type: 'offline-startup', hasData: true })).toMatchObject({ authState: 'offline', syncState: 'offline', data });
    expect(financeProviderReducer(cached, { type: 'sync-failed', syncState: 'validation-error', error: { code: 'finance_data_integrity', message: 'Ungültig' } })).toMatchObject({ syncState: 'validation-error', stale: true });
  });

  it('retains the last-known-good data after an invalid refresh', () => {
    const valid = financeProviderReducer(initialFinanceState, { type: 'sync-succeeded', data, refreshedAt: '2026-08-08T10:00:00.000Z' });
    const failed = financeProviderReducer(valid, {
      type: 'sync-failed',
      syncState: 'validation-error',
      error: { code: 'finance_data_integrity', message: 'Der gespeicherte Finanzstand ist ungültig.' },
    });
    expect(failed.data).toBe(data);
    expect(failed.lastSuccessfulRefresh).toBe('2026-08-08T10:00:00.000Z');
    expect(failed).toMatchObject({ stale: true, syncState: 'validation-error', connectionState: 'ready' });
  });
});
