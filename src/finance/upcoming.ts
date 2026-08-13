import type { BudgetItemV1, DebtV1, FinanceDataV1, UpcomingPaymentV1, UpcomingSummaryV1 } from './types.js';
import { selectCurrentAccountTotalCents } from './selectors.js';

export const SHORTLY_BEFORE_SALARY_THRESHOLD_DAYS = 7;

/** Returns the number of days in a given month (1-indexed month 1..12). */
export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

/** Clamps targetDay to the maximum valid day of the specified year and month. */
export function getValidDay(year: number, month: number, targetDay: number): number {
  const maxDays = getDaysInMonth(year, month);
  return Math.min(Math.max(1, targetDay), maxDays);
}

const pad2 = (n: number) => n.toString().padStart(2, '0');

export function formatISODate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseISODate(isoDate: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return null;
  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) return null;
  return { year, month, day };
}

/** Adds/subtracts calendar days using UTC arithmetic to prevent local timezone offsets. */
export function addCalendarDays(isoDate: string, days: number): string {
  const parsed = parseISODate(isoDate);
  if (!parsed) return isoDate;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Determines the next salary date from today's ISO date and configured salary day (1..31).
 * If salary day in current month is on or after today, returns that day (clamped to month length).
 * If salary day in current month has passed before today, returns the salary day of the next month (clamped).
 */
export function getNextSalaryDate(todayISO: string, salaryDay: number | null): string | null {
  if (salaryDay === null || salaryDay < 1 || salaryDay > 31) return null;
  const parsed = parseISODate(todayISO);
  if (!parsed) return null;

  const currentMonthSalaryDay = getValidDay(parsed.year, parsed.month, salaryDay);
  const currentMonthSalaryISO = formatISODate(parsed.year, parsed.month, currentMonthSalaryDay);

  if (currentMonthSalaryISO >= todayISO) {
    return currentMonthSalaryISO;
  }

  let nextYear = parsed.year;
  let nextMonth = parsed.month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const nextMonthSalaryDay = getValidDay(nextYear, nextMonth, salaryDay);
  return formatISODate(nextYear, nextMonth, nextMonthSalaryDay);
}

/**
 * Determines the next occurrence of a recurring payment due on dueDay (1..31).
 * If dueDay in current month is on or after today, returns that date (clamped).
 * Otherwise returns dueDay in the following month (clamped).
 */
export function getNextOccurrenceDate(todayISO: string, dueDay: number | null): string | null {
  if (dueDay === null || dueDay < 1 || dueDay > 31) return null;
  const parsed = parseISODate(todayISO);
  if (!parsed) return null;

  const currentMonthDueDay = getValidDay(parsed.year, parsed.month, dueDay);
  const currentMonthDueISO = formatISODate(parsed.year, parsed.month, currentMonthDueDay);

  if (currentMonthDueISO >= todayISO) {
    return currentMonthDueISO;
  }

  let nextYear = parsed.year;
  let nextMonth = parsed.month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const nextMonthDueDay = getValidDay(nextYear, nextMonth, dueDay);
  return formatISODate(nextYear, nextMonth, nextMonthDueDay);
}

/**
 * Checks if a payment due date falls shortly before the next salary date.
 * Default threshold is 7 calendar days inclusive ([nextSalaryDate - 7 days, nextSalaryDate]).
 */
export function isShortlyBeforeSalary(
  dueDateISO: string,
  nextSalaryDateISO: string,
  thresholdDays: number = SHORTLY_BEFORE_SALARY_THRESHOLD_DAYS,
): boolean {
  if (dueDateISO >= nextSalaryDateISO) return false;
  const cutoffISO = addCalendarDays(nextSalaryDateISO, -thresholdDays);
  return dueDateISO >= cutoffISO;
}

/**
 * Returns all active recurring payments due strictly before the next salary date (today <= dueDate < nextSalaryDate),
 * sorted chronologically.
 */
export function selectUpcomingPayments(data: FinanceDataV1, projectionDateISO: string): UpcomingPaymentV1[] {
  const nextSalaryDate = getNextSalaryDate(projectionDateISO, data.salaryDay);

  if (!nextSalaryDate) return [];

  const candidates: UpcomingPaymentV1[] = [];

  const processItem = (item: BudgetItemV1 | DebtV1, source: 'budget' | 'debt') => {
    if (!item.active || item.dueDay === null) return;
    const dueDate = getNextOccurrenceDate(projectionDateISO, item.dueDay);
    if (!dueDate) return;

    if (dueDate >= projectionDateISO && dueDate < nextSalaryDate) {
      const amountCents = 'monthlyAmountCents' in item ? item.monthlyAmountCents : item.monthlyPaymentCents;
      const name = 'label' in item ? item.label : item.name;
      candidates.push({
        id: item.id,
        name,
        amountCents,
        dueDay: item.dueDay,
        dueDate,
        source,
        isShortlyBeforeSalary: isShortlyBeforeSalary(dueDate, nextSalaryDate),
      });
    }
  };

  data.budgetItems.forEach((item) => processItem(item, 'budget'));
  data.debts.forEach((item) => processItem(item, 'debt'));

  return candidates.sort((a, b) => {
    const dateComp = a.dueDate.localeCompare(b.dueDate);
    if (dateComp !== 0) return dateComp;
    return a.name.localeCompare(b.name, 'de-DE');
  });
}

export function selectUpcomingPaymentsTotalCents(payments: UpcomingPaymentV1[]): number {
  return payments.reduce((sum, p) => sum + p.amountCents, 0);
}

export function selectSafeToSpendCents(currentlyAvailableCents: number, pendingPaymentsTotalCents: number): number {
  return currentlyAvailableCents - pendingPaymentsTotalCents;
}

export function selectUpcomingSummary(data: FinanceDataV1, projectionDateISO: string): UpcomingSummaryV1 {
  const nextSalaryDate = getNextSalaryDate(projectionDateISO, data.salaryDay);
  const payments = selectUpcomingPayments(data, projectionDateISO);
  const totalPendingCents = selectUpcomingPaymentsTotalCents(payments);
  const currentlyAvailableCents = selectCurrentAccountTotalCents(data);
  const safeToSpendCents = selectSafeToSpendCents(currentlyAvailableCents, totalPendingCents);

  return {
    salaryDay: data.salaryDay,
    nextSalaryDate,
    payments,
    totalPendingCents,
    currentlyAvailableCents,
    safeToSpendCents,
  };
}
