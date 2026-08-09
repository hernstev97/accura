import { useEffect, useState } from 'react';

export function useChartAnimation(reducedMotion: boolean | null, changeKey: string, durationMs: number) {
  const [active, setActive] = useState(() => !reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setActive(false);
      return;
    }
    setActive(true);
    const timeout = window.setTimeout(() => setActive(false), durationMs + 40);
    return () => window.clearTimeout(timeout);
  }, [changeKey, durationMs, reducedMotion]);

  return reducedMotion ? false : active;
}
