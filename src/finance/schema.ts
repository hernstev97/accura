import type { FinanceTabName } from './types.js';

export const FINANCE_TAB_HEADERS: Record<FinanceTabName, readonly string[]> = {
  _Meta: ['schema_version', 'as_of', 'currency', 'monthly_income'],
  _Accounts: ['id', 'name', 'kind', 'display_order', 'active'],
  _AccountSnapshots: ['account_id', 'as_of', 'balance'],
  _Pockets: ['id', 'account_id', 'name', 'display_order', 'active'],
  _PocketSnapshots: ['pocket_id', 'as_of', 'balance'],
  _BudgetItems: ['id', 'label', 'monthly_amount', 'necessity_id', 'kind', 'display_order', 'active', 'note'],
  _Debts: ['id', 'name', 'kind', 'monthly_payment', 'display_order', 'active', 'note'],
  _DebtSnapshots: ['debt_id', 'as_of', 'payoff_balance', 'remaining_payments'],
  _DebtMilestones: ['debt_id', 'date', 'balance'],
  _ReliefMilestones: ['date', 'free_amount', 'event', 'event_detail'],
};

export const GOOGLE_SHEETS_RANGES = Object.keys(FINANCE_TAB_HEADERS).map((tab) => `'${tab}'!A:Z`);
