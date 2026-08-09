import {
  Hct,
  MaterialDynamicColors,
  SchemeExpressive,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeTonalSpot,
  SchemeVibrant,
  argbFromHex,
  hexFromArgb,
  type DynamicScheme,
} from '@material/material-color-utilities';
import type { ResolvedThemeMode, SchemeVariant, ThemePair, ThemeTokenSet } from './types';

export const DEFAULT_THEME_SEED = '#2F667A';
export const MATERIAL_CONTRAST_LEVEL = 0;

function createScheme(seed: string, variant: SchemeVariant, resolvedMode: ResolvedThemeMode): DynamicScheme {
  const source = Hct.fromInt(argbFromHex(seed));
  const dark = resolvedMode === 'dark';

  switch (variant) {
    case 'neutral':
      return new SchemeNeutral(source, dark, MATERIAL_CONTRAST_LEVEL);
    case 'vibrant':
      return new SchemeVibrant(source, dark, MATERIAL_CONTRAST_LEVEL);
    case 'expressive':
      return new SchemeExpressive(source, dark, MATERIAL_CONTRAST_LEVEL);
    case 'monochrome':
      return new SchemeMonochrome(source, dark, MATERIAL_CONTRAST_LEVEL);
    case 'tonalSpot':
      return new SchemeTonalSpot(source, dark, MATERIAL_CONTRAST_LEVEL);
  }
}

function resolveTokens(seed: string, variant: SchemeVariant, resolvedMode: ResolvedThemeMode): ThemeTokenSet {
  const scheme = createScheme(seed, variant, resolvedMode);
  const colors = new MaterialDynamicColors();
  const color = (dynamicColor: ReturnType<MaterialDynamicColors['primary']>) => normalizeHexColor(hexFromArgb(dynamicColor.getArgb(scheme)))!;

  return {
    '--color-page': color(colors.background()),
    '--color-container-low': color(colors.surfaceContainerLow()),
    '--color-container': color(colors.surfaceContainer()),
    '--color-container-high': color(colors.surfaceContainerHigh()),
    '--color-surface-bright': color(colors.surfaceBright()),
    '--color-on-surface': color(colors.onSurface()),
    '--color-on-surface-variant': color(colors.onSurfaceVariant()),
    '--color-primary': color(colors.primary()),
    '--color-on-primary': color(colors.onPrimary()),
    '--color-primary-container': color(colors.primaryContainer()),
    '--color-on-primary-container': color(colors.onPrimaryContainer()),
    '--color-secondary': color(colors.secondary()),
    '--color-on-secondary': color(colors.onSecondary()),
    '--color-secondary-container': color(colors.secondaryContainer()),
    '--color-on-secondary-container': color(colors.onSecondaryContainer()),
    '--color-tertiary': color(colors.tertiary()),
    '--color-on-tertiary': color(colors.onTertiary()),
    '--color-tertiary-container': color(colors.tertiaryContainer()),
    '--color-on-tertiary-container': color(colors.onTertiaryContainer()),
    '--color-outline': color(colors.outline()),
    '--color-outline-variant': color(colors.outlineVariant()),
    '--color-scrim': color(colors.scrim()),
  };
}

export function generateThemePair(seed: string, variant: SchemeVariant = 'tonalSpot'): ThemePair {
  return {
    light: resolveTokens(seed, variant, 'light'),
    dark: resolveTokens(seed, variant, 'dark'),
  };
}

export function themeSwatch(theme: ThemePair): readonly [string, string, string, string] {
  return [
    theme.light['--color-primary'],
    theme.light['--color-secondary'],
    theme.light['--color-tertiary'],
    theme.light['--color-container-high'],
  ];
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!/^#[\da-f]{6}$/i.test(trimmed)) return null;
  return `#${trimmed.slice(1).toUpperCase()}`;
}
