export const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const compactCurrencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const percentFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const formatCurrency = (value: number) => currencyFormatter.format(value);

export const formatCurrencyParts = (value: number, compact = false) =>
  (compact ? compactCurrencyFormatter : currencyFormatter).formatToParts(value);

export const formatCurrencyValue = (value: number, privacyMode = false, compact = false) => {
  if (privacyMode) return 'Betrag ausgeblendet';
  return compact ? compactCurrencyFormatter.format(value) : currencyFormatter.format(value);
};

const DIGIT_SHAPES: Record<string, string> = {
  '0': 'o',
  '1': 't',
  '2': 'z',
  '3': 'e',
  '4': 'h',
  '5': 's',
  '6': 'b',
  '7': 'f',
  '8': 'B',
  '9': 'g',
};

export function maskMoneyShape(formatted: string): string {
  return formatted.replace(/\d/g, (digit) => DIGIT_SHAPES[digit] ?? 'x');
}

