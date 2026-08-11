import { Fragment, type CSSProperties } from 'react';
import { compactCurrencyFormatter, currencyFormatter, formatCurrencyParts, maskMoneyShape } from '../lib/format';
import { usePrivacy } from '../privacy/PrivacyProvider';

export type MoneyValueProps = {
  value: number;
  compact?: boolean;
  className?: string;
  maskedPlaceholder?: string;
};

type MoneyValueStyle = CSSProperties & {
  '--money-value-fit-size': string;
  '--money-value-hero-fit-size': string;
};

function createMoneyValueStyle(formatted: string): MoneyValueStyle {
  const estimatedWidthEm = Array.from(formatted).reduce((width, character) => {
    if (/\d/.test(character)) return width + 0.54;
    if (character === '.' || character === ',') return width + 0.24;
    if (/\s/.test(character)) return width + 0.25;
    if (character === '-' || character === '−' || character === '+') return width + 0.35;
    return width + 0.58;
  }, 0);

  const resolvedWidthEm = Math.max(estimatedWidthEm, 1);
  return {
    '--money-value-fit-size': `${(84 / resolvedWidthEm).toFixed(3)}cqi`,
    '--money-value-hero-fit-size': `${(92 / resolvedWidthEm).toFixed(3)}cqi`,
  };
}

function CurrencyParts({ compact, value }: { compact: boolean; value: number }) {
  const parts = formatCurrencyParts(value, compact);

  return parts.map((part, index) => {
    const nextPart = parts[index + 1];
    const breakAfter = part.type === 'group';
    const breakBefore = part.type === 'literal' && nextPart?.type === 'currency';
    return (
      <Fragment key={`${part.type}-${index}`}>
        {breakBefore ? <wbr /> : null}
        {part.value}
        {breakAfter ? <wbr /> : null}
      </Fragment>
    );
  });
}

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
        style={createMoneyValueStyle(formatted)}
      >
        <span aria-hidden="true" className="money-value__blur">
          {placeholder}
        </span>
      </span>
    );
  }

  const exactFormatted = currencyFormatter.format(value);
  const visibleFormatted = compact ? compactCurrencyFormatter.format(value) : exactFormatted;
  const resolvedClassName = `money-value ${value < 0 ? 'money-value--negative' : ''} ${className}`.trim();
  return (
    <span
      aria-label={compact ? exactFormatted : undefined}
      className={resolvedClassName}
      role={compact ? 'text' : undefined}
      style={createMoneyValueStyle(visibleFormatted)}
    >
      {compact ? (
        <span aria-hidden="true"><CurrencyParts compact value={value} /></span>
      ) : <CurrencyParts compact={false} value={value} />}
    </span>
  );
}
