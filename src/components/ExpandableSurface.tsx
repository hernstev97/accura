import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { spatialSpring } from '../design/motion';

type ExpandableSurfaceProps = {
  children: ReactNode;
  className?: string;
  expanded: boolean;
  label?: string;
};

export function ExpandableSurface({ children, className = '', expanded, label }: ExpandableSurfaceProps) {
  return (
    <motion.section
      aria-label={label}
      className={`expandable-surface ${expanded ? 'is-expanded' : ''} ${className}`.trim()}
      layout
      transition={{ layout: spatialSpring }}
    >
      {children}
    </motion.section>
  );
}
