import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

describe('design token contracts', () => {
  it('contains deterministic and system-supported accent paths', () => {
    expect(tokens).toMatch(/--color-system-accent:\s*#2f667a/);
    expect(tokens).toMatch(/@supports \(color: AccentColor\)/);
    expect(tokens).toMatch(/--color-system-accent:\s*AccentColor/);
    expect(tokens).toMatch(/--color-on-system-accent:\s*AccentColorText/);
    expect(tokens).toMatch(/color-mix\(in srgb, AccentColor/);
  });

  it('documents the shared outer-minus-inset radius calculation in code', () => {
    expect(tokens).toMatch(/--shape-calculated-inner:\s*max\(0px, calc\(var\(--shape-current-outer\) - var\(--shape-current-inset\)\)\)/);
    expect(tokens).toMatch(/--shape-grouped-list-inner:\s*max\(0px, calc\(var\(--shape-grouped-list-outer\) - var\(--shape-grouped-list-inset\)\)\)/);
  });
});
