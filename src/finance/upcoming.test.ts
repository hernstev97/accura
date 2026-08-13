import { describe, expect, it } from 'vitest';
import { anonymousWorkbook } from '../mocks/anonymousWorkbook';
import { validateFinanceWorkbook } from './parser';
import {
  addCalendarDays,
  getDaysInMonth,
  getNextOccurrenceDate,
  getNextSalaryDate,
  getValidDay,
  isShortlyBeforeSalary,
  selectSafeToSpendCents,
  selectUpcomingPayments,
  selectUpcomingPaymentsTotalCents,
  selectUpcomingSummary,
} from './upcoming';
import type { FinanceDataV1, TabularWorkbook } from './types';

describe('Upcoming recurring payments calculation domain logic', () => {
  describe('Month length and day clamping logic', () => {
    it('returns correct days in month for leap and non-leap years', () => {
      expect(getDaysInMonth(2026, 2)).toBe(28);
      expect(getDaysInMonth(2028, 2)).toBe(29);
      expect(getDaysInMonth(2000, 2)).toBe(29);
      expect(getDaysInMonth(1900, 2)).toBe(28);
      expect(getDaysInMonth(2026, 4)).toBe(30);
      expect(getDaysInMonth(2026, 3)).toBe(31);
    });

    it('clamps target day to maximum valid day of month', () => {
      expect(getValidDay(2026, 2, 31)).toBe(28);
      expect(getValidDay(2028, 2, 31)).toBe(29);
      expect(getValidDay(2026, 4, 31)).toBe(30);
      expect(getValidDay(2026, 1, 31)).toBe(31);
      expect(getValidDay(2026, 8, 15)).toBe(15);
    });

    it('adds and subtracts calendar days across month and year boundaries without timezone drift', () => {
      expect(addCalendarDays('2026-02-28', 1)).toBe('2026-03-01');
      expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
      expect(addCalendarDays('2028-02-28', 2)).toBe('2028-03-01');
      expect(addCalendarDays('2026-03-02', -7)).toBe('2026-02-23');
      expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    });
  });

  describe('Salary date determination (getNextSalaryDate)', () => {
    it('determines salary date later in current month', () => {
      expect(getNextSalaryDate('2026-08-10', 25)).toBe('2026-08-25');
    });

    it('determines next salary date when salary day already passed this month', () => {
      expect(getNextSalaryDate('2026-08-26', 25)).toBe('2026-09-25');
    });

    it('returns today when today is salary day', () => {
      expect(getNextSalaryDate('2026-08-25', 25)).toBe('2026-08-25');
    });

    it('handles year rollover from December to January', () => {
      expect(getNextSalaryDate('2026-12-28', 25)).toBe('2027-01-25');
    });

    it('clamps salary day 29, 30, or 31 in shorter target months (Feb, Apr, etc.)', () => {
      expect(getNextSalaryDate('2026-02-01', 31)).toBe('2026-02-28');
      expect(getNextSalaryDate('2028-02-01', 31)).toBe('2028-02-29');
      expect(getNextSalaryDate('2026-04-01', 31)).toBe('2026-04-30');
    });

    it('returns null when no salary configuration is provided or day is invalid', () => {
      expect(getNextSalaryDate('2026-08-10', null)).toBeNull();
      expect(getNextSalaryDate('2026-08-10', 0)).toBeNull();
      expect(getNextSalaryDate('2026-08-10', 32)).toBeNull();
    });
  });

  describe('Next occurrence determination (getNextOccurrenceDate)', () => {
    it('determines next occurrence later in current month', () => {
      expect(getNextOccurrenceDate('2026-08-10', 15)).toBe('2026-08-15');
    });

    it('determines next occurrence in next month if passed this month', () => {
      expect(getNextOccurrenceDate('2026-08-16', 15)).toBe('2026-09-15');
    });

    it('returns today when payment is due today', () => {
      expect(getNextOccurrenceDate('2026-08-15', 15)).toBe('2026-08-15');
    });

    it('clamps payment day in shorter months', () => {
      expect(getNextOccurrenceDate('2026-02-01', 30)).toBe('2026-02-28');
      expect(getNextOccurrenceDate('2028-02-01', 30)).toBe('2028-02-29');
    });

    it('returns null when dueDay is null', () => {
      expect(getNextOccurrenceDate('2026-08-10', null)).toBeNull();
    });
  });

  describe('Shortly before salary identification (isShortlyBeforeSalary)', () => {
    it('identifies payments within the 7 calendar day threshold before salary', () => {
      expect(isShortlyBeforeSalary('2026-08-18', '2026-08-25')).toBe(true); // 7 days before
      expect(isShortlyBeforeSalary('2026-08-25', '2026-08-25')).toBe(false); // on salary day (not strictly before)
      expect(isShortlyBeforeSalary('2026-08-17', '2026-08-25')).toBe(false); // 8 days before
      expect(isShortlyBeforeSalary('2026-08-26', '2026-08-25')).toBe(false); // after salary day
    });

    it('handles month boundaries when checking shortly before salary', () => {
      expect(isShortlyBeforeSalary('2026-02-23', '2026-03-02')).toBe(true);
      expect(isShortlyBeforeSalary('2026-02-22', '2026-03-02')).toBe(false);
    });
  });

  describe('Upcoming payments filtering and safeToSpend calculation', () => {
    const parsedResult = validateFinanceWorkbook(anonymousWorkbook as TabularWorkbook);
    const baseData = (parsedResult as { success: true; data: FinanceDataV1 }).data;

    it('returns payments due from today up to next salary, sorted chronologically', () => {
      // baseData has asOf 2026-08-08, salaryDay 25 (next salary: 2026-08-25)
      // Budget items with dueDay: insurance (15th, 100 EUR). Debt: primary loan (20th, 250 EUR).
      // Housing (1st) and groceries (5th) already passed for August.
      const payments = selectUpcomingPayments(baseData, '2026-08-08');
      expect(payments).toHaveLength(2);
      expect(payments[0]).toMatchObject({ id: 'insurance', dueDate: '2026-08-15', amountCents: 10000, isShortlyBeforeSalary: false });
      expect(payments[1]).toMatchObject({ id: 'primary-loan', dueDate: '2026-08-20', amountCents: 25000, isShortlyBeforeSalary: true });

      const total = selectUpcomingPaymentsTotalCents(payments);
      expect(total).toBe(35000); // 350 EUR
    });

    it('excludes payments occurring ON salary day (same calendar day)', () => {
      const dataWithSalaryDayPayment: FinanceDataV1 = {
        ...baseData,
        salaryDay: 25,
        budgetItems: [
          ...baseData.budgetItems,
          {
            id: 'same-day-bill',
            label: 'Miete',
            monthlyAmountCents: 80000,
            necessityId: 'essential',
            kind: 'expense',
            displayOrder: 99,
            active: true,
            note: null,
            dueDay: 25, // due on salary day!
          },
        ],
      };
      const payments = selectUpcomingPayments(dataWithSalaryDayPayment, '2026-08-08');
      const sameDay = payments.find((p) => p.id === 'same-day-bill');
      expect(sameDay).toBeUndefined();
    });

    it('includes payment due today', () => {
      const payments = selectUpcomingPayments(baseData, '2026-08-15');
      const todayPayment = payments.find((p) => p.id === 'insurance');
      expect(todayPayment).toBeDefined();
      expect(todayPayment?.dueDate).toBe('2026-08-15');
    });

    it('returns empty payments list when no salary configuration is set', () => {
      const dataNoSalary = { ...baseData, salaryDay: null };
      const summary = selectUpcomingSummary(dataNoSalary, '2026-08-08');
      expect(summary.nextSalaryDate).toBeNull();
      expect(summary.payments).toEqual([]);
      expect(summary.totalPendingCents).toBe(0);
      expect(summary.safeToSpendCents).toBe(summary.currentlyAvailableCents);
    });

    it('returns empty payments list when no recurring payments have dueDay set', () => {
      const dataNoDueDays: FinanceDataV1 = {
        ...baseData,
        budgetItems: baseData.budgetItems.map((b) => ({ ...b, dueDay: null })),
        debts: baseData.debts.map((d) => ({ ...d, dueDay: null })),
      };
      const summary = selectUpcomingSummary(dataNoDueDays, '2026-08-08');
      expect(summary.payments).toEqual([]);
      expect(summary.totalPendingCents).toBe(0);
      expect(summary.safeToSpendCents).toBe(summary.currentlyAvailableCents);
    });

    it('calculates safeToSpend correctly with zero, positive, and negative available money', () => {
      expect(selectSafeToSpendCents(100000, 30000)).toBe(70000);
      expect(selectSafeToSpendCents(0, 30000)).toBe(-30000);
      expect(selectSafeToSpendCents(-5000, 10000)).toBe(-15000);
      expect(selectSafeToSpendCents(20000, 50000)).toBe(-30000); // safeToSpend becomes negative
    });
  });
});
