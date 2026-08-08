import type { ReactNode } from 'react';

type MetricCardProps = {
  label: string;
  value: ReactNode;
  supporting?: string;
  tone?: 'default' | 'primary' | 'attention';
};

export function MetricCard({ label, value, supporting, tone = 'default' }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <p className="metric-card__label">{label}</p>
      <p className="metric-card__value">{value}</p>
      {supporting ? <p className="metric-card__supporting">{supporting}</p> : null}
    </article>
  );
}
