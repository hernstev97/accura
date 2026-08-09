import type { ReactNode } from 'react';

export type AllocationLegendItem = {
  id: string;
  label: string;
  value: ReactNode;
  color: string;
};

export function AllocationLegend({ items, label = 'Werte der Einkommensaufteilung' }: { items: readonly AllocationLegendItem[]; label?: string }) {
  return (
    <div aria-label={label} className="allocation-legend" role="list">
      {items.map((item) => (
        <div className="allocation-legend__item" data-allocation-id={item.id} key={item.id} role="listitem">
          <span className="allocation-legend__label"><i aria-hidden="true" style={{ background: item.color }} />{item.label}</span>
          <strong className="financial-value">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
