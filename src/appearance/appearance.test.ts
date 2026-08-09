import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  APPEARANCE_STORAGE_KEY,
  deserializeAppearancePreference,
  parseAppearancePreference,
  parseConcreteCssColor,
  readStoredAppearance,
  removeStoredAppearance,
  resolveBrowserAccent,
  resolveThemeMode,
  serializeAppearancePreference,
  writeStoredAppearance,
} from './appearanceStore';
import { defaultAppearancePreference, preferenceFromCandidate, presetPalettes } from './themePalettes';

function memoryStorage(initial: string | null = null) {
  const values = new Map<string, string>();
  if (initial) values.set(APPEARANCE_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('AppearancePreferenceV1 persistence', () => {
  it('places the allowlisted synchronous restore before the React entry point', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html.indexOf("localStorage.getItem('finance-appearance-v1')")).toBeGreaterThan(0);
    expect(html.indexOf("localStorage.getItem('finance-appearance-v1')")).toBeLessThan(html.indexOf('/src/main.tsx'));
    expect(html).toContain("root.dataset.themeResolved = resolved");
    expect(html).toContain('!validPalette || !validWallpaper || !validTokens');
  });

  it('round-trips a complete preset and wallpaper preference without image references', () => {
    const preset = preferenceFromCandidate('preset', 'dark', presetPalettes[3]);
    expect(deserializeAppearancePreference(serializeAppearancePreference(preset))).toEqual(preset);

    const wallpaper = preferenceFromCandidate('wallpaper', 'system', presetPalettes[4], {
      hasPreview: true,
      seeds: ['#8E4D64', '#3F5F90'],
    });
    const serialized = serializeAppearancePreference(wallpaper);
    expect(deserializeAppearancePreference(serialized)).toEqual(wallpaper);
    expect(serialized).not.toMatch(/blob:|objectURL|filePath|originalImage|data:image/i);
  });

  it('rejects damaged, incomplete, and future schemas', () => {
    const current = defaultAppearancePreference();
    expect(deserializeAppearancePreference('{broken')).toBeNull();
    expect(parseAppearancePreference({ ...current, version: 2 })).toBeNull();
    expect(parseAppearancePreference({ ...current, theme: { light: current.theme.light } })).toBeNull();
    expect(parseAppearancePreference({ ...current, mode: 'automatic' })).toBeNull();
    expect(parseAppearancePreference({ ...current, wallpaper: { hasPreview: true, seeds: ['not-a-color'] } })).toBeNull();
  });

  it('falls back safely when storage throws', () => {
    const brokenStorage = {
      getItem: () => { throw new DOMException('blocked'); },
      setItem: () => { throw new DOMException('blocked'); },
      removeItem: () => { throw new DOMException('blocked'); },
    };
    expect(readStoredAppearance(brokenStorage)).toBeNull();
    expect(writeStoredAppearance(defaultAppearancePreference(), brokenStorage)).toBe(false);
    expect(removeStoredAppearance(brokenStorage)).toBe(false);
  });

  it('reads, writes, and removes the versioned storage key only', () => {
    const storage = memoryStorage();
    const preference = defaultAppearancePreference();
    expect(writeStoredAppearance(preference, storage)).toBe(true);
    expect(readStoredAppearance(storage)).toEqual(preference);
    expect(removeStoredAppearance(storage)).toBe(true);
    expect(readStoredAppearance(storage)).toBeNull();
  });
});

describe('browser color and mode resolution', () => {
  it('parses only concrete opaque CSS colors', () => {
    expect(parseConcreteCssColor('#2f667a')).toBe('#2F667A');
    expect(parseConcreteCssColor('#abc')).toBe('#AABBCC');
    expect(parseConcreteCssColor('rgb(47, 102, 122)')).toBe('#2F667A');
    expect(parseConcreteCssColor('rgb(47 102 122 / 1)')).toBe('#2F667A');
    expect(parseConcreteCssColor('rgb(47 102 122 / 100%)')).toBe('#2F667A');
    expect(parseConcreteCssColor('color(srgb 0.2 0.4 0.6)')).toBe('#336699');
    expect(parseConcreteCssColor('rgba(47, 102, 122, 0.5)')).toBeNull();
    expect(parseConcreteCssColor('rgb(47 102 122 / 50%)')).toBeNull();
    expect(parseConcreteCssColor('AccentColor')).toBeNull();
    expect(parseConcreteCssColor('teal')).toBeNull();
  });

  it('uses the deterministic seed when system colors are unavailable', () => {
    expect(resolveBrowserAccent(undefined)).toEqual({ seed: '#2F667A', available: false, foreground: null });
  });

  it('accepts only a concrete computed AccentColor from the temporary probe', () => {
    let removed = false;
    const probe = {
      remove: () => { removed = true; },
      setAttribute: () => undefined,
      style: { cssText: '' },
    };
    const fakeDocument = {
      createElement: () => probe,
      documentElement: { append: () => undefined },
      defaultView: {
        CSS: { supports: () => true },
        getComputedStyle: () => ({ backgroundColor: 'rgb(255 255 255)', color: 'rgb(47 102 122)' }),
      },
    } as unknown as Document;
    expect(resolveBrowserAccent(fakeDocument)).toEqual({ seed: '#2F667A', available: true, foreground: '#FFFFFF' });
    expect(removed).toBe(true);

    fakeDocument.defaultView!.getComputedStyle = () => ({ backgroundColor: 'AccentColorText', color: 'AccentColor' }) as CSSStyleDeclaration;
    expect(resolveBrowserAccent(fakeDocument)).toEqual({ seed: '#2F667A', available: false, foreground: null });
  });

  it('resolves explicit modes ahead of the OS and follows the OS only in system mode', () => {
    expect(resolveThemeMode('light', { matches: true })).toBe('light');
    expect(resolveThemeMode('dark', { matches: false })).toBe('dark');
    expect(resolveThemeMode('system', { matches: true })).toBe('dark');
    expect(resolveThemeMode('system', { matches: false })).toBe('light');
  });
});
