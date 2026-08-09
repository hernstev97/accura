import type { ReactNode } from 'react';
import { ScreenHeader } from './ScreenHeader';

export function ConnectionStateLayout({
  action,
  children,
  eyebrow,
  mark,
  state,
  supporting,
  title,
  tone = 'info',
}: {
  action?: ReactNode;
  children?: ReactNode;
  eyebrow: string;
  mark: ReactNode;
  state: string;
  supporting: ReactNode;
  title: ReactNode;
  tone?: 'info' | 'warning' | 'danger';
}) {
  return (
    <section
      aria-labelledby="connection-title"
      className={`screen connection-state connection-state--${tone}`}
      data-finance-state={state}
    >
      <span className="connection-state__mark" aria-hidden="true">{mark}</span>
      <ScreenHeader eyebrow={eyebrow} id="connection-title" supporting={supporting} title={title} />
      {children ? <div className="connection-state__details">{children}</div> : null}
      {action ? <div className="connection-state__actions">{action}</div> : null}
    </section>
  );
}
