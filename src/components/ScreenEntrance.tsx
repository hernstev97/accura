import { useReducedMotion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { screenVisitStore, type VisitedDestination } from '../design/screenVisits';

type ScreenEntranceProps = {
  children: ReactNode;
  className?: string;
  destination: VisitedDestination;
  labelledBy: string;
};

export function ScreenEntrance({ children, className = '', destination, labelledBy }: ScreenEntranceProps) {
  const reduceMotion = useReducedMotion();
  const [firstVisit] = useState(() => !screenVisitStore.has(destination));

  useEffect(() => {
    screenVisitStore.mark(destination);
  }, [destination]);

  const entranceState = firstVisit ? (reduceMotion ? 'reduced' : 'first') : 'visited';

  return (
    <div
      aria-labelledby={labelledBy}
      className={`screen screen-entrance ${className}`.trim()}
      data-destination={destination}
      data-entrance={entranceState}
    >
      {children}
    </div>
  );
}
