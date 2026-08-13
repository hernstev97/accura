import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PinPad } from './PinPad';

describe('ACC-14 PIN pad accessibility', () => {
  it('renders a fixed Android-style keypad without exposing entered digits', () => {
    const emptyMarkup = renderToString(<PinPad onChange={vi.fn()} onSubmit={vi.fn()} value="" />);
    const markup = renderToString(<PinPad onChange={vi.fn()} onSubmit={vi.fn()} value="12" />);
    expect(markup).toContain('aria-label="PIN-Eingabe"');
    expect(markup).toContain('aria-label="Letzte PIN-Stelle löschen"');
    expect(markup).toContain('aria-label="PIN bestätigen"');
    expect(markup).toContain('2 von 6 Stellen eingegeben');
    expect(markup).not.toContain('value="12"');
    expect(emptyMarkup).not.toContain('class="pin-indicator"');
    expect(markup.match(/class="pin-indicator(?: |")/g)).toHaveLength(2);
    expect(markup).not.toContain('data-start-shape="Circle"');
  });

  it('keeps confirmation disabled until all six places are filled', () => {
    const incomplete = renderToString(<PinPad onChange={vi.fn()} onSubmit={vi.fn()} value="12345" />);
    const complete = renderToString(<PinPad onChange={vi.fn()} onSubmit={vi.fn()} value="123456" />);
    expect(incomplete).toMatch(/aria-label="PIN bestätigen"[^>]*disabled/);
    expect(complete).not.toMatch(/aria-label="PIN bestätigen"[^>]*disabled/);
  });
});
