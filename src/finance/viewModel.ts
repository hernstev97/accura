import {
  selectCurrentAccountTotalCents,
  selectCurrentPayoffCents,
  selectDebtReliefGainCents,
  selectFreeMoneyCents,
  selectFreePercentageBasisPoints,
  selectFutureDebtCostCents,
  selectLatestAccountSnapshot,
  selectLatestDebtSnapshot,
  selectLatestPocketSnapshot,
  selectNecessityTotalsCents,
  selectPlannedAmountCents,
  selectPlannedReserveCents,
  selectRemainingDebtPaymentsCents,
} from './selectors';
import type { FinanceDataV1, NecessityId } from './types';

const necessityPresentation: Record<NecessityId, { label: string; colorToken: string }> = {
  essential: { label: 'Existentiell', colorToken: '--chart-essential' },
  necessary: { label: 'Notwendig', colorToken: '--chart-necessary' },
  worthwhile: { label: 'Sinnvoll', colorToken: '--chart-worthwhile' },
  optional: { label: 'Optional', colorToken: '--chart-optional' },
  unnecessary: { label: 'Unnötig', colorToken: '--chart-unnecessary' },
};

const centsToEuros = (cents: number) => cents / 100;

const dateForFormatting = (value: string) => new Date(`${value.length === 7 ? `${value}-01` : value}T12:00:00Z`);
const longMonth = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortMonth = new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

export type FinanceViewModel = ReturnType<typeof createFinanceViewModel>;

export function createFinanceViewModel(data: FinanceDataV1) {
  const necessityTotals = selectNecessityTotalsCents(data);
  const accounts = data.accounts.filter(({ active }) => active).sort((a, b) => a.displayOrder - b.displayOrder).map((account) => ({
    ...account,
    balance: centsToEuros(selectLatestAccountSnapshot(data, account.id)?.balanceCents ?? 0),
  }));
  const pockets = data.pockets.filter(({ active }) => active).sort((a, b) => a.displayOrder - b.displayOrder).map((pocket) => ({
    ...pocket,
    balance: centsToEuros(selectLatestPocketSnapshot(data, pocket.id)?.balanceCents ?? 0),
  }));
  const budgetCategories = data.budgetItems.filter(({ active }) => active).sort((a, b) => a.displayOrder - b.displayOrder).map((item) => ({
    id: item.id,
    label: item.label,
    amount: centsToEuros(item.monthlyAmountCents),
    necessityId: item.necessityId,
    kind: item.kind,
    note: item.note,
  }));
  const debts = data.debts.filter(({ active }) => active).sort((a, b) => a.displayOrder - b.displayOrder).map((debt) => ({
    id: debt.id,
    name: debt.name,
    kind: debt.kind,
    note: debt.note,
    monthlyPayment: centsToEuros(debt.monthlyPaymentCents),
    payoffBalance: centsToEuros(selectLatestDebtSnapshot(data, debt.id)?.payoffBalanceCents ?? 0),
  }));
  const activeDebtIds = new Set(data.debts.filter(({ active }) => active).map(({ id }) => id));
  const milestoneTotals = new Map<string, number>();
  data.debtMilestones.filter(({ debtId }) => activeDebtIds.has(debtId)).forEach(({ date, balanceCents }) => {
    milestoneTotals.set(date, (milestoneTotals.get(date) ?? 0) + balanceCents);
  });
  const debtBalanceMilestones = [...milestoneTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, balanceCents]) => ({
    date,
    label: longMonth.format(dateForFormatting(date)),
    shortLabel: shortMonth.format(dateForFormatting(date)),
    balance: centsToEuros(balanceCents),
  }));
  const debtReliefMilestones = [...data.reliefMilestones].sort((a, b) => a.date.localeCompare(b.date)).map((milestone, index) => ({
    date: milestone.date,
    label: index === 0 ? 'Aktuell' : `Ab ${longMonth.format(dateForFormatting(milestone.date))}`,
    freeAmount: centsToEuros(milestone.freeAmountCents),
    event: milestone.event,
    eventDetail: milestone.eventDetail,
  }));

  return {
    meta: {
      asOf: data.asOf,
      asOfLabel: fullDate.format(dateForFormatting(data.asOf)),
      monthLabel: longMonth.format(dateForFormatting(data.asOf)),
      monthlyIncome: centsToEuros(data.monthlyIncomeCents),
      remainingDebtPayments: centsToEuros(selectRemainingDebtPaymentsCents(data)),
    },
    accounts,
    pockets,
    budgetCategories,
    necessityGroups: (Object.keys(necessityPresentation) as NecessityId[]).map((id) => ({
      id,
      ...necessityPresentation[id],
      amount: centsToEuros(necessityTotals[id]),
    })),
    debts,
    debtBalanceMilestones,
    debtReliefMilestones,
    totals: {
      currentCash: centsToEuros(selectCurrentAccountTotalCents(data)),
      plannedAmount: centsToEuros(selectPlannedAmountCents(data)),
      plannedReserves: centsToEuros(selectPlannedReserveCents(data)),
      freeMoney: centsToEuros(selectFreeMoneyCents(data)),
      freePercentage: selectFreePercentageBasisPoints(data) / 100,
      payoffToday: centsToEuros(selectCurrentPayoffCents(data)),
      futureDebtCost: centsToEuros(selectFutureDebtCostCents(data)),
      debtReliefGain: centsToEuros(selectDebtReliefGainCents(data)),
    },
  };
}
