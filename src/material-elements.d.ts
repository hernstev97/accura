import type React from 'react';

type MaterialElementProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  active?: boolean;
  disabled?: boolean;
  indeterminate?: boolean;
  label?: string;
  open?: boolean;
  selected?: boolean;
  type?: string;
  value?: number | string;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-assist-chip': MaterialElementProps;
      'md-dialog': MaterialElementProps;
      'md-filled-tonal-button': MaterialElementProps;
      'md-icon-button': MaterialElementProps;
      'md-linear-progress': MaterialElementProps;
      'md-outlined-button': MaterialElementProps;
      'md-primary-tab': MaterialElementProps;
      'md-tabs': MaterialElementProps;
      'md-text-button': MaterialElementProps;
    }
  }
}

export {};
