import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { presetDefinitions, presetPalettes } from './themePalettes';
import { DEFAULT_THEME_SEED, MATERIAL_CONTRAST_LEVEL, generateThemePair } from './themeTokens';
import { schemeVariants, themeTokenNames } from './types';

const hexPattern = /^#[\dA-F]{6}$/;

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string) {
  const values = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('Material Dynamic Color token generation', () => {
  it('creates complete stable light and dark mappings from a known seed at standard contrast', () => {
    const first = generateThemePair(DEFAULT_THEME_SEED, 'tonalSpot');
    const second = generateThemePair(DEFAULT_THEME_SEED, 'tonalSpot');
    expect(MATERIAL_CONTRAST_LEVEL).toBe(0);
    expect(first).toEqual(second);
    expect(Object.keys(first.light)).toEqual([...themeTokenNames]);
    expect(Object.keys(first.dark)).toEqual([...themeTokenNames]);
    expect(Object.values(first.light).every((value) => hexPattern.test(value))).toBe(true);
    expect(Object.values(first.dark).every((value) => hexPattern.test(value))).toBe(true);
    expect({ page: first.light['--color-page'], primary: first.light['--color-primary'] }).toEqual({ page: '#F5FAFD', primary: '#0C6780' });
    expect({ page: first.dark['--color-page'], primary: first.dark['--color-primary'] }).toEqual({ page: '#0F1417', primary: '#89D0ED' });
  });

  it('keeps key foreground/background pairs at WCAG AA contrast', () => {
    for (const mode of ['light', 'dark'] as const) {
      const tokens = generateThemePair(DEFAULT_THEME_SEED)[mode];
      for (const [foreground, background] of [
        ['--color-on-surface', '--color-page'],
        ['--color-on-primary', '--color-primary'],
        ['--color-on-primary-container', '--color-primary-container'],
        ['--color-on-secondary-container', '--color-secondary-container'],
        ['--color-on-tertiary-container', '--color-tertiary-container'],
      ] as const) expect(contrast(tokens[foreground], tokens[background])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('produces visibly different named scheme variants', () => {
    const primaryAndSurface = new Set(schemeVariants.map((variant) => {
      const theme = generateThemePair('#79548A', variant).light;
      return `${theme['--color-primary']}:${theme['--color-container']}:${theme['--color-tertiary']}`;
    }));
    expect(primaryAndSurface.size).toBe(schemeVariants.length);
  });
});

describe('curated presets and semantic color independence', () => {
  it('contains every required accessible German preset with unique IDs', () => {
    expect(presetDefinitions.map(({ name, seed }) => [name, seed])).toEqual([
      ['Petrol', '#2F667A'], ['Blau', '#3F5F90'], ['Indigo', '#60558F'],
      ['Violett', '#79548A'], ['Rosa', '#8E4D64'], ['Grün', '#4F6B4B'],
      ['Bernstein', '#85531A'], ['Koralle', '#8F4C38'], ['Neutral', '#5F6368'],
    ]);
    expect(new Set(presetPalettes.map(({ id }) => id)).size).toBe(presetPalettes.length);
    expect(presetPalettes.every(({ swatch, seed, variant }) => swatch.every((color) => hexPattern.test(color)) && hexPattern.test(seed) && variant === 'tonalSpot')).toBe(true);
    expect(presetPalettes.some(({ seed, swatch }) => swatch[0] !== seed)).toBe(true);
  });

  it('leaves finance semantics outside the dynamic token set', () => {
    const css = readFileSync(new URL('../design/tokens.css', import.meta.url), 'utf8');
    for (const semantic of ['--color-positive-container', '--color-attention-container', '--chart-free', '--chart-essential', '--chart-worthwhile']) {
      expect(themeTokenNames).not.toContain(semantic);
      expect(css).toContain(semantic);
    }
  });
});
