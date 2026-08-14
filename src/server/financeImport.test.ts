import { describe, expect, it } from 'vitest';
import { financeImportFingerprint, parseFinanceImportJson, parseFinanceImportSource } from '../../api/_lib/financeImport';
import { anonymousSheetsResponse } from '../mocks/anonymousWorkbook';

const parsedFixture = parseFinanceImportSource(anonymousSheetsResponse);
if (!parsedFixture.success) throw new Error('Anonymous finance fixture must be valid.');

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

  it('accepts an already normalized FinanceDataV1 object', () => {
    const parsed = parseFinanceImportSource(parsedFixture.data);
    expect(parsed).toEqual({ success: true, data: parsedFixture.data });
  });

  it.each([
    ['duplicate database key', {
      ...parsedFixture.data,
      accounts: [...parsedFixture.data.accounts, parsedFixture.data.accounts[0]!],
    }],
    ['blank constrained text', {
      ...parsedFixture.data,
      accounts: parsedFixture.data.accounts.map((account, index) => index === 0 ? { ...account, name: '   ' } : account),
    }],
    ['invalid calendar date', { ...parsedFixture.data, asOf: '2026-02-31' }],
    ['unknown foreign reference', {
      ...parsedFixture.data,
      accountSnapshots: parsedFixture.data.accountSnapshots.map((snapshot, index) => index === 0
        ? { ...snapshot, accountId: 'missing-account' }
        : snapshot),
    }],
  ])('rejects normalized input with %s before PostgreSQL', (_label, source) => {
    expect(parseFinanceImportSource(source).success).toBe(false);
  });

  it('rejects a non-object payload without leaking source text', () => {
    const parsed = parseFinanceImportSource('secret-amount-999');
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(JSON.stringify(parsed.issues)).not.toContain('secret-amount-999');
  });

  it('sanitizes malformed JSON errors without exposing file contents', () => {
    const secretSource = '{"monthlyIncomeCents": 987654321';
    expect(() => parseFinanceImportJson(secretSource)).toThrow('Die Importdatei ist kein gültiges JSON.');
    try {
      parseFinanceImportJson(secretSource);
    } catch (error) {
      expect(String(error)).not.toContain('987654321');
    }
  });

  it('rejects an unsupported object without leaking its source content', () => {
    const parsed = parseFinanceImportSource({ secret: 'private-finance-value-999' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(JSON.stringify(parsed.issues)).not.toContain('private-finance-value-999');
  });

  it('validates the complete relevant shape of Sheets payloads', () => {
    const parsed = parseFinanceImportSource({ spreadsheetId: 'sheet-id', valueRanges: 'private-finance-value-999' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(JSON.stringify(parsed.issues)).not.toContain('private-finance-value-999');
  });
});
