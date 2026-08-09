import type { ReactNode } from 'react';

type MetricCardProps = {
  label: string;
  value: ReactNode;
  supporting?: ReactNode;
  tone?: 'neutral' | 'accent' | 'positive' | 'attention' | 'default' | 'primary';
};

export function MetricCard({ label, value, supporting, tone = 'neutral' }: MetricCardProps) {
  const resolvedTone = tone === 'default' ? 'neutral' : tone === 'primary' ? 'accent' : tone;
  return (
    <article className={`metric-card metric-card--${resolvedTone}`}>
      <p className="metric-card__label">{label}</p>
      <p className="metric-card__value financial-value">{value}</p>
      {supporting ? <p className="metric-card__supporting">{supporting}</p> : null}
    </article>
  );
}
