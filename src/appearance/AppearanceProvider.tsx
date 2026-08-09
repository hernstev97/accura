/* eslint-disable react-refresh/only-export-components -- appearance context and provider intentionally share this module */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  APPEARANCE_STORAGE_KEY,
  appearanceForCurrentBrowser,
  applyAppearanceToDocument,
  deserializeAppearancePreference,
  initializeAppearanceBeforeRender,
  parseAppearancePreference,
  readStoredAppearance,
  removeStoredAppearance,
  resolveBrowserAccent,
  resolveThemeMode,
  writeStoredAppearance,
} from './appearanceStore';
import { createBrowserPalette, defaultAppearancePreference, preferenceFromCandidate } from './themePalettes';
import { themeSwatch } from './themeTokens';
import type { AppearancePreferenceV1, AppearanceSnapshot, PaletteCandidate, ResolvedThemeMode } from './types';
import { loadWallpaperPreview, removeWallpaperPreview, saveWallpaperPreview } from './wallpaperStore';

export type AppearanceApplyResult = {
  preferencePersisted: boolean;
  previewPersisted: boolean;
};

export type AppearanceApplyOptions = {
  wallpaperPreview?: Blob | null;
};

type AppearanceContextValue = {
  preference: AppearancePreferenceV1;
  resolvedMode: ResolvedThemeMode;
  activePalette: PaletteCandidate;
  wallpaperPreviewUrl: string | null;
  applyPreference: (preference: AppearancePreferenceV1, options?: AppearanceApplyOptions) => Promise<AppearanceApplyResult>;
  resetPreference: () => Promise<AppearanceApplyResult>;
  resolveBrowserPalette: () => PaletteCandidate;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function paletteFromPreference(preference: AppearancePreferenceV1): PaletteCandidate {
  return {
    ...preference.palette,
    theme: preference.theme,
    swatch: themeSwatch(preference.theme),
  };
}

function preferenceKey(preference: AppearancePreferenceV1) {
  return `${preference.source}:${preference.mode}:${preference.palette.id}:${preference.palette.seed}:${preference.wallpaper.hasPreview}`;
}

export function AppearanceProvider({ children, initialSnapshot }: { children: ReactNode; initialSnapshot?: AppearanceSnapshot }) {
  const initial = useMemo(() => initialSnapshot ?? initializeAppearanceBeforeRender(), [initialSnapshot]);
  const [preference, setPreference] = useState(initial.preference);
  const [resolvedMode, setResolvedMode] = useState(initial.resolvedMode);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const preferenceRef = useRef(preference);
  const persistedRef = useRef(initial.persisted);
  preferenceRef.current = preference;

  const wallpaperPreviewUrl = useMemo(() => previewBlob && typeof URL !== 'undefined' ? URL.createObjectURL(previewBlob) : null, [previewBlob]);
  useEffect(() => () => {
    if (wallpaperPreviewUrl) URL.revokeObjectURL(wallpaperPreviewUrl);
  }, [wallpaperPreviewUrl]);

  const activate = useCallback((nextPreference: AppearancePreferenceV1) => {
    const nextMode = resolveThemeMode(nextPreference.mode);
    applyAppearanceToDocument(nextPreference, nextMode);
    preferenceRef.current = nextPreference;
    setPreference(nextPreference);
    setResolvedMode(nextMode);
  }, []);

  const resolveBrowserPalette = useCallback(() => createBrowserPalette(resolveBrowserAccent().seed), []);

  const applyPreference = useCallback(async (candidatePreference: AppearancePreferenceV1, options: AppearanceApplyOptions = {}): Promise<AppearanceApplyResult> => {
    const parsed = parseAppearancePreference(candidatePreference);
    if (!parsed) throw new TypeError('Appearance preference is incomplete or invalid.');

    let nextPreference = parsed;
    let previewPersisted = true;
    if (parsed.source === 'wallpaper') {
      if (options.wallpaperPreview instanceof Blob) {
        try {
          await saveWallpaperPreview(options.wallpaperPreview);
          setPreviewBlob(options.wallpaperPreview);
          nextPreference = { ...parsed, wallpaper: { ...parsed.wallpaper, hasPreview: true } };
        } catch {
          previewPersisted = false;
          setPreviewBlob(options.wallpaperPreview);
          nextPreference = { ...parsed, wallpaper: { ...parsed.wallpaper, hasPreview: false } };
        }
      }
    } else {
      setPreviewBlob(null);
      try {
        await removeWallpaperPreview();
      } catch {
        previewPersisted = false;
      }
      nextPreference = { ...parsed, wallpaper: { hasPreview: false, seeds: [] } };
    }

    activate(nextPreference);
    const preferencePersisted = writeStoredAppearance(nextPreference);
    persistedRef.current = preferencePersisted;
    return { preferencePersisted, previewPersisted };
  }, [activate]);

  const resetPreference = useCallback(async (): Promise<AppearanceApplyResult> => {
    const preferencePersisted = removeStoredAppearance();
    let previewPersisted = true;
    try {
      await removeWallpaperPreview();
    } catch {
      previewPersisted = false;
    }
    setPreviewBlob(null);
    const fallback = preferenceFromCandidate('browser', 'system', resolveBrowserPalette());
    persistedRef.current = false;
    activate(fallback);
    return { preferencePersisted, previewPersisted };
  }, [activate, resolveBrowserPalette]);

  useEffect(() => {
    let current = true;
    if (preference.source !== 'wallpaper' || !preference.wallpaper.hasPreview) {
      setPreviewBlob(null);
      return () => { current = false; };
    }
    void loadWallpaperPreview().then((blob) => {
      if (current && blob) setPreviewBlob(blob);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [preference.source, preference.wallpaper.hasPreview, preference.palette.id]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const current = preferenceRef.current;
      if (current.mode !== 'system') return;
      const nextMode = resolveThemeMode('system', media);
      if (nextMode === resolvedMode) return;
      applyAppearanceToDocument(current, nextMode);
      setResolvedMode(nextMode);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [resolvedMode]);

  useEffect(() => {
    const refreshBrowserTheme = () => {
      if (document.visibilityState !== 'visible') return;
      const current = preferenceRef.current;
      if (current.source !== 'browser') return;
      const refreshed = appearanceForCurrentBrowser(current);
      if (preferenceKey(refreshed) === preferenceKey(current)) return;
      activate(refreshed);
      if (persistedRef.current) persistedRef.current = writeStoredAppearance(refreshed);
    };
    document.addEventListener('visibilitychange', refreshBrowserTheme);
    window.addEventListener('pageshow', refreshBrowserTheme);
    return () => {
      document.removeEventListener('visibilitychange', refreshBrowserTheme);
      window.removeEventListener('pageshow', refreshBrowserTheme);
    };
  }, [activate]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== APPEARANCE_STORAGE_KEY) return;
      const stored = deserializeAppearancePreference(event.newValue);
      const next = appearanceForCurrentBrowser(stored ?? defaultAppearancePreference());
      persistedRef.current = Boolean(stored);
      activate(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [activate]);

  useEffect(() => {
    const stored = readStoredAppearance();
    if (!stored || stored.source !== 'browser') return;
    const refreshed = appearanceForCurrentBrowser(stored);
    if (preferenceKey(refreshed) !== preferenceKey(preferenceRef.current)) activate(refreshed);
  }, [activate]);

  const activePalette = useMemo(() => paletteFromPreference(preference), [preference]);
  const value = useMemo<AppearanceContextValue>(() => ({
    preference,
    resolvedMode,
    activePalette,
    wallpaperPreviewUrl,
    applyPreference,
    resetPreference,
    resolveBrowserPalette,
  }), [activePalette, applyPreference, preference, resetPreference, resolveBrowserPalette, resolvedMode, wallpaperPreviewUrl]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance must be used inside AppearanceProvider.');
  return context;
}
