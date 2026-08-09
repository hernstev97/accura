import { useFinanceData } from '../data/FinanceDataProvider';
import { AppButton } from './AppButton';
import { Icon } from './Icon';
import { ValidationIssues } from './ValidationIssues';

const lastUpdatedFormatter = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' });

export function SyncStatusBanner() {
  const finance = useFinanceData();
  const lastUpdated = finance.lastSuccessfulRefresh
    ? lastUpdatedFormatter.format(new Date(finance.lastSuccessfulRefresh))
    : 'noch nicht synchronisiert';
  const status = finance.syncState === 'syncing' ? 'Wird aktualisiert …'
    : finance.syncState === 'offline' ? 'Offline · gespeicherter Stand'
      : finance.syncState === 'validation-error' ? 'Neue Daten ungültig · letzter gültiger Stand'
        : finance.connectionState === 'reconnect' ? 'Google muss erneut verbunden werden'
          : finance.stale ? 'Gespeicherter Stand' : 'Aktuell';
  const tone = finance.syncState === 'validation-error' ? 'danger'
    : finance.syncState === 'offline' || finance.connectionState === 'reconnect' || finance.stale ? 'warning'
      : 'neutral';
  const important = tone !== 'neutral';

  return (
    <aside
      aria-live={tone === 'danger' ? 'assertive' : 'polite'}
      className={`sync-status sync-status--${tone}`}
      data-finance-state={finance.syncState}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <div className="sync-status__summary">
        <span className="sync-status__icon" aria-hidden="true">
          <Icon className={finance.syncState === 'syncing' ? 'is-spinning' : undefined} name={finance.syncState === 'syncing' ? 'refresh' : important ? 'info' : 'check'} size={20} />
        </span>
        <span className="sync-status__copy">
          <strong>{status}</strong>
          <small>Zuletzt aktualisiert {lastUpdated}</small>
        </span>
        <AppButton
          aria-label="Finanzdaten aktualisieren"
          disabled={finance.syncState === 'syncing' || !finance.online}
          iconOnly
          onClick={() => void finance.refresh()}
          size="small"
          variant="text"
        >
          <Icon className={finance.syncState === 'syncing' ? 'is-spinning' : undefined} name="refresh" />
        </AppButton>
      </div>
      {important ? (
        <div className="sync-status__details">
          <p>{finance.error?.message ?? status}</p>
          {finance.connectionState === 'reconnect' ? <AppButton onClick={finance.signIn} size="small" variant="text">Neu verbinden</AppButton> : null}
          <ValidationIssues error={finance.error} />
        </div>
      ) : null}
    </aside>
  );
}
