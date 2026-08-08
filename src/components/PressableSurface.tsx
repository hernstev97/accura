import { motion, useReducedMotion } from 'motion/react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { tactileSpring } from '../design/motion';

type PressableSurfaceProps = Omit<ComponentPropsWithoutRef<typeof motion.button>, 'children'> & {
  children: ReactNode;
  broad?: boolean;
};

export function PressableSurface({ children, className = '', broad = false, ...props }: PressableSurfaceProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      className={`pressable-surface ${broad ? 'pressable-surface--broad' : ''} ${className}`.trim()}
      transition={tactileSpring}
      whileTap={reduceMotion ? undefined : { scale: broad ? 0.985 : 0.97 }}
      type="button"
      {...props}
    >
      {children}
    </motion.button>
  );
}
