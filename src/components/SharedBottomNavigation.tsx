import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { spatialSpring } from '../design/motion';
import { Icon, type IconName } from './Icon';

export type Destination = 'overview' | 'budget' | 'debt';

const destinations: Array<{ id: Destination; label: string; icon: IconName }> = [
  { id: 'overview', label: 'Übersicht', icon: 'overview' },
  { id: 'budget', label: 'Budget', icon: 'budget' },
  { id: 'debt', label: 'Schulden', icon: 'debt' },
];

type SharedBottomNavigationProps = {
  onSelect: (destination: Destination) => void;
  selectedId: Destination;
};

export function SharedBottomNavigation({ onSelect, selectedId }: SharedBottomNavigationProps) {
  const reduceMotion = useReducedMotion();
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef(new Map<Destination, HTMLButtonElement>());
  const [geometry, setGeometry] = useState({ x: 0, width: 64 });

  const measure = useCallback(() => {
    const item = itemRefs.current.get(selectedId);
    if (!item) return;
    const nextX = item.offsetLeft + (item.offsetWidth - 64) / 2;
    setGeometry((previous) => previous.x === nextX ? previous : { x: nextX, width: 64 });
  }, [selectedId]);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (navRef.current) observer.observe(navRef.current);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <nav aria-label="Hauptnavigation" className="bottom-navigation" ref={navRef}>
      <motion.span
        animate={{
          scaleX: reduceMotion ? 1 : [1, 1.14, 1],
          width: geometry.width,
          x: geometry.x,
        }}
        aria-hidden="true"
        className="bottom-navigation__indicator"
        data-testid="navigation-indicator"
        initial={false}
        transition={reduceMotion ? { duration: 0 } : {
          scaleX: { duration: 0.28, ease: [0.2, 0, 0, 1], times: [0, 0.45, 1] },
          width: spatialSpring,
          x: spatialSpring,
        }}
      />
      {destinations.map((item) => (
        <button
          aria-current={selectedId === item.id ? 'page' : undefined}
          className="bottom-navigation__item"
          key={item.id}
          onClick={() => onSelect(item.id)}
          ref={(element) => {
            if (element) itemRefs.current.set(item.id, element);
            else itemRefs.current.delete(item.id);
          }}
          type="button"
        >
          <span className="bottom-navigation__icon"><Icon name={item.icon} /></span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
