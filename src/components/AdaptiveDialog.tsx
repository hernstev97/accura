import { useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useModalBackground, useModalDialog } from './useModalDialog';

type AdaptiveDialogProps = {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  children: ReactNode;
  className?: string;
  surfaceClassName?: string;
  surfaceRef?: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  presentation?: 'sheet' | 'fullscreen';
  style?: CSSProperties;
};

export function AdaptiveDialog({
  ariaLabelledBy,
  children,
  className = '',
  initialFocusRef,
  onClose,
  open,
  presentation = 'sheet',
  returnFocusRef,
  style,
  surfaceClassName = '',
  surfaceRef,
}: AdaptiveDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const internalSurfaceRef = useRef<HTMLElement>(null);
  const activeSurfaceRef = surfaceRef ?? internalSurfaceRef;
  const activeInitialFocusRef = initialFocusRef ?? activeSurfaceRef;
  useModalBackground(open);
  useModalDialog({ active: open, initialFocusRef: activeInitialFocusRef, surfaceRef: activeSurfaceRef });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const returnFocusTarget = returnFocusRef?.current;
    if (!dialog.open) dialog.showModal();
    const frame = requestAnimationFrame(() => initialFocusRef?.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
      requestAnimationFrame(() => returnFocusTarget?.focus({ preventScroll: true }));
    };
  }, [initialFocusRef, open, returnFocusRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      aria-labelledby={ariaLabelledBy}
      aria-modal="true"
      className={`adaptive-dialog adaptive-dialog--${presentation} ${className}`.trim()}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onPointerDown={(event) => { if (event.currentTarget === event.target) onClose(); }}
      ref={dialogRef}
    >
      <section className={`adaptive-dialog__surface ${surfaceClassName}`.trim()} ref={activeSurfaceRef} style={style} tabIndex={-1}>
        {children}
      </section>
    </dialog>,
    document.body,
  );
}
