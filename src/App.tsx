import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { SharedBottomNavigation, type Destination } from './components/SharedBottomNavigation';
import { useFinanceData, type FinanceUiError } from './data/FinanceDataProvider';
import { OverviewScreen } from './screens/OverviewScreen';

const budgetScreenModule = import('./screens/BudgetScreen');
const debtScreenModule = import('./screens/DebtScreen');
const BudgetScreen = lazy(() => budgetScreenModule.then((module) => ({ default: module.BudgetScreen })));
const DebtScreen = lazy(() => debtScreenModule.then((module) => ({ default: module.DebtScreen })));

const screenNames: Record<Destination, string> = { overview: 'Übersicht', budget: 'Budget', debt: 'Schulden' };
const lastUpdatedFormatter = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' });

function ScreenLoading({ label = 'Ansicht wird geladen …' }: { label?: string }) {
  return (
    <div className="screen screen-loading" role="status">
      <span className="loading-mark" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

function ValidationIssues({ error }: { error: FinanceUiError | null }) {
  if (!error?.issues?.length) return null;
  return (
    <details className="validation-issues">
      <summary>{error.issues.length} Validierungsfehler anzeigen</summary>
      <ul>
        {error.issues.slice(0, 12).map((entry, index) => (
          <li key={`${entry.tab}-${entry.row}-${entry.column}-${index}`}>
            <strong>{entry.tab}</strong>, Zeile {entry.row}, Spalte {entry.column}: {entry.message} Erwartet: {entry.expected}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ConnectionStateScreen() {
  const finance = useFinanceData();
  const isLoading = finance.authState === 'checking' || finance.pickerOpen || (finance.syncState === 'syncing' && !finance.data);
  if (isLoading) return <ScreenLoading label={finance.pickerOpen ? 'Google-Tabelle wird geprüft …' : 'Verbindung wird geprüft …'} />;

  if (finance.connectionState === 'reconnect') {
    return (
      <section className="screen connection-state" data-finance-state="reconnect" aria-labelledby="connection-title">
        <span className="connection-state__mark"><Icon name="account" size={30} /></span>
        <p className="eyebrow">Autorisierung abgelaufen</p>
        <h1 id="connection-title">Google erneut verbinden</h1>
        <p>Der Zugriff wurde widerrufen oder ist abgelaufen. Verbinde das freigegebene Konto erneut; deine Tabelle wird danach wieder geladen.</p>
        <button className="primary-action" onClick={finance.signIn} type="button">Mit Google neu verbinden</button>
      </section>
    );
  }

  if (finance.authState === 'signed-out') {
    return (
      <section className="screen connection-state" data-finance-state="signed-out" aria-labelledby="connection-title">
        <span className="connection-state__mark"><Icon name="sheet" size={30} /></span>
        <p className="eyebrow">Private Finanzübersicht</p>
        <h1 id="connection-title">Mit deiner Tabelle verbinden</h1>
        <p>Melde dich mit dem freigegebenen Google-Konto an und wähle anschließend genau eine Tabelle im Finance Data Schema v1 aus.</p>
        <button className="primary-action" onClick={finance.signIn} type="button">Mit Google anmelden</button>
        {finance.error ? <p className="connection-state__hint">{finance.error.message}</p> : null}
      </section>
    );
  }

  if (finance.syncState === 'validation-error') {
    return (
      <section className="screen connection-state connection-state--error" data-finance-state="validation-error" aria-labelledby="connection-title">
        <span className="connection-state__mark"><Icon name="info" size={30} /></span>
        <p className="eyebrow">Schema nicht gültig</p>
        <h1 id="connection-title">Tabelle konnte nicht übernommen werden</h1>
        <p>{finance.error?.message}</p>
        <ValidationIssues error={finance.error} />
        <button className="primary-action" onClick={() => void finance.selectSpreadsheet()} type="button">Andere Tabelle auswählen</button>
      </section>
    );
  }

  if (finance.authState === 'offline' && !finance.data) {
    return (
      <section className="screen connection-state" data-finance-state="offline-empty" aria-labelledby="connection-title">
        <span className="connection-state__mark"><Icon name="info" size={30} /></span>
        <p className="eyebrow">Offline</p>
        <h1 id="connection-title">Noch kein lokaler Datenstand</h1>
        <p>Stelle eine Internetverbindung her, um dich anzumelden und deine Tabelle erstmals zu synchronisieren.</p>
      </section>
    );
  }

  const needsConnection = finance.connectionState === 'disconnected';
  return (
    <section className="screen connection-state" data-finance-state={needsConnection ? 'disconnected' : 'no-spreadsheet'} aria-labelledby="connection-title">
      <span className="connection-state__mark"><Icon name="sheet" size={30} /></span>
      <p className="eyebrow">{needsConnection ? 'Google-Verbindung fehlt' : 'Fast fertig'}</p>
      <h1 id="connection-title">{needsConnection ? 'Google erneut verbinden' : 'Google-Tabelle auswählen'}</h1>
      <p>{needsConnection
        ? 'Die Anmeldung ist gültig, aber es wurde keine gespeicherte Google-Verbindung gefunden.'
        : 'Der Picker zeigt ausschließlich Google-Sheets-Dateien. Die Auswahl wird erst nach erfolgreicher Schema-Prüfung gespeichert.'}</p>
      <button className="primary-action" onClick={needsConnection ? finance.signIn : () => void finance.selectSpreadsheet()} type="button">
        {needsConnection ? 'Google verbinden' : 'Google-Tabelle auswählen'}
      </button>
    </section>
  );
}

function InfoDisclosure() {
  const finance = useFinanceData();
  const [open, setOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const surfaceRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cancelDisconnectRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    (confirmDisconnect ? cancelDisconnectRef.current : closeRef.current)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (confirmDisconnect) setConfirmDisconnect(false);
        else setOpen(false);
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(surfaceRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], summary') ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirmDisconnect, open]);

  const close = () => { setConfirmDisconnect(false); setOpen(false); };

  return (
    <>
      {!open ? (
        <button aria-label="Verbindung und Informationen" className="icon-button icon-button--contextual" onClick={() => setOpen(true)} type="button">
          <Icon name="info" />
        </button>
      ) : <span className="info-action-placeholder" aria-hidden="true" />}

      <AnimatePresence>
        {open ? (
          <motion.div animate={{ opacity: 1 }} className="info-scrim" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onPointerDown={(event) => { if (event.currentTarget === event.target) close(); }} transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}>
            <section aria-labelledby="info-title" aria-modal="true" className="info-surface" ref={surfaceRef} role="dialog">
              <div className="info-surface__header">
                <div><p>Sichere Datenquelle</p><h2 id="info-title">Finanzen · v1</h2></div>
                <button aria-label="Informationen schließen" className="icon-button" onClick={close} ref={closeRef} type="button"><Icon name="close" /></button>
              </div>

              {confirmDisconnect ? (
                <div className="disconnect-confirmation" role="alert" aria-live="assertive">
                  <h3>Google-Verbindung trennen?</h3>
                  <p>Google-Zugriff, gespeicherte Verbindung und der Offline-Datenstand auf diesem Gerät werden entfernt.</p>
                  <div className="dialog-actions">
                    <button className="secondary-action" onClick={() => setConfirmDisconnect(false)} ref={cancelDisconnectRef} type="button">Abbrechen</button>
                    <button className="danger-action" onClick={() => void finance.disconnect().then(close)} type="button">Endgültig trennen</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="connection-summary">
                    <span>{finance.email ?? 'Nicht angemeldet'}</span>
                    <strong>{finance.spreadsheet?.name ?? 'Keine Tabelle ausgewählt'}</strong>
                    <small>OAuth-Tokens und Google-Zugangsdaten bleiben ausschließlich auf dem Server.</small>
                  </div>
                  {finance.data ? (
                    <div className="settings-actions">
                      <button className="settings-action" disabled={finance.syncState === 'syncing'} onClick={() => void finance.refresh()} type="button"><Icon name="refresh" size={20} />Jetzt aktualisieren</button>
                      <button className="settings-action" onClick={() => void finance.selectSpreadsheet()} type="button"><Icon name="sheet" size={20} />Andere Tabelle auswählen</button>
                    </div>
                  ) : null}
                  {finance.authState === 'authenticated' ? (
                    <div className="settings-actions settings-actions--secondary">
                      <button className="settings-action" onClick={() => void finance.logout().then(close)} type="button"><Icon name="logout" size={20} />Abmelden</button>
                      <button className="settings-action settings-action--danger" onClick={() => setConfirmDisconnect(true)} type="button"><Icon name="unlink" size={20} />Google-Verbindung trennen</button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function DataStatus() {
  const finance = useFinanceData();
  const lastUpdated = finance.lastSuccessfulRefresh ? lastUpdatedFormatter.format(new Date(finance.lastSuccessfulRefresh)) : 'noch nicht synchronisiert';
  const status = finance.syncState === 'syncing' ? 'Wird aktualisiert …'
    : finance.syncState === 'offline' ? 'Offline · gespeicherter Stand'
      : finance.syncState === 'validation-error' ? 'Neue Daten ungültig · letzter gültiger Stand'
        : finance.connectionState === 'reconnect' ? 'Google muss erneut verbunden werden'
          : finance.stale ? 'Gespeicherter Stand' : 'Aktuell';
  const problematic = finance.syncState === 'offline' || finance.syncState === 'validation-error' || finance.connectionState === 'reconnect';

  return (
    <>
      <div className={`data-status ${problematic ? 'data-status--warning' : ''}`} role="status" data-finance-state={finance.syncState}>
        <span><strong>{status}</strong><small>Zuletzt aktualisiert {lastUpdated}</small></span>
        <button aria-label="Finanzdaten aktualisieren" className="icon-button" disabled={finance.syncState === 'syncing' || !finance.online} onClick={() => void finance.refresh()} type="button">
          <Icon className={finance.syncState === 'syncing' ? 'is-spinning' : undefined} name="refresh" />
        </button>
      </div>
      {problematic ? (
        <aside className="sync-message" role={finance.syncState === 'validation-error' ? 'alert' : 'status'}>
          <p>{finance.error?.message ?? status}</p>
          {finance.connectionState === 'reconnect' ? <button className="inline-action" onClick={finance.signIn} type="button">Neu verbinden</button> : null}
          <ValidationIssues error={finance.error} />
        </aside>
      ) : null}
    </>
  );
}

function Screen({ destination }: { destination: Destination }) {
  return (
    <Suspense fallback={<ScreenLoading />}>
      {destination === 'overview' ? <OverviewScreen /> : null}
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
        <div className="app-content">
          <header className="top-app-bar">
            <div className="screen-identity"><span className="brand-mark" aria-hidden="true">F</span><div><span>Finanzen</span><strong>{hasData ? screenNames[destination] : 'Verbindung'}</strong></div></div>
            <InfoDisclosure />
          </header>
          {hasData ? <DataStatus /> : null}
          <main aria-label={hasData ? screenNames[destination] : 'Datenquelle einrichten'} ref={mainRef} tabIndex={-1}>
            {hasData ? (
              <Screen destination={destination} />
            ) : <ConnectionStateScreen />}
          </main>
          {hasData ? <SharedBottomNavigation onSelect={selectDestination} selectedId={destination} /> : null}
        </div>
      </div>
    </MotionConfig>
  );
}

export default App;
