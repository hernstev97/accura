import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppearance } from '../appearance/AppearanceProvider';
import { useFinanceData } from '../data/FinanceDataProvider';
import { AdaptiveDialog } from './AdaptiveDialog';
import { AppButton } from './AppButton';
import { ColorThemeDialog } from './ColorThemeDialog';
import { Icon } from './Icon';

const sourceLabels = {
  browser: 'System',
  wallpaper: 'Hintergrundbild',
  preset: 'Andere Farben',
} as const;

const modeLabels = {
  system: 'Systemmodus',
  light: 'Helles Design',
  dark: 'Dunkles Design',
} as const;

export function SettingsEntry() {
  const finance = useFinanceData();
  const appearance = useAppearance();
  const [open, setOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const colorsRef = useRef<HTMLButtonElement>(null);
  const cancelDisconnectRef = useRef<HTMLButtonElement>(null);

  const closeSettings = useCallback(() => {
    setConfirmDisconnect(false);
    setColorsOpen(false);
    setOpen(false);
  }, []);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    if (colorsOpen) {
      surface.setAttribute('inert', '');
      surface.setAttribute('aria-hidden', 'true');
    } else {
      surface.removeAttribute('inert');
      surface.removeAttribute('aria-hidden');
    }
  }, [colorsOpen]);

  useEffect(() => {
    if (!confirmDisconnect) return;
    const frame = requestAnimationFrame(() => cancelDisconnectRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [confirmDisconnect]);

  const closeColors = useCallback(() => {
    setColorsOpen(false);
  }, []);

  const activeTokens = appearance.preference.theme[appearance.resolvedMode];
  const summary = `${sourceLabels[appearance.preference.source]} · ${modeLabels[appearance.preference.mode]}`;
  const authenticated = finance.authState === 'authenticated';
  const localDataOnly = Boolean(finance.data) && !authenticated;
  const sourceKicker = authenticated
    ? finance.email ?? 'Mit Google verbunden'
    : localDataOnly
      ? finance.syncState === 'offline' ? 'Offline verfügbar' : 'Lokaler Datenstand'
      : 'Nicht angemeldet';
  const sourceName = finance.spreadsheet?.name ?? (localDataOnly ? 'Gespeicherte Finanzdaten' : 'Keine Tabelle ausgewählt');
  const sourceSupporting = authenticated
    ? 'OAuth-Tokens und Google-Zugangsdaten bleiben ausschließlich auf dem Server.'
    : localDataOnly
      ? 'Dieser Datenstand ist lokal auf diesem Gerät verfügbar. Es werden keine Google-Zugangsdaten im Browser gespeichert.'
      : 'Es sind weder eine Google-Verbindung noch lokale Finanzdaten auf diesem Gerät aktiv.';

  return (
    <>
      <AppButton
        aria-label="Einstellungen öffnen"
        className="icon-button icon-button--contextual"
        iconOnly
        onClick={() => setOpen(true)}
        ref={triggerRef}
        variant="text"
      >
        <Icon name="settings" />
      </AppButton>

      <AdaptiveDialog
        ariaLabelledBy="settings-title"
        className="settings-layer"
        initialFocusRef={closeRef}
        onClose={() => { if (confirmDisconnect) setConfirmDisconnect(false); else closeSettings(); }}
        open={open}
        returnFocusRef={triggerRef}
        surfaceClassName="settings-surface"
        surfaceRef={surfaceRef}
      >
        <header className="settings-surface__header">
          <div><p>accura auf diesem Gerät</p><h2 id="settings-title">Informationen</h2></div>
          <AppButton aria-label="Informationen schließen" className="icon-button" iconOnly onClick={closeSettings} ref={closeRef} variant="text"><Icon name="close" /></AppButton>
        </header>

        {confirmDisconnect ? (
          <div className="disconnect-confirmation" role="alert" aria-live="assertive">
            <h3>Google-Verbindung trennen?</h3>
            <p>Google-Zugriff, gespeicherte Verbindung und der Offline-Datenstand auf diesem Gerät werden entfernt.</p>
            <p>Farben und Design bleiben als gerätebezogene Einstellungen erhalten.</p>
            <div className="dialog-actions">
              <AppButton className="secondary-action" onClick={() => setConfirmDisconnect(false)} ref={cancelDisconnectRef} variant="tonal">Abbrechen</AppButton>
              <AppButton className="danger-action" onClick={() => void finance.disconnect().then(closeSettings)} variant="danger">Endgültig trennen</AppButton>
            </div>
          </div>
        ) : (
          <div className="settings-groups">
            <section className="settings-group" aria-labelledby="settings-appearance-title">
              <h3 id="settings-appearance-title">Darstellung</h3>
              <button className="appearance-settings-action" onClick={() => setColorsOpen(true)} ref={colorsRef} type="button">
                <span className="appearance-settings-action__icon"><Icon name="palette" /></span>
                <span className="appearance-settings-action__copy"><strong>Farben &amp; Design</strong><small>{summary}</small></span>
                <span className="appearance-settings-action__swatch" aria-hidden="true">
                  <i style={{ background: activeTokens['--color-primary'] }} />
                  <i style={{ background: activeTokens['--color-secondary'] }} />
                  <i style={{ background: activeTokens['--color-tertiary'] }} />
                  <i style={{ background: activeTokens['--color-container-high'] }} />
                </span>
                <Icon name="chevron" size={20} />
              </button>
            </section>

            <section className="settings-group" aria-labelledby="settings-source-title">
              <h3 id="settings-source-title">Datenquelle</h3>
              <div className="connection-summary">
                <span>{sourceKicker}</span>
                <strong>{sourceName}</strong>
                <small>{sourceSupporting}</small>
              </div>
              {finance.data && authenticated ? (
                <div className="settings-actions">
                  <AppButton className="settings-action" disabled={finance.syncState === 'syncing' || !finance.online} leadingIcon={<Icon name="refresh" size={20} />} onClick={() => void finance.refresh()} variant="tonal">Jetzt aktualisieren</AppButton>
                  <AppButton className="settings-action" disabled={!finance.online} leadingIcon={<Icon name="sheet" size={20} />} onClick={() => void finance.selectSpreadsheet()} variant="tonal">Andere Tabelle auswählen</AppButton>
                </div>
              ) : null}
            </section>

            <section className="settings-group" aria-labelledby="settings-account-title">
              <h3 id="settings-account-title">{authenticated ? 'Konto & Datenschutz' : 'Datenschutz'}</h3>
              <p className="settings-group__supporting">
                {authenticated
                  ? 'Abmelden blendet Finanzdaten aus. Nur das Trennen entfernt die Google-Verbindung und lokale Offline-Finanzdaten; deine gerätebezogenen Farben bleiben erhalten.'
                  : 'Farben und Design bleiben ausschließlich auf diesem Gerät. Lokale Finanzdaten werden nur als letzter gültiger Offline-Stand gespeichert.'}
              </p>
              {authenticated ? (
                <div className="settings-actions settings-actions--secondary">
                  <AppButton className="settings-action" leadingIcon={<Icon name="logout" size={20} />} onClick={() => void finance.logout().then(closeSettings)} variant="tonal">Abmelden</AppButton>
                  <AppButton className="settings-action settings-action--danger" leadingIcon={<Icon name="unlink" size={20} />} onClick={() => setConfirmDisconnect(true)} variant="danger">Google-Verbindung trennen</AppButton>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </AdaptiveDialog>

      <ColorThemeDialog onClose={closeColors} open={colorsOpen} returnFocusRef={colorsRef} />
    </>
  );
}
