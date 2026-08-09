import { useEffect, useState } from 'react';

export function useChartAnimation(reducedMotion: boolean | null, changeKey: string, durationMs: number) {
  const isReduced = Boolean(reducedMotion);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (isReduced) {
      setActive(false);
      return;
    }
    setActive(true);
    const timeout = window.setTimeout(() => setActive(false), durationMs + 40);
    return () => window.clearTimeout(timeout);
  }, [changeKey, durationMs, isReduced]);

  return isReduced ? false : active;
}
