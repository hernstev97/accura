import { Fragment, type CSSProperties } from 'react';
import {
  compactCurrencyFormatter,
  currencyFormatter,
  formatCurrencyCents,
  formatCurrencyCentsParts,
  formatCurrencyParts,
  maskMoneyShape,
} from '../lib/format';
import { usePrivacy } from '../privacy/PrivacyProvider';

type MoneyValueOptions = {
  compact?: boolean;
  className?: string;
  maskedPlaceholder?: string;
};

export type MoneyValueProps = MoneyValueOptions & (
  | { value: number; valueCents?: never }
  | { value?: never; valueCents: number }
);

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

function CurrencyParts({ parts }: { parts: Intl.NumberFormatPart[] }) {
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

export function MoneyValue({ value, valueCents, compact = false, className = '', maskedPlaceholder }: MoneyValueProps) {
  const { privacyMode } = usePrivacy();
  const usesCents = valueCents !== undefined;
  const resolvedValue = usesCents ? valueCents / 100 : value;
  const exactParts = usesCents ? formatCurrencyCentsParts(valueCents) : formatCurrencyParts(resolvedValue, false);
  const visibleParts = compact
    ? usesCents ? formatCurrencyCentsParts(valueCents, true) : formatCurrencyParts(resolvedValue, true)
    : exactParts;
  const exactFormatted = usesCents ? formatCurrencyCents(valueCents) : currencyFormatter.format(resolvedValue);
  const visibleFormatted = compact ? compactCurrencyFormatter.format(resolvedValue) : exactFormatted;

  if (privacyMode) {
    const maskedParts = visibleParts.map((part) => ({ ...part, value: maskMoneyShape(part.value) }));

    return (
      <span
        className={`money-value money-value--masked ${className}`.trim()}
        style={createMoneyValueStyle(visibleFormatted)}
      >
        <span className="sr-only">Betrag ausgeblendet</span>
        <span aria-hidden="true" className="money-value__blur">
          {maskedPlaceholder ?? <CurrencyParts parts={maskedParts} />}
        </span>
      </span>
    );
  }

  const negative = usesCents ? valueCents < 0 : resolvedValue < 0;
  const resolvedClassName = `money-value ${negative ? 'money-value--negative' : ''} ${className}`.trim();
  return (
    <span
      className={resolvedClassName}
      style={createMoneyValueStyle(visibleFormatted)}
    >
      {compact ? (
        <><span className="sr-only">{exactFormatted}</span><span aria-hidden="true"><CurrencyParts parts={visibleParts} /></span></>
      ) : <CurrencyParts parts={exactParts} />}
    </span>
  );
}
