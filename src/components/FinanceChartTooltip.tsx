import type { TooltipContentProps } from 'recharts';
import { formatCurrency } from '../lib/format';

type FinanceChartTooltipProps = Pick<TooltipContentProps, 'active' | 'label' | 'payload'> & {
  valueLabel: string;
  formatTitle?: (label: string | number | undefined, payload: TooltipContentProps['payload']) => string;
};

export function FinanceChartTooltip({ active, formatTitle, label, payload, valueLabel }: FinanceChartTooltipProps) {
  const entry = payload?.[0];
  if (!active || entry?.value === null || entry?.value === undefined) return null;
  const title = formatTitle ? formatTitle(label, payload) : String(label ?? entry.name ?? '');
  return (
    <div className="finance-chart-tooltip">
      {title ? <span>{title}</span> : null}
      <strong>{formatCurrency(Number(entry.value))}</strong>
      <small>{valueLabel}</small>
    </div>
  );
}
