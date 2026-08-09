import { Hct, argbFromHex } from '@material/material-color-utilities';
import { DEFAULT_THEME_SEED, generateThemePair, normalizeHexColor, themeSwatch } from './themeTokens';
import type { AppearancePreferenceV1, ColorSource, PaletteCandidate, SchemeVariant, ThemeMode } from './types';

type PresetDefinition = { id: string; name: string; seed: string };

export const presetDefinitions = [
  { id: 'petrol', name: 'Petrol', seed: '#2F667A' },
  { id: 'blue', name: 'Blau', seed: '#3F5F90' },
  { id: 'indigo', name: 'Indigo', seed: '#60558F' },
  { id: 'violet', name: 'Violett', seed: '#79548A' },
  { id: 'pink', name: 'Rosa', seed: '#8E4D64' },
  { id: 'green', name: 'Grün', seed: '#4F6B4B' },
  { id: 'amber', name: 'Bernstein', seed: '#85531A' },
  { id: 'coral', name: 'Koralle', seed: '#8F4C38' },
  { id: 'neutral', name: 'Neutral', seed: '#5F6368' },
] as const satisfies readonly PresetDefinition[];

function candidate(id: string, name: string, seed: string, variant: SchemeVariant): PaletteCandidate {
  const normalizedSeed = normalizeHexColor(seed) ?? DEFAULT_THEME_SEED;
  const theme = generateThemePair(normalizedSeed, variant);
  return { id, name, seed: normalizedSeed, variant, theme, swatch: themeSwatch(theme) };
}

export const presetPalettes: readonly PaletteCandidate[] = presetDefinitions.map(({ id, name, seed }) => (
  candidate(`preset-${id}`, name, seed, 'tonalSpot')
));

const wallpaperVariantNames: Record<SchemeVariant, string> = {
  tonalSpot: 'Tonal Spot',
  neutral: 'Neutral',
  vibrant: 'Vibrant',
  expressive: 'Expressiv',
  monochrome: 'Monochrom',
};

function circularHueDistance(a: number, b: number) {
  const difference = Math.abs(a - b);
  return Math.min(difference, 360 - difference);
}

export function areSeedsDistinct(first: string, second: string): boolean {
  const a = Hct.fromInt(argbFromHex(first));
  const b = Hct.fromInt(argbFromHex(second));
  const hueDistance = circularHueDistance(a.hue, b.hue);
  const chromaDistance = Math.abs(a.chroma - b.chroma);
  const toneDistance = Math.abs(a.tone - b.tone);
  return hueDistance >= 18 || chromaDistance >= 16 || toneDistance >= 18;
}

export function dedupeSeedColors(seeds: readonly string[], limit = 3): string[] {
  const distinct: string[] = [];
  for (const seed of seeds) {
    const normalized = normalizeHexColor(seed);
    if (!normalized || distinct.some((existing) => !areSeedsDistinct(existing, normalized))) continue;
    distinct.push(normalized);
    if (distinct.length === limit) break;
  }
  return distinct;
}

export function createWallpaperPalettes(seeds: readonly string[]): PaletteCandidate[] {
  const distinctSeeds = dedupeSeedColors(seeds);
  const bestSeed = distinctSeeds[0] ?? DEFAULT_THEME_SEED;
  const bestId = bestSeed.slice(1).toLowerCase();
  const variants: SchemeVariant[] = ['tonalSpot', 'neutral', 'vibrant', 'expressive', 'monochrome'];
  const palettes = variants.map((variant) => candidate(
    `wallpaper-${variant}-${bestId}`,
    `${wallpaperVariantNames[variant]} aus Hintergrundbild`,
    bestSeed,
    variant,
  ));

  distinctSeeds.slice(1, 3).forEach((seed, index) => {
    palettes.push(candidate(
      `wallpaper-tonalSpot-${seed.slice(1).toLowerCase()}`,
      `Weitere Bildfarbe ${index + 2}`,
      seed,
      'tonalSpot',
    ));
  });
  return palettes;
}

export function createBrowserPalette(seed: string): PaletteCandidate {
  return candidate('browser-system', 'System', seed, 'tonalSpot');
}

export function preferenceFromCandidate(
  source: ColorSource,
  mode: ThemeMode,
  palette: PaletteCandidate,
  wallpaper: AppearancePreferenceV1['wallpaper'] = { hasPreview: false, seeds: [] },
): AppearancePreferenceV1 {
  return {
    version: 1,
    mode,
    source,
    palette: { id: palette.id, name: palette.name, seed: palette.seed, variant: palette.variant },
    theme: palette.theme,
    wallpaper,
  };
}

export function defaultAppearancePreference(seed = DEFAULT_THEME_SEED): AppearancePreferenceV1 {
  return preferenceFromCandidate('browser', 'system', createBrowserPalette(seed));
}
