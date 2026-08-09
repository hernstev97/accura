import { useEffect, useState } from 'react';

export type TimeOfDayGreeting = 'Gute Nacht' | 'Guten Morgen' | 'Guten Tag' | 'Guten Abend';

export function getTimeOfDayGreeting(date = new Date()): TimeOfDayGreeting {
  const hour = date.getHours();

  if (hour < 5 || hour >= 22) return 'Gute Nacht';
  if (hour < 11) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function getNextGreetingChange(date = new Date()) {
  const nextChange = new Date(date);
  const hour = date.getHours();

  if (hour < 5) nextChange.setHours(5, 0, 0, 0);
  else if (hour < 11) nextChange.setHours(11, 0, 0, 0);
  else if (hour < 18) nextChange.setHours(18, 0, 0, 0);
  else if (hour < 22) nextChange.setHours(22, 0, 0, 0);
  else {
    nextChange.setDate(nextChange.getDate() + 1);
    nextChange.setHours(5, 0, 0, 0);
  }

  return nextChange;
}

export function useTimeOfDayGreeting() {
  const [greeting, setGreeting] = useState(() => getTimeOfDayGreeting());

  useEffect(() => {
    let timeout: number | undefined;

    const refresh = () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      const now = new Date();
      setGreeting(getTimeOfDayGreeting(now));
      timeout = window.setTimeout(refresh, getNextGreetingChange(now).getTime() - now.getTime());
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  return greeting;
}
