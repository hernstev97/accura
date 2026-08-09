import type { ReactNode } from 'react';

export function MetricGrid({ children, label }: { children: ReactNode; label: string }) {
  return <section aria-label={label} className="metric-grid">{children}</section>;
}
