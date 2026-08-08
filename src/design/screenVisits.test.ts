import { describe, expect, it } from 'vitest';
import { createScreenVisitStore, SCREEN_VISITS_SESSION_KEY } from './screenVisits';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('session-scoped destination visits', () => {
  it('claims every destination only once and persists it for the browser-tab session', () => {
    const storage = memoryStorage();
    const firstStore = createScreenVisitStore(storage);
    expect(firstStore.has('overview')).toBe(false);
    firstStore.mark('overview');
    expect(firstStore.has('overview')).toBe(true);
    expect(firstStore.has('budget')).toBe(false);

    const revisitedStore = createScreenVisitStore(storage);
    expect(revisitedStore.has('overview')).toBe(true);
    expect(JSON.parse(storage.getItem(SCREEN_VISITS_SESSION_KEY) ?? '[]')).toEqual(['overview']);
  });

  it('falls back to in-memory tracking when sessionStorage is unavailable', () => {
    const store = createScreenVisitStore(null);
    expect(store.has('debt')).toBe(false);
    store.mark('debt');
    expect(store.has('debt')).toBe(true);
  });

  it('recovers safely from malformed or throwing storage', () => {
    const malformed = { getItem: () => '{not-json', setItem: () => undefined };
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(createScreenVisitStore(malformed).has('budget')).toBe(false);
    const fallback = createScreenVisitStore(throwing);
    fallback.mark('budget');
    expect(fallback.has('budget')).toBe(true);
  });
});
