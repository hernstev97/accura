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
    expect(result.data.monthlyIncomeCents).toBe(259_132);
    expect(result.data.accountSnapshots[1]?.balanceCents).toBe(120_025);
    expect(result.data.budgetItems[0]?.monthlyAmountCents).toBe(100_000);
    expect(result.data.debtSnapshots[0]).toMatchObject({
      remainingPaymentCount: 60,
      remainingScheduledTotalCents: 1_500_000,
    });
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

  it('validates installment counts independently from required scheduled monetary totals', () => {
    const missingMoney = workbook();
    missingMoney._DebtSnapshots[1]![4] = '';
    const missingMoneyResult = validateFinanceWorkbook(missingMoney);
    expect(missingMoneyResult.success).toBe(false);
    if (!missingMoneyResult.success) {
      expect(missingMoneyResult.issues).toContainEqual(expect.objectContaining({
        tab: '_DebtSnapshots',
        row: 2,
        column: 'remaining_scheduled_total',
      }));
    }

    const fractionalCount = workbook();
    fractionalCount._DebtSnapshots[1]![3] = 86.5;
    const fractionalCountResult = validateFinanceWorkbook(fractionalCount);
    expect(fractionalCountResult.success).toBe(false);
    if (!fractionalCountResult.success) {
      expect(fractionalCountResult.issues).toContainEqual(expect.objectContaining({
        tab: '_DebtSnapshots',
        row: 2,
        column: 'remaining_payments',
        expected: 'nicht negative Ganzzahl (Anzahl verbleibender Raten)',
      }));
    }
  });

  it('allows multiple relief events in the same month for deterministic grouping', () => {
    const raw = workbook();
    raw._ReliefMilestones.push(['2026-09', 10, 'Zweites Ereignis', 'Gleicher Monat']);
    const result = validateFinanceWorkbook(raw);
    expect(result.success).toBe(true);
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

  it('parses salary_day and due_day optional columns correctly', () => {
    const raw = workbook();
    const result = validateFinanceWorkbook(raw);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.salaryDay).toBe(25);
    expect(result.data.budgetItems[0]?.dueDay).toBe(1);
    expect(result.data.budgetItems[2]?.dueDay).toBeNull();
    expect(result.data.debts[0]?.dueDay).toBe(20);
  });

  it('remains backwards-compatible when salary_day or due_day columns are omitted', () => {
    const raw = workbook();
    raw._Meta[0] = ['schema_version', 'as_of', 'currency', 'monthly_income'];
    raw._Meta[1] = [1, '2026-08-08', 'EUR', 2591.32];
    raw._BudgetItems[0] = ['id', 'label', 'monthly_amount', 'necessity_id', 'kind', 'display_order', 'active', 'note'];
    raw._BudgetItems[1] = ['housing', 'Wohnen', 1000, 'essential', 'expense', 1, true, ''];
    const result = validateFinanceWorkbook(raw);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.salaryDay).toBeNull();
    expect(result.data.budgetItems[0]?.dueDay).toBeNull();
  });

  it('rejects invalid day values for salary_day and due_day', () => {
    const raw = workbook();
    raw._Meta[1]![4] = 32;
    raw._BudgetItems[1]![8] = 0;
    raw._Debts[1]![7] = 'invalid';
    const result = validateFinanceWorkbook(raw);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ tab: '_Meta', row: 2, column: 'salary_day', expected: 'Ganzzahl von 1 bis 31 oder leer' }),
      expect.objectContaining({ tab: '_BudgetItems', row: 2, column: 'due_day', expected: 'Ganzzahl von 1 bis 31 oder leer' }),
      expect.objectContaining({ tab: '_Debts', row: 2, column: 'due_day', expected: 'Ganzzahl von 1 bis 31 oder leer' }),
    ]));
  });
});
