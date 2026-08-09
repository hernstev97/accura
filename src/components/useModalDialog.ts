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
}: {
  active: boolean;
  surfaceRef: RefObject<HTMLElement | null>;
  initialFocusRef: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => initialFocusRef.current?.focus({ preventScroll: true }));
    const onKeyDown = (event: KeyboardEvent) => {
      if (!surfaceRef.current?.contains(document.activeElement)) return;
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
  }, [active, initialFocusRef, surfaceRef]);
}

export function useModalBackground(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const background = document.querySelector<HTMLElement>('.app-shell');
    const previousOverflow = document.body.style.overflow;
    const previouslyInert = background?.hasAttribute('inert') ?? false;
    const previousAriaHidden = background?.getAttribute('aria-hidden');
    background?.setAttribute('inert', '');
    background?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'hidden';
    return () => {
      if (!previouslyInert) background?.removeAttribute('inert');
      if (previousAriaHidden === null) background?.removeAttribute('aria-hidden');
      else if (previousAriaHidden !== undefined) background?.setAttribute('aria-hidden', previousAriaHidden);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
}
