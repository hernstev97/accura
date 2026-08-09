import type { ReactNode } from 'react';

export type SurfaceTone = 'accent' | 'neutral' | 'positive' | 'attention';

export type FinancialHeroProps = {
  id: string;
  label: string;
  value: ReactNode;
  supporting?: ReactNode;
  tone: SurfaceTone;
  visual?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
};

export function FinancialHero({ action, footer, id, label, supporting, tone, value, visual }: FinancialHeroProps) {
  const labelId = `${id}-label`;
  return (
    <section aria-labelledby={labelId} className={`financial-hero financial-hero--${tone}`} id={id}>
      <div className="financial-hero__composition">
        <div className="financial-hero__content">
          <h2 className="financial-hero__label" id={labelId}>{label}</h2>
          <p className="financial-hero__value">{value}</p>
          {supporting ? <p className="financial-hero__supporting">{supporting}</p> : null}
          {action ? <div className="financial-hero__action">{action}</div> : null}
        </div>
        {visual ? <div className="financial-hero__visual">{visual}</div> : null}
      </div>
      {footer ? <div className="financial-hero__footer">{footer}</div> : null}
    </section>
  );
}
