import type { RawSheetsBatchResponse, TabularWorkbook } from '../finance/types';

/** Anonymous data for deterministic tests and explicitly enabled local mocks only. */
export const anonymousWorkbook: TabularWorkbook = {
  _Meta: [
    ['schema_version', 'as_of', 'currency', 'monthly_income'],
    [1, '2026-08-08', 'EUR', 3000],
  ],
  _Accounts: [
    ['id', 'name', 'kind', 'display_order', 'active'],
    ['daily-account', 'Alltagskonto', 'bank', 1, true],
    ['travel-wallet', 'Reise-Wallet', 'wallet', 2, true],
    ['cash-box', 'Bargeld', 'cash', 3, true],
    ['old-account', 'Altes Konto', 'bank', 4, false],
  ],
  _AccountSnapshots: [
    ['account_id', 'as_of', 'balance'],
    ['daily-account', '2026-07-31', 1100],
    ['daily-account', '2026-08-08', 1200.25],
    ['travel-wallet', '2026-08-08', 120.5],
    ['cash-box', '2026-08-08', 30],
  ],
  _Pockets: [
    ['id', 'account_id', 'name', 'display_order', 'active'],
    ['home-reserve', 'daily-account', 'Wohnen', 1, true],
    ['food-reserve', 'daily-account', 'Lebensmittel', 2, true],
    ['trip-reserve', 'travel-wallet', 'Reise', 3, true],
    ['tech-reserve', 'daily-account', 'Technik', 4, true],
    ['gift-reserve', 'daily-account', 'Geschenke', 5, true],
    ['empty-reserve', 'daily-account', 'Später', 6, true],
  ],
  _PocketSnapshots: [
    ['pocket_id', 'as_of', 'balance'],
    ['home-reserve', '2026-08-08', 300],
    ['food-reserve', '2026-08-08', 150.25],
    ['trip-reserve', '2026-08-08', 75],
    ['tech-reserve', '2026-08-08', 0],
    ['gift-reserve', '2026-08-08', 25],
    ['empty-reserve', '2026-08-08', 0],
  ],
  _BudgetItems: [
    ['id', 'label', 'monthly_amount', 'necessity_id', 'kind', 'display_order', 'active', 'note'],
    ['housing', 'Wohnen', 1000, 'essential', 'expense', 1, true, ''],
    ['groceries', 'Lebensmittel', 500, 'essential', 'expense', 2, true, ''],
    ['reserve', 'Rücklagen', 300, 'worthwhile', 'reserve', 3, true, ''],
    ['utilities', 'Nebenkosten', 200, 'necessary', 'expense', 4, true, ''],
    ['mobility', 'Mobilität', 150, 'necessary', 'expense', 5, true, ''],
    ['insurance', 'Versicherungen', 100, 'essential', 'expense', 6, true, ''],
    ['fitness', 'Fitness', 60, 'optional', 'expense', 7, true, ''],
    ['internet', 'Internet', 50, 'necessary', 'expense', 8, true, ''],
    ['gifts', 'Geschenke', 50, 'unnecessary', 'expense', 9, true, ''],
    ['subscriptions', 'Abos', 40, 'optional', 'expense', 10, true, ''],
  ],
  _Debts: [
    ['id', 'name', 'kind', 'monthly_payment', 'display_order', 'active', 'note'],
    ['community-loan', 'Gemeinschaftsdarlehen', 'loan', 300, 1, true, 'Fester Zahlungsplan'],
    ['device-plan', 'Gerätefinanzierung', 'installment', 50, 2, true, 'Endet demnächst'],
  ],
  _DebtSnapshots: [
    ['debt_id', 'as_of', 'payoff_balance', 'remaining_payments'],
    ['community-loan', '2026-08-08', 5000, 6000],
    ['device-plan', '2026-08-08', 300, 360],
  ],
  _DebtMilestones: [
    ['debt_id', 'date', 'balance'],
    ['community-loan', '2026-08', 5000],
    ['device-plan', '2026-08', 300],
    ['community-loan', '2027-08', 3500],
    ['device-plan', '2027-08', 0],
    ['community-loan', '2028-08', 1700],
    ['device-plan', '2028-08', 0],
    ['community-loan', '2029-09', 0],
    ['device-plan', '2029-09', 0],
  ],
  _ReliefMilestones: [
    ['date', 'free_amount', 'event', 'event_detail'],
    ['2026-08', 550, 'Aktueller Plan', 'Ausgangswert'],
    ['2026-12', 600, 'Gerätefinanzierung', 'endet im November 2026'],
    ['2027-04', 650, 'Jahresvertrag', 'endet im März 2027'],
  ],
};

export const anonymousSheetsResponse: RawSheetsBatchResponse = {
  valueRanges: Object.entries(anonymousWorkbook).map(([tab, values]) => ({ range: `'${tab}'!A1:Z1000`, values })),
};
