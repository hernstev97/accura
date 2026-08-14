import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { MotionConfig } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { AdaptiveNavigation } from './components/AdaptiveNavigation';
import { AccuraLogo } from './components/AccuraLogo';
import { AppButton } from './components/AppButton';
import { AppLockScreen } from './components/AppLockScreen';
import { ConnectionStateLayout } from './components/ConnectionStateLayout';
import { Icon } from './components/Icon';
import { LoadingIndicator } from './components/LoadingIndicator';
import { PrivacyToggle } from './components/PrivacyToggle';
import { PwaUpdateNotice } from './components/PwaUpdateNotice';
import { SettingsEntry } from './components/SettingsDialog';
import { SyncStatusBanner } from './components/SyncStatusBanner';
import { ValidationIssues } from './components/ValidationIssues';
import { useFinanceData } from './data/FinanceDataProvider';
import {
  appLabelForDestination,
  appPathForDestination,
  resolveBrowserHistoryNavigation,
  writeStoredDestination,
  type Destination,
} from './navigation/appNavigation';
import { OverviewScreen } from './screens/OverviewScreen';

const VERCEL_TELEMETRY_ENABLED = Boolean(import.meta.env.VITE_VERCEL_ENV);

const budgetScreenModule = import('./screens/BudgetScreen');
const debtScreenModule = import('./screens/DebtScreen');
const upcomingScreenModule = import('./screens/UpcomingScreen');
const BudgetScreen = lazy(() => budgetScreenModule.then((module) => ({ default: module.BudgetScreen })));
const DebtScreen = lazy(() => debtScreenModule.then((module) => ({ default: module.DebtScreen })));
const UpcomingScreen = lazy(() => upcomingScreenModule.then((module) => ({ default: module.UpcomingScreen })));

function ScreenLoading({ label = 'Ansicht wird geladen …' }: { label?: string }) {
  return (
    <div className="screen screen-loading">
      <LoadingIndicator label={label} />
    </div>
  );
}

export function ConnectionStateScreen() {
  const finance = useFinanceData();
  const isLoading = finance.authState === 'checking' || (finance.syncState === 'syncing' && !finance.data);
  if (isLoading) return <ScreenLoading label="Verbindung wird geprüft …" />;

  if (finance.syncState === 'offline' && !finance.data) {
    return (
      <ConnectionStateLayout
        eyebrow="Offline"
        mark={<Icon name="info" size={30} />}
        state="offline-empty"
        supporting="Stelle eine Internetverbindung her, um dich anzumelden und deinen Finanzstand erstmals zu laden."
        title="Noch kein lokaler Datenstand"
        tone="warning"
      />
    );
  }

  if (finance.authState === 'signed-out') {
    return (
      <ConnectionStateLayout
        action={<AppButton onClick={finance.signIn} size="large">Mit Google anmelden</AppButton>}
        eyebrow="Private Finanzübersicht"
        mark={<Icon name="account" size={30} />}
        state="signed-out"
        supporting="Melde dich mit dem freigegebenen Google-Konto an. Google dient nur der Anmeldung; der Finanzstand liegt in accura."
        title="Bei accura anmelden"
      >
        {finance.error ? <p className="connection-state__hint">{finance.error.message}</p> : null}
      </ConnectionStateLayout>
    );
  }

  if (finance.syncState === 'validation-error') {
    return (
      <ConnectionStateLayout
        action={<AppButton disabled={!finance.online} onClick={() => void finance.refresh()} size="large">Erneut laden</AppButton>}
        eyebrow="Datenstand ungültig"
        mark={<Icon name="info" size={30} />}
        state="validation-error"
        supporting={finance.error?.message ?? 'Der gespeicherte Finanzstand ist ungültig.'}
        title="Finanzstand konnte nicht geladen werden"
        tone="danger"
      >
        <ValidationIssues error={finance.error} />
      </ConnectionStateLayout>
    );
  }

  return (
    <ConnectionStateLayout
      action={<AppButton disabled={!finance.online} onClick={() => void finance.refresh()} size="large">Erneut prüfen</AppButton>}
      eyebrow="Noch kein Finanzstand"
      mark={<Icon name="info" size={30} />}
      state="no-finance"
      supporting="Die Anmeldung ist gültig, aber es wurde noch kein Finanzstand importiert. Der einmalige Import liegt außerhalb der App."
      title="Finanzstand fehlt"
    />
  );
}

function Screen({ destination }: { destination: Destination }) {
  return (
    <Suspense fallback={<ScreenLoading />}>
      {destination === 'overview' ? <OverviewScreen /> : null}
      {destination === 'upcoming' ? <UpcomingScreen /> : null}
      {destination === 'budget' ? <BudgetScreen /> : null}
      {destination === 'debt' ? <DebtScreen /> : null}
    </Suspense>
  );
}

type AppProps = {
  initialDestination: Destination;
};

function App({ initialDestination }: AppProps) {
  const finance = useFinanceData();
  const [destination, setDestination] = useState<Destination>(initialDestination);
  const mainRef = useRef<HTMLElement>(null);
  const hasData = Boolean(finance.data && finance.viewModel);

  const navigate = useCallback((nextDestination: Destination, event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const nextPath = appPathForDestination(nextDestination);
    if (window.location.pathname !== nextPath) window.history.pushState(window.history.state, '', nextPath);
    setDestination((currentDestination) => nextDestination === currentDestination ? currentDestination : nextDestination);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const onPopState = () => setDestination(resolveBrowserHistoryNavigation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (hasData) writeStoredDestination(destination);
  }, [destination, hasData]);

  useEffect(() => { mainRef.current?.focus({ preventScroll: true }); }, [destination, hasData]);

  const screenName = appLabelForDestination(destination);

  return (
    <MotionConfig reducedMotion="user">
      {VERCEL_TELEMETRY_ENABLED ? (
        <>
          <SpeedInsights />
          <Analytics />
        </>
      ) : null}
      <AppLockScreen />
      <div className="app-shell">
        <div className={`app-content ${hasData ? 'app-content--connected' : ''}`}>
          <header className="top-app-bar">
            <div className="screen-identity">
              <AccuraLogo className="brand-mark" />
              <div><span>accura</span><strong>{hasData ? screenName : 'Anmeldung'}</strong></div>
            </div>
            <div className="top-app-bar__actions">
              <PrivacyToggle />
              <SettingsEntry />
            </div>
          </header>
          <PwaUpdateNotice />
          {hasData ? <SyncStatusBanner /> : null}
          <main aria-label={hasData ? screenName : 'Anmeldung'} ref={mainRef} tabIndex={-1}>
            {hasData ? <Screen destination={destination} /> : <ConnectionStateScreen />}
          </main>
          {hasData ? <AdaptiveNavigation onNavigate={navigate} selectedId={destination} /> : null}
        </div>
      </div>
    </MotionConfig>
  );
}

export default App;
