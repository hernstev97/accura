import type { TooltipContentProps } from 'recharts';
import { MoneyValue } from './MoneyValue';

type FinanceChartTooltipProps = Pick<TooltipContentProps, 'active' | 'label' | 'payload'> & {
  valueLabel: string;
  centsDataKey?: string;
  formatTitle?: (label: string | number | undefined, payload: TooltipContentProps['payload']) => string;
};

export function FinanceChartTooltip({ active, centsDataKey, formatTitle, label, payload, valueLabel }: FinanceChartTooltipProps) {
  const entry = payload?.[0];
  if (!active || entry?.value === null || entry?.value === undefined) return null;
  const title = formatTitle ? formatTitle(label, payload) : String(label ?? entry.name ?? '');
  const cents = centsDataKey && typeof entry.payload === 'object' && entry.payload !== null
    ? (entry.payload as Record<string, unknown>)[centsDataKey]
    : undefined;
  return (
    <div className="finance-chart-tooltip">
      {title ? <span>{title}</span> : null}
      <strong>{typeof cents === 'number' && Number.isSafeInteger(cents)
        ? <MoneyValue valueCents={cents} />
        : <MoneyValue value={Number(entry.value)} />}</strong>
      <small>{valueLabel}</small>
    </div>
  );
}
