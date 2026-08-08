import { z } from 'zod';
import { FINANCE_TAB_HEADERS } from './schema.js';
import {
  FINANCE_SCHEMA_VERSION,
  FINANCE_TAB_NAMES,
  type FinanceTabName,
  type FinanceValidationIssue,
  type FinanceValidationResult,
  type RawSheetsBatchResponse,
  type TabularWorkbook,
} from './types.js';

const kebabCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isoMonthOrDate = /^\d{4}-\d{2}(?:-\d{2})?$/;

const isActualDate = (value: string) => {
  if (!isoDate.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

const isActualMonthOrDate = (value: string) => {
  if (!isoMonthOrDate.test(value)) return false;
  if (value.length === 7) {
    const month = Number(value.slice(5, 7));
    return month >= 1 && month <= 12;
  }
  return isActualDate(value);
};

export const euroNumberToCents = (value: number): number => {
  if (!Number.isFinite(value)) throw new Error('Betrag muss eine endliche Zahl sein.');
  const cents = Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error('Betrag liegt außerhalb des sicheren Zahlenbereichs.');
  return cents;
};

type LocatedRecord = { row: number; values: Record<string, unknown> };

const issue = (tab: FinanceTabName, row: number, column: string, expected: string, message?: string): FinanceValidationIssue => ({
  tab,
  row,
  column,
  expected,
  message: message ?? `Ungültiger Wert; erwartet: ${expected}.`,
});

const isBlank = (value: unknown) => value === undefined || value === null || value === '';
const isBlankRow = (row: unknown[]) => row.every(isBlank);

const tabNameFromRange = (range: string | undefined): FinanceTabName | null => {
  if (!range) return null;
  const rawName = range.split('!')[0]?.replace(/^'/, '').replace(/'$/, '');
  return FINANCE_TAB_NAMES.find((name) => name === rawName) ?? null;
};

export function sheetsResponseToWorkbook(response: RawSheetsBatchResponse): {
  workbook?: TabularWorkbook;
  issues: FinanceValidationIssue[];
} {
  const tabs = new Map<FinanceTabName, unknown[][]>();
  for (const range of response.valueRanges ?? []) {
    const name = tabNameFromRange(range.range);
    if (name) tabs.set(name, range.values ?? []);
  }

  const issues: FinanceValidationIssue[] = [];
  for (const tab of FINANCE_TAB_NAMES) {
    if (!tabs.has(tab)) issues.push(issue(tab, 1, '(tab)', `Tab „${tab}“`, 'Erforderlicher Tabellen-Tab fehlt.'));
  }
  if (issues.length) return { issues };

  return { workbook: Object.fromEntries(FINANCE_TAB_NAMES.map((tab) => [tab, tabs.get(tab)!])) as TabularWorkbook, issues };
}

function recordsForTab(tab: FinanceTabName, rows: unknown[][], issues: FinanceValidationIssue[]): LocatedRecord[] {
  const header = rows[0] ?? [];
  const headerNames = header.map((cell) => typeof cell === 'string' ? cell : '');
  const required = FINANCE_TAB_HEADERS[tab];

  const seenHeaders = new Set<string>();
  headerNames.forEach((column) => {
    if (column && seenHeaders.has(column)) issues.push(issue(tab, 1, column, 'eindeutiger Spaltenname', 'Doppelter Spaltenname.'));
    seenHeaders.add(column);
  });

  for (const column of required) {
    if (!headerNames.includes(column)) {
      issues.push(issue(tab, 1, column, `Spalte „${column}“`, 'Erforderliche Spalte fehlt.'));
    }
  }
  if (required.some((column) => !headerNames.includes(column))) return [];

  return rows.slice(1).map((row, index) => ({ row: index + 2, raw: row }))
    .filter(({ raw }) => !isBlankRow(raw))
    .map(({ row, raw }) => ({
      row,
      values: Object.fromEntries(headerNames.map((column, index) => [column, raw[index]])),
    }));
}

function read<T>(
  tab: FinanceTabName,
  record: LocatedRecord,
  column: string,
  schema: z.ZodType<T>,
  expected: string,
  issues: FinanceValidationIssue[],
): T | undefined {
  const result = schema.safeParse(record.values[column]);
  if (!result.success) {
    issues.push(issue(tab, record.row, column, expected));
    return undefined;
  }
  return result.data;
}

function readOptionalText(tab: FinanceTabName, record: LocatedRecord, column: string, issues: FinanceValidationIssue[]) {
  const value = record.values[column];
  if (isBlank(value)) return null;
  return read(tab, record, column, z.string().trim().min(1), 'Text oder leer', issues) ?? null;
}

function readMoney(tab: FinanceTabName, record: LocatedRecord, column: string, issues: FinanceValidationIssue[]) {
  const value = read(tab, record, column, z.number().finite(), 'numerischer Euro-Wert ohne Währungssymbol', issues);
  if (value === undefined) return undefined;
  try {
    return euroNumberToCents(value);
  } catch {
    issues.push(issue(tab, record.row, column, 'sicher darstellbarer numerischer Euro-Wert'));
    return undefined;
  }
}

const requiredText = z.string().trim().min(1);
const idSchema = z.string().regex(kebabCase);
const integerSchema = z.number().int().safe();
const nonNegativeIntegerSchema = integerSchema.nonnegative();
const booleanSchema = z.boolean();
const isoDateSchema = z.string().refine(isActualDate);
const milestoneDateSchema = z.string().refine(isActualMonthOrDate);

function duplicateIssues<T>(
  records: T[],
  key: (record: T) => string,
  located: LocatedRecord[],
  tab: FinanceTabName,
  column: string,
  issues: FinanceValidationIssue[],
) {
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const value = key(record);
    if (seen.has(value)) issues.push(issue(tab, located[index]?.row ?? 1, column, 'eindeutiger Wert', 'Doppelter Schlüssel.'));
    seen.add(value);
  });
}

export function validateFinanceWorkbook(workbook: TabularWorkbook): FinanceValidationResult {
  const issues: FinanceValidationIssue[] = [];
  const records = Object.fromEntries(FINANCE_TAB_NAMES.map((tab) => [tab, recordsForTab(tab, workbook[tab], issues)])) as Record<FinanceTabName, LocatedRecord[]>;

  if (records._Meta.length !== 1) {
    issues.push(issue('_Meta', 2, '(row)', 'genau eine Datenzeile', 'Der _Meta-Tab muss genau eine Datenzeile enthalten.'));
  }
  const meta = records._Meta[0];
  const schemaVersion = meta ? read('_Meta', meta, 'schema_version', z.number().int(), 'Ganzzahl 1', issues) : undefined;
  const asOf = meta ? read('_Meta', meta, 'as_of', isoDateSchema, 'ISO-Datum YYYY-MM-DD', issues) : undefined;
  const currency = meta ? read('_Meta', meta, 'currency', z.literal('EUR'), 'EUR', issues) : undefined;
  const monthlyIncomeCents = meta ? readMoney('_Meta', meta, 'monthly_income', issues) : undefined;
  if (schemaVersion !== undefined && schemaVersion !== FINANCE_SCHEMA_VERSION) {
    issues.push(issue('_Meta', meta?.row ?? 2, 'schema_version', 'unterstützte Schema-Version 1', `Schema-Version ${schemaVersion} wird nicht unterstützt.`));
  }

  const accounts = records._Accounts.flatMap((record) => {
    const id = read('_Accounts', record, 'id', idSchema, 'stabile lowercase-kebab-case ID', issues);
    const name = read('_Accounts', record, 'name', requiredText, 'nicht leerer Text', issues);
    const kind = read('_Accounts', record, 'kind', z.enum(['bank', 'wallet', 'cash']), 'bank, wallet oder cash', issues);
    const displayOrder = read('_Accounts', record, 'display_order', integerSchema, 'Ganzzahl', issues);
    const active = read('_Accounts', record, 'active', booleanSchema, 'boolescher Wert TRUE/FALSE', issues);
    return id !== undefined && name !== undefined && kind !== undefined && displayOrder !== undefined && active !== undefined
      ? [{ id, name, kind, displayOrder, active }] : [];
  });

  const accountSnapshots = records._AccountSnapshots.flatMap((record) => {
    const accountId = read('_AccountSnapshots', record, 'account_id', idSchema, 'lowercase-kebab-case Account-ID', issues);
    const snapshotAsOf = read('_AccountSnapshots', record, 'as_of', isoDateSchema, 'ISO-Datum YYYY-MM-DD', issues);
    const balanceCents = readMoney('_AccountSnapshots', record, 'balance', issues);
    return accountId !== undefined && snapshotAsOf !== undefined && balanceCents !== undefined
      ? [{ accountId, asOf: snapshotAsOf, balanceCents }] : [];
  });

  const pockets = records._Pockets.flatMap((record) => {
    const id = read('_Pockets', record, 'id', idSchema, 'stabile lowercase-kebab-case ID', issues);
    const accountId = read('_Pockets', record, 'account_id', idSchema, 'lowercase-kebab-case Account-ID', issues);
    const name = read('_Pockets', record, 'name', requiredText, 'nicht leerer Text', issues);
    const displayOrder = read('_Pockets', record, 'display_order', integerSchema, 'Ganzzahl', issues);
    const active = read('_Pockets', record, 'active', booleanSchema, 'boolescher Wert TRUE/FALSE', issues);
    return id !== undefined && accountId !== undefined && name !== undefined && displayOrder !== undefined && active !== undefined
      ? [{ id, accountId, name, displayOrder, active }] : [];
  });

  const pocketSnapshots = records._PocketSnapshots.flatMap((record) => {
    const pocketId = read('_PocketSnapshots', record, 'pocket_id', idSchema, 'lowercase-kebab-case Pocket-ID', issues);
    const snapshotAsOf = read('_PocketSnapshots', record, 'as_of', isoDateSchema, 'ISO-Datum YYYY-MM-DD', issues);
    const balanceCents = readMoney('_PocketSnapshots', record, 'balance', issues);
    return pocketId !== undefined && snapshotAsOf !== undefined && balanceCents !== undefined
      ? [{ pocketId, asOf: snapshotAsOf, balanceCents }] : [];
  });

  const budgetItems = records._BudgetItems.flatMap((record) => {
    const id = read('_BudgetItems', record, 'id', idSchema, 'stabile lowercase-kebab-case ID', issues);
    const label = read('_BudgetItems', record, 'label', requiredText, 'nicht leerer Text', issues);
    const monthlyAmountCents = readMoney('_BudgetItems', record, 'monthly_amount', issues);
    const necessityId = read('_BudgetItems', record, 'necessity_id', z.enum(['essential', 'necessary', 'worthwhile', 'optional', 'unnecessary']), 'gültige necessity_id', issues);
    const kind = read('_BudgetItems', record, 'kind', z.enum(['expense', 'reserve']), 'expense oder reserve', issues);
    const displayOrder = read('_BudgetItems', record, 'display_order', integerSchema, 'Ganzzahl', issues);
    const active = read('_BudgetItems', record, 'active', booleanSchema, 'boolescher Wert TRUE/FALSE', issues);
    const note = readOptionalText('_BudgetItems', record, 'note', issues);
    return id !== undefined && label !== undefined && monthlyAmountCents !== undefined && necessityId !== undefined && kind !== undefined && displayOrder !== undefined && active !== undefined
      ? [{ id, label, monthlyAmountCents, necessityId, kind, displayOrder, active, note }] : [];
  });

  const debts = records._Debts.flatMap((record) => {
    const id = read('_Debts', record, 'id', idSchema, 'stabile lowercase-kebab-case ID', issues);
    const name = read('_Debts', record, 'name', requiredText, 'nicht leerer Text', issues);
    const kind = read('_Debts', record, 'kind', z.enum(['loan', 'installment']), 'loan oder installment', issues);
    const monthlyPaymentCents = readMoney('_Debts', record, 'monthly_payment', issues);
    const displayOrder = read('_Debts', record, 'display_order', integerSchema, 'Ganzzahl', issues);
    const active = read('_Debts', record, 'active', booleanSchema, 'boolescher Wert TRUE/FALSE', issues);
    const note = readOptionalText('_Debts', record, 'note', issues);
    return id !== undefined && name !== undefined && kind !== undefined && monthlyPaymentCents !== undefined && displayOrder !== undefined && active !== undefined
      ? [{ id, name, kind, monthlyPaymentCents, displayOrder, active, note }] : [];
  });

  const debtSnapshots = records._DebtSnapshots.flatMap((record) => {
    const debtId = read('_DebtSnapshots', record, 'debt_id', idSchema, 'lowercase-kebab-case Debt-ID', issues);
    const snapshotAsOf = read('_DebtSnapshots', record, 'as_of', isoDateSchema, 'ISO-Datum YYYY-MM-DD', issues);
    const payoffBalanceCents = readMoney('_DebtSnapshots', record, 'payoff_balance', issues);
    const remainingPaymentCount = read(
      '_DebtSnapshots',
      record,
      'remaining_payments',
      nonNegativeIntegerSchema,
      'nicht negative Ganzzahl (Anzahl verbleibender Raten)',
      issues,
    );
    const remainingScheduledTotalCents = readMoney('_DebtSnapshots', record, 'remaining_scheduled_total', issues);
    return debtId !== undefined
      && snapshotAsOf !== undefined
      && payoffBalanceCents !== undefined
      && remainingPaymentCount !== undefined
      && remainingScheduledTotalCents !== undefined
      ? [{ debtId, asOf: snapshotAsOf, payoffBalanceCents, remainingPaymentCount, remainingScheduledTotalCents }]
      : [];
  });

  const debtMilestones = records._DebtMilestones.flatMap((record) => {
    const debtId = read('_DebtMilestones', record, 'debt_id', idSchema, 'lowercase-kebab-case Debt-ID', issues);
    const date = read('_DebtMilestones', record, 'date', milestoneDateSchema, 'Datum YYYY-MM oder YYYY-MM-DD', issues);
    const balanceCents = readMoney('_DebtMilestones', record, 'balance', issues);
    return debtId !== undefined && date !== undefined && balanceCents !== undefined ? [{ debtId, date, balanceCents }] : [];
  });

  const reliefMilestones = records._ReliefMilestones.flatMap((record) => {
    const date = read('_ReliefMilestones', record, 'date', milestoneDateSchema, 'Datum YYYY-MM oder YYYY-MM-DD', issues);
    const monthlyReliefCents = readMoney('_ReliefMilestones', record, 'free_amount', issues);
    const event = read('_ReliefMilestones', record, 'event', requiredText, 'nicht leerer Text', issues);
    const eventDetail = readOptionalText('_ReliefMilestones', record, 'event_detail', issues);
    return date !== undefined && monthlyReliefCents !== undefined && event !== undefined ? [{ date, monthlyReliefCents, event, eventDetail }] : [];
  });

  duplicateIssues(accounts, (entry) => entry.id, records._Accounts, '_Accounts', 'id', issues);
  duplicateIssues(pockets, (entry) => entry.id, records._Pockets, '_Pockets', 'id', issues);
  duplicateIssues(budgetItems, (entry) => entry.id, records._BudgetItems, '_BudgetItems', 'id', issues);
  duplicateIssues(debts, (entry) => entry.id, records._Debts, '_Debts', 'id', issues);
  duplicateIssues(accountSnapshots, (entry) => `${entry.accountId}|${entry.asOf}`, records._AccountSnapshots, '_AccountSnapshots', 'account_id, as_of', issues);
  duplicateIssues(pocketSnapshots, (entry) => `${entry.pocketId}|${entry.asOf}`, records._PocketSnapshots, '_PocketSnapshots', 'pocket_id, as_of', issues);
  duplicateIssues(debtSnapshots, (entry) => `${entry.debtId}|${entry.asOf}`, records._DebtSnapshots, '_DebtSnapshots', 'debt_id, as_of', issues);
  duplicateIssues(debtMilestones, (entry) => `${entry.debtId}|${entry.date}`, records._DebtMilestones, '_DebtMilestones', 'debt_id, date', issues);

  const accountIds = new Set(accounts.map(({ id }) => id));
  const pocketIds = new Set(pockets.map(({ id }) => id));
  const debtIds = new Set(debts.map(({ id }) => id));
  accountSnapshots.forEach((entry, index) => {
    if (!accountIds.has(entry.accountId)) issues.push(issue('_AccountSnapshots', records._AccountSnapshots[index]?.row ?? 1, 'account_id', 'vorhandene _Accounts.id', 'Unbekannte Account-ID.'));
  });
  pockets.forEach((entry, index) => {
    if (!accountIds.has(entry.accountId)) issues.push(issue('_Pockets', records._Pockets[index]?.row ?? 1, 'account_id', 'vorhandene _Accounts.id', 'Unbekannte Account-ID.'));
  });
  pocketSnapshots.forEach((entry, index) => {
    if (!pocketIds.has(entry.pocketId)) issues.push(issue('_PocketSnapshots', records._PocketSnapshots[index]?.row ?? 1, 'pocket_id', 'vorhandene _Pockets.id', 'Unbekannte Pocket-ID.'));
  });
  debtSnapshots.forEach((entry, index) => {
    if (!debtIds.has(entry.debtId)) issues.push(issue('_DebtSnapshots', records._DebtSnapshots[index]?.row ?? 1, 'debt_id', 'vorhandene _Debts.id', 'Unbekannte Debt-ID.'));
  });
  debtMilestones.forEach((entry, index) => {
    if (!debtIds.has(entry.debtId)) issues.push(issue('_DebtMilestones', records._DebtMilestones[index]?.row ?? 1, 'debt_id', 'vorhandene _Debts.id', 'Unbekannte Debt-ID.'));
  });

  if (asOf) {
    const hasSnapshot = <T>(all: T[], id: string, getId: (item: T) => string, getDate: (item: T) => string) =>
      all.some((item) => getId(item) === id && getDate(item) <= asOf);
    accounts.filter(({ active }) => active).forEach(({ id }) => {
      if (!hasSnapshot(accountSnapshots, id, (entry) => entry.accountId, (entry) => entry.asOf)) {
        issues.push(issue('_AccountSnapshots', 1, 'account_id, as_of', `Snapshot für „${id}“ spätestens ${asOf}`, 'Aktueller Snapshot fehlt.'));
      }
    });
    pockets.filter(({ active }) => active).forEach(({ id }) => {
      if (!hasSnapshot(pocketSnapshots, id, (entry) => entry.pocketId, (entry) => entry.asOf)) {
        issues.push(issue('_PocketSnapshots', 1, 'pocket_id, as_of', `Snapshot für „${id}“ spätestens ${asOf}`, 'Aktueller Snapshot fehlt.'));
      }
    });
    debts.filter(({ active }) => active).forEach(({ id }) => {
      if (!hasSnapshot(debtSnapshots, id, (entry) => entry.debtId, (entry) => entry.asOf)) {
        issues.push(issue('_DebtSnapshots', 1, 'debt_id, as_of', `Snapshot für „${id}“ spätestens ${asOf}`, 'Aktueller Snapshot fehlt.'));
      }
    });
  }

  if (issues.length || schemaVersion !== FINANCE_SCHEMA_VERSION || !asOf || currency !== 'EUR' || monthlyIncomeCents === undefined) {
    return { success: false, issues };
  }

  return {
    success: true,
    data: {
      schemaVersion: FINANCE_SCHEMA_VERSION,
      asOf,
      currency,
      monthlyIncomeCents,
      accounts,
      accountSnapshots,
      pockets,
      pocketSnapshots,
      budgetItems,
      debts,
      debtSnapshots,
      debtMilestones,
      reliefMilestones,
    },
  };
}

export function parseSheetsBatchResponse(response: RawSheetsBatchResponse): FinanceValidationResult {
  const extracted = sheetsResponseToWorkbook(response);
  if (!extracted.workbook) return { success: false, issues: extracted.issues };
  return validateFinanceWorkbook(extracted.workbook);
}
