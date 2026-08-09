import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
  'summary',
].join(',');

export function useModalDialog({
  active,
  surfaceRef,
  initialFocusRef,
  onEscape,
}: {
  active: boolean;
  surfaceRef: RefObject<HTMLElement | null>;
  initialFocusRef: RefObject<HTMLElement | null>;
  onEscape: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => initialFocusRef.current?.focus({ preventScroll: true }));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(surfaceRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])]
        .filter((element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) {
        event.preventDefault();
        surfaceRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [active, initialFocusRef, onEscape, surfaceRef]);
}

export function useModalBackground(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const background = document.querySelector<HTMLElement>('.app-shell');
    const previousOverflow = document.body.style.overflow;
    background?.setAttribute('inert', '');
    background?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'hidden';
    return () => {
      background?.removeAttribute('inert');
      background?.removeAttribute('aria-hidden');
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
}
