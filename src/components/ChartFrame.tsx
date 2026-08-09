import type { ReactNode } from 'react';
import { SurfaceSection } from './SurfaceSection';

type ChartFrameProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  id: string;
  subtitle?: string;
  title: string;
};

export function ChartFrame({ action, children, className = '', footer, id, subtitle, title }: ChartFrameProps) {
  return (
    <SurfaceSection action={action} className={`chart-frame ${className}`.trim()} id={id} supporting={subtitle} title={title} variant="tonal">
      {children}
      {footer ? <div className="chart-frame__footer">{footer}</div> : null}
    </SurfaceSection>
  );
}
