import { describe, expect, it } from 'vitest';
import { anonymousSheetsResponse, anonymousWorkbook } from '../mocks/anonymousWorkbook';
import { FINANCE_TAB_HEADERS } from './schema';
import { euroNumberToCents, parseSheetsBatchResponse, validateFinanceWorkbook } from './parser';
import { FINANCE_TAB_NAMES, type TabularWorkbook } from './types';

const workbook = () => structuredClone(anonymousWorkbook);

describe('Finance Data Schema v1 parser', () => {
  it('parses a complete raw batchGet response into normalized source data', () => {
    const result = parseSheetsBatchResponse(anonymousSheetsResponse);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.schemaVersion).toBe(1);
    expect(result.data.monthlyIncomeCents).toBe(300_000);
    expect(result.data.accountSnapshots[1]?.balanceCents).toBe(120_025);
    expect(result.data.budgetItems[0]?.monthlyAmountCents).toBe(100_000);
  });

  it.each(FINANCE_TAB_NAMES)('requires and parses the %s machine tab', (tab) => {
    const raw = structuredClone(anonymousSheetsResponse);
    raw.valueRanges = raw.valueRanges?.filter((range) => !range.range?.startsWith(`'${tab}'`));
    const result = parseSheetsBatchResponse(raw);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toContainEqual(expect.objectContaining({ tab, column: '(tab)' }));
  });

  it.each(Object.entries(FINANCE_TAB_HEADERS))('rejects a missing required column in %s', (tab, headers) => {
    const raw = workbook();
    raw[tab as keyof TabularWorkbook][0] = headers.slice(1) as unknown[];
    const result = validateFinanceWorkbook(raw);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toContainEqual(expect.objectContaining({ tab, row: 1, column: headers[0] }));
  });

  it('rejects unsupported schema versions', () => {
    const raw = workbook();
    raw._Meta[1]![0] = 2;
    const result = validateFinanceWorkbook(raw);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.some(({ column, message }) => column === 'schema_version' && message.includes('nicht unterstützt'))).toBe(true);
  });

  it('rejects duplicate IDs and duplicate snapshot keys', () => {
    const raw = workbook();
    raw._Accounts.push([...raw._Accounts[1]!]);
    raw._AccountSnapshots.push([...raw._AccountSnapshots[1]!]);
    const result = validateFinanceWorkbook(raw);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.filter(({ message }) => message === 'Doppelter Schlüssel.')).toHaveLength(2);
  });

  it('rejects broken foreign-key references', () => {
    const raw = workbook();
    raw._Pockets[1]![1] = 'missing-account';
    const result = validateFinanceWorkbook(raw);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues).toContainEqual(expect.objectContaining({ tab: '_Pockets', column: 'account_id', message: 'Unbekannte Account-ID.' }));
  });

  it('rejects malformed dates, invalid enums, and German-formatted monetary strings with locations', () => {
    const raw = workbook();
    raw._AccountSnapshots[1]![1] = '08.08.2026';
    raw._Accounts[1]![2] = 'credit-card';
    raw._BudgetItems[1]![2] = '1.000,00';
    const result = validateFinanceWorkbook(raw);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ tab: '_AccountSnapshots', row: 2, column: 'as_of', expected: 'ISO-Datum YYYY-MM-DD' }),
      expect.objectContaining({ tab: '_Accounts', row: 2, column: 'kind' }),
      expect.objectContaining({ tab: '_BudgetItems', row: 2, column: 'monthly_amount' }),
    ]));
  });

  it('rounds numeric euro values to integer cents without later floating-point money', () => {
    expect(euroNumberToCents(1.005)).toBe(101);
    expect(euroNumberToCents(-1.005)).toBe(-101);
    expect(euroNumberToCents(12.344)).toBe(1234);
    expect(euroNumberToCents(12.345)).toBe(1235);
  });

  it('ignores blank rows, unrelated tabs, and additional columns', () => {
    const raw = workbook();
    raw._Accounts[0]!.push('future_field');
    raw._Accounts[1]!.push('ignored');
    raw._Accounts.push(['', '', '', '', '', '']);
    const result = validateFinanceWorkbook(raw);
    expect(result.success).toBe(true);
  });

  it('requires exact, unique machine headers', () => {
    const whitespace = workbook();
    whitespace._Accounts[0]![0] = ' id ';
    const whitespaceResult = validateFinanceWorkbook(whitespace);
    expect(whitespaceResult.success).toBe(false);
    if (!whitespaceResult.success) expect(whitespaceResult.issues).toContainEqual(expect.objectContaining({ tab: '_Accounts', column: 'id', message: 'Erforderliche Spalte fehlt.' }));

    const duplicate = workbook();
    duplicate._Accounts[0]!.push('name');
    const duplicateResult = validateFinanceWorkbook(duplicate);
    expect(duplicateResult.success).toBe(false);
    if (!duplicateResult.success) expect(duplicateResult.issues).toContainEqual(expect.objectContaining({ tab: '_Accounts', column: 'name', message: 'Doppelter Spaltenname.' }));
  });

  it('requires a current snapshot for every active account, pocket, and debt', () => {
    const raw = workbook();
    raw._PocketSnapshots = [raw._PocketSnapshots[0]!, ...raw._PocketSnapshots.slice(1).filter((row) => row[0] !== 'home-reserve')];
    const result = validateFinanceWorkbook(raw);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues).toContainEqual(expect.objectContaining({ tab: '_PocketSnapshots', message: 'Aktueller Snapshot fehlt.' }));
  });
});
