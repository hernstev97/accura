import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type PressableSurfaceProps = Omit<ComponentPropsWithoutRef<'button'>, 'children'> & { children: ReactNode };

export function PressableSurface({ children, className = '', ...props }: PressableSurfaceProps) {
  return (
    <button
      className={`pressable-surface ${className}`.trim()}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
