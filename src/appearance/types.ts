export const themeModes = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof themeModes)[number];

export const colorSources = ['browser', 'wallpaper', 'preset'] as const;
export type ColorSource = (typeof colorSources)[number];

export const schemeVariants = ['tonalSpot', 'neutral', 'vibrant', 'expressive', 'monochrome'] as const;
export type SchemeVariant = (typeof schemeVariants)[number];

export type ResolvedThemeMode = 'light' | 'dark';

export const themeTokenNames = [
  '--color-page',
  '--color-container-low',
  '--color-container',
  '--color-container-high',
  '--color-surface-bright',
  '--color-on-surface',
  '--color-on-surface-variant',
  '--color-primary',
  '--color-on-primary',
  '--color-primary-container',
  '--color-on-primary-container',
  '--color-secondary',
  '--color-on-secondary',
  '--color-secondary-container',
  '--color-on-secondary-container',
  '--color-tertiary',
  '--color-on-tertiary',
  '--color-tertiary-container',
  '--color-on-tertiary-container',
  '--color-outline',
  '--color-outline-variant',
  '--color-scrim',
] as const;

export type ThemeTokenName = (typeof themeTokenNames)[number];
export type ThemeTokenSet = Record<ThemeTokenName, string>;

export type ThemePair = {
  light: ThemeTokenSet;
  dark: ThemeTokenSet;
};

export type PaletteCandidate = {
  id: string;
  name: string;
  seed: string;
  variant: SchemeVariant;
  theme: ThemePair;
  swatch: readonly [string, string, string, string];
};

export type AppearancePreferenceV1 = {
  version: 1;
  mode: ThemeMode;
  source: ColorSource;
  palette: {
    id: string;
    name: string;
    seed: string;
    variant: SchemeVariant;
  };
  theme: ThemePair;
  wallpaper: {
    hasPreview: boolean;
    seeds: string[];
  };
};

export type AppearanceSnapshot = {
  preference: AppearancePreferenceV1;
  resolvedMode: ResolvedThemeMode;
  persisted: boolean;
};
