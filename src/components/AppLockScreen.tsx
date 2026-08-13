import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFinanceData } from '../data/FinanceDataProvider';
import { usePrivacy, type ProtectionOperationResult } from '../privacy/PrivacyProvider';
import { AppButton } from './AppButton';
import { Icon } from './Icon';
import { PinPad } from './PinPad';

function verificationMessage(result: ProtectionOperationResult): string | null {
  switch (result.status) {
    case 'incorrect':
      return result.attemptsRemaining === 1
        ? 'PIN falsch. Noch ein Versuch bis zur Wartezeit.'
        : `PIN falsch. Noch ${result.attemptsRemaining} Versuche bis zur Wartezeit.`;
    case 'cooldown': return 'Zu viele Fehlversuche. Bitte warte, bevor du es erneut versuchst.';
    case 'storage-error': return 'Der Schutzstatus konnte nicht sicher gespeichert werden. Accura bleibt gesperrt.';
    case 'unavailable': return 'Die sichere PIN-Prüfung ist in diesem Browser momentan nicht verfügbar.';
    case 'invalid-pin': return 'Bitte gib genau sechs Ziffern ein.';
    case 'pin-required': return 'Zum Entsperren ist die eingerichtete PIN erforderlich.';
    case 'success': return null;
  }
}

function formatRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = String(seconds % 60).padStart(2, '0');
  return `${minutesPart}:${secondsPart}`;
}

function ActiveAppLockScreen() {
  const finance = useFinanceData();
  const {
    appProtection,
    appProtectionCorrupt,
    revealPrivacyScreen,
    resetAppProtectionAfterRecovery,
    unlockWithPin,
  } = usePrivacy();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [recoveryOpen, setRecoveryOpen] = useState(appProtectionCorrupt);
  const [now, setNow] = useState(Date.now());
  const pinPadRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLButtonElement>(null);
  const recoveryBackRef = useRef<HTMLButtonElement>(null);
  const hasPin = Boolean(appProtection.pin);
  const cooldownRemaining = Math.max(0, (appProtection.blockedUntil ?? 0) - now);
  const coolingDown = cooldownRemaining > 0;

  useEffect(() => {
    if (!coolingDown) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [coolingDown]);

  useLayoutEffect(() => {
    const appShell = document.querySelector<HTMLElement>('.app-shell');
    appShell?.setAttribute('inert', '');
    appShell?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      if (recoveryOpen) recoveryBackRef.current?.focus({ preventScroll: true });
      else if (hasPin) pinPadRef.current?.focus({ preventScroll: true });
      else revealRef.current?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      appShell?.removeAttribute('inert');
      appShell?.removeAttribute('aria-hidden');
      document.body.style.removeProperty('overflow');
    };
  }, [hasPin, recoveryOpen]);

  useEffect(() => {
    const appShell = document.querySelector<HTMLElement>('.app-shell');
    appShell?.setAttribute('inert', '');
    appShell?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'hidden';
  }, []);

  const submitPin = async () => {
    if (busy || coolingDown) return;
    setBusy(true);
    setError(null);
    const result = await unlockWithPin(pin);
    setBusy(false);
    if (result.status === 'success') return;
    setPin('');
    setResetToken((current) => current + 1);
    setError(verificationMessage(result));
    requestAnimationFrame(() => pinPadRef.current?.focus({ preventScroll: true }));
  };

  const recover = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await finance.recoverProtectedAccess();
    if (result === 'success') {
      const resetResult = resetAppProtectionAfterRecovery();
      if (resetResult.status === 'success') return;
      setError(verificationMessage(resetResult));
    } else if (result === 'offline') {
      setError('Für den sicheren Reset wird eine Internetverbindung benötigt. Accura bleibt gesperrt.');
    } else {
      setError('Verbindung und lokaler Finanzstand konnten nicht sicher entfernt werden. Accura bleibt gesperrt.');
    }
    setBusy(false);
  };

  const title = recoveryOpen ? 'App-Schutz zurücksetzen?' : hasPin ? 'PIN eingeben' : 'Accura ist geschützt';

  return createPortal(
    <section
      aria-labelledby="app-lock-title"
      aria-modal="true"
      className="app-lock-screen"
      data-lock-state={recoveryOpen ? 'recovery' : hasPin ? coolingDown ? 'cooldown' : busy ? 'verifying' : 'locked' : 'covered'}
      role="dialog"
    >
      <div className="app-lock-screen__content">
        <header className="app-lock-screen__header">
          <h1 id="app-lock-title">{title}</h1>
          <p>{recoveryOpen
            ? 'Der Reset entfernt die lokale Sperre erst, nachdem Sitzung, Google-Verbindung und lokaler Finanzstand sicher bereinigt wurden.'
            : hasPin
              ? 'Entsperre deine private Finanzübersicht.'
              : 'Deine Finanzübersicht bleibt verdeckt, bis du sie bewusst wieder anzeigst.'}</p>
        </header>

        {recoveryOpen ? (
          <div className="app-lock-recovery">
            <div className="app-lock-recovery__mark"><Icon name="lock" size={32} /></div>
            <p>Die Google-Sheets-Datei selbst wird nicht verändert. Ohne Netzwerk bleibt der Schutz aktiv; alternativ kannst du alle Accura-Sitedaten in den Browser- oder Android-Einstellungen löschen.</p>
            {error ? <p aria-live="assertive" className="pin-pad__error" role="alert">{error}</p> : null}
            <div className="app-lock-recovery__actions">
              {!appProtectionCorrupt ? (
                <AppButton disabled={busy} onClick={() => { setError(null); setRecoveryOpen(false); }} ref={recoveryBackRef} variant="tonal">Zurück</AppButton>
              ) : null}
              <AppButton disabled={busy || finance.authState === 'checking'} onClick={() => void recover()} variant="danger">
                {busy ? 'Wird zurückgesetzt …' : finance.authState === 'checking' ? 'Verbindung wird geprüft …' : 'Sicher zurücksetzen'}
              </AppButton>
            </div>
          </div>
        ) : hasPin ? (
          <>
            <PinPad
              disabled={busy || coolingDown}
              error={error}
              onChange={(value) => { setPin(value); if (error) setError(null); }}
              onSubmit={() => void submitPin()}
              resetToken={resetToken}
              rootRef={pinPadRef}
              status={coolingDown ? `Erneut versuchen in ${formatRemaining(cooldownRemaining)}` : busy ? 'PIN wird geprüft …' : undefined}
              value={pin}
            />
            <button className="app-lock-screen__forgot" disabled={busy} onClick={() => { setError(null); setRecoveryOpen(true); }} type="button">
              PIN vergessen?
            </button>
          </>
        ) : (
          <div className="app-lock-screen__reveal">
            <div className="app-lock-screen__shield"><Icon name="lock" size={34} /></div>
            <AppButton onClick={revealPrivacyScreen} ref={revealRef} size="large">Inhalte anzeigen</AppButton>
          </div>
        )}
      </div>
    </section>,
    document.body,
  );
}

export function AppLockScreen() {
  const { appCovered } = usePrivacy();
  return appCovered && typeof document !== 'undefined' ? <ActiveAppLockScreen /> : null;
}
