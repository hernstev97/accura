export const FINANCE_SCHEMA_VERSION = 1 as const;

export const FINANCE_TAB_NAMES = [
  '_Meta',
  '_Accounts',
  '_AccountSnapshots',
  '_Pockets',
  '_PocketSnapshots',
  '_BudgetItems',
  '_Debts',
  '_DebtSnapshots',
  '_DebtMilestones',
  '_ReliefMilestones',
] as const;

export type FinanceTabName = (typeof FINANCE_TAB_NAMES)[number];
export type AccountKind = 'bank' | 'wallet' | 'cash';
export type BudgetKind = 'expense' | 'reserve';
export type DebtKind = 'loan' | 'installment';
export type NecessityId = 'essential' | 'necessary' | 'worthwhile' | 'optional' | 'unnecessary';

export type FinanceAccountV1 = {
  id: string;
  name: string;
  kind: AccountKind;
  displayOrder: number;
  active: boolean;
};

export type AccountSnapshotV1 = {
  accountId: string;
  asOf: string;
  balanceCents: number;
};

export type FinancePocketV1 = {
  id: string;
  accountId: string;
  name: string;
  displayOrder: number;
  active: boolean;
};

export type PocketSnapshotV1 = {
  pocketId: string;
  asOf: string;
  balanceCents: number;
};

export type BudgetItemV1 = {
  id: string;
  label: string;
  monthlyAmountCents: number;
  necessityId: NecessityId;
  kind: BudgetKind;
  displayOrder: number;
  active: boolean;
  note: string | null;
  dueDay: number | null;
};

export type DebtV1 = {
  id: string;
  name: string;
  kind: DebtKind;
  monthlyPaymentCents: number;
  displayOrder: number;
  active: boolean;
  note: string | null;
  dueDay: number | null;
};

export type DebtSnapshotV1 = {
  debtId: string;
  asOf: string;
  payoffBalanceCents: number;
  remainingPaymentCount: number;
  remainingScheduledTotalCents: number;
};

export type DebtMilestoneV1 = {
  debtId: string;
  date: string;
  balanceCents: number;
};

export type ReliefMilestoneV1 = {
  date: string;
  monthlyReliefCents: number;
  event: string;
  eventDetail: string | null;
};

export type UpcomingPaymentV1 = {
  id: string;
  name: string;
  amountCents: number;
  dueDay: number;
  dueDate: string;
  source: 'budget' | 'debt';
  isShortlyBeforeSalary: boolean;
};

export type UpcomingSummaryV1 = {
  salaryDay: number | null;
  nextSalaryDate: string | null;
  payments: UpcomingPaymentV1[];
  totalPendingCents: number;
  currentlyAvailableCents: number;
  safeToSpendCents: number;
};

/** Canonical, versioned source-domain contract. It contains no derived totals. */
export type FinanceDataV1 = {
  schemaVersion: typeof FINANCE_SCHEMA_VERSION;
  asOf: string;
  currency: 'EUR';
  monthlyIncomeCents: number;
  salaryDay: number | null;
  accounts: FinanceAccountV1[];
  accountSnapshots: AccountSnapshotV1[];
  pockets: FinancePocketV1[];
  pocketSnapshots: PocketSnapshotV1[];
  budgetItems: BudgetItemV1[];
  debts: DebtV1[];
  debtSnapshots: DebtSnapshotV1[];
  debtMilestones: DebtMilestoneV1[];
  reliefMilestones: ReliefMilestoneV1[];
};

export type RawSheetsValueRange = {
  range?: string;
  values?: unknown[][];
};

export type RawSheetsBatchResponse = {
  valueRanges?: RawSheetsValueRange[];
};

export type TabularWorkbook = Record<FinanceTabName, unknown[][]>;

export type FinanceValidationIssue = {
  tab: FinanceTabName;
  row: number;
  column: string;
  message: string;
  expected: string;
};

export type FinanceValidationResult =
  | { success: true; data: FinanceDataV1 }
  | { success: false; issues: FinanceValidationIssue[] };
