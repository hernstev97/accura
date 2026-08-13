import { describe, expect, it } from 'vitest';
import { anonymousSheetsResponse } from '../mocks/anonymousWorkbook';
import { parseSheetsBatchResponse } from './parser';
import {
  selectCurrentAccountTotalCents,
  selectCurrentPayoffCents,
  selectCurrentPocketTotalCents,
  selectDebtBalanceMilestoneTotals,
  selectFreeMoneyCents,
  selectFreePercentageBasisPoints,
  selectFutureDebtReliefMilestones,
  selectFutureDebtCostCents,
  selectLatestAccountSnapshot,
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
import { createFinanceViewModel } from './viewModel';

const parsed = parseSheetsBatchResponse(anonymousSheetsResponse);
if (!parsed.success) throw new Error('Anonymous test workbook must be valid.');
const data = parsed.data;

describe('cent-based finance selectors', () => {
  it('chooses the latest snapshots on or before _Meta.as_of', () => {
    expect(selectLatestAccountSnapshot(data, 'daily-account')?.asOf).toBe('2026-08-08');
    expect(selectLatestAccountSnapshot(data, 'daily-account')?.balanceCents).toBe(120_025);
  });

  it('derives account and pocket totals', () => {
    expect(selectCurrentAccountTotalCents(data)).toBe(135_075);
    expect(selectCurrentPocketTotalCents(data)).toBe(55_025);
  });

  it('derives the complete monthly budget in integer cents', () => {
    expect(selectPlannedAmountCents(data)).toBe(245_000);
    expect(selectPlannedReserveCents(data)).toBe(30_000);
    expect(selectFreeMoneyCents(data)).toBe(14_132);
    expect(selectFreePercentageBasisPoints(data)).toBe(545);
    expect(selectNecessityTotalsCents(data)).toEqual({
      essential: 160_000,
      necessary: 40_000,
      worthwhile: 30_000,
      optional: 10_000,
      unnecessary: 5_000,
    });
  });

  it('reconciles overview and Budget ring allocations exactly to monthly income', () => {
    const overview = selectOverviewAllocationCents(data);
    expect(overview).toEqual({ expensesCents: 215_000, reservesCents: 30_000, freeCents: 14_132, incomeCents: 259_132 });
    expect(overview.expensesCents + overview.reservesCents + overview.freeCents).toBe(overview.incomeCents);

    const budget = selectBudgetAllocationCents(data);
    expect(Object.values(budget.necessityCents).reduce((sum, amount) => sum + amount, 0) + budget.freeCents).toBe(budget.incomeCents);
  });

  it('classifies empty, within-budget, exact, and overdrawn budgets in cents', () => {
    expect(selectBudgetStatusCents({ ...data, budgetItems: [] })).toEqual({
      kind: 'empty',
      balanceCents: data.monthlyIncomeCents,
      plannedCents: 0,
      utilizationBasisPoints: 0,
    });

    expect(selectBudgetStatusCents(data)).toEqual({
      kind: 'within-budget',
      balanceCents: 14_132,
      plannedCents: 245_000,
      utilizationBasisPoints: 9_455,
    });

    expect(selectBudgetStatusCents({ ...data, monthlyIncomeCents: 245_000 })).toEqual({
      kind: 'within-budget',
      balanceCents: 0,
      plannedCents: 245_000,
      utilizationBasisPoints: 10_000,
    });

    expect(selectBudgetStatusCents({ ...data, monthlyIncomeCents: 100_000 })).toEqual({
      kind: 'overdrawn',
      balanceCents: -145_000,
      deficitCents: 145_000,
      plannedCents: 245_000,
      utilizationBasisPoints: 24_500,
    });
  });

  it('does not invent budget utilization without positive income', () => {
    expect(selectBudgetStatusCents({ ...data, monthlyIncomeCents: 0 })).toMatchObject({
      kind: 'overdrawn',
      utilizationBasisPoints: null,
    });
    expect(selectFreePercentageBasisPoints({ ...data, monthlyIncomeCents: 0 })).toBeNull();

    const negativeEmptyBudget = { ...data, monthlyIncomeCents: -12_345, budgetItems: [] };
    expect(selectBudgetStatusCents(negativeEmptyBudget)).toEqual({
      kind: 'empty',
      balanceCents: -12_345,
      plannedCents: 0,
      utilizationBasisPoints: null,
    });
    expect(selectFreePercentageBasisPoints(negativeEmptyBudget)).toBeNull();
  });

  it('calculates percentages for large safe cent values without unsafe intermediate multiplication', () => {
    const large = {
      ...data,
      monthlyIncomeCents: 9_000_000_000_000_000,
      budgetItems: [{ ...data.budgetItems[0]!, monthlyAmountCents: 4_500_000_000_000_000 }],
    };

    expect(selectFreePercentageBasisPoints(large)).toBe(5_000);
    expect(selectBudgetStatusCents(large).utilizationBasisPoints).toBe(5_000);
  });

  it('keeps installment counts separate from cent-based scheduled totals', () => {
    expect(data.debtSnapshots.map(({ remainingPaymentCount }) => remainingPaymentCount)).toEqual([60, 1, 4, 3, 2]);
    expect(data.debtSnapshots.map(({ remainingScheduledTotalCents }) => remainingScheduledTotalCents)).toEqual([
      1_500_000,
      12_000,
      24_000,
      9_000,
      3_000,
    ]);
    expect(selectRemainingPaymentCount(data)).toBe(70);
    expect(selectRemainingScheduledTotalCents(data)).toBe(1_548_000);
    expect(selectCurrentPayoffCents(data)).toBe(1_282_567);
    expect(selectFutureDebtCostCents(data)).toBe(265_433);
    expect(Number.isSafeInteger(selectRemainingScheduledTotalCents(data))).toBe(true);
    expect(Number.isSafeInteger(selectFutureDebtCostCents(data))).toBe(true);
  });

  it('selects Finanzierung A as the earliest future relief from an unsorted list without mutating it', () => {
    const reliefMilestonesBefore = structuredClone(data.reliefMilestones);

    expect(data.reliefMilestones[0]?.event).toBe('Ratenkredit');
    expect(selectNextDebtReliefMilestone(data)).toEqual({
      date: '2026-09',
      monthlyReliefCents: 12_000,
      events: [{ event: 'Finanzierung A', eventDetail: 'Letzte Rate' }],
    });
    expect(selectNextFreeMoneyCents(data)).toBe(26_132);
    expect(data.reliefMilestones).toEqual(reliefMilestonesBefore);
  });

  it('ignores past milestones based on the imported as_of date', () => {
    const withPastMilestone = {
      ...data,
      reliefMilestones: [
        ...data.reliefMilestones,
        { date: '2026-07', monthlyReliefCents: 999_999, event: 'Vergangenheit', eventDetail: null },
      ],
    };

    expect(selectNextDebtReliefMilestone(withPastMilestone)?.events[0]?.event).toBe('Finanzierung A');
  });

  it('groups same-month milestones deterministically and adds their monthly relief', () => {
    const withSameMonthMilestone = {
      ...data,
      reliefMilestones: [
        ...data.reliefMilestones,
        { date: '2026-09', monthlyReliefCents: 1_000, event: 'Alpha', eventDetail: 'Gleicher Monat' },
      ],
    };

    expect(selectFutureDebtReliefMilestones(withSameMonthMilestone)[0]).toEqual({
      date: '2026-09',
      monthlyReliefCents: 13_000,
      events: [
        { event: 'Alpha', eventDetail: 'Gleicher Monat' },
        { event: 'Finanzierung A', eventDetail: 'Letzte Rate' },
      ],
    });
    expect(selectNextFreeMoneyCents(withSameMonthMilestone)).toBe(27_132);
  });

  it('represents the absence of future relief explicitly', () => {
    const afterAllMilestones = { ...data, asOf: '2034-01-01' };

    expect(selectNextDebtReliefMilestone(afterAllMilestones)).toBeUndefined();
    expect(selectNextFreeMoneyCents(afterAllMilestones)).toBeNull();
    expect(createFinanceViewModel(afterAllMilestones, afterAllMilestones.asOf).nextDebtRelief).toBeNull();
  });

  it('creates localized, UI-ready values only at the presentation boundary', () => {
    const view = createFinanceViewModel(data, data.asOf);
    expect(view.meta.asOfLabel).toBe('08.08.2026');
    expect(view.meta.monthLabel).toBe('August 2026');
    expect(view.totals.currentCash).toBe(1350.75);
    expect(view.totals.currentCashCents).toBe(135_075);
    expect(view.nextDebtRelief).toMatchObject({ eventLabel: 'Finanzierung A', monthlyRelief: 120, freeAfter: 261.32 });
    expect(view.nextDebtRelief).toMatchObject({ monthlyReliefCents: 12_000, freeAfterCents: 26_132 });
    expect(view.debtReliefMilestones[1]).toMatchObject({ event: 'Finanzierung A', eventDetail: 'Letzte Rate' });
    expect(view.debtBalanceMilestones.map(({ balance }) => balance)).toEqual([12825.67, 12705.67, 12615.67, 12585.67, 11000, 5000, 0]);
    expect(view.debtBalanceMilestones.map(({ balanceCents }) => balanceCents)).toEqual([1_282_567, 1_270_567, 1_261_567, 1_258_567, 1_100_000, 500_000, 0]);
    expect(view.budgetStatus).toEqual({
      kind: 'within-budget',
      balance: 141.32,
      balanceCents: 14_132,
      planned: 2450,
      plannedCents: 245_000,
      utilizationBasisPoints: 9_455,
    });
  });

  it('keeps machine event codes and a raw loan note out of presentation values', () => {
    const withCopyLeaks = {
      ...data,
      debts: data.debts.map((debt) => debt.kind === 'loan' ? { ...debt, note: 'Raw English spreadsheet instruction' } : debt),
      reliefMilestones: [
        { date: '2026-09', monthlyReliefCents: 12_000, event: 'debt-payment-ends', eventDetail: 'Finanzierung A' },
      ],
    };
    const view = createFinanceViewModel(withCopyLeaks, withCopyLeaks.asOf);
    expect(view.nextDebtRelief?.eventLabel).toBe('Finanzierung A');
    expect(view.nextDebtRelief?.eventLabel).not.toContain('debt-payment-ends');
    expect(view.debts.find(({ kind }) => kind === 'loan')?.supportingText).toBe('Kredit mit monatlicher Rate');
  });

  it('carries unchanged synthetic debt balances through creditor-specific milestones', () => {
    expect(selectDebtBalanceMilestoneTotals(data)).toEqual([
      { date: '2026-08-08', balanceCents: 1_282_567 },
      { date: '2026-09', balanceCents: 1_270_567 },
      { date: '2026-10', balanceCents: 1_261_567 },
      { date: '2026-12', balanceCents: 1_258_567 },
      { date: '2027-01', balanceCents: 1_100_000 },
      { date: '2029-01', balanceCents: 500_000 },
      { date: '2031-08', balanceCents: 0 },
    ]);
  });

  it('keeps the debt trajectory empty when no milestones are configured', () => {
    expect(selectDebtBalanceMilestoneTotals({ ...data, debtMilestones: [] })).toEqual([]);
  });

  it('keeps the debt trajectory empty when all milestones are on or before the data date', () => {
    const pastMilestonesOnly = data.debtMilestones.filter(({ date }) => date <= '2026-08');

    expect(pastMilestonesOnly.length).toBeGreaterThan(0);
    expect(selectDebtBalanceMilestoneTotals({ ...data, debtMilestones: pastMilestonesOnly })).toEqual([]);
  });
});
