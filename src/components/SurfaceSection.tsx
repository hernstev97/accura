import type { ReactNode } from 'react';
import { SectionHeading } from './SectionHeading';

export type SurfaceSectionProps = {
  id: string;
  title: string;
  supporting?: string;
  action?: ReactNode;
  variant?: 'plain' | 'tonal';
  className?: string;
  children: ReactNode;
};

export function SurfaceSection({ action, children, className = '', id, supporting, title, variant = 'plain' }: SurfaceSectionProps) {
  const headingId = `${id}-title`;
  return (
    <section aria-labelledby={headingId} className={`surface-section surface-section--${variant} ${className}`.trim()} id={id}>
      <SectionHeading action={action} id={headingId} subtitle={supporting} title={title} />
      <div className="surface-section__content">{children}</div>
    </section>
  );
}
