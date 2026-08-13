import { usePrivacy } from '../privacy/PrivacyProvider';
import { AppButton } from './AppButton';
import { Icon } from './Icon';

export function PrivacyToggle() {
  const { manualPrivacyMode, togglePrivacyMode } = usePrivacy();

  return (
    <AppButton
      aria-label={manualPrivacyMode ? 'Beträge anzeigen' : 'Beträge ausblenden'}
      aria-pressed={manualPrivacyMode}
      className="icon-button icon-button--contextual"
      iconOnly
      onClick={togglePrivacyMode}
      variant="text"
    >
      <Icon name={manualPrivacyMode ? 'eyeOff' : 'eye'} />
    </AppButton>
  );
}
