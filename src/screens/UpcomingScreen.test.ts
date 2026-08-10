import { describe, expect, it } from 'vitest';
import { createFinanceViewModel } from '../finance/viewModel';
import { validateFinanceWorkbook } from '../finance/parser';
import { anonymousWorkbook } from '../mocks/anonymousWorkbook';
import type { FinanceDataV1, TabularWorkbook } from '../finance/types';

const parsed = validateFinanceWorkbook(anonymousWorkbook as TabularWorkbook);
if (!parsed.success) throw new Error('Anonymous workbook invalid');
const baseData = parsed.data;

describe('UpcomingScreen view model integration', () => {
  it('prepares formatted upcoming data for UpcomingScreen from FinanceDataV1', () => {
    const viewModel = createFinanceViewModel(baseData);
    const upcoming = viewModel.upcoming;

    expect(upcoming.salaryDay).toBe(25);
    expect(upcoming.nextSalaryDate).toBe('2026-08-25');
    expect(upcoming.nextSalaryDateLabel).toBe('25.08.2026');
    expect(upcoming.totalPending).toBe(320.22);
    expect(upcoming.totalPendingCents).toBe(32022);
    expect(upcoming.safeToSpend).toBe(1030.53); // 1350.75 cash - 320.22 pending = 1030.53
    expect(upcoming.payments).toHaveLength(2);

    expect(upcoming.payments[0]).toMatchObject({
      id: 'insurance',
      name: 'Versicherungen',
      amount: 100,
      dueDay: 15,
      dueDate: '2026-08-15',
      dueDateLabel: '15.08.2026',
      source: 'budget',
      isShortlyBeforeSalary: false,
    });

    expect(upcoming.payments[1]).toMatchObject({
      id: 'dkb',
      name: 'DKB',
      amount: 220.22,
      dueDay: 20,
      dueDate: '2026-08-20',
      dueDateLabel: '20.08.2026',
      source: 'debt',
      isShortlyBeforeSalary: true,
    });
  });

  it('handles missing salary configuration cleanly', () => {
    const noSalaryData: FinanceDataV1 = { ...baseData, salaryDay: null };
    const viewModel = createFinanceViewModel(noSalaryData);
    const upcoming = viewModel.upcoming;

    expect(upcoming.salaryDay).toBeNull();
    expect(upcoming.nextSalaryDate).toBeNull();
    expect(upcoming.nextSalaryDateLabel).toBeNull();
    expect(upcoming.payments).toEqual([]);
    expect(upcoming.totalPending).toBe(0);
    expect(upcoming.safeToSpend).toBe(viewModel.totals.currentCash);
  });

  it('handles negative safeToSpend when pending payments exceed cash total', () => {
    const highPendingData: FinanceDataV1 = {
      ...baseData,
      salaryDay: 25,
      budgetItems: [
        ...baseData.budgetItems,
        {
          id: 'large-rent',
          label: 'Große Miete',
          monthlyAmountCents: 200000,
          necessityId: 'essential',
          kind: 'expense',
          displayOrder: 99,
          active: true,
          note: null,
          dueDay: 15,
        },
      ],
    };
    const viewModel = createFinanceViewModel(highPendingData);
    const upcoming = viewModel.upcoming;

    expect(upcoming.totalPending).toBe(2320.22);
    expect(upcoming.safeToSpend).toBe(-969.47); // 1350.75 - 2320.22 = -969.47
  });
});
