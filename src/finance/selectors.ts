import type {
  AccountSnapshotV1,
  DebtSnapshotV1,
  FinanceDataV1,
  NecessityId,
  PocketSnapshotV1,
  ReliefMilestoneV1,
} from './types';

const sumCents = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
const sumCounts = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

function latestOnOrBefore<T>(records: T[], asOf: string, date: (record: T) => string): T | undefined {
  return records.filter((record) => date(record) <= asOf).sort((a, b) => date(b).localeCompare(date(a)))[0];
}

export const selectLatestAccountSnapshot = (data: FinanceDataV1, accountId: string): AccountSnapshotV1 | undefined =>
  latestOnOrBefore(data.accountSnapshots.filter((snapshot) => snapshot.accountId === accountId), data.asOf, (snapshot) => snapshot.asOf);

export const selectLatestPocketSnapshot = (data: FinanceDataV1, pocketId: string): PocketSnapshotV1 | undefined =>
  latestOnOrBefore(data.pocketSnapshots.filter((snapshot) => snapshot.pocketId === pocketId), data.asOf, (snapshot) => snapshot.asOf);

export const selectLatestDebtSnapshot = (data: FinanceDataV1, debtId: string): DebtSnapshotV1 | undefined =>
  latestOnOrBefore(data.debtSnapshots.filter((snapshot) => snapshot.debtId === debtId), data.asOf, (snapshot) => snapshot.asOf);

export const selectCurrentAccountTotalCents = (data: FinanceDataV1) => sumCents(
  data.accounts.filter(({ active }) => active).map(({ id }) => selectLatestAccountSnapshot(data, id)?.balanceCents ?? 0),
);

export const selectCurrentPocketTotalCents = (data: FinanceDataV1) => sumCents(
  data.pockets.filter(({ active }) => active).map(({ id }) => selectLatestPocketSnapshot(data, id)?.balanceCents ?? 0),
);

export const selectPlannedAmountCents = (data: FinanceDataV1) => sumCents(
  data.budgetItems.filter(({ active }) => active).map(({ monthlyAmountCents }) => monthlyAmountCents),
);

export const selectPlannedReserveCents = (data: FinanceDataV1) => sumCents(
  data.budgetItems.filter(({ active, kind }) => active && kind === 'reserve').map(({ monthlyAmountCents }) => monthlyAmountCents),
);

export const selectFreeMoneyCents = (data: FinanceDataV1) => data.monthlyIncomeCents - selectPlannedAmountCents(data);

export const selectFreePercentageBasisPoints = (data: FinanceDataV1) => data.monthlyIncomeCents === 0
  ? 0
  : Math.round((selectFreeMoneyCents(data) * 10_000) / data.monthlyIncomeCents);

export type OverviewAllocationCents = {
  expensesCents: number;
  freeCents: number;
  incomeCents: number;
  reservesCents: number;
};

/**
 * Canonical overview allocation. Every value remains in integer cents and the
 * three displayed roles reconcile exactly to the imported monthly income.
 */
export const selectOverviewAllocationCents = (data: FinanceDataV1): OverviewAllocationCents => {
  const reservesCents = selectPlannedReserveCents(data);
  const plannedCents = selectPlannedAmountCents(data);
  return {
    expensesCents: plannedCents - reservesCents,
    freeCents: data.monthlyIncomeCents - plannedCents,
    incomeCents: data.monthlyIncomeCents,
    reservesCents,
  };
};

export const selectNecessityTotalsCents = (data: FinanceDataV1): Record<NecessityId, number> => {
  const result: Record<NecessityId, number> = { essential: 0, necessary: 0, worthwhile: 0, optional: 0, unnecessary: 0 };
  data.budgetItems.filter(({ active }) => active).forEach(({ necessityId, monthlyAmountCents }) => {
    result[necessityId] += monthlyAmountCents;
  });
  return result;
};

export const selectBudgetAllocationCents = (data: FinanceDataV1) => ({
  freeCents: selectFreeMoneyCents(data),
  incomeCents: data.monthlyIncomeCents,
  necessityCents: selectNecessityTotalsCents(data),
});

export const selectCurrentPayoffCents = (data: FinanceDataV1) => sumCents(
  data.debts.filter(({ active }) => active).map(({ id }) => selectLatestDebtSnapshot(data, id)?.payoffBalanceCents ?? 0),
);

export const selectRemainingPaymentCount = (data: FinanceDataV1) => sumCounts(
  data.debts.filter(({ active }) => active).map(({ id }) => selectLatestDebtSnapshot(data, id)?.remainingPaymentCount ?? 0),
);

export const selectRemainingScheduledTotalCents = (data: FinanceDataV1) => sumCents(
  data.debts.filter(({ active }) => active).map(({ id }) => selectLatestDebtSnapshot(data, id)?.remainingScheduledTotalCents ?? 0),
);

export const selectFutureDebtCostCents = (data: FinanceDataV1) => selectRemainingScheduledTotalCents(data) - selectCurrentPayoffCents(data);

export type DebtReliefMilestoneGroup = {
  date: string;
  monthlyReliefCents: number;
  events: Pick<ReliefMilestoneV1, 'event' | 'eventDetail'>[];
};

const milestoneSort = (a: ReliefMilestoneV1, b: ReliefMilestoneV1) =>
  a.date.localeCompare(b.date)
  || a.event.localeCompare(b.event, 'de-DE')
  || (a.eventDetail ?? '').localeCompare(b.eventDetail ?? '', 'de-DE');

const isFutureMilestone = (milestone: ReliefMilestoneV1, asOf: string) =>
  (milestone.date.length === 7 ? `${milestone.date}-01` : milestone.date) > asOf;

export const selectFutureDebtReliefMilestones = (data: FinanceDataV1): DebtReliefMilestoneGroup[] => {
  const groups = new Map<string, DebtReliefMilestoneGroup>();
  [...data.reliefMilestones]
    .sort(milestoneSort)
    .filter((milestone) => isFutureMilestone(milestone, data.asOf))
    .forEach((milestone) => {
      const month = milestone.date.slice(0, 7);
      const existing = groups.get(month);
      if (existing) {
        existing.monthlyReliefCents += milestone.monthlyReliefCents;
        existing.events.push({ event: milestone.event, eventDetail: milestone.eventDetail });
      } else {
        groups.set(month, {
          date: month,
          monthlyReliefCents: milestone.monthlyReliefCents,
          events: [{ event: milestone.event, eventDetail: milestone.eventDetail }],
        });
      }
    });
  return [...groups.values()];
};

export const selectNextDebtReliefMilestone = (data: FinanceDataV1) => selectFutureDebtReliefMilestones(data)[0];

export const selectNextFreeMoneyCents = (data: FinanceDataV1) => {
  const next = selectNextDebtReliefMilestone(data);
  return next ? selectFreeMoneyCents(data) + next.monthlyReliefCents : null;
};
