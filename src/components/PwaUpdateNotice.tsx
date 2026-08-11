import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AppButton } from './AppButton';
import { Icon } from './Icon';
import { InlineNotice } from './InlineNotice';

const ACTIVATION_TIMEOUT_MS = 10_000;
const activationError = 'Die neue Version konnte nicht geladen werden. Bitte versuche es erneut.';

export type PwaUpdateNoticeViewProps = {
  needRefresh: boolean;
  updating: boolean;
  error: string | null;
  onUpdate: () => void;
  onDismiss: () => void;
};

export function PwaUpdateNoticeView({ error, needRefresh, onDismiss, onUpdate, updating }: PwaUpdateNoticeViewProps) {
  if (!needRefresh) return null;

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="pwa-update-notice"
      role="status"
    >
      <InlineNotice
        action={(
          <div className="pwa-update-notice__actions">
            <AppButton disabled={updating} onClick={onDismiss} size="small" variant="text">Später</AppButton>
            <AppButton
              aria-busy={updating}
              disabled={updating}
              leadingIcon={<Icon className={updating ? 'is-spinning' : undefined} name="refresh" size={20} />}
              onClick={onUpdate}
              size="small"
              variant="tonal"
            >
              {updating ? 'Wird neu geladen …' : 'Jetzt neu laden'}
            </AppButton>
          </div>
        )}
        icon={<Icon name="refresh" size={24} />}
        title="Neue Version verfügbar"
        tone={error ? 'warning' : 'info'}
      >
        <p>{error ?? 'accura wurde aktualisiert. Lade die App neu, um die neue Version zu verwenden.'}</p>
      </InlineNotice>
    </div>
  );
}

export function PwaUpdateNotice() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activationTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (activationTimer.current !== null) window.clearTimeout(activationTimer.current);
  }, []);

  const dismiss = () => {
    setError(null);
    setNeedRefresh(false);
  };

  const update = async () => {
    if (activationTimer.current !== null) window.clearTimeout(activationTimer.current);
    setError(null);
    setUpdating(true);
    try {
      await updateServiceWorker(true);
      activationTimer.current = window.setTimeout(() => {
        activationTimer.current = null;
        setUpdating(false);
        setError(activationError);
      }, ACTIVATION_TIMEOUT_MS);
    } catch {
      setUpdating(false);
      setError(activationError);
    }
  };

  return (
    <PwaUpdateNoticeView
      error={error}
      needRefresh={needRefresh}
      onDismiss={dismiss}
      onUpdate={() => { void update(); }}
      updating={updating}
    />
  );
}
