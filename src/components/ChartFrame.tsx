import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { spatialSpring } from '../design/motion';
import { SectionHeading } from './SectionHeading';

type ChartFrameProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  subtitle?: string;
  title: string;
};

export function ChartFrame({ action, children, className = '', subtitle, title }: ChartFrameProps) {
  return (
    <motion.section className={`chart-frame ${className}`.trim()} layout transition={{ layout: spatialSpring }}>
      <SectionHeading action={action} subtitle={subtitle} title={title} />
      {children}
    </motion.section>
  );
}
