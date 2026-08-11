export const APP_ROUTES = [
  { destination: 'overview', label: 'Übersicht', path: '/' },
  { destination: 'upcoming', label: 'Demnächst', path: '/demnaechst' },
  { destination: 'budget', label: 'Budget', path: '/budget' },
  { destination: 'debt', label: 'Schulden', path: '/schulden' },
] as const;

export type Destination = (typeof APP_ROUTES)[number]['destination'];
export type AppPath = (typeof APP_ROUTES)[number]['path'];

export const DEFAULT_DESTINATION: Destination = 'overview';
export const DEFAULT_APP_PATH: AppPath = '/';
export const LAST_DESTINATION_STORAGE_KEY = 'finance-last-destination-v1';
export const PWA_LAUNCH_PARAMETER = 'app-launch';
export const PWA_LAUNCH_VALUE = 'pwa';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type LocationLike = Pick<Location, 'hash' | 'pathname' | 'search'>;
type HistoryLike = Pick<History, 'replaceState' | 'state'>;

const routeByDestination = new Map<Destination, (typeof APP_ROUTES)[number]>(
  APP_ROUTES.map((route) => [route.destination, route]),
);
const routeByPath = new Map<AppPath, (typeof APP_ROUTES)[number]>(
  APP_ROUTES.map((route) => [route.path, route]),
);
const destinations = new Set<Destination>(APP_ROUTES.map(({ destination }) => destination));
const appPaths = new Set<AppPath>(APP_ROUTES.map(({ path }) => path));

export function isDestination(value: unknown): value is Destination {
  return typeof value === 'string' && destinations.has(value as Destination);
}

export function isAppPath(value: unknown): value is AppPath {
  return typeof value === 'string' && appPaths.has(value as AppPath);
}

export function appPathForDestination(destination: Destination): AppPath {
  return routeByDestination.get(destination)?.path ?? DEFAULT_APP_PATH;
}

export function appLabelForDestination(destination: Destination): string {
  return routeByDestination.get(destination)?.label ?? 'Übersicht';
}

export function safeAppReturnPath(value: unknown): AppPath {
  return isAppPath(value) ? value : DEFAULT_APP_PATH;
}

export type AppPathResolution = {
  canonicalPath: AppPath;
  destination: Destination;
  needsReplacement: boolean;
  valid: boolean;
};

export function resolveAppPath(pathname: string): AppPathResolution {
  const exactRoute = routeByPath.get(pathname as AppPath);
  if (exactRoute) {
    return {
      canonicalPath: exactRoute.path,
      destination: exactRoute.destination,
      needsReplacement: false,
      valid: true,
    };
  }

  if (pathname.length > 1 && pathname.endsWith('/') && !pathname.endsWith('//')) {
    const routeWithoutTrailingSlash = routeByPath.get(pathname.slice(0, -1) as AppPath);
    if (routeWithoutTrailingSlash) {
      return {
        canonicalPath: routeWithoutTrailingSlash.path,
        destination: routeWithoutTrailingSlash.destination,
        needsReplacement: true,
        valid: true,
      };
    }
  }

  return {
    canonicalPath: DEFAULT_APP_PATH,
    destination: DEFAULT_DESTINATION,
    needsReplacement: pathname !== DEFAULT_APP_PATH,
    valid: false,
  };
}

export function readStoredDestination(storage: StorageLike | null): Destination | null {
  if (!storage) return null;
  try {
    const stored = storage.getItem(LAST_DESTINATION_STORAGE_KEY);
    return isDestination(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeStoredDestination(destination: Destination, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage || !isDestination(destination)) return false;
  try {
    storage.setItem(LAST_DESTINATION_STORAGE_KEY, destination);
    return true;
  } catch {
    return false;
  }
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function urlFromParts(pathname: string, searchParams: URLSearchParams, hash: string) {
  const search = searchParams.toString();
  return `${pathname}${search ? `?${search}` : ''}${hash}`;
}

export type NavigationResolution = {
  destination: Destination;
  replacementUrl: string | null;
};

export function resolveInitialNavigation(location: LocationLike, storedDestination: Destination | null): NavigationResolution {
  const pathResolution = resolveAppPath(location.pathname);
  const searchParams = new URLSearchParams(location.search);
  const isPwaLaunch = location.pathname === DEFAULT_APP_PATH
    && searchParams.get(PWA_LAUNCH_PARAMETER) === PWA_LAUNCH_VALUE;
  const hadLaunchParameter = searchParams.has(PWA_LAUNCH_PARAMETER);

  if (hadLaunchParameter) searchParams.delete(PWA_LAUNCH_PARAMETER);

  const destination = isPwaLaunch && storedDestination ? storedDestination : pathResolution.destination;
  const canonicalPath = isPwaLaunch ? appPathForDestination(destination) : pathResolution.canonicalPath;
  const replacementUrl = pathResolution.needsReplacement || hadLaunchParameter
    ? urlFromParts(canonicalPath, searchParams, location.hash)
    : null;

  return { destination, replacementUrl };
}

export function resolveHistoryNavigation(location: LocationLike): NavigationResolution {
  const pathResolution = resolveAppPath(location.pathname);
  const replacementUrl = pathResolution.needsReplacement
    ? urlFromParts(pathResolution.canonicalPath, new URLSearchParams(location.search), location.hash)
    : null;
  return { destination: pathResolution.destination, replacementUrl };
}

function applyReplacement(history: HistoryLike, replacementUrl: string | null) {
  if (replacementUrl) history.replaceState(history.state, '', replacementUrl);
}

export function initializeNavigationBeforeRender(
  location: LocationLike = window.location,
  history: HistoryLike = window.history,
  storage: StorageLike | null = browserStorage(),
): Destination {
  const resolution = resolveInitialNavigation(location, readStoredDestination(storage));
  applyReplacement(history, resolution.replacementUrl);
  return resolution.destination;
}

export function resolveBrowserHistoryNavigation(
  location: LocationLike = window.location,
  history: HistoryLike = window.history,
): Destination {
  const resolution = resolveHistoryNavigation(location);
  applyReplacement(history, resolution.replacementUrl);
  return resolution.destination;
}
