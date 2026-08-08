import type { ReactNode } from 'react';

type ExpandableSurfaceProps = {
  children: ReactNode;
  className?: string;
  expanded: boolean;
  label?: string;
};

export function ExpandableSurface({ children, className = '', expanded, label }: ExpandableSurfaceProps) {
  return (
    <section
      aria-label={label}
      className={`expandable-surface ${expanded ? 'is-expanded' : ''} ${className}`.trim()}
    >
      {children}
    </section>
  );
}
