import { describe, expect, it } from 'vitest';
import { getNextGreetingChange, getTimeOfDayGreeting } from './timeOfDayGreeting';

const localDate = (hour: number, minute = 0) => new Date(2026, 0, 15, hour, minute, 0, 0);

describe('time-of-day greeting', () => {
  it.each([
    [0, 0, 'Gute Nacht'],
    [4, 59, 'Gute Nacht'],
    [5, 0, 'Guten Morgen'],
    [10, 59, 'Guten Morgen'],
    [11, 0, 'Guten Tag'],
    [17, 59, 'Guten Tag'],
    [18, 0, 'Guten Abend'],
    [21, 59, 'Guten Abend'],
    [22, 0, 'Gute Nacht'],
    [23, 59, 'Gute Nacht'],
  ] as const)('returns the greeting for %s:%s', (hour, minute, greeting) => {
    expect(getTimeOfDayGreeting(localDate(hour, minute))).toBe(greeting);
  });

  it.each([
    [0, 5],
    [5, 11],
    [11, 18],
    [18, 22],
  ] as const)('schedules the next same-day change from %s:00 for %s:00', (hour, nextHour) => {
    const current = localDate(hour);
    const next = getNextGreetingChange(current);
    expect(next.getDate()).toBe(current.getDate());
    expect([next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds()]).toEqual([nextHour, 0, 0, 0]);
    expect(current).toEqual(localDate(hour));
  });

  it('schedules the late-night change for 05:00 on the following day', () => {
    const current = localDate(22);
    const next = getNextGreetingChange(current);
    expect(next.getDate()).toBe(current.getDate() + 1);
    expect([next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds()]).toEqual([5, 0, 0, 0]);
  });
});
