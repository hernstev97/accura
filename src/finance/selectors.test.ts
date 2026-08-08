import { describe, expect, it } from 'vitest';
import { anonymousSheetsResponse } from '../mocks/anonymousWorkbook';
import { parseSheetsBatchResponse } from './parser';
import {
  selectCurrentAccountTotalCents,
  selectCurrentPayoffCents,
  selectCurrentPocketTotalCents,
  selectFreeMoneyCents,
  selectFreePercentageBasisPoints,
  selectFutureDebtReliefMilestones,
  selectFutureDebtCostCents,
  selectLatestAccountSnapshot,
  selectNecessityTotalsCents,
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

  it('keeps installment counts separate from cent-based scheduled totals', () => {
    expect(data.debtSnapshots.map(({ remainingPaymentCount }) => remainingPaymentCount)).toEqual([86, 1, 5, 3, 4]);
    expect(data.debtSnapshots.map(({ remainingScheduledTotalCents }) => remainingScheduledTotalCents)).toEqual([
      1_893_914,
      16_424,
      19_352,
      5_515,
      2_000,
    ]);
    expect(selectRemainingPaymentCount(data)).toBe(99);
    expect(selectRemainingScheduledTotalCents(data)).toBe(1_937_205);
    expect(selectCurrentPayoffCents(data)).toBe(1_432_293);
    expect(selectFutureDebtCostCents(data)).toBe(504_912);
    expect(Number.isSafeInteger(selectRemainingScheduledTotalCents(data))).toBe(true);
    expect(Number.isSafeInteger(selectFutureDebtCostCents(data))).toBe(true);
  });

  it('selects Coolblue as the earliest future relief from an unsorted list without mutating it', () => {
    const reliefMilestonesBefore = structuredClone(data.reliefMilestones);

    expect(data.reliefMilestones[0]?.event).toBe('DKB');
    expect(selectNextDebtReliefMilestone(data)).toEqual({
      date: '2026-09',
      monthlyReliefCents: 16_400,
      events: [{ event: 'Coolblue', eventDetail: 'Letzte Rate' }],
    });
    expect(selectNextFreeMoneyCents(data)).toBe(30_532);
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

    expect(selectNextDebtReliefMilestone(withPastMilestone)?.events[0]?.event).toBe('Coolblue');
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
      monthlyReliefCents: 17_400,
      events: [
        { event: 'Alpha', eventDetail: 'Gleicher Monat' },
        { event: 'Coolblue', eventDetail: 'Letzte Rate' },
      ],
    });
    expect(selectNextFreeMoneyCents(withSameMonthMilestone)).toBe(31_532);
  });

  it('represents the absence of future relief explicitly', () => {
    const afterAllMilestones = { ...data, asOf: '2034-01-01' };

    expect(selectNextDebtReliefMilestone(afterAllMilestones)).toBeUndefined();
    expect(selectNextFreeMoneyCents(afterAllMilestones)).toBeNull();
    expect(createFinanceViewModel(afterAllMilestones).nextDebtRelief).toBeNull();
  });

  it('creates localized, UI-ready values only at the presentation boundary', () => {
    const view = createFinanceViewModel(data);
    expect(view.meta.asOfLabel).toBe('08.08.2026');
    expect(view.meta.monthLabel).toBe('August 2026');
    expect(view.totals.currentCash).toBe(1350.75);
    expect(view.nextDebtRelief).toMatchObject({ eventLabel: 'Coolblue', monthlyRelief: 164, freeAfter: 305.32 });
    expect(view.debtBalanceMilestones.map(({ balance }) => balance)).toEqual([14322.93, 13000, 8000, 0]);
  });
});
