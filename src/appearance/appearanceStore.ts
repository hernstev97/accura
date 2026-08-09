import { createBrowserPalette, defaultAppearancePreference, preferenceFromCandidate } from './themePalettes';
import { DEFAULT_THEME_SEED, normalizeHexColor } from './themeTokens';
import {
  colorSources,
  schemeVariants,
  themeModes,
  themeTokenNames,
  type AppearancePreferenceV1,
  type AppearanceSnapshot,
  type ResolvedThemeMode,
  type ThemeMode,
  type ThemePair,
  type ThemeTokenSet,
} from './types';

export const APPEARANCE_STORAGE_KEY = 'finance-appearance-v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type MediaQueryLike = Pick<MediaQueryList, 'matches'>;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isOneOf = <T extends string>(value: unknown, options: readonly T[]): value is T => typeof value === 'string' && options.includes(value as T);

function parseTokenSet(value: unknown): ThemeTokenSet | null {
  if (!isRecord(value)) return null;
  const tokens = {} as ThemeTokenSet;
  for (const tokenName of themeTokenNames) {
    const color = value[tokenName];
    const normalized = typeof color === 'string' ? normalizeHexColor(color) : null;
    if (!normalized) return null;
    tokens[tokenName] = normalized;
  }
  return tokens;
}

function parseThemePair(value: unknown): ThemePair | null {
  if (!isRecord(value)) return null;
  const light = parseTokenSet(value.light);
  const dark = parseTokenSet(value.dark);
  return light && dark ? { light, dark } : null;
}

export function parseAppearancePreference(value: unknown): AppearancePreferenceV1 | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (!isOneOf(value.mode, themeModes) || !isOneOf(value.source, colorSources)) return null;
  if (!isRecord(value.palette) || typeof value.palette.id !== 'string' || !value.palette.id.trim()) return null;
  if (typeof value.palette.name !== 'string' || !value.palette.name.trim()) return null;
  if (!isOneOf(value.palette.variant, schemeVariants)) return null;
  const seed = typeof value.palette.seed === 'string' ? normalizeHexColor(value.palette.seed) : null;
  const theme = parseThemePair(value.theme);
  if (!seed || !theme || !isRecord(value.wallpaper) || typeof value.wallpaper.hasPreview !== 'boolean' || !Array.isArray(value.wallpaper.seeds)) return null;
  const seeds = value.wallpaper.seeds.map((entry) => typeof entry === 'string' ? normalizeHexColor(entry) : null);
  if (seeds.length > 3 || seeds.some((entry) => entry === null)) return null;

  return {
    version: 1,
    mode: value.mode,
    source: value.source,
    palette: {
      id: value.palette.id,
      name: value.palette.name,
      seed,
      variant: value.palette.variant,
    },
    theme,
    wallpaper: {
      hasPreview: value.wallpaper.hasPreview,
      seeds: seeds as string[],
    },
  };
}

export function deserializeAppearancePreference(raw: string | null): AppearancePreferenceV1 | null {
  if (!raw) return null;
  try {
    return parseAppearancePreference(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function serializeAppearancePreference(preference: AppearancePreferenceV1): string {
  const validated = parseAppearancePreference(preference);
  if (!validated) throw new TypeError('Appearance preference is incomplete or invalid.');
  return JSON.stringify(validated);
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredAppearance(storage: StorageLike | null = browserStorage()): AppearancePreferenceV1 | null {
  if (!storage) return null;
  try {
    return deserializeAppearancePreference(storage.getItem(APPEARANCE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredAppearance(preference: AppearancePreferenceV1, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(APPEARANCE_STORAGE_KEY, serializeAppearancePreference(preference));
    return true;
  } catch {
    return false;
  }
}

export function removeStoredAppearance(storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(APPEARANCE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function byteToHex(value: number) {
  return Math.round(value).toString(16).padStart(2, '0');
}

function parseRgbChannel(value: string): number | null {
  const percentage = value.endsWith('%');
  const parsed = Number.parseFloat(value);
  const channel = percentage ? parsed * 2.55 : parsed;
  return Number.isFinite(channel) && channel >= 0 && channel <= 255 ? channel : null;
}

function parseAlphaChannel(value: string): number | null {
  const parsed = Number.parseFloat(value);
  const alpha = value.endsWith('%') ? parsed / 100 : parsed;
  return Number.isFinite(alpha) && alpha >= 0 && alpha <= 1 ? alpha : null;
}

export function parseConcreteCssColor(value: string): string | null {
  const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) {
    const expanded = hex[1].length === 3 ? [...hex[1]].map((character) => `${character}${character}`).join('') : hex[1];
    return `#${expanded.toUpperCase()}`;
  }

  const rgb = value.trim().match(/^rgba?\((.+)\)$/i);
  if (rgb) {
    const components = rgb[1].replaceAll(',', ' ').replace('/', ' ').split(/\s+/).filter(Boolean);
    if (components.length < 3 || components.length > 4) return null;
    const channels = components.slice(0, 3).map(parseRgbChannel);
    const alpha = components[3] === undefined ? 1 : parseAlphaChannel(components[3]);
    if (channels.some((channel) => channel === null) || alpha === null || alpha < 0.99) return null;
    return `#${channels.map((channel) => byteToHex(channel!)).join('').toUpperCase()}`;
  }

  const srgb = value.trim().match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/i);
  if (srgb) {
    const channels = srgb.slice(1, 4).map(Number);
    const alpha = srgb[4] === undefined ? 1 : Number(srgb[4]);
    if (channels.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 1) || !Number.isFinite(alpha) || alpha < 0.99) return null;
    return `#${channels.map((channel) => byteToHex(channel * 255)).join('').toUpperCase()}`;
  }
  return null;
}

export type BrowserAccentResolution = { seed: string; available: boolean; foreground: string | null };

export function resolveBrowserAccent(documentRef: Document | undefined = typeof document === 'undefined' ? undefined : document): BrowserAccentResolution {
  const css = documentRef?.defaultView?.CSS;
  if (!documentRef || !css?.supports('color', 'AccentColor')) return { seed: DEFAULT_THEME_SEED, available: false, foreground: null };

  const probe = documentRef.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;inline-size:0;block-size:0;overflow:hidden;pointer-events:none;color:AccentColor;background-color:AccentColorText;';
  try {
    documentRef.documentElement.append(probe);
    const style = documentRef.defaultView?.getComputedStyle(probe);
    const seed = style ? parseConcreteCssColor(style.color) : null;
    const foreground = style ? parseConcreteCssColor(style.backgroundColor) : null;
    return seed ? { seed, available: true, foreground } : { seed: DEFAULT_THEME_SEED, available: false, foreground: null };
  } catch {
    return { seed: DEFAULT_THEME_SEED, available: false, foreground: null };
  } finally {
    probe.remove();
  }
}

export function resolveThemeMode(mode: ThemeMode, media: MediaQueryLike | null = typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)')): ResolvedThemeMode {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return media?.matches ? 'dark' : 'light';
}

function updateThemeColorMeta(documentRef: Document, preference: AppearancePreferenceV1, resolvedMode: ResolvedThemeMode) {
  documentRef.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"][data-theme-fallback]').forEach((meta) => {
    const mode = meta.dataset.themeFallback === 'dark' ? 'dark' : 'light';
    meta.content = preference.theme[mode]['--color-page'];
  });
  let active = documentRef.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-appearance-theme-color]');
  if (!active) {
    active = documentRef.createElement('meta');
    active.name = 'theme-color';
    active.dataset.appearanceThemeColor = 'active';
    documentRef.head.append(active);
  }
  active.content = preference.theme[resolvedMode]['--color-page'];
}

export function applyAppearanceToDocument(preference: AppearancePreferenceV1, resolvedMode: ResolvedThemeMode, documentRef: Document | undefined = typeof document === 'undefined' ? undefined : document) {
  if (!documentRef) return;
  const root = documentRef.documentElement;
  const tokens = preference.theme[resolvedMode];
  root.dataset.themeMode = preference.mode;
  root.dataset.themeResolved = resolvedMode;
  root.dataset.colorSource = preference.source;
  root.dataset.appearanceReady = 'true';
  root.style.colorScheme = resolvedMode;
  themeTokenNames.forEach((tokenName) => root.style.setProperty(tokenName, tokens[tokenName]));
  updateThemeColorMeta(documentRef, preference, resolvedMode);
}

export function appearanceForCurrentBrowser(preference: AppearancePreferenceV1): AppearancePreferenceV1 {
  if (preference.source !== 'browser') return preference;
  const { seed } = resolveBrowserAccent();
  return preferenceFromCandidate('browser', preference.mode, createBrowserPalette(seed));
}

export function initializeAppearanceBeforeRender(): AppearanceSnapshot {
  const stored = readStoredAppearance();
  const preference = appearanceForCurrentBrowser(stored ?? defaultAppearancePreference());
  const resolvedMode = resolveThemeMode(preference.mode);
  applyAppearanceToDocument(preference, resolvedMode);
  return { preference, resolvedMode, persisted: Boolean(stored) };
}
