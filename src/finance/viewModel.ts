import {
  selectCurrentAccountTotalCents,
  selectCurrentPayoffCents,
  selectFreeMoneyCents,
  selectFreePercentageBasisPoints,
  selectFutureDebtReliefMilestones,
  selectFutureDebtCostCents,
  selectLatestAccountSnapshot,
  selectLatestDebtSnapshot,
  selectLatestPocketSnapshot,
  selectNecessityTotalsCents,
  selectBudgetAllocationCents,
  selectBudgetStatusCents,
  selectOverviewAllocationCents,
  selectNextDebtReliefMilestone,
  selectNextFreeMoneyCents,
  selectPlannedAmountCents,
  selectPlannedReserveCents,
  selectRemainingPaymentCount,
  selectRemainingScheduledTotalCents,
} from './selectors';
import { selectUpcomingSummary } from './upcoming';
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
const eventList = new Intl.ListFormat('de-DE', { style: 'long', type: 'conjunction' });

export type FinanceViewModel = ReturnType<typeof createFinanceViewModel>;

type BudgetStatusBase = {
  balance: number;
  balanceCents: number;
  planned: number;
  plannedCents: number;
  utilizationBasisPoints: number | null;
};

export type BudgetStatus =
  | (BudgetStatusBase & { kind: 'empty' })
  | (BudgetStatusBase & { kind: 'within-budget' })
  | (BudgetStatusBase & { kind: 'overdrawn'; deficit: number; deficitCents: number });

export function createFinanceViewModel(data: FinanceDataV1) {
  const necessityTotals = selectNecessityTotalsCents(data);
  const overviewAllocation = selectOverviewAllocationCents(data);
  const budgetAllocation = selectBudgetAllocationCents(data);
  const selectedBudgetStatus = selectBudgetStatusCents(data);
  const commonBudgetStatus = {
    balance: centsToEuros(selectedBudgetStatus.balanceCents),
    balanceCents: selectedBudgetStatus.balanceCents,
    planned: centsToEuros(selectedBudgetStatus.plannedCents),
    plannedCents: selectedBudgetStatus.plannedCents,
    utilizationBasisPoints: selectedBudgetStatus.utilizationBasisPoints,
  };
  const budgetStatus: BudgetStatus = selectedBudgetStatus.kind === 'overdrawn'
    ? {
        kind: 'overdrawn',
        deficit: centsToEuros(selectedBudgetStatus.deficitCents),
        deficitCents: selectedBudgetStatus.deficitCents,
        ...commonBudgetStatus,
      }
    : { kind: selectedBudgetStatus.kind, ...commonBudgetStatus };
  const accounts = data.accounts.filter(({ active }) => active).sort((a, b) => a.displayOrder - b.displayOrder).map((account) => {
    const balanceCents = selectLatestAccountSnapshot(data, account.id)?.balanceCents ?? 0;
    return { ...account, balance: centsToEuros(balanceCents), balanceCents };
  });
  const pockets = data.pockets.filter(({ active }) => active).sort((a, b) => a.displayOrder - b.displayOrder).map((pocket) => {
    const balanceCents = selectLatestPocketSnapshot(data, pocket.id)?.balanceCents ?? 0;
    return { ...pocket, balance: centsToEuros(balanceCents), balanceCents };
  });
  const budgetCategories = data.budgetItems.filter(({ active }) => active).sort((a, b) => a.displayOrder - b.displayOrder).map((item) => ({
    id: item.id,
    label: item.label,
    amount: centsToEuros(item.monthlyAmountCents),
    amountCents: item.monthlyAmountCents,
    necessityId: item.necessityId,
    kind: item.kind,
    note: item.note,
  }));
  const debts = data.debts.filter(({ active }) => active).sort((a, b) => a.displayOrder - b.displayOrder).map((debt) => {
    const payoffBalanceCents = selectLatestDebtSnapshot(data, debt.id)?.payoffBalanceCents ?? 0;
    return {
      id: debt.id,
      name: debt.name,
      kind: debt.kind,
      supportingText: /\bdkb\b/i.test(debt.name)
        ? 'Kredit mit monatlicher Rate'
        : debt.note,
      monthlyPayment: centsToEuros(debt.monthlyPaymentCents),
      monthlyPaymentCents: debt.monthlyPaymentCents,
      payoffBalance: centsToEuros(payoffBalanceCents),
      payoffBalanceCents,
    };
  });
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
    balanceCents,
  }));
  let projectedFreeCents = selectFreeMoneyCents(data);
  const futureReliefMilestones = selectFutureDebtReliefMilestones(data);
  const presentReliefEvent = ({ event, eventDetail }: { event: string; eventDetail: string | null }) => {
    const machineFacing = event === 'debt-payment-ends' || /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(event);
    return machineFacing ? (eventDetail?.trim() || 'Eine Finanzierung') : event;
  };
  const debtReliefMilestones = [
    {
      date: data.asOf,
      label: 'Aktuell',
      monthLabel: longMonth.format(dateForFormatting(data.asOf)),
      freeAmount: centsToEuros(projectedFreeCents),
      freeAmountCents: projectedFreeCents,
      event: null,
      eventDetail: null,
    },
    ...futureReliefMilestones.map((milestone) => {
      projectedFreeCents += milestone.monthlyReliefCents;
      const monthLabel = longMonth.format(dateForFormatting(milestone.date));
      return {
        date: milestone.date,
        label: `Nach ${monthLabel}`,
        monthLabel,
        freeAmount: centsToEuros(projectedFreeCents),
        freeAmountCents: projectedFreeCents,
        event: eventList.format(milestone.events.map(presentReliefEvent)),
        eventDetail: milestone.events
          .filter(({ event }) => event !== 'debt-payment-ends' && !/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(event))
          .map(({ eventDetail }) => eventDetail)
          .filter((detail) => detail !== null)
          .join(' · ') || null,
      };
    }),
  ];
  const nextReliefMilestone = selectNextDebtReliefMilestone(data);
  const nextFreeMoneyCents = selectNextFreeMoneyCents(data);
  const nextDebtRelief = nextReliefMilestone && nextFreeMoneyCents !== null ? {
    date: nextReliefMilestone.date,
    monthLabel: longMonth.format(dateForFormatting(nextReliefMilestone.date)),
    eventLabel: eventList.format(nextReliefMilestone.events.map(presentReliefEvent)),
    eventCount: nextReliefMilestone.events.length,
    monthlyRelief: centsToEuros(nextReliefMilestone.monthlyReliefCents),
    monthlyReliefCents: nextReliefMilestone.monthlyReliefCents,
    freeAfter: centsToEuros(nextFreeMoneyCents),
    freeAfterCents: nextFreeMoneyCents,
  } : null;

  const upcomingSummary = selectUpcomingSummary(data);
  const currentCashCents = selectCurrentAccountTotalCents(data);
  const plannedAmountCents = selectPlannedAmountCents(data);
  const plannedReservesCents = selectPlannedReserveCents(data);
  const freeMoneyCents = selectFreeMoneyCents(data);
  const freePercentageBasisPoints = selectFreePercentageBasisPoints(data);
  const payoffTodayCents = selectCurrentPayoffCents(data);
  const remainingScheduledTotalCents = selectRemainingScheduledTotalCents(data);
  const futureDebtCostCents = selectFutureDebtCostCents(data);

  return {
    meta: {
      asOf: data.asOf,
      asOfLabel: fullDate.format(dateForFormatting(data.asOf)),
      monthLabel: longMonth.format(dateForFormatting(data.asOf)),
      monthlyIncome: centsToEuros(data.monthlyIncomeCents),
      monthlyIncomeCents: data.monthlyIncomeCents,
      remainingPaymentCount: selectRemainingPaymentCount(data),
    },
    accounts,
    pockets,
    budgetCategories,
    budgetStatus,
    necessityGroups: (Object.keys(necessityPresentation) as NecessityId[]).map((id) => ({
      id,
      ...necessityPresentation[id],
      amount: centsToEuros(necessityTotals[id]),
      amountCents: budgetAllocation.necessityCents[id],
    })),
    debts,
    debtBalanceMilestones,
    debtReliefMilestones,
    nextDebtRelief,
    upcoming: {
      salaryDay: upcomingSummary.salaryDay,
      nextSalaryDate: upcomingSummary.nextSalaryDate,
      nextSalaryDateLabel: upcomingSummary.nextSalaryDate ? fullDate.format(dateForFormatting(upcomingSummary.nextSalaryDate)) : null,
      totalPending: centsToEuros(upcomingSummary.totalPendingCents),
      totalPendingCents: upcomingSummary.totalPendingCents,
      safeToSpend: centsToEuros(upcomingSummary.safeToSpendCents),
      safeToSpendCents: upcomingSummary.safeToSpendCents,
      payments: upcomingSummary.payments.map((p) => ({
        ...p,
        amount: centsToEuros(p.amountCents),
        dueDateLabel: fullDate.format(dateForFormatting(p.dueDate)),
      })),
    },
    allocations: {
      budget: budgetAllocation,
      overview: overviewAllocation,
    },
    totals: {
      currentCash: centsToEuros(currentCashCents),
      currentCashCents,
      plannedAmount: centsToEuros(plannedAmountCents),
      plannedAmountCents,
      plannedReserves: centsToEuros(plannedReservesCents),
      plannedReservesCents,
      freeMoney: centsToEuros(freeMoneyCents),
      freeMoneyCents,
      freePercentage: freePercentageBasisPoints === null ? null : freePercentageBasisPoints / 100,
      payoffToday: centsToEuros(payoffTodayCents),
      payoffTodayCents,
      remainingScheduledTotal: centsToEuros(remainingScheduledTotalCents),
      remainingScheduledTotalCents,
      futureDebtCost: centsToEuros(futureDebtCostCents),
      futureDebtCostCents,
    },
  };
}
