import type { ReactNode } from 'react';

type SectionHeadingProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  compact?: boolean;
};

export function SectionHeading({ title, subtitle, action, compact = false }: SectionHeadingProps) {
  return (
    <div className={`section-heading ${compact ? 'section-heading--compact' : ''}`}>
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ? <div className="section-heading__action">{action}</div> : null}
    </div>
  );
}
