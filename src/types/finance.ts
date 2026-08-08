export type Account = {
  id: string;
  name: string;
  balance: number;
  kind: 'bank' | 'wallet';
};

export type Pocket = {
  id: string;
  name: string;
  balance: number;
  accountId: string;
};

export type BudgetCategory = {
  id: string;
  label: string;
  amount: number;
  necessityId: NecessityId;
  kind: 'expense' | 'reserve';
};

export type NecessityId = 'essential' | 'necessary' | 'worthwhile' | 'optional';

export type NecessityGroup = {
  id: NecessityId;
  label: string;
  amount: number;
  colorToken: string;
};

export type DebtCreditor = {
  id: string;
  name: string;
  payoffBalance: number;
  note: string;
};

export type DebtBalanceMilestone = {
  date: string;
  label: string;
  shortLabel: string;
  balance: number;
};

export type DebtReliefMilestone = {
  date: string;
  label: string;
  freeAmount: number;
  event: string | null;
  eventDetail: string | null;
};

export type FinanceFixture = {
  meta: {
    asOf: string;
    asOfLabel: string;
    monthlyIncome: number;
    remainingDebtPayments: number;
  };
  accounts: Account[];
  pockets: Pocket[];
  budgetCategories: BudgetCategory[];
  necessityGroups: NecessityGroup[];
  debtCreditors: DebtCreditor[];
  debtBalanceMilestones: DebtBalanceMilestone[];
  debtReliefMilestones: DebtReliefMilestone[];
};
