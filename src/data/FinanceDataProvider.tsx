/* eslint-disable react-refresh/only-export-components -- provider hooks and reducer intentionally share one state boundary */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { FinanceDataV1, FinanceValidationIssue } from '../finance/types';
import { createFinanceViewModel, type FinanceViewModel } from '../finance/viewModel';
import { getCurrentUserDateISO, millisecondsUntilNextLocalDay } from '../lib/calendarDate';
import { safeAppReturnPath } from '../navigation/appNavigation';
import {
  clearCachedFinanceData,
  loadCachedFinanceData,
  readFinanceCacheGeneration,
  restoreFinanceCacheGeneration,
  rotateFinanceCacheGeneration,
  saveCachedFinanceData,
} from './financeCache';
import { FinanceApiError, productionFinanceApi, type FinanceApi, type FinanceSession } from './financeApi';
import { runWithAbortTimeout } from './requestTimeout';

const STALE_AFTER_MS = 10 * 60 * 1000;
export const PROTECTED_ACCESS_RECOVERY_TIMEOUT_MS = 15_000;

export type AuthState = 'checking' | 'signed-out' | 'authenticated' | 'offline';
export type ConnectionState = 'unknown' | 'ready' | 'missing';
export type SyncState = 'initial' | 'syncing' | 'idle' | 'stale' | 'offline' | 'validation-error' | 'error';
export type ProtectedAccessRecoveryResult = 'success' | 'offline' | 'error';

export type FinanceUiError = {
  code: string;
  message: string;
  issues?: FinanceValidationIssue[];
};

export type FinanceProviderState = {
  authState: AuthState;
  connectionState: ConnectionState;
  syncState: SyncState;
  email: string | null;
  csrfToken: string | null;
  data: FinanceDataV1 | null;
  lastSuccessfulRefresh: string | null;
  stale: boolean;
  error: FinanceUiError | null;
};

export const initialFinanceState: FinanceProviderState = {
  authState: 'checking',
  connectionState: 'unknown',
  syncState: 'initial',
  email: null,
  csrfToken: null,
  data: null,
  lastSuccessfulRefresh: null,
  stale: false,
  error: null,
};

type Action =
  | { type: 'cache-loaded'; data: FinanceDataV1; refreshedAt: string }
  | { type: 'signed-out'; error?: FinanceUiError }
  | { type: 'authenticated'; session: Extract<FinanceSession, { authenticated: true }> }
  | { type: 'offline-startup'; hasData: boolean }
  | { type: 'sync-started' }
  | { type: 'sync-succeeded'; data: FinanceDataV1; refreshedAt: string }
  | { type: 'sync-failed'; error: FinanceUiError; syncState: SyncState; missing?: boolean }
  | { type: 'reset' };

export function financeProviderReducer(state: FinanceProviderState, action: Action): FinanceProviderState {
  switch (action.type) {
    case 'cache-loaded':
      return { ...state, data: action.data, lastSuccessfulRefresh: action.refreshedAt, stale: true, syncState: 'stale', connectionState: 'ready' };
    case 'signed-out':
      return { ...initialFinanceState, authState: 'signed-out', connectionState: 'unknown', syncState: 'idle', error: action.error ?? null };
    case 'authenticated':
      return {
        ...state,
        authState: 'authenticated',
        connectionState: state.data ? 'ready' : 'unknown',
        email: action.session.user.email,
        csrfToken: action.session.csrfToken,
        stale: Boolean(state.data),
        syncState: state.data ? 'stale' : 'initial',
        error: null,
      };
    case 'offline-startup':
      return {
        ...state,
        authState: action.hasData ? 'offline' : 'signed-out',
        connectionState: action.hasData ? 'ready' : 'unknown',
        syncState: 'offline',
        stale: action.hasData,
        error: action.hasData ? null : { code: 'network_error', message: 'Offline und keine gespeicherten Daten verfügbar.' },
      };
    case 'sync-started':
      return { ...state, syncState: 'syncing', error: null };
    case 'sync-succeeded':
      return { ...state, connectionState: 'ready', syncState: 'idle', data: action.data, lastSuccessfulRefresh: action.refreshedAt, stale: false, error: null };
    case 'sync-failed':
      return {
        ...state,
        connectionState: action.missing && !state.data ? 'missing' : state.connectionState,
        syncState: action.syncState,
        stale: Boolean(state.data),
        error: action.error,
      };
    case 'reset':
      return { ...initialFinanceState, authState: 'signed-out', connectionState: 'unknown', syncState: 'idle' };
  }
}

type FinanceContextValue = FinanceProviderState & {
  viewModel: FinanceViewModel | null;
  online: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  recoverProtectedAccess: () => Promise<ProtectedAccessRecoveryResult>;
  signIn: () => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

const toUiError = (error: unknown): FinanceUiError => error instanceof FinanceApiError
  ? { code: error.code, message: error.message, issues: error.issues }
  : { code: 'unknown_error', message: 'Ein unerwarteter Fehler ist aufgetreten.' };

const syncStateFor = (error: FinanceUiError, online: boolean): SyncState => {
  if (!online || error.code === 'network_error') return 'offline';
  if (error.code === 'finance_data_integrity' || error.code === 'invalid_finance_schema') return 'validation-error';
  return 'error';
};

export function FinanceDataProvider({
  children,
  api = productionFinanceApi,
  initialState = initialFinanceState,
}: {
  children: ReactNode;
  api?: FinanceApi;
  initialState?: FinanceProviderState;
}) {
  const [state, dispatch] = useReducer(financeProviderReducer, initialState);
  const [online, setOnline] = useReducer((_current: boolean, next: boolean) => next, typeof navigator === 'undefined' ? true : navigator.onLine);
  const [projectionDate, setProjectionDate] = useState(getCurrentUserDateISO);
  const stateRef = useRef(state);
  const refreshPromise = useRef<Promise<void> | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const cacheGeneration = useRef(readFinanceCacheGeneration());
  stateRef.current = state;

  const acceptFinanceResponse = useCallback(async (
    response: Awaited<ReturnType<FinanceApi['getFinance']>>,
    requestGeneration: number,
    requestCacheGeneration: string,
  ) => {
    if (generation.current !== requestGeneration) return;
    const persisted = await saveCachedFinanceData({
      refreshedAt: response.refreshedAt,
      data: response.data,
    }, requestCacheGeneration);
    if (!persisted || generation.current !== requestGeneration) return;
    dispatch({ type: 'sync-succeeded', ...response });
  }, []);

  const refresh = useCallback(async () => {
    if (refreshPromise.current) return refreshPromise.current;
    const current = stateRef.current;
    if (current.authState !== 'authenticated' && current.authState !== 'offline') return;
    const requestGeneration = generation.current;
    const requestCacheGeneration = cacheGeneration.current;
    const controller = new AbortController();
    abortController.current = controller;
    const task = (async () => {
      dispatch({ type: 'sync-started' });
      try {
        const response = await api.getFinance(controller.signal);
        await acceptFinanceResponse(response, requestGeneration, requestCacheGeneration);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (generation.current !== requestGeneration) return;
        const uiError = toUiError(error);
        dispatch({
          type: 'sync-failed',
          error: uiError,
          syncState: syncStateFor(uiError, navigator.onLine),
          missing: uiError.code === 'finance_missing',
        });
      } finally {
        if (abortController.current === controller) abortController.current = null;
        refreshPromise.current = null;
      }
    })();
    refreshPromise.current = task;
    return task;
  }, [acceptFinanceResponse, api]);

  useEffect(() => {
    let dayChangeTimer: number;
    const updateProjectionDate = () => {
      window.clearTimeout(dayChangeTimer);
      setProjectionDate(getCurrentUserDateISO());
      dayChangeTimer = window.setTimeout(updateProjectionDate, millisecondsUntilNextLocalDay());
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') updateProjectionDate();
    };
    updateProjectionDate();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(dayChangeTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const cached = await loadCachedFinanceData().catch(() => null);
      if (!active) return;
      if (cached) dispatch({
        type: 'cache-loaded',
        data: cached.data,
        refreshedAt: cached.refreshedAt,
      });
      try {
        const session = await api.getSession();
        if (!active) return;
        if (!session.authenticated) {
          const authError = new URLSearchParams(window.location.search).get('auth_error');
          if (authError) {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete('auth_error');
            window.history.replaceState(
              window.history.state,
              '',
              `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
            );
          }
          const message = authError === 'user_not_allowed'
            ? 'Dieses Google-Konto ist nicht für die App freigeschaltet.'
            : authError ? 'Die Google-Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.' : undefined;
          dispatch({ type: 'signed-out', error: message ? { code: authError!, message } : undefined });
          return;
        }
        dispatch({ type: 'authenticated', session });
        stateRef.current = financeProviderReducer(stateRef.current, { type: 'authenticated', session });
        await refresh();
      } catch {
        if (active) dispatch({ type: 'offline-startup', hasData: Boolean(cached) });
      }
    })();
    return () => {
      active = false;
      generation.current += 1;
      abortController.current?.abort();
    };
  }, [api, refresh]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      if (stateRef.current.authState === 'authenticated') void refresh();
    };
    const onOffline = () => {
      setOnline(false);
      if (stateRef.current.data) dispatch({ type: 'sync-failed', syncState: 'offline', error: { code: 'offline', message: 'Offline – gespeicherter Datenstand wird angezeigt.' } });
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const last = stateRef.current.lastSuccessfulRefresh;
      if (!last || Date.now() - new Date(last).valueOf() > STALE_AFTER_MS) void refresh();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, setOnline]);

  const logout = useCallback(async () => {
    const csrfToken = stateRef.current.csrfToken;
    if (!csrfToken) return;
    try {
      await api.logout(csrfToken);
      generation.current += 1;
      abortController.current?.abort();
      dispatch({ type: 'reset' });
    } catch (error) {
      const uiError = toUiError(error);
      dispatch({ type: 'sync-failed', error: uiError, syncState: syncStateFor(uiError, navigator.onLine) });
    }
  }, [api]);

  const recoverProtectedAccess = useCallback(async (): Promise<ProtectedAccessRecoveryResult> => {
    if (!navigator.onLine || stateRef.current.authState === 'offline') return 'offline';
    const current = stateRef.current;
    let endSession: ((signal: AbortSignal) => Promise<void>) | null = null;
    if (current.authState === 'authenticated') {
      if (!current.csrfToken) return 'error';
      const csrfToken = current.csrfToken;
      endSession = (signal) => api.logout(csrfToken, signal);
    } else if (current.authState !== 'signed-out') {
      return 'error';
    }
    const previousCacheGeneration = cacheGeneration.current;
    const recoveryCacheGeneration = rotateFinanceCacheGeneration();
    if (!recoveryCacheGeneration) return 'error';
    cacheGeneration.current = recoveryCacheGeneration;
    let sessionEnded = endSession === null;
    try {
      if (endSession) {
        await runWithAbortTimeout(
          endSession,
          PROTECTED_ACCESS_RECOVERY_TIMEOUT_MS,
        );
        sessionEnded = true;
      }
      generation.current += 1;
      abortController.current?.abort();
      stateRef.current = financeProviderReducer(stateRef.current, { type: 'reset' });
      dispatch({ type: 'reset' });
      await clearCachedFinanceData();
      return 'success';
    } catch {
      if (!sessionEnded && restoreFinanceCacheGeneration(previousCacheGeneration)) {
        cacheGeneration.current = previousCacheGeneration;
      }
      return navigator.onLine ? 'error' : 'offline';
    }
  }, [api]);

  const signIn = useCallback(() => {
    const parameters = new URLSearchParams({ return_to: safeAppReturnPath(window.location.pathname) });
    window.location.assign(`/api/auth/google/start?${parameters.toString()}`);
  }, []);
  const viewModel = useMemo(() => state.data ? createFinanceViewModel(state.data, projectionDate) : null, [state.data, projectionDate]);
  const value = useMemo<FinanceContextValue>(() => ({
    ...state,
    viewModel,
    online,
    refresh,
    logout,
    recoverProtectedAccess,
    signIn,
  }), [state, viewModel, online, refresh, logout, recoverProtectedAccess, signIn]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinanceData() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('useFinanceData must be used inside FinanceDataProvider.');
  return context;
}

export function useFinanceViewModel() {
  const { viewModel } = useFinanceData();
  if (!viewModel) throw new Error('Finance view model is not available in the current connection state.');
  return viewModel;
}
