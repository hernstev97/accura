import type { ReactNode } from 'react';

export type InlineNoticeProps = {
  tone: 'info' | 'positive' | 'warning' | 'danger';
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function InlineNotice({ action, children, className = '', icon, title, tone }: InlineNoticeProps) {
  return (
    <aside className={`inline-notice inline-notice--${tone} ${className}`.trim()}>
      {icon ? <span className="inline-notice__icon" aria-hidden="true">{icon}</span> : null}
      <div className="inline-notice__content">
        <strong>{title}</strong>
        <div>{children}</div>
      </div>
      {action ? <div className="inline-notice__action">{action}</div> : null}
    </aside>
  );
}
