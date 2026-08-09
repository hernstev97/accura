import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const fontFaces = readFileSync(new URL('./googleSansFlex.css', import.meta.url), 'utf8');
const packageJson = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
const fontLicense = readFileSync(new URL('../../docs/fonts/Google-Sans-Flex-OFL.txt', import.meta.url), 'utf8');

describe('design token contracts', () => {
  it('contains deterministic and system-supported accent paths', () => {
    expect(tokens).toMatch(/--color-browser-accent-fallback:\s*#2f667a/);
    expect(tokens).toMatch(/--color-browser-accent-source:\s*var\(--color-browser-accent-fallback\)/);
    expect(tokens).toMatch(/--color-system-accent-source:\s*var\(--color-primary/);
    expect(tokens).toMatch(/--color-system-accent:\s*var\(--color-system-accent-source\)/);
    expect(tokens).toMatch(/@supports \(color: AccentColor\)/);
    expect(tokens).toMatch(/--color-browser-accent-source:\s*AccentColor/);
    expect(tokens).toMatch(/--color-browser-on-accent-source:\s*AccentColorText/);
    expect(tokens).toMatch(/color-mix\(in srgb, var\(--color-system-accent\)/);
    expect(tokens).toMatch(/:root\[data-theme-resolved='dark'\]/);
  });

  it('bundles Google Sans Flex and uses its fully rounded cut in every type role', () => {
    expect(fontFaces).toMatch(/font-family:\s*'Google Sans Flex Variable'/);
    expect(fontFaces).toMatch(/google-sans-flex-latin-full-normal\.woff2/);
    expect(fontFaces).toMatch(/google-sans-flex-latin-ext-full-normal\.woff2/);
    expect(tokens).toMatch(/font-optical-sizing:\s*auto/);
    expect(tokens).toMatch(/font-variation-settings:\s*'ROND' 100, 'wdth' 100/);
    for (const role of ['screen', 'hero', 'section', 'component', 'body', 'label', 'metric']) {
      expect(tokens).toMatch(new RegExp(`--type-${role}-rond:\\s*100`));
    }
    expect(packageJson).toContain('@fontsource-variable/google-sans-flex');
    expect(packageJson).not.toContain('@fontsource-variable/roboto-flex');
    expect(fontLicense).toMatch(/Copyright 2015 Google LLC/);
    expect(fontLicense).toMatch(/SIL OPEN FONT LICENSE Version 1\.1/);
  });

  it('documents the shared outer-minus-inset radius calculation in code', () => {
    expect(tokens).toMatch(/--shape-calculated-inner:\s*max\(0px, calc\(var\(--shape-current-outer\) - var\(--shape-current-inset\)\)\)/);
    expect(tokens).toMatch(/--shape-grouped-list-inner:\s*max\(0px, calc\(var\(--shape-grouped-list-outer\) - var\(--shape-grouped-list-inset\)\)\)/);
  });
});
