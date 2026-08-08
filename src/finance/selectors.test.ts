import { describe, expect, it } from 'vitest';
import { anonymousSheetsResponse } from '../mocks/anonymousWorkbook';
import { parseSheetsBatchResponse } from './parser';
import {
  selectCurrentAccountTotalCents,
  selectCurrentPayoffCents,
  selectCurrentPocketTotalCents,
  selectFreeMoneyCents,
  selectFreePercentageBasisPoints,
  selectFutureDebtCostCents,
  selectLatestAccountSnapshot,
  selectNecessityTotalsCents,
  selectPlannedAmountCents,
  selectPlannedReserveCents,
  selectRemainingDebtPaymentsCents,
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
    expect(selectFreeMoneyCents(data)).toBe(55_000);
    expect(selectFreePercentageBasisPoints(data)).toBe(1833);
    expect(selectNecessityTotalsCents(data)).toEqual({
      essential: 160_000,
      necessary: 40_000,
      worthwhile: 30_000,
      optional: 10_000,
      unnecessary: 5_000,
    });
  });

  it('derives debt totals and future additional cost', () => {
    expect(selectCurrentPayoffCents(data)).toBe(530_000);
    expect(selectRemainingDebtPaymentsCents(data)).toBe(636_000);
    expect(selectFutureDebtCostCents(data)).toBe(106_000);
  });

  it('creates localized, UI-ready values only at the presentation boundary', () => {
    const view = createFinanceViewModel(data);
    expect(view.meta.asOfLabel).toBe('08.08.2026');
    expect(view.meta.monthLabel).toBe('August 2026');
    expect(view.totals.currentCash).toBe(1350.75);
    expect(view.debtBalanceMilestones.map(({ balance }) => balance)).toEqual([5300, 3500, 1700, 0]);
  });
});
