import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PrivacyProvider } from './PrivacyProvider';
import { applyPrivacyToDocument, readStoredPrivacy, writeStoredPrivacy, PRIVACY_STORAGE_KEY } from './privacyStore';
import { MoneyValue } from '../components/MoneyValue';
import { PrivacyToggle } from '../components/PrivacyToggle';
import { OverviewScreen } from '../screens/OverviewScreen';
import { UpcomingScreen } from '../screens/UpcomingScreen';
import { BudgetScreen } from '../screens/BudgetScreen';
import { DebtScreen } from '../screens/DebtScreen';
import { FinanceDataProvider } from '../data/FinanceDataProvider';
import { validateFinanceWorkbook } from '../finance/parser';
import { anonymousWorkbook } from '../mocks/anonymousWorkbook';
import type { FinanceApi } from '../data/financeApi';
import type { TabularWorkbook } from '../finance/types';

const parsed = validateFinanceWorkbook(anonymousWorkbook as TabularWorkbook);
if (!parsed.success) throw new Error('Anonymous workbook is invalid');
const baseData = parsed.data;

const visibleText = (markup: string) => markup.replace(/<!-- -->|<[^>]+>/g, '');

const mockApi: FinanceApi = {
  getSession: async () => ({ authenticated: false }),
  getFinance: async () => { throw new Error('not implemented'); },
  getPickerConfig: async () => { throw new Error('not implemented'); },
  saveSpreadsheet: async () => { throw new Error('not implemented'); },
  logout: async () => {},
  disconnect: async () => {},
};

function TestWrapper({ children, privacyEnabled = true }: { children: React.ReactNode; privacyEnabled?: boolean }) {
  const initialState = {
    authState: 'authenticated' as const,
    connectionState: 'connected' as const,
    syncState: 'idle' as const,
    email: 'user@example.test',
    csrfToken: 'token',
    spreadsheet: { id: 'mock-id', name: 'Mock Sheet' },
    data: baseData,
    lastSuccessfulRefresh: '2026-08-08T10:00:00Z',
    stale: false,
    error: null,
    pickerOpen: false,
  };

  return (
    <PrivacyProvider initialEnabled={privacyEnabled}>
      <FinanceDataProvider api={mockApi} initialState={initialState}>
        {children}
      </FinanceDataProvider>
    </PrivacyProvider>
  );
}

describe('ACC-62 Privacy Mode', () => {
  it('1. Privacy Mode hides amounts and displays masked shape placeholder and accessible label', () => {
    const html = renderToString(
      <PrivacyProvider initialEnabled={true}>
        <MoneyValue value={1234.56} />
      </PrivacyProvider>
    );
    expect(html).toContain('aria-label="Betrag ausgeblendet"');
    expect(html).toContain('money-value--masked');
    expect(html).toContain('t.zeh,sb');
    expect(html).not.toContain('1.234,56');
  });

  it('2. Disabling Privacy Mode restores original formatted amounts immediately', () => {
    const html = renderToString(
      <PrivacyProvider initialEnabled={false}>
        <MoneyValue value={1234.56} />
      </PrivacyProvider>
    );
    expect(visibleText(html)).toContain('1.234,56');
    expect(html).not.toContain('money-value--masked');
    expect(html).not.toContain('Betrag ausgeblendet');
  });

  it('3. State remains active and persisted state survives reload/reinitialization', () => {
    const memoryStorage = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => memoryStorage.get(k) ?? null,
      setItem: (k: string, v: string) => { memoryStorage.set(k, v); },
      removeItem: (k: string) => { memoryStorage.delete(k); },
    };

    expect(readStoredPrivacy(mockStorage)).toBe(false);
    writeStoredPrivacy(true, mockStorage);
    expect(memoryStorage.get(PRIVACY_STORAGE_KEY)).toBe('true');
    expect(readStoredPrivacy(mockStorage)).toBe(true);

    writeStoredPrivacy(false, mockStorage);
    expect(memoryStorage.get(PRIVACY_STORAGE_KEY)).toBe('false');
    expect(readStoredPrivacy(mockStorage)).toBe(false);
  });

  it('4. applyPrivacyToDocument sets document dataset attribute synchronously', () => {
    const fakeDocument = {
      documentElement: {
        dataset: {} as Record<string, string>,
      },
    } as unknown as Document;

    applyPrivacyToDocument(true, fakeDocument);
    expect(fakeDocument.documentElement.dataset.privacyMode).toBe('true');

    applyPrivacyToDocument(false, fakeDocument);
    expect(fakeDocument.documentElement.dataset.privacyMode).toBeUndefined();
  });

  it('5. Übersicht (OverviewScreen) does not expose raw monetary amounts when Privacy Mode is active', () => {
    const html = renderToString(
      <TestWrapper privacyEnabled={true}>
        <OverviewScreen />
      </TestWrapper>
    );
    // Raw sensitive numbers from anonymousWorkbook: monthly_income 2591.32, cash 1350.75, planned 450.25, free 790.32
    expect(html).not.toContain('2.591,32');
    expect(html).not.toContain('1.350,75');
    expect(html).not.toContain('450,25');
    expect(html).not.toContain('1.200,25');
    expect(html).toContain('Betrag ausgeblendet');
  });

  it('6. Demnächst (UpcomingScreen) does not expose raw monetary amounts when Privacy Mode is active', () => {
    const html = renderToString(
      <TestWrapper privacyEnabled={true}>
        <UpcomingScreen />
      </TestWrapper>
    );
    // SafeToSpend 1030.53, TotalPending 320.22, DKB 220.22, Insurance 100
    expect(html).not.toContain('1.030,53');
    expect(html).not.toContain('320,22');
    expect(html).not.toContain('220,22');
    expect(html).toContain('Betrag ausgeblendet');
  });

  it('7. Budget (BudgetScreen) does not expose raw monetary amounts when Privacy Mode is active', () => {
    const html = renderToString(
      <TestWrapper privacyEnabled={true}>
        <BudgetScreen />
      </TestWrapper>
    );
    expect(html).not.toContain('2.591,32');
    expect(html).not.toContain('450,25');
    expect(html).toContain('Betrag ausgeblendet');
  });

  it('8. Schulden (DebtScreen) does not expose raw monetary amounts when Privacy Mode is active', () => {
    const html = renderToString(
      <TestWrapper privacyEnabled={true}>
        <DebtScreen />
      </TestWrapper>
    );
    // PayoffToday 4800, DKB 4800
    expect(html).not.toContain('4.800,00');
    expect(html).toContain('Betrag ausgeblendet');
  });

  it('9. Hidden amounts are not leaked through accessibility labels, aria-describedby, or sr-only text', () => {
    const overviewHtml = renderToString(
      <TestWrapper privacyEnabled={true}>
        <OverviewScreen />
      </TestWrapper>
    );
    const budgetHtml = renderToString(
      <TestWrapper privacyEnabled={true}>
        <BudgetScreen />
      </TestWrapper>
    );
    const debtHtml = renderToString(
      <TestWrapper privacyEnabled={true}>
        <DebtScreen />
      </TestWrapper>
    );

    expect(overviewHtml).not.toMatch(/\d+\.\d{3},\d{2}\s*€/);
    expect(budgetHtml).not.toMatch(/\d+\.\d{3},\d{2}\s*€/);
    expect(debtHtml).not.toMatch(/\d+\.\d{3},\d{2}\s*€/);
  });

  it('10. The toggle button exposes state-dependent accessible labels and aria-pressed semantics', () => {
    const offHtml = renderToString(
      <PrivacyProvider initialEnabled={false}>
        <PrivacyToggle />
      </PrivacyProvider>
    );
    expect(offHtml).toContain('aria-label="Beträge ausblenden"');
    expect(offHtml).toContain('aria-pressed="false"');

    const onHtml = renderToString(
      <PrivacyProvider initialEnabled={true}>
        <PrivacyToggle />
      </PrivacyProvider>
    );
    expect(onHtml).toContain('aria-label="Beträge anzeigen"');
    expect(onHtml).toContain('aria-pressed="true"');
  });
});
