import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { installFinanceApiMocks, installPickerMock } from '../../scripts/fixtures/anonymous-finance-data.mjs';

type Theme = 'light' | 'dark';
type FinanceDestination = 'overview' | 'budget' | 'debt';
type FinanceState = 'connected' | 'signed-out' | 'no-spreadsheet' | 'validation-error' | 'reconnect';
const defaultVisualTime = new Date('2026-08-09T06:00:00Z');
const overviewHeading = /^(?:Guten Morgen|Guten Tag|Guten Abend|Gute Nacht)$/;

async function preparePage(
  page: Page,
  context: BrowserContext,
  state: FinanceState | 'offline-empty' = 'connected',
  theme: Theme = 'light',
  fixGreetingTime = false,
) {
  if (fixGreetingTime) await page.clock.setFixedTime(defaultVisualTime);
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
  const headings = { overview: overviewHeading, budget: 'Dein Budget', debt: 'Dein Weg auf null' } as const;
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

async function expectCompactHeroRingBesideCopy(page: Page, destination: 'overview' | 'budget') {
  const geometry = await page.locator(`.${destination}-screen .financial-hero`).evaluate((hero) => {
    const content = hero.querySelector('.financial-hero__content')?.getBoundingClientRect();
    const ringElement = hero.querySelector('.circular-allocation');
    const ring = ringElement?.getBoundingClientRect();
    const centerValue = hero.querySelector('.circular-allocation__center strong');
    const arcIds = [...(ringElement?.querySelectorAll('.circular-allocation__arc[data-allocation-id]') ?? [])]
      .map((arc) => arc.getAttribute('data-allocation-id'));
    return {
      arcIds,
      endCaps: [...(ringElement?.querySelectorAll('[data-allocation-end-cap]') ?? [])].map((cap) => ({
        id: cap.getAttribute('data-allocation-end-cap'),
        overlays: cap.getAttribute('data-overlays-allocation-id'),
        shape: cap.getAttribute('data-overlay-shape'),
      })),
      contentRight: content?.right ?? 0,
      ringLeft: ring?.left ?? 0,
      ringWidth: ring?.width ?? 0,
      centerWhiteSpace: centerValue ? getComputedStyle(centerValue).whiteSpace : '',
    };
  });
  expect(geometry.ringLeft).toBeGreaterThanOrEqual(geometry.contentRight - 0.5);
  expect(geometry.ringWidth).toBeGreaterThanOrEqual(164);
  expect(geometry.centerWhiteSpace).toBe('nowrap');
  expect(geometry.endCaps).toEqual(geometry.arcIds.length > 1 ? geometry.arcIds.map((id, index, arcIds) => ({
    id,
    overlays: arcIds[(index + 1) % arcIds.length],
    shape: 'full-circle',
  })) : []);
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
    await preparePage(page, context, 'connected', 'light', scenario.destination === 'overview');
    await openDestination(page, scenario.destination);
    await scenario.interact?.(page);
    if (scenario.destination === 'overview' || scenario.destination === 'budget') {
      await expectCompactHeroRingBesideCopy(page, scenario.destination);
    }
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

test('overview greeting follows the local device time', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context, 'connected', 'light', true);

  for (const { time, greeting } of [
    { time: '2026-08-09T02:00:00Z', greeting: 'Gute Nacht' },
    { time: '2026-08-09T06:00:00Z', greeting: 'Guten Morgen' },
    { time: '2026-08-09T12:00:00Z', greeting: 'Guten Tag' },
    { time: '2026-08-09T18:00:00Z', greeting: 'Guten Abend' },
    { time: '2026-08-09T21:00:00Z', greeting: 'Gute Nacht' },
  ]) {
    await page.clock.setFixedTime(new Date(time));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('heading', { name: greeting })).toBeVisible();
  }

  await page.clock.setSystemTime(new Date('2026-08-09T08:59:59Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'Guten Morgen' })).toBeVisible();
  await page.clock.fastForward(1_000);
  await expect(page.getByRole('heading', { name: 'Guten Tag' })).toBeVisible();
});

test('412 light info dialog', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context, 'connected', 'light', true);
  await page.getByRole('heading', { name: 'Guten Morgen' }).waitFor();
  await page.getByLabel('Informationen öffnen').click();
  await page.getByRole('dialog', { name: 'Informationen' }).waitFor();
  await capture(page, '412-light-info-dialog.png');
});

test('412 light disconnect confirmation', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await preparePage(page, context, 'connected', 'light', true);
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
    await preparePage(page, context, 'connected', 'dark', scenario.destination === 'overview');
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
  await preparePage(page, context, 'connected', 'dark', true);
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
        await preparePage(page, context, 'connected', theme, destination === 'overview');
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
