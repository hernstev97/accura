import { compactCurrencyFormatter, currencyFormatter, maskMoneyShape } from '../lib/format';
import { usePrivacy } from '../privacy/PrivacyProvider';

export type MoneyValueProps = {
  value: number;
  compact?: boolean;
  className?: string;
  maskedPlaceholder?: string;
};

export function MoneyValue({ value, compact = false, className = '', maskedPlaceholder }: MoneyValueProps) {
  const { privacyMode } = usePrivacy();

  if (privacyMode) {
    const formatted = compact ? compactCurrencyFormatter.format(value) : currencyFormatter.format(value);
    const defaultPlaceholder = maskMoneyShape(formatted);
    const placeholder = maskedPlaceholder ?? defaultPlaceholder;

    return (
      <span
        aria-label="Betrag ausgeblendet"
        className={`money-value money-value--masked ${className}`.trim()}
        role="text"
      >
        <span aria-hidden="true" className="money-value__blur">
          {placeholder}
        </span>
      </span>
    );
  }

  const formatted = compact ? compactCurrencyFormatter.format(value) : currencyFormatter.format(value);
  return (
    <span className={`money-value ${className}`.trim()}>
      {formatted}
    </span>
  );
}
