import type { FinanceFixture } from '../types/finance';

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

const sumMoney = (values: number[]) => fromCents(values.reduce((sum, value) => sum + toCents(value), 0));

export const selectCurrentCash = (data: FinanceFixture) => sumMoney(data.accounts.map((account) => account.balance));

export const selectPlannedAmount = (data: FinanceFixture) => sumMoney(data.budgetCategories.map((category) => category.amount));

export const selectPlannedReserves = (data: FinanceFixture) =>
  sumMoney(data.budgetCategories.filter((category) => category.kind === 'reserve').map((category) => category.amount));

export const selectFreeMoney = (data: FinanceFixture) =>
  fromCents(toCents(data.meta.monthlyIncome) - toCents(selectPlannedAmount(data)));

export const selectFreePercentage = (data: FinanceFixture) =>
  (selectFreeMoney(data) / data.meta.monthlyIncome) * 100;

export const selectPayoffToday = (data: FinanceFixture) => sumMoney(data.debtCreditors.map((creditor) => creditor.payoffBalance));

export const selectFutureDebtCost = (data: FinanceFixture) =>
  fromCents(toCents(data.meta.remainingDebtPayments) - toCents(selectPayoffToday(data)));

export const selectVisiblePockets = (data: FinanceFixture, includeEmpty = false) =>
  includeEmpty ? data.pockets : data.pockets.filter((pocket) => pocket.balance !== 0);

export const selectSortedBudgetCategories = (data: FinanceFixture) =>
  [...data.budgetCategories].sort((a, b) => b.amount - a.amount);

export const selectDebtReliefGain = (data: FinanceFixture) => {
  const first = data.debtReliefMilestones.at(0)?.freeAmount ?? 0;
  const last = data.debtReliefMilestones.at(-1)?.freeAmount ?? 0;
  return fromCents(toCents(last) - toCents(first));
};
