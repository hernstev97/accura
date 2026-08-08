import type { AccountSnapshotV1, DebtSnapshotV1, FinanceDataV1, NecessityId, PocketSnapshotV1 } from './types';

const sumCents = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

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

export const selectNecessityTotalsCents = (data: FinanceDataV1): Record<NecessityId, number> => {
  const result: Record<NecessityId, number> = { essential: 0, necessary: 0, worthwhile: 0, optional: 0, unnecessary: 0 };
  data.budgetItems.filter(({ active }) => active).forEach(({ necessityId, monthlyAmountCents }) => {
    result[necessityId] += monthlyAmountCents;
  });
  return result;
};

export const selectCurrentPayoffCents = (data: FinanceDataV1) => sumCents(
  data.debts.filter(({ active }) => active).map(({ id }) => selectLatestDebtSnapshot(data, id)?.payoffBalanceCents ?? 0),
);

export const selectRemainingDebtPaymentsCents = (data: FinanceDataV1) => sumCents(
  data.debts.filter(({ active }) => active).map(({ id }) => selectLatestDebtSnapshot(data, id)?.remainingPaymentsCents ?? 0),
);

export const selectFutureDebtCostCents = (data: FinanceDataV1) => selectRemainingDebtPaymentsCents(data) - selectCurrentPayoffCents(data);

export const selectDebtReliefGainCents = (data: FinanceDataV1) => {
  const sorted = [...data.reliefMilestones].sort((a, b) => a.date.localeCompare(b.date));
  return (sorted.at(-1)?.freeAmountCents ?? 0) - (sorted[0]?.freeAmountCents ?? 0);
};
