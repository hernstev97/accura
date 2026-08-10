import { MotionConfig } from 'motion/react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AdaptiveNavigation, type Destination } from './components/AdaptiveNavigation';
import { AccuraLogo } from './components/AccuraLogo';
import { AppButton } from './components/AppButton';
import { ConnectionStateLayout } from './components/ConnectionStateLayout';
import { Icon } from './components/Icon';
import { LoadingIndicator } from './components/LoadingIndicator';
import { SettingsEntry } from './components/SettingsDialog';
import { SyncStatusBanner } from './components/SyncStatusBanner';
import { ValidationIssues } from './components/ValidationIssues';
import { useFinanceData } from './data/FinanceDataProvider';
import { OverviewScreen } from './screens/OverviewScreen';

const budgetScreenModule = import('./screens/BudgetScreen');
const debtScreenModule = import('./screens/DebtScreen');
const upcomingScreenModule = import('./screens/UpcomingScreen');
const BudgetScreen = lazy(() => budgetScreenModule.then((module) => ({ default: module.BudgetScreen })));
const DebtScreen = lazy(() => debtScreenModule.then((module) => ({ default: module.DebtScreen })));
const UpcomingScreen = lazy(() => upcomingScreenModule.then((module) => ({ default: module.UpcomingScreen })));

const screenNames: Record<Destination, string> = { overview: 'Übersicht', upcoming: 'Demnächst', budget: 'Budget', debt: 'Schulden' };

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

function App() {
  const finance = useFinanceData();
  const [destination, setDestination] = useState<Destination>('overview');
  const mainRef = useRef<HTMLElement>(null);
  const hasData = Boolean(finance.data && finance.viewModel);

  const selectDestination = (nextDestination: Destination) => {
    setDestination((currentDestination) => nextDestination === currentDestination ? currentDestination : nextDestination);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  useEffect(() => { mainRef.current?.focus({ preventScroll: true }); }, [destination, hasData]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <div className={`app-content ${hasData ? 'app-content--connected' : ''}`}>
          <header className="top-app-bar">
            <div className="screen-identity">
              <AccuraLogo className="brand-mark" />
              <div><span>accura</span><strong>{hasData ? screenNames[destination] : 'Verbindung'}</strong></div>
            </div>
            <SettingsEntry />
          </header>
          {hasData ? <SyncStatusBanner /> : null}
          <main aria-label={hasData ? screenNames[destination] : 'Datenquelle einrichten'} ref={mainRef} tabIndex={-1}>
            {hasData ? <Screen destination={destination} /> : <ConnectionStateScreen />}
          </main>
          {hasData ? <AdaptiveNavigation onSelect={selectDestination} selectedId={destination} /> : null}
        </div>
      </div>
    </MotionConfig>
  );
}

export default App;
