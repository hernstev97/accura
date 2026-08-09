import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppearance } from '../appearance/AppearanceProvider';
import { useFinanceData } from '../data/FinanceDataProvider';
import { ColorThemeDialog } from './ColorThemeDialog';
import { Icon } from './Icon';
import { useModalBackground, useModalDialog } from './useModalDialog';

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
  const restoreColorsFocus = useRef(false);

  useModalBackground(open);

  const closeSettings = useCallback(() => {
    setConfirmDisconnect(false);
    setColorsOpen(false);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);

  const onSettingsEscape = useCallback(() => {
    if (confirmDisconnect) setConfirmDisconnect(false);
    else closeSettings();
  }, [closeSettings, confirmDisconnect]);

  useModalDialog({
    active: open && !colorsOpen,
    surfaceRef,
    initialFocusRef: confirmDisconnect ? cancelDisconnectRef : closeRef,
    onEscape: onSettingsEscape,
  });

  useEffect(() => {
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

  const closeColors = useCallback(() => {
    restoreColorsFocus.current = true;
    setColorsOpen(false);
  }, []);

  useEffect(() => {
    if (!open || colorsOpen || !restoreColorsFocus.current) return;
    restoreColorsFocus.current = false;
    const frame = requestAnimationFrame(() => colorsRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [colorsOpen, open]);

  const activeTokens = appearance.preference.theme[appearance.resolvedMode];
  const summary = `${sourceLabels[appearance.preference.source]} · ${modeLabels[appearance.preference.mode]}`;

  return (
    <>
      <button aria-label="Einstellungen öffnen" className="icon-button icon-button--contextual" onClick={() => setOpen(true)} ref={triggerRef} type="button">
        <Icon name="settings" />
      </button>

      {open && typeof document !== 'undefined' ? createPortal(
        <div className="settings-layer" onPointerDown={(event) => { if (!colorsOpen && event.currentTarget === event.target) closeSettings(); }}>
          <section aria-labelledby="settings-title" aria-modal={!colorsOpen} className="settings-surface" ref={surfaceRef} role="dialog" tabIndex={-1}>
            <header className="settings-surface__header">
              <div><p>Finanzen auf diesem Gerät</p><h2 id="settings-title">Einstellungen</h2></div>
              <button aria-label="Einstellungen schließen" className="icon-button" onClick={closeSettings} ref={closeRef} type="button"><Icon name="close" /></button>
            </header>

            {confirmDisconnect ? (
              <div className="disconnect-confirmation" role="alert" aria-live="assertive">
                <h3>Google-Verbindung trennen?</h3>
                <p>Google-Zugriff, gespeicherte Verbindung und der Offline-Datenstand auf diesem Gerät werden entfernt.</p>
                <p>Farben und Design bleiben als gerätebezogene Einstellungen erhalten.</p>
                <div className="dialog-actions">
                  <button className="secondary-action" onClick={() => setConfirmDisconnect(false)} ref={cancelDisconnectRef} type="button">Abbrechen</button>
                  <button className="danger-action" onClick={() => void finance.disconnect().then(closeSettings)} type="button">Endgültig trennen</button>
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
                </section>

                <section className="settings-group" aria-labelledby="settings-account-title">
                  <h3 id="settings-account-title">Konto &amp; Datenschutz</h3>
                  <p className="settings-group__supporting">Abmelden blendet Finanzdaten aus. Nur das Trennen entfernt die Google-Verbindung und lokale Offline-Finanzdaten; deine gerätebezogenen Farben bleiben erhalten.</p>
                  {finance.authState === 'authenticated' ? (
                    <div className="settings-actions settings-actions--secondary">
                      <button className="settings-action" onClick={() => void finance.logout().then(closeSettings)} type="button"><Icon name="logout" size={20} />Abmelden</button>
                      <button className="settings-action settings-action--danger" onClick={() => setConfirmDisconnect(true)} type="button"><Icon name="unlink" size={20} />Google-Verbindung trennen</button>
                    </div>
                  ) : null}
                </section>
              </div>
            )}
          </section>
        </div>,
        document.body,
      ) : null}

      <ColorThemeDialog onClose={closeColors} open={colorsOpen} />
    </>
  );
}
