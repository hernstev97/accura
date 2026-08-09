import type { ReactNode } from 'react';

export function DataList({ children, footer, label }: { children: ReactNode; footer?: ReactNode; label: string }) {
  return (
    <div aria-label={label} className="data-list" role="list">
      {children}
      {footer ? <div className="data-list__footer">{footer}</div> : null}
    </div>
  );
}

export function DataListItem({ icon, title, supporting, value }: {
  icon?: ReactNode;
  title: ReactNode;
  supporting?: ReactNode;
  value?: ReactNode;
}) {
  return (
    <article className="data-list__item" role="listitem">
      {icon ? <span className="data-list__icon" aria-hidden="true">{icon}</span> : null}
      <span className="data-list__body">
        <strong>{title}</strong>
        {supporting ? <small>{supporting}</small> : null}
      </span>
      {value ? <strong className="data-list__value financial-value">{value}</strong> : null}
    </article>
  );
}
