import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { currencyFormatter } from '../lib/format';
import { PrivacyProvider } from '../privacy/PrivacyProvider';
import { MoneyValue } from './MoneyValue';

function renderMoney(value: number, { compact = false, privacy = false } = {}) {
  return renderToStaticMarkup(
    <PrivacyProvider initialEnabled={privacy}>
      <MoneyValue compact={compact} value={value} />
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

  it('keeps the exact value as the accessible name when the visible value is compact', () => {
    const value = 123_456_789.01;
    const markup = renderMoney(value, { compact: true });

    expect(markup).toContain(`aria-label="${currencyFormatter.format(value)}"`);
    expect(markup).toContain('aria-hidden="true"');
    expect(visibleText(markup)).not.toBe(currencyFormatter.format(value));
  });

  it('does not expose a negative amount or negative-state class in Privacy Mode', () => {
    const markup = renderMoney(-98_765_432.1, { privacy: true });

    expect(markup).toContain('aria-label="Betrag ausgeblendet"');
    expect(markup).not.toContain(currencyFormatter.format(-98_765_432.1));
    expect(markup).not.toContain('money-value--negative');
  });
});
