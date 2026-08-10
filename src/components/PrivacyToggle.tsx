import { usePrivacy } from '../privacy/PrivacyProvider';
import { AppButton } from './AppButton';
import { Icon } from './Icon';

export function PrivacyToggle() {
  const { privacyMode, togglePrivacyMode } = usePrivacy();

  return (
    <AppButton
      aria-label={privacyMode ? 'Beträge anzeigen' : 'Beträge ausblenden'}
      aria-pressed={privacyMode}
      className="icon-button icon-button--contextual"
      iconOnly
      onClick={togglePrivacyMode}
      variant="text"
    >
      <Icon name={privacyMode ? 'eyeOff' : 'eye'} />
    </AppButton>
  );
}
