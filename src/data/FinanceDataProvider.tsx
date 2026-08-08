/* eslint-disable react-refresh/only-export-components -- provider hooks and reducer intentionally share one state boundary */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import type { FinanceDataV1, FinanceValidationIssue } from '../finance/types';
import { createFinanceViewModel, type FinanceViewModel } from '../finance/viewModel';
import { clearCachedFinanceData, loadCachedFinanceData, saveCachedFinanceData } from './financeCache';
import { FinanceApiError, productionFinanceApi, type FinanceApi, type FinanceSession } from './financeApi';
import { launchGooglePicker, selectSpreadsheetWithPicker, type PickerLauncher } from './googlePicker';

const STALE_AFTER_MS = 10 * 60 * 1000;

export type AuthState = 'checking' | 'signed-out' | 'authenticated' | 'offline';
export type ConnectionState = 'unknown' | 'disconnected' | 'no-spreadsheet' | 'connected' | 'reconnect';
export type SyncState = 'initial' | 'syncing' | 'idle' | 'stale' | 'offline' | 'validation-error' | 'error';

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
  spreadsheet: { id: string; name: string } | null;
  data: FinanceDataV1 | null;
  lastSuccessfulRefresh: string | null;
  stale: boolean;
  error: FinanceUiError | null;
  pickerOpen: boolean;
};

export const initialFinanceState: FinanceProviderState = {
  authState: 'checking',
  connectionState: 'unknown',
  syncState: 'initial',
  email: null,
  csrfToken: null,
  spreadsheet: null,
  data: null,
  lastSuccessfulRefresh: null,
  stale: false,
  error: null,
  pickerOpen: false,
};

type Action =
  | { type: 'cache-loaded'; data: FinanceDataV1; refreshedAt: string; spreadsheet: { id: string; name: string } }
  | { type: 'signed-out'; error?: FinanceUiError }
  | { type: 'authenticated'; session: Extract<FinanceSession, { authenticated: true }> }
  | { type: 'offline-startup'; hasData: boolean }
  | { type: 'sync-started' }
  | { type: 'sync-succeeded'; data: FinanceDataV1; refreshedAt: string; spreadsheet: { id: string; name: string } }
  | { type: 'sync-failed'; error: FinanceUiError; syncState: SyncState; reconnect?: boolean }
  | { type: 'picker-started' }
  | { type: 'picker-finished' }
  | { type: 'reset' };

export function financeProviderReducer(state: FinanceProviderState, action: Action): FinanceProviderState {
  switch (action.type) {
    case 'cache-loaded':
      return { ...state, data: action.data, lastSuccessfulRefresh: action.refreshedAt, spreadsheet: action.spreadsheet, stale: true, syncState: 'stale' };
    case 'signed-out':
      return { ...initialFinanceState, authState: 'signed-out', connectionState: 'disconnected', syncState: 'idle', error: action.error ?? null };
    case 'authenticated': {
      const spreadsheet = action.session.connection.spreadsheet;
      return {
        ...state,
        authState: 'authenticated',
        connectionState: action.session.connection.connected ? (spreadsheet ? 'connected' : 'no-spreadsheet') : 'disconnected',
        email: action.session.user.email,
        csrfToken: action.session.csrfToken,
        spreadsheet,
        data: spreadsheet && state.spreadsheet?.id === spreadsheet.id ? state.data : null,
        lastSuccessfulRefresh: spreadsheet && state.spreadsheet?.id === spreadsheet.id ? state.lastSuccessfulRefresh : null,
        stale: Boolean(spreadsheet && state.data),
        syncState: spreadsheet && state.data ? 'stale' : 'initial',
        error: null,
      };
    }
    case 'offline-startup':
      return { ...state, authState: action.hasData ? 'offline' : 'signed-out', connectionState: action.hasData ? 'connected' : 'unknown', syncState: 'offline', stale: action.hasData, error: action.hasData ? null : { code: 'network_error', message: 'Offline und keine gespeicherten Daten verfügbar.' } };
    case 'sync-started':
      return { ...state, syncState: 'syncing', error: null };
    case 'sync-succeeded':
      return { ...state, connectionState: 'connected', syncState: 'idle', spreadsheet: action.spreadsheet, data: action.data, lastSuccessfulRefresh: action.refreshedAt, stale: false, error: null };
    case 'sync-failed':
      return { ...state, connectionState: action.reconnect ? 'reconnect' : state.connectionState, syncState: action.syncState, stale: Boolean(state.data), error: action.error };
    case 'picker-started':
      return { ...state, pickerOpen: true, error: null };
    case 'picker-finished':
      return { ...state, pickerOpen: false };
    case 'reset':
      return { ...initialFinanceState, authState: 'signed-out', connectionState: 'disconnected', syncState: 'idle' };
  }
}

type FinanceContextValue = FinanceProviderState & {
  viewModel: FinanceViewModel | null;
  online: boolean;
  refresh: () => Promise<void>;
  selectSpreadsheet: () => Promise<void>;
  logout: () => Promise<void>;
  disconnect: () => Promise<void>;
  signIn: () => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

const toUiError = (error: unknown): FinanceUiError => error instanceof FinanceApiError
  ? { code: error.code, message: error.message, issues: error.issues }
  : { code: 'unknown_error', message: 'Ein unerwarteter Fehler ist aufgetreten.' };

const syncStateFor = (error: FinanceUiError, online: boolean): SyncState => {
  if (!online || error.code === 'network_error') return 'offline';
  if (error.code === 'invalid_finance_schema') return 'validation-error';
  return 'error';
};

export function FinanceDataProvider({
  children,
  api = productionFinanceApi,
  pickerLauncher = launchGooglePicker,
}: {
  children: ReactNode;
  api?: FinanceApi;
  pickerLauncher?: PickerLauncher;
}) {
  const [state, dispatch] = useReducer(financeProviderReducer, initialFinanceState);
  const [online, setOnline] = useReducer((_current: boolean, next: boolean) => next, typeof navigator === 'undefined' ? true : navigator.onLine);
  const stateRef = useRef(state);
  const refreshPromise = useRef<Promise<void> | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const generation = useRef(0);
  stateRef.current = state;

  const acceptFinanceResponse = useCallback(async (response: Awaited<ReturnType<FinanceApi['getFinance']>>, requestGeneration: number) => {
    if (generation.current !== requestGeneration) return;
    await saveCachedFinanceData({
      spreadsheetId: response.spreadsheet.id,
      spreadsheetName: response.spreadsheet.name,
      refreshedAt: response.refreshedAt,
      data: response.data,
    });
    if (generation.current !== requestGeneration) return;
    dispatch({ type: 'sync-succeeded', ...response });
  }, []);

  const refresh = useCallback(async () => {
    if (refreshPromise.current) return refreshPromise.current;
    const current = stateRef.current;
    if (!current.spreadsheet || (current.authState !== 'authenticated' && current.authState !== 'offline')) return;
    const requestGeneration = generation.current;
    const controller = new AbortController();
    abortController.current = controller;
    const task = (async () => {
      dispatch({ type: 'sync-started' });
      try {
        const response = await api.getFinance(controller.signal);
        await acceptFinanceResponse(response, requestGeneration);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (generation.current !== requestGeneration) return;
        const uiError = toUiError(error);
        dispatch({
          type: 'sync-failed',
          error: uiError,
          syncState: syncStateFor(uiError, navigator.onLine),
          reconnect: uiError.code === 'reconnect_required',
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
    let active = true;
    void (async () => {
      const cached = await loadCachedFinanceData().catch(() => null);
      if (!active) return;
      if (cached) dispatch({
        type: 'cache-loaded',
        data: cached.data,
        refreshedAt: cached.refreshedAt,
        spreadsheet: { id: cached.spreadsheetId, name: cached.spreadsheetName },
      });
      try {
        const session = await api.getSession();
        if (!active) return;
        if (!session.authenticated) {
          const authError = new URLSearchParams(window.location.search).get('auth_error');
          if (authError) window.history.replaceState({}, '', window.location.pathname);
          const message = authError === 'user_not_allowed'
            ? 'Dieses Google-Konto ist nicht für die App freigeschaltet.'
            : authError ? 'Die Google-Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.' : undefined;
          dispatch({ type: 'signed-out', error: message ? { code: authError!, message } : undefined });
          return;
        }
        dispatch({ type: 'authenticated', session });
        stateRef.current = financeProviderReducer(stateRef.current, { type: 'authenticated', session });
        if (session.connection.spreadsheet) await refresh();
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
      if (stateRef.current.spreadsheet) void refresh();
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

  const selectSpreadsheet = useCallback(async () => {
    const csrfToken = stateRef.current.csrfToken;
    if (!csrfToken) return;
    generation.current += 1;
    abortController.current?.abort();
    const requestGeneration = generation.current;
    const controller = new AbortController();
    abortController.current = controller;
    dispatch({ type: 'picker-started' });
    try {
      const response = await selectSpreadsheetWithPicker(api, pickerLauncher, csrfToken, controller.signal);
      if (response) await acceptFinanceResponse(response, requestGeneration);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        const uiError = toUiError(error);
        dispatch({ type: 'sync-failed', error: uiError, syncState: syncStateFor(uiError, navigator.onLine), reconnect: uiError.code === 'reconnect_required' });
      }
    } finally {
      if (abortController.current === controller) abortController.current = null;
      dispatch({ type: 'picker-finished' });
    }
  }, [acceptFinanceResponse, api, pickerLauncher]);

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

  const disconnect = useCallback(async () => {
    const csrfToken = stateRef.current.csrfToken;
    if (!csrfToken) return;
    try {
      await api.disconnect(csrfToken);
      generation.current += 1;
      abortController.current?.abort();
      await clearCachedFinanceData();
      dispatch({ type: 'reset' });
    } catch (error) {
      const uiError = toUiError(error);
      dispatch({ type: 'sync-failed', error: uiError, syncState: syncStateFor(uiError, navigator.onLine) });
    }
  }, [api]);

  const signIn = useCallback(() => { window.location.assign('/api/auth/google/start'); }, []);
  const viewModel = useMemo(() => state.data ? createFinanceViewModel(state.data) : null, [state.data]);
  const value = useMemo<FinanceContextValue>(() => ({ ...state, viewModel, online, refresh, selectSpreadsheet, logout, disconnect, signIn }), [state, viewModel, online, refresh, selectSpreadsheet, logout, disconnect, signIn]);

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
