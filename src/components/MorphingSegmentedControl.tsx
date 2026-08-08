import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { spatialSpring } from '../design/motion';

type Segment = { id: string; label: string };
type IndicatorGeometry = { x: number; width: number };

type MorphingSegmentedControlProps = {
  label: string;
  onSelectionChange: (id: string) => void;
  options: Segment[];
  selectedId: string;
};

export function MorphingSegmentedControl({ label, onSelectionChange, options, selectedId }: MorphingSegmentedControlProps) {
  const reduceMotion = useReducedMotion();
  const shellRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const [geometry, setGeometry] = useState<IndicatorGeometry>({ x: 4, width: 0 });

  const measure = useCallback(() => {
    const shell = shellRef.current;
    const item = itemRefs.current.get(selectedId);
    if (!shell || !item) return;
    const next = { x: item.offsetLeft, width: item.offsetWidth };
    setGeometry((previous) => previous.x === next.x && previous.width === next.width ? previous : next);
  }, [selectedId]);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (shellRef.current) observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div aria-label={label} className="segmented-control" ref={shellRef} role="tablist">
      <motion.span
        aria-hidden="true"
        animate={{
          borderRadius: reduceMotion ? 22 : [22, 16, 22],
          width: geometry.width,
          x: geometry.x,
        }}
        className="segmented-control__indicator"
        data-testid="segment-indicator"
        initial={false}
        transition={reduceMotion ? { duration: 0 } : {
          borderRadius: { duration: 0.28, ease: [0.2, 0, 0, 1], times: [0, 0.45, 1] },
          width: spatialSpring,
          x: spatialSpring,
        }}
      />
      {options.map((option) => (
        <button
          aria-selected={selectedId === option.id}
          className="segmented-control__item"
          key={option.id}
          onClick={() => onSelectionChange(option.id)}
          ref={(element) => {
            if (element) itemRefs.current.set(option.id, element);
            else itemRefs.current.delete(option.id);
          }}
          role="tab"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
