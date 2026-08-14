import { describe, expect, it } from 'vitest';
import { financeImportFingerprint, parseFinanceImportSource } from '../../api/_lib/financeImport';
import { anonymousSheetsResponse } from '../mocks/anonymousWorkbook';

describe('finance import source', () => {
  it('accepts the anonymous Sheets batchGet fixture without exposing amounts in the fingerprint', () => {
    const parsed = parseFinanceImportSource(anonymousSheetsResponse);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(financeImportFingerprint(parsed.data)).toEqual({
      asOf: '2026-08-08',
      currency: 'EUR',
      salaryDay: 25,
      accounts: parsed.data.accounts.length,
      accountSnapshots: parsed.data.accountSnapshots.length,
      pockets: parsed.data.pockets.length,
      pocketSnapshots: parsed.data.pocketSnapshots.length,
      budgetItems: parsed.data.budgetItems.length,
      debts: parsed.data.debts.length,
      debtSnapshots: parsed.data.debtSnapshots.length,
      debtMilestones: parsed.data.debtMilestones.length,
      reliefMilestones: parsed.data.reliefMilestones.length,
    });
    expect(JSON.stringify(financeImportFingerprint(parsed.data))).not.toContain(String(parsed.data.monthlyIncomeCents));
  });

  it('rejects a non-object payload without leaking source text', () => {
    const parsed = parseFinanceImportSource('secret-amount-999');
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(JSON.stringify(parsed.issues)).not.toContain('secret-amount-999');
  });
});
