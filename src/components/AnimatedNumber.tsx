import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '../lib/format';

type AnimatedNumberProps = {
  value: number;
  className?: string;
  currency?: boolean;
};

export function AnimatedNumber({ value, className, currency = true }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const previous = useRef(value);
  const [displayed, setDisplayed] = useState(value);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayed(value);
      previous.current = value;
      return;
    }

    const controls = animate(previous.current, value, {
      duration: 0.24,
      ease: [0.2, 0, 0, 1],
      onUpdate: setDisplayed,
    });
    previous.current = value;
    return () => controls.stop();
  }, [reduceMotion, value]);

  const formatted = currency ? formatCurrency(displayed) : displayed.toLocaleString('de-DE');
  const exact = currency ? formatCurrency(value) : value.toLocaleString('de-DE');

  return (
    <span aria-label={exact} className={className}>
      <span aria-hidden="true">{formatted}</span>
    </span>
  );
}
