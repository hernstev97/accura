import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { MotionConfig } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { AdaptiveNavigation } from './components/AdaptiveNavigation';
import { AccuraLogo } from './components/AccuraLogo';
import { AppButton } from './components/AppButton';
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
  const isLoading = finance.authState === 'checking' || finance.pickerOpen || (finance.syncState === 'syncing' && !finance.data);
  if (isLoading) return <ScreenLoading label={finance.pickerOpen ? 'Google-Tabelle wird geprüft …' : 'Verbindung wird geprüft …'} />;

  if (finance.connectionState === 'reconnect') {
    return (
      <ConnectionStateLayout
        action={<AppButton onClick={finance.signIn} size="large">Mit Google neu verbinden</AppButton>}
        eyebrow="Autorisierung abgelaufen"
        mark={<Icon name="account" size={30} />}
        state="reconnect"
        supporting="Der Zugriff wurde widerrufen oder ist abgelaufen. Verbinde das freigegebene Konto erneut; deine Tabelle wird danach wieder geladen."
        title="Google erneut verbinden"
        tone="warning"
      />
    );
  }

  if (finance.syncState === 'offline' && !finance.data) {
    return (
      <ConnectionStateLayout
        eyebrow="Offline"
        mark={<Icon name="info" size={30} />}
        state="offline-empty"
        supporting="Stelle eine Internetverbindung her, um dich anzumelden und deine Tabelle erstmals zu synchronisieren."
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
        mark={<Icon name="sheet" size={30} />}
        state="signed-out"
        supporting="Melde dich mit dem freigegebenen Google-Konto an und wähle anschließend genau eine Tabelle im Finance Data Schema v1 aus."
        title="Mit deiner Tabelle verbinden"
      >
        {finance.error ? <p className="connection-state__hint">{finance.error.message}</p> : null}
      </ConnectionStateLayout>
    );
  }

  if (finance.syncState === 'validation-error') {
    return (
      <ConnectionStateLayout
        action={<AppButton onClick={() => void finance.selectSpreadsheet()} size="large">Andere Tabelle auswählen</AppButton>}
        eyebrow="Schema nicht gültig"
        mark={<Icon name="info" size={30} />}
        state="validation-error"
        supporting={finance.error?.message ?? 'Die ausgewählte Tabelle entspricht nicht dem Finance Data Schema v1.'}
        title="Tabelle konnte nicht übernommen werden"
        tone="danger"
      >
        <ValidationIssues error={finance.error} />
      </ConnectionStateLayout>
    );
  }

  const needsConnection = finance.connectionState === 'disconnected';
  return (
    <ConnectionStateLayout
      action={(
        <AppButton onClick={needsConnection ? finance.signIn : () => void finance.selectSpreadsheet()} size="large">
          {needsConnection ? 'Google verbinden' : 'Google-Tabelle auswählen'}
        </AppButton>
      )}
      eyebrow={needsConnection ? 'Google-Verbindung fehlt' : 'Fast fertig'}
      mark={<Icon name="sheet" size={30} />}
      state={needsConnection ? 'disconnected' : 'no-spreadsheet'}
      supporting={needsConnection
        ? 'Die Anmeldung ist gültig, aber es wurde keine gespeicherte Google-Verbindung gefunden.'
        : 'Der Picker zeigt ausschließlich Google-Sheets-Dateien. Die Auswahl wird erst nach erfolgreicher Schema-Prüfung gespeichert.'}
      title={needsConnection ? 'Google erneut verbinden' : 'Google-Tabelle auswählen'}
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
      <SpeedInsights />
      <Analytics />
      <div className="app-shell">
        <div className={`app-content ${hasData ? 'app-content--connected' : ''}`}>
          <header className="top-app-bar">
            <div className="screen-identity">
              <AccuraLogo className="brand-mark" />
              <div><span>accura</span><strong>{hasData ? screenName : 'Verbindung'}</strong></div>
            </div>
            <div className="top-app-bar__actions">
              <PrivacyToggle />
              <SettingsEntry />
            </div>
          </header>
          <PwaUpdateNotice />
          {hasData ? <SyncStatusBanner /> : null}
          <main aria-label={hasData ? screenName : 'Datenquelle einrichten'} ref={mainRef} tabIndex={-1}>
            {hasData ? <Screen destination={destination} /> : <ConnectionStateScreen />}
          </main>
          {hasData ? <AdaptiveNavigation onNavigate={navigate} selectedId={destination} /> : null}
        </div>
      </div>
    </MotionConfig>
  );
}

export default App;
