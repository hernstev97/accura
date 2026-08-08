import type { ReactNode } from 'react';
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
    <section className={`chart-frame ${className}`.trim()}>
      <SectionHeading action={action} subtitle={subtitle} title={title} />
      {children}
    </section>
  );
}
