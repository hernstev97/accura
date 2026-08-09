import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'filled' | 'tonal' | 'text' | 'danger';
  size?: 'small' | 'medium' | 'large';
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  iconOnly?: boolean;
};

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(function AppButton({
  children,
  className = '',
  iconOnly = false,
  leadingIcon,
  size = 'medium',
  trailingIcon,
  type = 'button',
  variant = 'filled',
  ...props
}, ref) {
  return (
    <button
      className={`app-button app-button--${variant} app-button--${size} ${iconOnly ? 'app-button--icon' : ''} ${className}`.trim()}
      ref={ref}
      type={type}
      {...props}
    >
      {leadingIcon ? <span className="app-button__icon" aria-hidden="true">{leadingIcon}</span> : null}
      {children ? <span className="app-button__label">{children}</span> : null}
      {trailingIcon ? <span className="app-button__icon" aria-hidden="true">{trailingIcon}</span> : null}
    </button>
  );
});
