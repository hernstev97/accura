import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppearance } from '../appearance/AppearanceProvider';
import { useFinanceData } from '../data/FinanceDataProvider';
import { usePrivacy } from '../privacy/PrivacyProvider';
import {
  ACCURA_LICENSE_URL,
  ACCURA_SOURCE_SHORT_SHA,
  ACCURA_SOURCE_URL,
  ACCURA_TRADEMARKS_URL,
} from '../legalLinks';
import { AdaptiveDialog } from './AdaptiveDialog';
import { AppButton } from './AppButton';
import { ColorThemeDialog } from './ColorThemeDialog';
import { Icon } from './Icon';
import { PinManagementDialog, type PinManagementMode } from './PinManagementDialog';

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
  const privacy = usePrivacy();
  const [open, setOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [pinDialogMode, setPinDialogMode] = useState<PinManagementMode | null>(null);
  const [protectionMessage, setProtectionMessage] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const colorsRef = useRef<HTMLButtonElement>(null);
  const privacyScreenRef = useRef<HTMLInputElement>(null);
  const pinProtectionRef = useRef<HTMLButtonElement>(null);


  const closeSettings = useCallback(() => {
    setColorsOpen(false);
    setPinDialogMode(null);
    setProtectionMessage(null);
    setOpen(false);
  }, []);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    if (colorsOpen || pinDialogMode) {
      surface.setAttribute('inert', '');
      surface.setAttribute('aria-hidden', 'true');
    } else {
      surface.removeAttribute('inert');
      surface.removeAttribute('aria-hidden');
    }
  }, [colorsOpen, pinDialogMode]);

  useEffect(() => {
    if (!open || !privacy.appProtection.privacyScreenEnabled) return;
    const closeWhenHidden = () => {
      if (document.visibilityState === 'hidden') closeSettings();
    };
    document.addEventListener('visibilitychange', closeWhenHidden);
    window.addEventListener('pagehide', closeSettings);
    return () => {
      document.removeEventListener('visibilitychange', closeWhenHidden);
      window.removeEventListener('pagehide', closeSettings);
    };
  }, [closeSettings, open, privacy.appProtection.privacyScreenEnabled]);

  const closeColors = useCallback(() => {
    setColorsOpen(false);
  }, []);

  const closePinDialog = useCallback(() => {
    setPinDialogMode(null);
  }, []);

  const togglePrivacyScreen = (enabled: boolean) => {
    const result = privacy.setPrivacyScreenEnabled(enabled);
    if (result.status === 'success') {
      setProtectionMessage(enabled ? 'App-Vorschau-Schutz aktiviert.' : 'App-Vorschau-Schutz deaktiviert.');
    } else {
      setProtectionMessage('Die Einstellung konnte nicht dauerhaft gespeichert werden.');
    }
  };

  const activeTokens = appearance.preference.theme[appearance.resolvedMode];
  const summary = `${sourceLabels[appearance.preference.source]} · ${modeLabels[appearance.preference.mode]}`;
  const authenticated = finance.authState === 'authenticated';
  const localDataOnly = Boolean(finance.data) && !authenticated;
  const sourceKicker = authenticated
    ? finance.email ?? 'Mit Google verbunden'
    : localDataOnly
      ? finance.syncState === 'offline' ? 'Offline verfügbar' : 'Lokaler Datenstand'
      : 'Nicht angemeldet';
  const sourceName = finance.data
    ? 'Gespeicherter Finanzstand'
    : authenticated
      ? 'Noch kein Finanzstand'
      : localDataOnly
        ? 'Gespeicherte Finanzdaten'
        : 'Kein lokaler Datenstand';
  const sourceSupporting = authenticated
    ? 'Google dient nur der Anmeldung. Der Finanzstand liegt in accura und wird nicht aus einer Tabelle gelesen.'
    : localDataOnly
      ? 'Dieser Datenstand ist lokal auf diesem Gerät verfügbar. Es werden keine Google-Zugangsdaten im Browser gespeichert.'
      : 'Es sind weder eine Anmeldung noch lokale Finanzdaten auf diesem Gerät aktiv.';
  const pinConfigured = Boolean(privacy.appProtection.pin);
  const pinSetupAvailable = privacy.pinSecurityAvailable && privacy.appProtectionStorageAvailable;

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
        onClose={closeSettings}
        open={open}
        returnFocusRef={triggerRef}
        surfaceClassName="settings-surface"
        surfaceRef={surfaceRef}
      >
        <header className="settings-surface__header">
          <div><p>accura auf diesem Gerät</p><h2 id="settings-title">Informationen</h2></div>
          <AppButton aria-label="Informationen schließen" className="icon-button" iconOnly onClick={closeSettings} ref={closeRef} variant="text"><Icon name="close" /></AppButton>
        </header>

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
                </div>
              ) : null}
            </section>

            <section className="settings-group" aria-labelledby="settings-protection-title">
              <h3 id="settings-protection-title">App-Schutz</h3>
              <div className="settings-switch-list">
                <label className="settings-switch-row">
                  <span className="settings-switch-row__icon"><Icon name="eyeOff" /></span>
                  <span className="settings-switch-row__copy">
                    <strong>App-Vorschau schützen</strong>
                    <small id="privacy-screen-support">Verdeckt Accura beim Wechsel in den Hintergrund, bis du die Inhalte bewusst wieder anzeigst.</small>
                  </span>
                  <input
                    aria-describedby="privacy-screen-support"
                    checked={privacy.appProtection.privacyScreenEnabled}
                    disabled={pinConfigured}
                    onChange={(event) => togglePrivacyScreen(event.target.checked)}
                    ref={privacyScreenRef}
                    type="checkbox"
                  />
                  <span aria-hidden="true" className="settings-switch-row__track"><i /></span>
                </label>
                <div className="settings-switch-row settings-switch-row--action">
                  <span className="settings-switch-row__icon"><Icon name="lock" /></span>
                  <span className="settings-switch-row__copy">
                    <strong>Mit PIN entsperren</strong>
                    <small id="pin-lock-support">Verlangt nach jedem Hintergrundwechsel sowie bei App-Start und Reload eine sechsstellige PIN.</small>
                  </span>
                  <AppButton
                    aria-haspopup="dialog"
                    aria-label={pinConfigured ? 'PIN-Sperre deaktivieren' : 'PIN einrichten'}
                    aria-describedby="pin-lock-support"
                    className="settings-switch-row__action"
                    disabled={!pinConfigured && !pinSetupAvailable}
                    onClick={() => setPinDialogMode(pinConfigured ? 'disable' : 'setup')}
                    ref={pinProtectionRef}
                    size="small"
                    variant="tonal"
                  >
                    {pinConfigured ? 'Deaktivieren' : 'Einrichten'}
                  </AppButton>
                </div>
              </div>
              {pinConfigured ? (
                <div className="settings-actions settings-actions--secondary app-protection-actions">
                  <AppButton className="settings-action" leadingIcon={<Icon name="lock" size={20} />} onClick={() => setPinDialogMode('change')} variant="tonal">PIN ändern</AppButton>
                </div>
              ) : null}
              {!pinSetupAvailable && !pinConfigured ? (
                <p className="settings-group__supporting app-protection-support">PIN-Schutz benötigt verfügbaren lokalen Speicher und Web Crypto über HTTPS.</p>
              ) : null}
              {pinConfigured ? <p className="settings-group__supporting app-protection-support">Der App-Vorschau-Schutz bleibt aktiv, solange die PIN-Sperre eingerichtet ist.</p> : null}
              <p aria-atomic="true" aria-live="polite" className="settings-inline-status" role="status">{protectionMessage ?? ''}</p>
            </section>

            <section className="settings-group" aria-labelledby="settings-account-title">
              <h3 id="settings-account-title">{authenticated ? 'Konto & Datenschutz' : 'Datenschutz'}</h3>
              <p className="settings-group__supporting">
                {authenticated
                  ? 'Abmelden beendet nur die Sitzung auf diesem Gerät. Der gespeicherte Finanzstand in accura bleibt erhalten; Farben, Design und App-Schutz ebenfalls.'
                  : 'Farben, Design und App-Schutz bleiben ausschließlich auf diesem Gerät. Lokale Finanzdaten werden nur als letzter gültiger Offline-Stand gespeichert.'}
              </p>
              {authenticated ? (
                <div className="settings-actions settings-actions--secondary">
                  <AppButton className="settings-action" leadingIcon={<Icon name="logout" size={20} />} onClick={() => void finance.logout().then(closeSettings)} variant="tonal">Abmelden</AppButton>
                </div>
              ) : null}
            </section>

            <section className="settings-group" aria-labelledby="settings-legal-title">
              <h3 id="settings-legal-title">Open Source &amp; Rechtliches</h3>
              <nav className="legal-links" aria-label="Open Source und rechtliche Informationen">
                <a href={ACCURA_SOURCE_URL} rel="noreferrer" target="_blank">
                  Quellcode dieser Version ({ACCURA_SOURCE_SHORT_SHA})
                </a>
                <a href={ACCURA_LICENSE_URL} rel="noreferrer" target="_blank">GNU AGPL-3.0-only</a>
                <a href={ACCURA_TRADEMARKS_URL} rel="noreferrer" target="_blank">Brand- und Kennzeichenhinweise</a>
                <a href="/THIRD_PARTY_NOTICES.txt" target="_blank">Drittanbieter-Lizenzen</a>
              </nav>
            </section>
        </div>
      </AdaptiveDialog>

      <ColorThemeDialog onClose={closeColors} open={colorsOpen} returnFocusRef={colorsRef} />
      {pinDialogMode ? (
        <PinManagementDialog
          key={pinDialogMode}
          mode={pinDialogMode}
          onClose={closePinDialog}
          onComplete={(message) => { setProtectionMessage(message); closePinDialog(); }}
          returnFocusRef={pinProtectionRef}
        />
      ) : null}
    </>
  );
}
