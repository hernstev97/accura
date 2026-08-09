import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { installFinanceApiMocks, installPickerMock } from '../../scripts/fixtures/anonymous-finance-data.mjs';

type Theme = 'light' | 'dark';
type FinanceDestination = 'overview' | 'budget' | 'debt';
type FinanceState = 'connected' | 'signed-out' | 'no-spreadsheet' | 'validation-error' | 'reconnect';

async function preparePage(page: Page, context: BrowserContext, state: FinanceState | 'offline-empty' = 'connected', theme: Theme = 'light') {
  await context.setOffline(false);
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.removeItem('finance-appearance-v1');
    sessionStorage.clear();
  });
  await installPickerMock(page);
  if (state === 'offline-empty') {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false });
    });
    await page.route('**/api/**', (route) => route.abort('internetdisconnected'));
  } else {
    await installFinanceApiMocks(page, state);
  }
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--color-system-accent-source', '#2F667A');
    document.documentElement.style.setProperty('--color-on-system-accent-source', '#FFFFFF');
  });
  await page.waitForFunction(() => document.fonts.status === 'loaded');
}

async function openDestination(page: Page, destination: FinanceDestination) {
  const headings = { overview: 'Guten Morgen', budget: 'Dein Budget', debt: 'Dein Weg auf null' } as const;
  if (destination !== 'overview') await page.getByRole('button', { name: destination === 'budget' ? 'Budget' : 'Schulden', exact: true }).click();
  await page.getByRole('heading', { name: headings[destination] }).waitFor();
}

async function capture(page: Page, name: string) {
  await expect(page).toHaveScreenshot(name, { fullPage: true });
}

async function expectNoAxeViolations(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations, `${label}: ${JSON.stringify(result.violations, null, 2)}`).toEqual([]);
}

for (const scenario of [
  { name: 'overview-default', destination: 'overview' as const },
  { name: 'overview-detailed', destination: 'overview' as const, interact: async (page: Page) => page.locator('.overview-screen .circular-allocation__button').click() },
  { name: 'budget-categories', destination: 'budget' as const },
  { name: 'budget-necessity', destination: 'budget' as const, interact: async (page: Page) => page.getByRole('tab', { name: 'Notwendigkeit' }).click() },
  { name: 'debt-collapsed', destination: 'debt' as const },
  { name: 'debt-expanded', destination: 'debt' as const, interact: async (page: Page) => page.getByRole('button', { name: 'Verlauf anzeigen' }).click() },
]) {
  test(`412 light ${scenario.name}`, async ({ page, context }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await preparePage(page, context);
    await openDestination(page, scenario.destination);
    await scenario.interact?.(page);
    await capture(page, `412-light-${scenario.name}.png`);
  });
}

for (const scenario of [
  { name: 'signed-out', state: 'signed-out' as const, heading: 'Mit deiner Tabelle verbinden' },
  { name: 'no-spreadsheet', state: 'no-spreadsheet' as const, heading: 'Google-Tabelle auswählen' },
  { name: 'validation-error', state: 'validation-error' as const, heading: 'Tabelle konnte nicht übernommen werden' },
  { name: 'offline-empty', state: 'offline-empty' as const, heading: 'Noch kein lokaler Datenstand' },
]) {
  test(`412 light state ${scenario.name}`, async ({ page, context }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await preparePage(page, context, scenario.state);
    await page.getByRole('heading', { name: scenario.heading }).waitFor();
    await capture(page, `412-light-state-${scenario.name}.png`);
  });
}

test('412 light info dialog', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context);
  await page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  await page.getByLabel('Informationen öffnen').click();
  await page.getByRole('dialog', { name: 'Informationen' }).waitFor();
  await capture(page, '412-light-info-dialog.png');
});

test('412 light disconnect confirmation', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context);
  await page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  await page.getByLabel('Informationen öffnen').click();
  await page.getByRole('button', { name: /Google-Verbindung trennen/ }).click();
  await page.getByText('Google-Verbindung trennen?').waitFor();
  await capture(page, '412-light-disconnect-confirmation.png');
});

for (const scenario of [
  { name: 'overview', destination: 'overview' as const },
  { name: 'budget', destination: 'budget' as const },
  { name: 'debt', destination: 'debt' as const },
]) {
  test(`412 dark ${scenario.name}`, async ({ page, context }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await preparePage(page, context, 'connected', 'dark');
    await openDestination(page, scenario.destination);
    await capture(page, `412-dark-${scenario.name}.png`);
  });
}

test('412 dark validation error', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context, 'validation-error', 'dark');
  await page.getByRole('heading', { name: 'Tabelle konnte nicht übernommen werden' }).waitFor();
  await capture(page, '412-dark-validation-error.png');
});

test('412 dark info dialog', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context, 'connected', 'dark');
  await page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  await page.getByLabel('Informationen öffnen').click();
  await page.getByRole('dialog', { name: 'Informationen' }).waitFor();
  await capture(page, '412-dark-info-dialog.png');
});

for (const viewport of [{ width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
  for (const theme of viewport.width === 1440 ? (['light', 'dark'] as const) : (['light'] as const)) {
    for (const destination of ['overview', 'budget', 'debt'] as const) {
      test(`${viewport.width} ${theme} ${destination}`, async ({ page, context }) => {
        await page.setViewportSize(viewport);
        await preparePage(page, context, 'connected', theme);
        await openDestination(page, destination);
        await capture(page, `${viewport.width}-${theme}-${destination}.png`);
      });
    }
  }
}

test('WCAG AA finance screens', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context);
  for (const destination of ['overview', 'budget', 'debt'] as const) {
    await openDestination(page, destination);
    await expectNoAxeViolations(page, destination);
  }
});

test('WCAG AA connection states and dialogs', async ({ browser }) => {
  for (const state of ['signed-out', 'no-spreadsheet', 'validation-error', 'reconnect', 'offline-empty'] as const) {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'de-DE', serviceWorkers: 'block' });
    const page = await context.newPage();
    await preparePage(page, context, state);
    await expectNoAxeViolations(page, state);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'de-DE', serviceWorkers: 'block' });
  const page = await context.newPage();
  await preparePage(page, context);
  await page.getByLabel('Informationen öffnen').click();
  await page.getByRole('dialog', { name: 'Informationen' }).waitFor();
  await expectNoAxeViolations(page, 'Info-Dialog');
  await page.getByRole('button', { name: /Google-Verbindung trennen/ }).click();
  await expectNoAxeViolations(page, 'Disconnect-Dialog');
  await context.close();
});
