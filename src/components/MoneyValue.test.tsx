import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { currencyFormatter, formatCurrencyCents } from '../lib/format';
import { PrivacyProvider } from '../privacy/PrivacyProvider';
import { MoneyValue } from './MoneyValue';

function renderMoney(value: number, { compact = false, privacy = false } = {}) {
  return renderToStaticMarkup(
    <PrivacyProvider initialEnabled={privacy}>
      <MoneyValue compact={compact} value={value} />
    </PrivacyProvider>,
  );
}

function renderMoneyCents(valueCents: number, { compact = false, privacy = false } = {}) {
  return renderToStaticMarkup(
    <PrivacyProvider initialEnabled={privacy}>
      <MoneyValue compact={compact} valueCents={valueCents} />
    </PrivacyProvider>,
  );
}

function visibleText(markup: string) {
  return markup.replace(/<[^>]+>/g, '').replaceAll('&nbsp;', '\u00a0');
}

describe('MoneyValue', () => {
  it.each([123_456_789.01, -98_765_432.1])('keeps the exact localized value for %s', (value) => {
    const markup = renderMoney(value);

    expect(visibleText(markup)).toBe(currencyFormatter.format(value));
    expect(markup).toContain('<wbr/>');
    expect(markup).toMatch(/--money-value-fit-size:[\d.]+cqi/);
    expect(markup).toContain(value < 0 ? 'money-value--negative' : 'money-value');
  });

  it('keeps the exact value as screen-reader text when the visible value is compact', () => {
    const value = 123_456_789.01;
    const markup = renderMoney(value, { compact: true });

    expect(markup).toContain(`<span class="sr-only">${currencyFormatter.format(value)}`);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain('role="text"');
    expect(markup).not.toContain('aria-label=');
  });

  it.each([
    [Number.MAX_SAFE_INTEGER, '90.071.992.547.409,91\u00a0€'],
    [-Number.MAX_SAFE_INTEGER, '-90.071.992.547.409,91\u00a0€'],
    [1, '0,01\u00a0€'],
    [-1, '-0,01\u00a0€'],
    [0, '0,00\u00a0€'],
  ])('formats safe integer cents without losing precision: %s', (valueCents, expected) => {
    const markup = renderMoneyCents(valueCents);

    expect(visibleText(markup)).toBe(expected);
    expect(formatCurrencyCents(valueCents)).toBe(expected);
  });

  it('does not expose a negative amount or negative-state class in Privacy Mode', () => {
    const markup = renderMoney(-98_765_432.1, { privacy: true });

    expect(markup).toContain('<span class="sr-only">Betrag ausgeblendet</span>');
    expect(markup).not.toContain('role="text"');
    expect(markup).not.toContain('aria-label=');
    expect(markup).not.toContain(currencyFormatter.format(-98_765_432.1));
    expect(markup).not.toContain('money-value--negative');
  });
});
