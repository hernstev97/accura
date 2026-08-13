import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { usePrivacy, type ProtectionOperationResult } from '../privacy/PrivacyProvider';
import { AdaptiveDialog } from './AdaptiveDialog';
import { AppButton } from './AppButton';
import { Icon } from './Icon';
import { PinPad } from './PinPad';

export type PinManagementMode = 'setup' | 'change' | 'disable';
type Stage = 'current' | 'new' | 'confirm';

function messageFor(result: ProtectionOperationResult): string | null {
  switch (result.status) {
    case 'incorrect': return `PIN falsch. Noch ${result.attemptsRemaining} ${result.attemptsRemaining === 1 ? 'Versuch' : 'Versuche'} bis zur Wartezeit.`;
    case 'cooldown': return 'Zu viele Fehlversuche. Bitte warte, bevor du es erneut versuchst.';
    case 'storage-error': return 'Die Einstellung konnte nicht dauerhaft und sicher gespeichert werden.';
    case 'unavailable': return 'Web Crypto ist in diesem Browser momentan nicht verfügbar.';
    case 'invalid-pin': return 'Bitte gib genau sechs Ziffern ein.';
    case 'pin-required': return 'Die aktuelle PIN ist erforderlich.';
    case 'success': return null;
  }
}

function titleFor(mode: PinManagementMode, stage: Stage) {
  if (mode === 'disable') return 'PIN-Sperre deaktivieren';
  if (stage === 'current') return 'Aktuelle PIN eingeben';
  if (stage === 'confirm') return 'Neue PIN bestätigen';
  return mode === 'setup' ? 'PIN einrichten' : 'Neue PIN eingeben';
}

function supportingFor(mode: PinManagementMode, stage: Stage) {
  if (mode === 'disable') return 'Danach bleibt der einfache App-Vorschau-Schutz aktiv.';
  if (stage === 'current') return 'Bestätige zuerst deine bisherige sechsstellige PIN.';
  if (stage === 'confirm') return 'Gib dieselbe sechsstellige PIN noch einmal ein.';
  return 'Wähle genau sechs Ziffern. Die PIN wird nur als langsamer kryptografischer Verifier gespeichert.';
}

export function PinManagementDialog({
  mode,
  onClose,
  onComplete,
  returnFocusRef,
}: {
  mode: PinManagementMode;
  onClose: () => void;
  onComplete: (message: string) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const privacy = usePrivacy();
  const [stage, setStage] = useState<Stage>(() => mode === 'setup' ? 'new' : 'current');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [now, setNow] = useState(Date.now());
  const candidatePinRef = useRef('');
  const pinPadRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cooldownRemaining = Math.max(0, (privacy.appProtection.blockedUntil ?? 0) - now);
  const coolingDown = cooldownRemaining > 0;

  useEffect(() => {
    if (!coolingDown) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [coolingDown]);

  useEffect(() => {
    const closeWhenHidden = () => {
      if (document.visibilityState === 'hidden') onClose();
    };
    document.addEventListener('visibilitychange', closeWhenHidden);
    window.addEventListener('pagehide', onClose);
    return () => {
      document.removeEventListener('visibilitychange', closeWhenHidden);
      window.removeEventListener('pagehide', onClose);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => pinPadRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [stage, resetToken]);

  const clearEntry = () => {
    setPin('');
    setResetToken((current) => current + 1);
  };

  const handleFailure = (result: ProtectionOperationResult) => {
    setError(messageFor(result));
    clearEntry();
  };

  const submit = async () => {
    if (busy || coolingDown) return;
    setError(null);

    if (stage === 'new') {
      candidatePinRef.current = pin;
      setStage('confirm');
      clearEntry();
      return;
    }

    if (stage === 'confirm' && pin !== candidatePinRef.current) {
      candidatePinRef.current = '';
      setStage('new');
      setError('Die beiden PINs stimmen nicht überein. Bitte beginne erneut.');
      clearEntry();
      return;
    }

    setBusy(true);
    if (stage === 'current') {
      try {
        if (mode === 'disable') {
          const result = await privacy.disablePin(pin);
          if (result.status === 'success') {
            onComplete('PIN-Sperre deaktiviert. Der App-Vorschau-Schutz bleibt aktiv.');
            return;
          }
          handleFailure(result);
          return;
        }
        const result = await privacy.verifyCurrentPin(pin);
        if (result.status === 'success') {
          setStage('new');
          clearEntry();
        } else {
          handleFailure(result);
        }
      } catch {
        setError('Die PIN-Prüfung ist unerwartet fehlgeschlagen. Bitte versuche es erneut.');
        clearEntry();
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      const result = mode === 'setup' ? await privacy.setupPin(pin) : await privacy.replacePin(pin);
      candidatePinRef.current = '';
      if (result.status === 'success') {
        onComplete(mode === 'setup' ? 'PIN-Sperre eingerichtet.' : 'PIN wurde geändert.');
        return;
      }
      setStage('new');
      handleFailure(result);
    } catch {
      candidatePinRef.current = '';
      setStage('new');
      setError('Die PIN konnte unerwartet nicht gespeichert werden. Bitte versuche es erneut.');
      clearEntry();
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    setError(null);
    candidatePinRef.current = '';
    if (stage === 'confirm') {
      setStage('new');
      clearEntry();
    } else {
      onClose();
    }
  };

  return (
    <AdaptiveDialog
      ariaLabelledBy="pin-management-title"
      className="pin-management-layer"
      initialFocusRef={pinPadRef}
      onClose={onClose}
      open
      presentation="fullscreen"
      returnFocusRef={returnFocusRef}
      surfaceClassName="pin-management-dialog"
      surfaceRef={surfaceRef}
    >
      <header className="pin-management-dialog__header">
        <AppButton aria-label="PIN-Einrichtung zurück" className="icon-button" iconOnly onClick={goBack} variant="text">
          <Icon name="chevron" />
        </AppButton>
        <div>
          <p>App-Schutz</p>
          <h2 id="pin-management-title">{titleFor(mode, stage)}</h2>
        </div>
        <AppButton aria-label="PIN-Einrichtung schließen" className="icon-button" iconOnly onClick={onClose} ref={closeRef} variant="text">
          <Icon name="close" />
        </AppButton>
      </header>
      <p className="pin-management-dialog__supporting">{supportingFor(mode, stage)}</p>
      <PinPad
        disabled={busy || coolingDown}
        error={error}
        onChange={(value) => { setPin(value); if (error) setError(null); }}
        onSubmit={() => void submit()}
        resetToken={resetToken}
        rootRef={pinPadRef}
        status={coolingDown ? `Erneut versuchen in ${Math.ceil(cooldownRemaining / 1000)} Sekunden` : busy ? 'PIN wird verarbeitet …' : undefined}
        value={pin}
      />
    </AdaptiveDialog>
  );
}
