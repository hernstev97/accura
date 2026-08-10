export type VisitedDestination = 'overview' | 'upcoming' | 'budget' | 'debt';

export const SCREEN_VISITS_SESSION_KEY = 'finance-screen-visits-v1';

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const validDestinations = new Set<VisitedDestination>(['overview', 'upcoming', 'budget', 'debt']);

function parseVisited(value: string | null) {
  if (!value) return new Set<VisitedDestination>();
  try {
    const parsed: unknown = JSON.parse(value);
    return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is VisitedDestination => validDestinations.has(entry as VisitedDestination)) : []);
  } catch {
    return new Set<VisitedDestination>();
  }
}

export function createScreenVisitStore(storage: SessionStorageLike | null) {
  const memory = new Set<VisitedDestination>();

  const read = () => {
    if (!storage) return new Set(memory);
    try {
      const persisted = parseVisited(storage.getItem(SCREEN_VISITS_SESSION_KEY));
      memory.forEach((destination) => persisted.add(destination));
      return persisted;
    } catch {
      return new Set(memory);
    }
  };

  return {
    has(destination: VisitedDestination) {
      return read().has(destination);
    },
    mark(destination: VisitedDestination) {
      memory.add(destination);
      if (!storage) return;
      try {
        storage.setItem(SCREEN_VISITS_SESSION_KEY, JSON.stringify([...read()]));
      } catch {
        // Privacy modes and storage quotas may reject sessionStorage writes.
      }
    },
    snapshot() {
      return [...read()];
    },
  };
}

const browserStorage = (() => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
})();

export const screenVisitStore = createScreenVisitStore(browserStorage);
