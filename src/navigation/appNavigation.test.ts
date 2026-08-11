import { describe, expect, it, vi } from 'vitest';
import {
  APP_ROUTES,
  LAST_DESTINATION_STORAGE_KEY,
  appLabelForDestination,
  appPathForDestination,
  initializeNavigationBeforeRender,
  readStoredDestination,
  resolveAppPath,
  resolveInitialNavigation,
  safeAppReturnPath,
  writeStoredDestination,
  type Destination,
} from './appNavigation';

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(LAST_DESTINATION_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

const location = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });

describe('app navigation contract', () => {
  it('maps every destination to its canonical path and label', () => {
    expect(APP_ROUTES).toEqual([
      { destination: 'overview', label: 'Übersicht', path: '/' },
      { destination: 'upcoming', label: 'Demnächst', path: '/demnaechst' },
      { destination: 'budget', label: 'Budget', path: '/budget' },
      { destination: 'debt', label: 'Schulden', path: '/schulden' },
    ]);

    for (const route of APP_ROUTES) {
      expect(appPathForDestination(route.destination)).toBe(route.path);
      expect(appLabelForDestination(route.destination)).toBe(route.label);
      expect(resolveAppPath(route.path)).toMatchObject({
        canonicalPath: route.path,
        destination: route.destination,
        needsReplacement: false,
        valid: true,
      });
    }
  });

  it('normalizes one trailing slash and replaces unknown paths with the overview', () => {
    expect(resolveAppPath('/budget/')).toEqual({
      canonicalPath: '/budget',
      destination: 'budget',
      needsReplacement: true,
      valid: true,
    });
    for (const invalidPath of ['/budget//', '/Budget', '/unbekannt']) {
      expect(resolveAppPath(invalidPath)).toMatchObject({
        canonicalPath: '/',
        destination: 'overview',
        needsReplacement: true,
        valid: false,
      });
    }
  });

  it('accepts only exact canonical OAuth return paths', () => {
    for (const { path } of APP_ROUTES) expect(safeAppReturnPath(path)).toBe(path);
    for (const unsafe of [
      'https://evil.example/budget',
      '//evil.example',
      '/budget?next=https://evil.example',
      '/budget/',
      '%2Fbudget',
      '/unbekannt',
      null,
    ]) {
      expect(safeAppReturnPath(unsafe)).toBe('/');
    }
  });
});

describe('last destination storage', () => {
  it('stores only a valid destination in a versioned entry', () => {
    const storage = memoryStorage();
    expect(writeStoredDestination('debt', storage)).toBe(true);
    expect(storage.getItem(LAST_DESTINATION_STORAGE_KEY)).toBe('debt');
    expect(readStoredDestination(storage)).toBe('debt');
  });

  it('rejects malformed values and tolerates unavailable storage', () => {
    expect(readStoredDestination(memoryStorage('https://evil.example'))).toBeNull();
    expect(readStoredDestination(null)).toBeNull();
    expect(writeStoredDestination('manipulated' as Destination, memoryStorage())).toBe(false);

    const throwing = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(readStoredDestination(throwing)).toBeNull();
    expect(writeStoredDestination('budget', throwing)).toBe(false);
  });
});

describe('initial navigation precedence', () => {
  it('keeps explicit root and deep links ahead of the stored destination', () => {
    expect(resolveInitialNavigation(location('/'), 'budget')).toEqual({ destination: 'overview', replacementUrl: null });
    expect(resolveInitialNavigation(location('/schulden'), 'budget')).toEqual({ destination: 'debt', replacementUrl: null });
  });

  it('restores a stored destination only for the marked PWA launch', () => {
    expect(resolveInitialNavigation(location('/', '?app-launch=pwa&source=launcher', '#status'), 'budget')).toEqual({
      destination: 'budget',
      replacementUrl: '/budget?source=launcher#status',
    });
    expect(resolveInitialNavigation(location('/', '?app-launch=pwa'), null)).toEqual({
      destination: 'overview',
      replacementUrl: '/',
    });
  });

  it('removes reserved launch markers and preserves unrelated URL parts during fallback', () => {
    expect(resolveInitialNavigation(location('/unbekannt', '?app-launch=pwa&auth_error=failed', '#details'), 'debt')).toEqual({
      destination: 'overview',
      replacementUrl: '/?auth_error=failed#details',
    });
  });

  it('applies canonical replacement before render without adding a history entry', () => {
    const replaceState = vi.fn();
    const history = { state: { retained: true }, replaceState };
    const destination = initializeNavigationBeforeRender(
      location('/demnaechst/', '?source=link', '#next'),
      history,
      memoryStorage('debt'),
    );

    expect(destination).toBe<Destination>('upcoming');
    expect(replaceState).toHaveBeenCalledWith({ retained: true }, '', '/demnaechst?source=link#next');
  });
});
