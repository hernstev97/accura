import { describe, expect, it } from 'vitest';
import { formatISODateInTimeZone, millisecondsUntilNextLocalDay } from './calendarDate';

describe('calendar date in user time zone', () => {
  it('derives different calendar dates for the same instant across IANA time zones', () => {
    const instant = new Date('2026-08-13T01:30:00.000Z');

    expect(formatISODateInTimeZone(instant, 'Europe/Berlin')).toBe('2026-08-13');
    expect(formatISODateInTimeZone(instant, 'America/Los_Angeles')).toBe('2026-08-12');
  });

  it('handles a European daylight-saving transition without offset arithmetic', () => {
    const beforeTransition = new Date('2026-03-28T23:30:00.000Z');
    const afterTransition = new Date('2026-03-29T22:30:00.000Z');

    expect(formatISODateInTimeZone(beforeTransition, 'Europe/Berlin')).toBe('2026-03-29');
    expect(formatISODateInTimeZone(afterTransition, 'Europe/Berlin')).toBe('2026-03-30');
  });

  it('falls back to the device calendar when an IANA time zone is unavailable', () => {
    const instant = new Date(2026, 7, 13, 12);

    expect(formatISODateInTimeZone(instant, 'not/a-time-zone')).toBe('2026-08-13');
  });

  it('schedules the day change after the current instant', () => {
    const instant = new Date(2026, 7, 13, 23, 59, 59, 900);

    expect(millisecondsUntilNextLocalDay(instant)).toBe(200);
  });
});
