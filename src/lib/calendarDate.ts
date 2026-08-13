const pad2 = (value: number) => String(value).padStart(2, '0');

const formatLocalISODate = (instant: Date): string =>
  `${instant.getFullYear()}-${pad2(instant.getMonth() + 1)}-${pad2(instant.getDate())}`;

export function resolveUserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function formatISODateInTimeZone(instant: Date, timeZone: string | null): string {
  if (!Number.isFinite(instant.valueOf())) throw new Error('Ungültiger Zeitpunkt.');
  if (!timeZone) return formatLocalISODate(instant);

  try {
    const parts = new Intl.DateTimeFormat('en', {
      calendar: 'gregory',
      day: '2-digit',
      month: '2-digit',
      numberingSystem: 'latn',
      timeZone,
      year: 'numeric',
    }).formatToParts(instant);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
    const year = value('year');
    const month = value('month');
    const day = value('day');
    return year && month && day ? `${year}-${month}-${day}` : formatLocalISODate(instant);
  } catch {
    return formatLocalISODate(instant);
  }
}

export function getCurrentUserDateISO(instant = new Date()): string {
  return formatISODateInTimeZone(instant, resolveUserTimeZone());
}

/** Uses the device's local calendar so DST-short and DST-long days are handled by Date. */
export function millisecondsUntilNextLocalDay(instant = new Date()): number {
  if (!Number.isFinite(instant.valueOf())) throw new Error('Ungültiger Zeitpunkt.');
  const nextDay = new Date(instant.valueOf());
  nextDay.setHours(24, 0, 0, 100);
  return Math.max(100, nextDay.valueOf() - instant.valueOf());
}
